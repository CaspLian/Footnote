"""Turn Gemini's displayed answer into text that sounds right when spoken.

Rules this module follows:
- Remove formatting (Markdown, HTML tags, links, citations), never meaning.
  Words such as "not", "may" and "about" are never removed.
- Pauses come from punctuation. Every heading, list item and paragraph ends
  with a sentence mark so the voice pauses there. Extra spaces and blank
  lines are not used to control pauses.
- Symbols that carry meaning are spoken as words: "~5 days" becomes
  "about 5 days" and a cross mark becomes "No:". Decorative emoji are dropped.
- Only unambiguous rewrites. "2026-10-09" becomes "October 9, 2026", but
  "10/09/2026" is left alone because it could mean September or October.
- Numbers and money ("$1,250.50") are left to the voice model. Flash models (the default)
  read them right only with ElevenLabs' number reading on, which config sends for them. For full control,
  have Gemini write a speech_text version with numbers in words (see README).

Known trade-off: a bracketed whole number such as "[3]" is treated as a citation
and removed, because citations are far more common in LLM answers than "[3] options".

This is plain string processing: no network calls and no cost. Every pattern is
bounded, so unusual input (say 50,000 "[" characters) cannot stall the server.
"""

from __future__ import annotations

import html
import json
import logging
import re
from datetime import date
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlsplit

logger = logging.getLogger(__name__)

CODE_BLOCK_NOTE = "A code example is shown on screen."

_PRONUNCIATIONS_FILE = Path(__file__).with_name("pronunciations.json")

# --- Special characters, written by name so they are visible in the source -------------

_VS16 = "\N{VARIATION SELECTOR-16}"  # the invisible "show as emoji" marker, as in a warning sign emoji
_ZWJ = "\N{ZERO WIDTH JOINER}"
_KEYCAP = "\N{COMBINING ENCLOSING KEYCAP}"  # turns "1" into the keycap emoji "1" in a box
_INVISIBLE = "\N{ZERO WIDTH SPACE}\N{ZERO WIDTH NON-JOINER}\N{WORD JOINER}\N{BYTE ORDER MARK}"
_EN_DASH = "\N{EN DASH}"
_BULLET_CHARS = "\N{BULLET}\N{WHITE BULLET}\N{BLACK SMALL SQUARE}\N{TRIANGULAR BULLET}"
_ARROWS = (
    "\N{RIGHTWARDS ARROW}\N{HEAVY WIDE-HEADED RIGHTWARDS ARROW}"
    "\N{HEAVY ROUND-TIPPED RIGHTWARDS ARROW}\N{BLACK RIGHTWARDS ARROW}"
)
_YES_MARKS = "\N{WHITE HEAVY CHECK MARK}\N{HEAVY CHECK MARK}\N{BALLOT BOX WITH CHECK}\N{CHECK MARK}"
_NO_MARKS = "\N{CROSS MARK}\N{HEAVY MULTIPLICATION X}\N{BALLOT X}\N{HEAVY BALLOT X}\N{NO ENTRY SIGN}"
_WARNING_MARK = "\N{WARNING SIGN}"
_EMOJI_RANGES = "\U0001F000-\U0001FAFF\U00002600-\U000027BF\U00002B00-\U00002BFF"
_CURRENCY = "$\N{EURO SIGN}\N{POUND SIGN}\N{YEN SIGN}"
# Direction marks and controls, which Hebrew and Arabic text may carry. They only steer how mixed right-to-left and
# left-to-right text is displayed, so they are kept (the captions show this text), but never hide a sentence's end.
_DIRECTION_MARKS = (
    "\N{LEFT-TO-RIGHT MARK}\N{RIGHT-TO-LEFT MARK}\N{ARABIC LETTER MARK}"
    "\N{LEFT-TO-RIGHT EMBEDDING}\N{RIGHT-TO-LEFT EMBEDDING}\N{POP DIRECTIONAL FORMATTING}"
    "\N{LEFT-TO-RIGHT OVERRIDE}\N{RIGHT-TO-LEFT OVERRIDE}"
    "\N{LEFT-TO-RIGHT ISOLATE}\N{RIGHT-TO-LEFT ISOLATE}\N{FIRST STRONG ISOLATE}\N{POP DIRECTIONAL ISOLATE}"
)
_AT_MOST = "\N{LESS-THAN OR EQUAL TO}"
_AT_LEAST = "\N{GREATER-THAN OR EQUAL TO}"
_ALMOST_EQUAL = "\N{ALMOST EQUAL TO}"
_PLUS_MINUS = "\N{PLUS-MINUS SIGN}"

# --- Whole-text patterns (applied before splitting into blocks) --------------------------
# Quantifiers are bounded and link text may not contain "[", so every pattern runs in
# linear time even on hostile input.

_INVISIBLE_CHARS = re.compile(f"[{_INVISIBLE}]")
_FENCED_CODE = re.compile(r"^[ \t]*(`{3,10}|~{3,10})[^\n]*\n.*?(?:^[ \t]*\1[ \t]*$|\Z)", re.M | re.S)
_SCRIPT_OR_STYLE = re.compile(r"<(script|style)\b[^<>]{0,500}>.*?</\1\s*>", re.I | re.S)
_SUP_CITATION = re.compile(r"<sup>\s*\[?\d{1,4}(?:\s*,\s*\d{1,4}){0,20}\]?\s*</sup>", re.I)
# Known HTML/SSML tags. SSML <break> becomes a sentence end: pauses come from punctuation, and
# ElevenLabs warns that many break tags make speech unstable (v3/v4 do not support them at all).
_HTML_BLOCK_TAG = re.compile(
    r"</?(?:br|p|div|li|ul|ol|tr|td|th|table|blockquote|hr|h[1-6]|break)\b[^<>]{0,500}>", re.I
)
_HTML_INLINE_TAG = re.compile(
    r"</?(?:b|i|u|s|a|em|strong|span|code|small|mark|del|ins|sub|sup|thead|tbody|img|pre"
    r"|speak|phoneme|prosody|emphasis|say-as|lang)\b[^<>]{0,500}>",
    re.I,
)
# Other tags are removed only when a closing tag proves they are tags (<kbd>Ctrl</kbd>), so a
# placeholder such as "<your account number>" or "<name>" keeps its words.
_CLOSING_TAG = re.compile(r"</([A-Za-z][\w-]{0,30})\s*>")
_SELF_CLOSING_TAG = re.compile(r"<[A-Za-z][\w-]{0,30}(?:\s[^<>]{0,500})?/>")
_ANGLE_PLACEHOLDER = re.compile(r"<(?=[A-Za-z])([^<>\n]{1,60}?)(?<=\S)>")
_FOOTNOTE_DEFINITION = re.compile(r"^[ \t]*\[\^[^\[\]\n]{1,40}\]:.*$", re.M)
# "[1]: https://source" lines. Only when a URL follows, so "[Note]: important" is kept.
_REFERENCE_DEFINITION = re.compile(
    r"^[ \t]*\[[^\[\]\n]{1,100}\]:[ \t]+(?:https?://|www\.|/)\S*.*$", re.M | re.I
)
_IMAGE = re.compile(r"!\[[^\[\]\n]{0,300}\]\([^()\n]{0,2000}\)")
_LINK = re.compile(
    r"\[([^\[\]\n]{1,300})\]\((?:[^()\s]{0,2000}(?:\([^()\s]{0,500}\)[^()\s]{0,2000}){0,3})"
    r"(?:\s+\"[^\"\n]{0,300}\")?\)"
)
_REFERENCE_LINK = re.compile(r"\[([^\[\]\n]{1,300})\]\[[^\[\]\n]{0,100}\]")
_URL = re.compile(r"\b(?:https?://|www\.)[^\s<>\"']+", re.I)
# [1]  [1, 2]  [1-3]  [^1]  and Gemini's [cite: 1] / [cite_start] markers.
_CITATION = re.compile(
    rf"\[\^?\d{{1,4}}(?:\s*[,{_EN_DASH}-]\s*\d{{1,4}}){{0,20}}\]"
    r"|\[\^[^\[\]\s]{1,40}\]"
    r"|\[cite(?:_start|_end)?(?::[^\[\]\n]{0,200})?\]",
    re.I,
)

# --- Line patterns -------------------------------------------------------------------------

_HEADING = re.compile(r"^#{1,6}\s+(.*?)\s*#*\s*$")
# "---", "***", "___" and the "=====" line under a title all end the current block.
_HORIZONTAL_RULE = re.compile(r"^(?:[-*_=][ \t]*){3,}$")
_TABLE_SEPARATOR = re.compile(r"^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?$")
_BLOCKQUOTE = re.compile(r"^(?:>[ \t]?)+")
_BULLET = re.compile(rf"^(?:[-*+{_BULLET_CHARS}{_ARROWS}]{_VS16}?|->|=>)[ \t]+(?:\[[ xX]\][ \t]+)?")
_NUMBERED = re.compile(r"^(\d{1,3})[.)][ \t]+")
_KEYCAP_NUMBER = re.compile(rf"^(\d{{1,2}}){_VS16}?{_KEYCAP}[ \t]*")
# Gemini often uses emoji as bullets ("✅ Online booking"), so a line starting with one is a list item.
_EMOJI_BULLET = re.compile(f"^[{_EMOJI_RANGES}]")

# --- Inline patterns -----------------------------------------------------------------------

_INLINE_CODE = re.compile(r"`([^`\n]+)`")
_BOLD = re.compile(r"(\*\*|__)(?=\S)(.+?)(?<=\S)\1")
_ITALIC_STAR = re.compile(r"(?<![\w*])\*(?=\S)([^*\n]+?)(?<=\S)\*(?![\w*])")
_ITALIC_UNDERSCORE = re.compile(r"(?<!\w)_(?=\S)([^_\n]+?)(?<=\S)_(?!\w)")
_STRIKETHROUGH = re.compile(r"~~(?=\S)(.+?)(?<=\S)~~")
_STRAY_STAR = re.compile(r"(?<!\S)\*(?=\S)|(?<=\S)\*(?!\S)")
_PIPE = re.compile(r"\s*\|\s*")

_YES_AT_START = re.compile(rf"^[{_YES_MARKS}]{_VS16}?\s*")
_NO_AT_START = re.compile(rf"^[{_NO_MARKS}]{_VS16}?\s*")
_WARNING_AT_START = re.compile(rf"^{_WARNING_MARK}{_VS16}?\s*")
_YES_AFTER_LABEL = re.compile(rf"(?<=[:?])\s*[{_YES_MARKS}]{_VS16}?")  # "Refundable: ✅"
_YES_INLINE = re.compile(rf"\s*[{_YES_MARKS}]{_VS16}?")
_NO_INLINE = re.compile(rf"\s*[{_NO_MARKS}]{_VS16}?")
_WARNING_INLINE = re.compile(rf"\s*{_WARNING_MARK}{_VS16}?")
_EMOJI = re.compile(f"[{_EMOJI_RANGES}{_VS16}{_ZWJ}{_KEYCAP}]")

_BEFORE_AMOUNT = rf"(?=[\d{_CURRENCY}])"  # followed by a number or a currency sign
# Symbols that change the meaning of a number or a comparison are spoken as words.
_SYMBOLS = [
    (re.compile(r"(?<=\s)&(?=\s)"), "and"),
    (re.compile(rf"\s*(?:[{_ARROWS}]{_VS16}?|->)\s*"), " to "),
    (re.compile(rf"(?<!\w)~\s?{_BEFORE_AMOUNT}"), "about "),
    (re.compile(rf"{_ALMOST_EQUAL}\s?"), "approximately "),
    (re.compile(rf"(?:{_AT_MOST}|(?<![\w<>=-])<=)\s?{_BEFORE_AMOUNT}"), "at most "),
    (re.compile(rf"(?:{_AT_LEAST}|(?<![\w<>=-])>=)\s?{_BEFORE_AMOUNT}"), "at least "),
    (re.compile(rf"(?<=\s)(?:{_AT_MOST}|<=)(?=\s)"), "less than or equal to"),
    (re.compile(rf"(?<=\s)(?:{_AT_LEAST}|>=)(?=\s)"), "greater than or equal to"),
    (re.compile(_AT_MOST), " at most "),
    (re.compile(_AT_LEAST), " at least "),
    (re.compile(rf"(?:{_PLUS_MINUS}|\+/-)\s?"), "plus or minus "),
    (re.compile(rf"(?<![\w<-])<\s?{_BEFORE_AMOUNT}"), "less than "),
    (re.compile(rf"(?<![\w>=-])>\s?{_BEFORE_AMOUNT}"), "more than "),
    (re.compile(r"(?<=\s)<(?=\s)"), "less than"),
    (re.compile(r"(?<=\s)>(?=\s)"), "greater than"),
    # An en dash between numbers is a range: "3–5 days" -> "3 to 5 days".
    # A plain hyphen is left alone because it is also used in IDs and phone numbers.
    (re.compile(rf"(?<=\d)\s?{_EN_DASH}\s?(?=\d)"), " to "),
]

# Abbreviations that speech models often read letter by letter.
_ABBREVIATIONS = [
    (re.compile(r"\b([eE])\.g\.,?"), "for example,"),
    (re.compile(r"\b([iI])\.e\.,?"), "that is,"),
    (re.compile(r"\b([vV])s\.?(?=\s)"), "versus"),
    (re.compile(r"\b([aA])pprox\.(?=\s)"), "approximately"),
]

_ISO_DATE = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b")
_MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

# Full-width marks end sentences in Japanese and Chinese, the danda in Hindi, and Arabic has its own question mark.
_TERMINAL_PUNCTUATION = (
    ".!?:;\N{HORIZONTAL ELLIPSIS}\N{IDEOGRAPHIC FULL STOP}\N{FULLWIDTH EXCLAMATION MARK}\N{FULLWIDTH QUESTION MARK}"
    "\N{DEVANAGARI DANDA}\N{ARABIC QUESTION MARK}"
)
_CLOSING_CHARS = (
    "\"')]}\N{RIGHT DOUBLE QUOTATION MARK}\N{RIGHT SINGLE QUOTATION MARK}"
    "\N{RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK}\N{RIGHT CORNER BRACKET}\N{RIGHT WHITE CORNER BRACKET}"
)


# What a check mark, a cross and a warning sign are spoken as, per language (ISO 639-1; "fil" for Filipino).
MARK_WORDS = {
    "en": ("Yes", "No", "Warning"), "ja": ("はい", "いいえ", "注意"), "zh": ("是", "否", "注意"),
    "de": ("Ja", "Nein", "Achtung"), "hi": ("हाँ", "नहीं", "चेतावनी"), "fr": ("Oui", "Non", "Attention"),
    "ko": ("예", "아니요", "주의"), "pt": ("Sim", "Não", "Atenção"), "it": ("Sì", "No", "Attenzione"),
    "es": ("Sí", "No", "Atención"), "id": ("Ya", "Tidak", "Peringatan"), "nl": ("Ja", "Nee", "Let op"),
    "tr": ("Evet", "Hayır", "Uyarı"), "fil": ("Oo", "Hindi", "Babala"), "pl": ("Tak", "Nie", "Uwaga"),
    "sv": ("Ja", "Nej", "Varning"), "bg": ("Да", "Не", "Внимание"), "ro": ("Da", "Nu", "Atenție"),
    "ar": ("نعم", "لا", "تنبيه"), "cs": ("Ano", "Ne", "Upozornění"), "el": ("Ναι", "Όχι", "Προσοχή"),
    "fi": ("Kyllä", "Ei", "Varoitus"), "hr": ("Da", "Ne", "Upozorenje"), "ms": ("Ya", "Tidak", "Amaran"),
    "sk": ("Áno", "Nie", "Upozornenie"), "da": ("Ja", "Nej", "Advarsel"), "ta": ("ஆம்", "இல்லை", "எச்சரிக்கை"),
    "uk": ("Так", "Ні", "Увага"), "ru": ("Да", "Нет", "Внимание"), "hu": ("Igen", "Nem", "Figyelem"),
    "nb": ("Ja", "Nei", "Advarsel"), "vi": ("Có", "Không", "Cảnh báo"),
    "he": ("כן", "לא", "אזהרה"), "th": ("ใช่", "ไม่ใช่", "คำเตือน"),
}


def _language_base(language: str) -> str:
    base = str(language or "en").strip().replace("_", "-").split("-")[0].lower()
    return {"tl": "fil", "no": "nb", "iw": "he"}.get(base, base)


def prepare_for_speech(text: str, pronunciations: dict[str, str] | None = None, language: str = "en") -> str:
    """Return the text to send to the speech provider. Returns "" if nothing speakable is left.

    `pronunciations` maps exact words to how they should be spelled for the voice,
    e.g. {"Footnote": "Foot note"}. Defaults to pronunciations.json.
    `language` (a locale such as "es-MX", or "es") decides the words spoken for marks. The English-only rewrites
    (symbols such as "~" -> "about", abbreviations, dates with English month names, the code-block note) run only
    for English, so no English word ever lands in another language's reply.
    """
    if not text:
        return ""
    if pronunciations is None:
        pronunciations = load_pronunciations()

    base = _language_base(language)
    english = base == "en"
    text = _normalize_characters(text)
    text = _FENCED_CODE.sub(f"\n\n{CODE_BLOCK_NOTE}\n\n" if english else "\n\n", text)
    text = _SCRIPT_OR_STYLE.sub(" ", text)
    text = _SUP_CITATION.sub("", text)
    text = _HTML_BLOCK_TAG.sub("\n\n", text)  # a block tag ends the sentence
    text = _HTML_INLINE_TAG.sub("", text)
    text = _strip_unknown_tags(text)
    text = html.unescape(text)
    text = _ANGLE_PLACEHOLDER.sub(r"\1", text)
    text = _FOOTNOTE_DEFINITION.sub("", text)
    text = _REFERENCE_DEFINITION.sub("", text)
    text = _IMAGE.sub("", text)
    text = _LINK.sub(_link_text, text)  # before citations, so "[1](url)" goes as a whole
    text = _CITATION.sub("", text)  # before reference links, so "[1][2]" is not read as "1"
    text = _REFERENCE_LINK.sub(r"\1", text)
    text = _URL.sub(_speak_url, text)

    # A check mark next to a cross is a yes/no answer; on its own it is usually decoration.
    speak_check_marks = any(mark in text for mark in _NO_MARKS)

    words = MARK_WORDS.get(base, MARK_WORDS["en"])
    blocks = [_clean_block(block, speak_check_marks, base) for block in _split_blocks(text, words)]
    full_stop = "\N{IDEOGRAPHIC FULL STOP}" if base in ("ja", "zh") else "."
    text = "\n".join(_end_sentence(block, full_stop) for block in blocks if block)
    text = _apply_pronunciations(text, pronunciations)
    return _tidy(text)


@lru_cache(maxsize=1)
def _load_pronunciations_file() -> tuple[tuple[str, str], ...]:
    """Read once per process. A broken file is ignored with a warning instead of breaking all speech."""
    try:
        data = json.loads(_PRONUNCIATIONS_FILE.read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        return ()
    except (OSError, ValueError) as exc:
        logger.warning("Ignoring %s: %s", _PRONUNCIATIONS_FILE.name, exc)
        return ()
    if not isinstance(data, dict):
        logger.warning("Ignoring %s: expected a JSON object", _PRONUNCIATIONS_FILE.name)
        return ()
    return tuple((str(word), str(spoken)) for word, spoken in data.items() if not str(word).startswith("_"))


def load_pronunciations() -> dict[str, str]:
    """The default pronunciations from pronunciations.json (keys starting with "_" are comments)."""
    return dict(_load_pronunciations_file())


# --- Steps ------------------------------------------------------------------------------------


def _normalize_characters(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\N{NO-BREAK SPACE}", " ").replace("\t", " ")
    text = _INVISIBLE_CHARS.sub("", text)
    return re.sub(r" {2,}", " ", text)  # runs of spaces carry no meaning


def _strip_unknown_tags(text: str) -> str:
    names = {name.lower() for name in _CLOSING_TAG.findall(text)}
    if names and len(names) <= 50:
        alternatives = "|".join(re.escape(name) for name in sorted(names))
        text = re.sub(rf"<(?:{alternatives})\b[^<>]{{0,500}}>", " ", text, flags=re.I)
    text = _CLOSING_TAG.sub(" ", text)
    return _SELF_CLOSING_TAG.sub(" ", text)


def _link_text(match: re.Match) -> str:
    label = match.group(1).strip()
    # A link whose label is just a number is a citation, e.g. [1](https://source).
    if re.fullmatch(r"\^?\d+", label):
        return ""
    return label


def _speak_url(match: re.Match) -> str:
    """Replace a URL with its site name: https://www.example.com/a/b -> example.com"""
    url = match.group(0)
    trailing = ""
    while url and url[-1] in ".,;:!?)]}":
        trailing = url[-1] + trailing
        url = url[:-1]
    try:
        host = urlsplit(url if "://" in url else "http://" + url).hostname or ""
    except ValueError:
        host = ""
    host = host.removeprefix("www.")
    return (host or "a link") + trailing


def _split_blocks(text: str, words: tuple[str, str, str] = MARK_WORDS["en"]) -> list[str]:
    """Split into speakable blocks: headings, list items, table rows and paragraphs.

    Consecutive plain lines belong to the same paragraph, so a sentence that
    happens to be wrapped across lines is not broken in two.
    `words` are the yes, no and warning words of the reply's language (MARK_WORDS), for table cells.
    """
    blocks: list[str] = []
    paragraph: list[str] = []

    def finish_paragraph() -> None:
        if paragraph:
            blocks.append(" ".join(paragraph))
            paragraph.clear()

    for raw_line in text.split("\n"):
        line = raw_line.strip()
        if not line or _HORIZONTAL_RULE.match(line) or _TABLE_SEPARATOR.match(line):
            finish_paragraph()
            continue
        line = _BLOCKQUOTE.sub("", line).strip()
        if not line:
            finish_paragraph()
            continue

        heading = _HEADING.match(line)
        if heading:
            finish_paragraph()
            blocks.append(heading.group(1))
        elif _BULLET.match(line):
            finish_paragraph()
            blocks.append(_BULLET.sub("", line, count=1))
        elif _NUMBERED.match(line):
            finish_paragraph()
            blocks.append(_NUMBERED.sub(r"\1. ", line, count=1))
        elif _KEYCAP_NUMBER.match(line):
            finish_paragraph()
            blocks.append(_KEYCAP_NUMBER.sub(r"\1. ", line, count=1))
        elif _EMOJI_BULLET.match(line):
            finish_paragraph()
            blocks.append(line)
        elif "|" in line:  # a table row, with or without the outer pipes
            finish_paragraph()
            cells = [_mark_as_word(cell.strip(), words) for cell in line.strip("|").split("|")]
            blocks.append(", ".join(cell for cell in cells if cell))
        else:
            paragraph.append(line)
    finish_paragraph()
    return blocks


def _mark_as_word(cell: str, words: tuple[str, str, str] = MARK_WORDS["en"]) -> str:
    """A table cell that holds only a check mark or a cross is a yes/no answer, said in the reply's language."""
    bare = cell.replace(_VS16, "").strip()
    if len(bare) == 1 and bare in _YES_MARKS:
        return words[0].lower()
    if len(bare) == 1 and bare in _NO_MARKS:
        return words[1].lower()
    return cell


def _clean_block(block: str, speak_check_marks: bool, language: str = "en") -> str:
    block = _INLINE_CODE.sub(r"\1", block)
    block = _BOLD.sub(r"\2", block)
    block = _ITALIC_STAR.sub(r"\1", block)
    block = _ITALIC_UNDERSCORE.sub(r"\1", block)
    block = _STRIKETHROUGH.sub(r"\1", block)
    block = block.replace("**", "").replace("__", "").replace("`", "")
    block = _STRAY_STAR.sub("", block)
    english = language == "en"
    block = _speak_marks(block.strip(), speak_check_marks, MARK_WORDS.get(language, MARK_WORDS["en"]))
    if english:
        for pattern, words in _SYMBOLS:  # before emoji removal: some arrows are emoji
            block = pattern.sub(words, block)
    block = _EMOJI.sub("", block)
    if english:
        for pattern, words in _ABBREVIATIONS:
            block = pattern.sub(lambda m, words=words: _match_case(m.group(1), words), block)
        block = _ISO_DATE.sub(_speak_iso_date, block)
    # ElevenLabs: characters like [ ] { } "usually result in low quality speech". Keep the words inside.
    block = re.sub(r"[\[\]{}]", "", block)
    block = _PIPE.sub(", ", block).strip(" ,")
    block = re.sub(r"\s+", " ", block).strip()
    # A block that was only symbols or punctuation has nothing to say.
    return block if re.search(r"\w", block) else ""


def _speak_marks(block: str, speak_check_marks: bool, words: tuple[str, str, str] = ("Yes", "No", "Warning")) -> str:
    """A cross is always spoken, because dropping it would flip the meaning of the line.

    A check mark is spoken when it answers something ("Refundable: ✅") or when crosses
    are also present; otherwise ("✅ Step one") it is decoration and is dropped.
    `words` are the yes, no and warning words of the reply's language (MARK_WORDS).
    """
    yes, no, warning = words
    block = _NO_AT_START.sub(_label(no), block)
    block = _NO_INLINE.sub(lambda m: " " + no.lower(), block)
    block = _WARNING_AT_START.sub(_label(warning), block)
    block = _WARNING_INLINE.sub(lambda m: " " + warning.lower(), block)
    block = _YES_AFTER_LABEL.sub(lambda m: " " + yes.lower(), block)
    if speak_check_marks:
        block = _YES_AT_START.sub(_label(yes), block)
        block = _YES_INLINE.sub(lambda m: " " + yes.lower(), block)
    return block


def _label(word: str):
    """Speak a leading mark as "Word: ", unless the line already starts with that word."""

    def replace(match: re.Match) -> str:
        # (?!\w), not \b: Thai, Hindi and Tamil words can end in a vowel sign or tone mark, which is no word character
        already_said = re.match(rf"{re.escape(word)}(?!\w)", match.string[match.end():], re.IGNORECASE)
        return "" if already_said else f"{word}: "

    return replace


def _match_case(first_letter: str, words: str) -> str:
    return words[0].upper() + words[1:] if first_letter.isupper() else words


def _speak_iso_date(match: re.Match) -> str:
    year, month, day = (int(part) for part in match.groups())
    try:
        date(year, month, day)
    except ValueError:
        return match.group(0)
    return f"{_MONTHS[month - 1]} {day}, {year}"


def _end_sentence(block: str, full_stop: str = ".") -> str:
    """Make sure the block ends with punctuation so the voice pauses after it."""
    core = block.rstrip(_CLOSING_CHARS + _DIRECTION_MARKS)
    if core and core[-1] in _TERMINAL_PUNCTUATION:
        return block
    return block + full_stop


def _apply_pronunciations(text: str, pronunciations: dict[str, str]) -> str:
    for word in sorted(pronunciations, key=len, reverse=True):
        text = re.sub(rf"(?<!\w){re.escape(word)}(?!\w)", lambda _: pronunciations[word], text)
    return text


def _tidy(text: str) -> str:
    text = re.sub(r"[ ]{2,}", " ", text)
    text = re.sub(r" +([,.;:!?])", r"\1", text)  # "covered ." -> "covered."
    text = re.sub(r"\(\s*\)", "", text)  # "()" left behind by a removed citation
    text = re.sub(r"[,;](?=[.!?])", "", text)  # "apples,." -> "apples."
    text = re.sub(r"(?<!\.)\.\.(?!\.)", ".", text)  # ".." -> "." but keep "..."
    text = re.sub(r" +\n|\n +", "\n", text)
    return text.strip()
