import json
import re
import time
from collections import Counter
from pathlib import Path

import pytest

from text_to_speech.text_prep import CODE_BLOCK_NOTE, load_pronunciations, prepare_for_speech

MOCKS = json.loads(
    (Path(__file__).parents[1] / "mock_data" / "gemini_responses.json").read_text(encoding="utf-8")
)


def prep(text: str) -> str:
    return prepare_for_speech(text, pronunciations={})


# --- What each mock Gemini answer should sound like ------------------------------------

EXPECTED_MOCK_OUTPUT = {
    "mock-plain": "The museum opens at 9 AM on weekdays and 10 AM on weekends. Entry is free for children under 12.",
    "mock-markdown": (
        "Getting started.\n"
        "Here is what you need to do:\n"
        "Create an account on the official website.\n"
        "Verify your email address.\n"
        "Set a strong password.\n"
        "You can read more at docs.example.com."
    ),
    "mock-numbers": (
        "The total is $1,250.50, due on November 15, 2026. Delivery takes 3 to 5 business days "
        "and costs about $12. Orders over $100 ship free; orders less than $20 may incur a 10% fee."
    ),
    "mock-meaning": (
        "The results are not final and may change.\n"
        "Yes: Online booking.\n"
        "No: Same-day cancellation.\n"
        "The venue reportedly closes early on holidays, but this has not been confirmed."
    ),
    "mock-code": f"To install the tool, run:\n{CODE_BLOCK_NOTE}\nThen restart your terminal.",
    "mock-table": (
        "Plan, Price.\n"
        "Basic, $5 per month.\n"
        "Pro, $15 per month.\n"
        "Both plans include email support, for example, replies within one day."
    ),
    "mock-bill-summary": (
        "Hello, and welcome to ClaimPulse AI, your personal medical billing assistant.\n"
        "I've finished analyzing your hospital bill from Metro Health Hospital, dated September 15, 2026.\n"
        "Your total hospital charge is $4,850.75. After reviewing your insurance statement, "
        "I've identified two potential billing discrepancies.\n"
        "First, your MRI procedure, listed under CPT code 70551, was billed at $3,200. However, our "
        "available pricing benchmark suggests a typical charge of approximately $1,400.\n"
        "Second, your insurance provider appears to have covered only 60% of your emergency room visit. "
        "This may require further review of your insurance policy.\n"
        "Please remember that these findings do not necessarily mean your hospital made a billing error.\n"
        "Would you like me to explain these charges in greater detail, help you prepare a dispute letter, "
        "or connect you with a billing representative?"
    ),
    "mock-empty": "",
}


@pytest.mark.parametrize("mock", MOCKS, ids=[m["request_id"] for m in MOCKS])
def test_mock_answers(mock):
    assert prep(mock["text"]) == EXPECTED_MOCK_OUTPUT[mock["request_id"]]


# --- Meaning must survive cleanup -----------------------------------------------------

MEANING_WORDS = [
    "not", "no", "never", "none", "nor", "cannot", "don't", "doesn't", "isn't", "won't", "can't",
    "may", "might", "could", "possibly", "likely", "unlikely", "reportedly", "allegedly",
    "about", "approximately", "around", "unless", "except", "only", "without", "until",
]

TRICKY_MEANING_TEXT = """\
## **Not** covered
- You may *not* claim this unless the form is signed[1].
- It is **never** refunded, except in rare cases.
- Reportedly, delivery takes ~3 days (about 72 hours) without tracking.
> It isn't final and might change; we can't promise anything.
| Option | Allowed? |
|---|---|
| Late entry | ❌ |
"""


def _word_counts(text: str) -> Counter:
    return Counter(re.findall(r"[a-z']+", text.lower().replace("’", "'")))


@pytest.mark.parametrize(
    "text", [m["text"] for m in MOCKS] + [TRICKY_MEANING_TEXT], ids=[m["request_id"] for m in MOCKS] + ["tricky"]
)
def test_meaning_words_are_never_removed(text):
    before, after = _word_counts(text), _word_counts(prep(text))
    for word in MEANING_WORDS:
        assert after[word] >= before[word], f"{word!r} was removed"


def test_tricky_meaning_text_reads_correctly():
    assert prep(TRICKY_MEANING_TEXT) == (
        "Not covered.\n"
        "You may not claim this unless the form is signed.\n"
        "It is never refunded, except in rare cases.\n"
        "Reportedly, delivery takes about 3 days (about 72 hours) without tracking.\n"
        "It isn't final and might change; we can't promise anything.\n"
        "Option, Allowed?\n"
        "Late entry, no."
    )


@pytest.mark.parametrize("mock", MOCKS, ids=[m["request_id"] for m in MOCKS])
def test_cleaning_twice_changes_nothing(mock):
    once = prep(mock["text"])
    assert " ".join(prep(once).split()) == " ".join(once.split())


# --- Individual rules -------------------------------------------------------------------


@pytest.mark.parametrize(
    "raw, expected",
    [
        # Empty input
        ("", ""),
        ("   \n\n  ", ""),
        ("---\n***", ""),
        # Sentence endings create the pauses
        ("Hello world", "Hello world."),
        ("Is it ready?", "Is it ready?"),
        ("He said \"yes.\"", "He said \"yes.\""),
        ("Next steps (optional)", "Next steps (optional)."),
        ("The order was shipped\nbecause payment cleared.", "The order was shipped because payment cleared."),
        # Markdown
        ("**Bold** and *italic* and __also__ and _this_", "Bold and italic and also and this."),
        ("Use `pip install` now.", "Use pip install now."),
        ("# Title\nBody text.", "Title.\nBody text."),
        ("- one\n- two\n* three\n+ four", "one.\ntwo.\nthree.\nfour."),
        ("- [x] Done task\n- [ ] Open task", "Done task.\nOpen task."),
        ("1. First step\n2) Second step", "1. First step.\n2. Second step."),
        ("> Quoted advice", "Quoted advice."),
        ("~~old~~ new price", "old new price."),
        ("**Unbalanced bold", "Unbalanced bold."),
        ("2 * 3 = 6", "2 * 3 = 6."),
        ("Keep my_variable_name intact", "Keep my_variable_name intact."),
        # Links, URLs and citations
        ("Read [the guide](https://example.com/guide) first.", "Read the guide first."),
        ("Read [the guide][ref] first.\n\n[ref]: https://example.com", "Read the guide first."),
        ("![diagram](https://example.com/a.png) Text", "Text."),
        ("See https://www.example.com/a/b?c=1.", "See example.com."),
        ("(see https://example.com/x)", "(see example.com)."),
        ("Visit www.example.org today", "Visit example.org today."),
        ("Covered [1] and confirmed [2, 3].", "Covered and confirmed."),
        ("Covered.[1][2]", "Covered."),
        ("Covered[^1].\n\n[^1]: Source document", "Covered."),
        ("Covered<sup>1</sup>.", "Covered."),
        ("Covered [1](https://source.example.com).", "Covered."),
        ("[cite_start]The plan covers it.[cite: 4, 7]", "The plan covers it."),
        ("[Note]: this line is content, not a link", "Note: this line is content, not a link."),
        # Brackets lower speech quality (ElevenLabs docs): keep the words, drop the brackets
        ("Option [A] or {B}", "Option A or B."),
        # HTML and SSML
        ("Line one<br>Line two", "Line one.\nLine two."),
        ("<b>Bold</b> text", "Bold text."),
        ("Fish &amp; chips", "Fish and chips."),
        ("Enter <your account number> here.", "Enter your account number here."),
        ("if x > y and a < b", "if x greater than y and a less than b."),
        ('Wait<break time="1.5s" />then go', "Wait.\nthen go."),
        ("<speak>Hello <emphasis>there</emphasis></speak>", "Hello there."),
        # Code
        ("Run:\n```\nrm -rf build\n```\nDone.", f"Run:\n{CODE_BLOCK_NOTE}\nDone."),
        ("Run:\n```python\nprint('unfinished')", f"Run:\n{CODE_BLOCK_NOTE}"),
        # Emoji and marks
        ("Great news 🎉", "Great news."),
        ("✅ Step one\n✅ Step two", "Step one.\nStep two."),
        ("❌ Flood damage", "No: Flood damage."),
        ("Refundable: ❌", "Refundable: no."),
        ("✅ Water\n❌ Flood", "Yes: Water.\nNo: Flood."),
        ("\N{WARNING SIGN}\N{VARIATION SELECTOR-16} Check the date", "Warning: Check the date."),
        ("🎉", ""),
        # Symbols that carry meaning
        ("It takes ~5 days", "It takes about 5 days."),
        ("Roughly ≈ 20% faster", "Roughly approximately 20% faster."),
        ("Orders <$20 pay a fee", "Orders less than $20 pay a fee."),
        ("Orders > 10 items ship free", "Orders more than 10 items ship free."),
        ("You must be ≥ 18", "You must be at least 18."),
        ("Up to ≤ 3 bags", "Up to at most 3 bags."),
        ("Accurate to ± 2 cm", "Accurate to plus or minus 2 cm."),
        ("Accurate to +/- 2 cm", "Accurate to plus or minus 2 cm."),
        ("Terms & Conditions", "Terms and Conditions."),
        ("AT&T", "AT&T."),
        ("Step 1 → Step 2", "Step 1 to Step 2."),
        ("Settings -> Privacy", "Settings to Privacy."),
        ("3–5 days", "3 to 5 days."),
        ("Call 555-1234", "Call 555-1234."),
        # Dates: only unambiguous ones are rewritten
        ("Due 2026-10-09", "Due October 9, 2026."),
        ("Due 2026-02-30", "Due 2026-02-30."),
        ("Due 10/09/2026", "Due 10/09/2026."),
        ("At 2026-10-09T10:00:00Z", "At 2026-10-09T10:00:00Z."),
        # Abbreviations
        ("Fruit, e.g. apples", "Fruit, for example, apples."),
        ("E.g., apples", "For example, apples."),
        ("Soon, i.e. tomorrow", "Soon, that is, tomorrow."),
        ("Cats vs. dogs", "Cats versus dogs."),
        ("Cats vs dogs", "Cats versus dogs."),
        ("It costs approx. $5", "It costs approximately $5."),
        # Whitespace and invisible characters
        ("Too    many   spaces", "Too many spaces."),
        ("Non\N{NO-BREAK SPACE}breaking\N{ZERO WIDTH SPACE} space", "Non breaking space."),
        ("Windows\r\nline endings", "Windows line endings."),
    ],
)
def test_rules(raw, expected):
    assert prep(raw) == expected


def test_pronunciations_are_whole_word_and_case_sensitive():
    sounds = {"ClaimPulse": "Claim Pulse"}
    assert prepare_for_speech("ClaimPulse works", sounds) == "Claim Pulse works."
    assert prepare_for_speech("ClaimPulsed and claimpulse", sounds) == "ClaimPulsed and claimpulse."


def test_default_pronunciations_file_is_loaded_and_comments_skipped():
    sounds = load_pronunciations()
    assert sounds.get("ClaimPulse") == "Claim Pulse"
    assert not any(key.startswith("_") for key in sounds)
    assert prepare_for_speech("ClaimPulse") == "Claim Pulse."


def test_pronunciation_alias_is_inserted_literally():
    alias = "C" + chr(92) + "1"  # a backslash must not be read as a regex group reference
    assert prepare_for_speech("Use X now", {"X": alias}) == f"Use {alias} now."


@pytest.fixture
def pronunciations_file(monkeypatch, tmp_path):
    import text_to_speech.text_prep as text_prep

    path = tmp_path / "pronunciations.json"
    monkeypatch.setattr(text_prep, "_PRONUNCIATIONS_FILE", path)
    text_prep._load_pronunciations_file.cache_clear()
    yield path
    text_prep._load_pronunciations_file.cache_clear()


def test_broken_pronunciations_file_is_ignored_not_fatal(pronunciations_file, caplog):
    pronunciations_file.write_text("{not json", encoding="utf-8")
    assert prepare_for_speech("ClaimPulse works") == "ClaimPulse works."
    assert "Ignoring pronunciations.json" in caplog.text


def test_pronunciations_file_saved_with_bom_still_loads(pronunciations_file):
    pronunciations_file.write_text('\N{BYTE ORDER MARK}{"ClaimPulse": "Claim Pulse"}', encoding="utf-8")
    assert prepare_for_speech("ClaimPulse works") == "Claim Pulse works."


# --- Fixes from the adversarial review (2026-10-09) -------------------------------------

YES = "\N{WHITE HEAVY CHECK MARK}"
NO = "\N{CROSS MARK}"
VS16 = "\N{VARIATION SELECTOR-16}"
KEYCAP = "\N{COMBINING ENCLOSING KEYCAP}"


@pytest.mark.parametrize(
    "raw, expected",
    [
        # Unknown HTML tags are removed only when a closing tag proves they are tags
        ("Press <kbd>Ctrl</kbd>+<kbd>Z</kbd> to undo.", "Press Ctrl + Z to undo."),
        ("<details><summary>More</summary>Hidden text</details>", "More Hidden text."),
        ("<script>alert(1)</script>Hi", "Hi."),
        ("Hello <name>, your <account number> is ready.", "Hello name, your account number is ready."),
        ("Go to <https://example.com/> now.", "Go to example.com now."),
        # A check mark that answers something is spoken; a decorative one is not
        (f"Refundable: {YES}", "Refundable: yes."),
        (f"Covered? {YES}", "Covered? yes."),
        (f"Result {YES}", "Result."),
        (
            f"| Name | Covered? |\n|:--|:--:|\n| Fire | {YES} |\n| Flood | {NO} |",
            "Name, Covered?\nFire, yes.\nFlood, no.",
        ),
        # The mark's word is not said twice
        (f"{YES} Yes, you can.\n{NO} No, you can't.", "Yes, you can.\nNo, you can't."),
        (f"{NO} Not covered", "No: Not covered."),
        # More list and table shapes
        (f"1{VS16}{KEYCAP} First\n2{VS16}{KEYCAP} Second", "1. First.\n2. Second."),
        ("Title\n=====\nBody", "Title.\nBody."),
        ("Column a | Column b\n--- | ---\n1 | 2", "Column a, Column b.\n1, 2."),
        ("\N{RIGHTWARDS ARROW} Call the office", "Call the office."),
        (f"\N{BLACK RIGHTWARDS ARROW}{VS16} Next steps", "Next steps."),
        ("-> Option A", "Option A."),
        ("Step 1 \N{HEAVY WIDE-HEADED RIGHTWARDS ARROW} Step 2", "Step 1 to Step 2."),
        # Comparisons
        ("Use >= 18 years.", "Use at least 18 years."),
        ("Use <= 3 bags.", "Use at most 3 bags."),
        ("if x >= y then", "if x greater than or equal to y then."),
        ("x\N{LESS-THAN OR EQUAL TO}y", "x at most y."),
        # Known trade-off (documented): a bracketed whole number is treated as a citation
        ("There are [3] options.", "There are options."),
    ],
)
def test_review_fixes(raw, expected):
    assert prep(raw) == expected


@pytest.mark.parametrize(
    "hostile",
    ["[" * 50_000, "[^" * 25_000, "[cite" * 10_000, "~" * 50_000, "<a" * 25_000, "**a" * 16_000, "| " * 25_000],
    ids=["brackets", "footnotes", "cite", "tildes", "angles", "bold", "pipes"],
)
def test_hostile_input_is_handled_quickly(hostile):
    started = time.perf_counter()
    prep(hostile)
    assert time.perf_counter() - started < 2.0  # "[" * 50_000 took over 20 s before patterns were bounded
