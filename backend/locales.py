"""The languages ClaimPulse answers and speaks in: the 32 languages ElevenLabs Flash v2.5 speaks, as 39 locales.

One list for the whole backend. Gemini writes in the locale's language and regional variant, speech-to-text gets the
language as a hint, and text-to-speech speaks it (services/audio_service/text_to_speech/config.py lists what each
voice model speaks). Clients send a locale such as "pt-BR". A bare language such as "pt", or an older code such as
"tl", means the language's default locale. Anything else is refused, so an unsupported language never reaches
Gemini or ElevenLabs.
"""

LOCALES: dict[str, str] = {
    "en-US": "English (United States)",
    "en-GB": "English (United Kingdom)",
    "en-AU": "English (Australia)",
    "en-CA": "English (Canada)",
    "ja-JP": "Japanese",
    "zh-CN": "Chinese (Mandarin, Simplified)",
    "de-DE": "German",
    "hi-IN": "Hindi",
    "fr-FR": "French (France)",
    "fr-CA": "French (Canada)",
    "ko-KR": "Korean",
    "pt-BR": "Portuguese (Brazil)",
    "pt-PT": "Portuguese (Portugal)",
    "it-IT": "Italian",
    "es-ES": "Spanish (Spain)",
    "es-MX": "Spanish (Mexico)",
    "id-ID": "Indonesian",
    "nl-NL": "Dutch",
    "tr-TR": "Turkish",
    "fil-PH": "Filipino",
    "pl-PL": "Polish",
    "sv-SE": "Swedish",
    "bg-BG": "Bulgarian",
    "ro-RO": "Romanian",
    "ar-SA": "Arabic (Saudi Arabia)",
    "ar-AE": "Arabic (United Arab Emirates)",
    "cs-CZ": "Czech",
    "el-GR": "Greek",
    "fi-FI": "Finnish",
    "hr-HR": "Croatian",
    "ms-MY": "Malay",
    "sk-SK": "Slovak",
    "da-DK": "Danish",
    "ta-IN": "Tamil",
    "uk-UA": "Ukrainian",
    "ru-RU": "Russian",
    "hu-HU": "Hungarian",
    "nb-NO": "Norwegian (Bokmål)",
    "vi-VN": "Vietnamese",
}

# A bare language means its first locale above, except where most of the app's users would expect another:
# Spanish speakers in the United States mostly use Latin American Spanish.
_DEFAULT_LOCALE = {"es": "es-MX"}
# Other names for the same languages: Tagalog is the base of Filipino, and "no" is Norwegian.
_LANGUAGE_ALIASES = {"tl": "fil", "no": "nb"}

_BY_LOWER = {locale.lower(): locale for locale in LOCALES}
for _locale in LOCALES:
    _DEFAULT_LOCALE.setdefault(_locale.split("-")[0], _locale)


def resolve_locale(code: object) -> str:
    """The supported locale a client's code stands for: "en_us" or "EN-us" -> "en-US", "es" -> "es-MX".

    Raises ValueError, naming the supported locales, for anything else."""
    cleaned = str(code or "").strip().replace("_", "-").lower()
    if cleaned in _BY_LOWER:
        return _BY_LOWER[cleaned]
    language = _LANGUAGE_ALIASES.get(cleaned, cleaned)
    if language in _DEFAULT_LOCALE:
        return _DEFAULT_LOCALE[language]
    raise ValueError(
        f"Unsupported language {str(code)!r}. Use one of: {', '.join(LOCALES)} (GET /api/v1/languages)."
    )


def language_of(locale: str) -> str:
    """The language part of a supported locale: "pt-BR" -> "pt", "fil-PH" -> "fil". The hint speech-to-text takes."""
    return resolve_locale(locale).split("-")[0]


def language_name(locale: str) -> str:
    """How Gemini is told the language: "en-GB" -> "English (United Kingdom)"."""
    return LOCALES[resolve_locale(locale)]


def is_english(locale: str) -> bool:
    return language_of(locale) == "en"
