"""locales.py: the 39 supported locales, how clients' codes resolve, and that every one can be spoken."""
import pytest

from locales import LOCALES, is_english, language_name, language_of, resolve_locale

REQUESTED = [
    "en-US", "en-GB", "en-AU", "en-CA", "ja-JP", "zh-CN", "de-DE", "hi-IN", "fr-FR", "fr-CA",
    "ko-KR", "pt-BR", "pt-PT", "it-IT", "es-ES", "es-MX", "id-ID", "nl-NL", "tr-TR", "fil-PH",
    "pl-PL", "sv-SE", "bg-BG", "ro-RO", "ar-SA", "ar-AE", "cs-CZ", "el-GR", "fi-FI", "hr-HR",
    "ms-MY", "sk-SK", "da-DK", "ta-IN", "uk-UA", "ru-RU", "hu-HU", "nb-NO", "vi-VN",
]


def test_exactly_the_requested_locales_are_supported():
    assert list(LOCALES) == REQUESTED
    assert len({locale.split("-")[0] for locale in LOCALES}) == 32  # Flash v2.5's 32 languages


@pytest.mark.parametrize("code, locale", [
    ("en-GB", "en-GB"), ("en_gb", "en-GB"), ("EN-us", "en-US"), (" pt-BR ", "pt-BR"),
    ("en", "en-US"), ("es", "es-MX"), ("fr", "fr-FR"), ("pt", "pt-BR"), ("ar", "ar-SA"), ("zh", "zh-CN"),
    ("tl", "fil-PH"), ("fil", "fil-PH"), ("no", "nb-NO"), ("nb", "nb-NO"),
])
def test_codes_resolve_to_a_supported_locale(code, locale):
    assert resolve_locale(code) == locale


@pytest.mark.parametrize("code", ["yue", "ht", "bn", "es-AR", "xx", "", None, "english"])
def test_anything_else_is_refused_with_the_list(code):
    with pytest.raises(ValueError, match="Use one of: en-US, en-GB"):
        resolve_locale(code)


def test_the_language_part_and_the_name():
    assert language_of("pt-BR") == "pt" and language_of("fil-PH") == "fil" and language_of("tl") == "fil"
    assert language_name("en-GB") == "English (United Kingdom)" and language_name("es") == "Spanish (Mexico)"
    assert is_english("en-AU") and not is_english("es-MX")


def test_every_locale_is_spoken_by_the_default_voice_model():
    from services.audio_service.text_to_speech.config import DEFAULT_MODEL_ID, speaks

    assert all(speaks(DEFAULT_MODEL_ID, locale) for locale in LOCALES)
