"""locales.py: the 42 supported locales, how clients' codes resolve, and that every one can be spoken."""
import pytest

from locales import LOCALES, is_english, language_name, language_of, resolve_locale

REQUESTED = [
    "en-US", "en-GB", "en-AU", "en-CA", "ja-JP", "zh-CN", "de-DE", "hi-IN", "fr-FR", "fr-CA",
    "ko-KR", "pt-BR", "pt-PT", "it-IT", "es-ES", "es-MX", "id-ID", "nl-NL", "tr-TR", "fil-PH",
    "pl-PL", "sv-SE", "bg-BG", "ro-RO", "ar-SA", "ar-AE", "cs-CZ", "el-GR", "fi-FI", "hr-HR",
    "ms-MY", "sk-SK", "da-DK", "ta-IN", "uk-UA", "ru-RU", "hu-HU", "nb-NO", "vi-VN",
    "zh-TW", "he-IL", "th-TH",  # added for the app's language picker, after the first 39
]

# The 31 choices of the app's language picker (mobile/src/domain/languages.ts on frontend-aarush, c04f38f), as
# (code, locale): the locale is what to send as target_language. Each one must resolve to itself, or to the
# supported locale it stands for.
PICKER = [
    ("en", "en-US"), ("es", "es-ES"), ("fr", "fr-FR"), ("de", "de-DE"), ("it", "it-IT"), ("zh-Hans", "zh-Hans"),
    ("zh-Hant", "zh-Hant-TW"), ("ja", "ja-JP"), ("ko", "ko-KR"), ("hi", "hi-IN"), ("ar", "ar-SA"), ("he", "he-IL"),
    ("nl", "nl-NL"), ("sv", "sv-SE"), ("da", "da-DK"), ("fi", "fi-FI"), ("no", "nb-NO"), ("pl", "pl-PL"),
    ("cs", "cs-CZ"), ("sk", "sk-SK"), ("hu", "hu-HU"), ("ro", "ro-RO"), ("el", "el-GR"), ("ru", "ru-RU"),
    ("uk", "uk-UA"), ("tr", "tr-TR"), ("id", "id-ID"), ("ms", "ms-MY"), ("th", "th-TH"), ("vi", "vi-VN"),
    ("pt-PT", "pt-PT"),
]
SCRIPT_TAGS = {"zh-Hans": "zh-CN", "zh-Hant-TW": "zh-TW"}


def test_exactly_the_requested_locales_are_supported():
    from services.audio_service.text_to_speech.config import FLASH_LANGUAGES

    assert list(LOCALES) == REQUESTED
    languages = {locale.split("-")[0] for locale in LOCALES}
    assert len(languages) == 34 and languages - {"he", "th"} == FLASH_LANGUAGES  # Flash v2.5's 32, Hebrew and Thai


@pytest.mark.parametrize("code, locale", [
    ("en-GB", "en-GB"), ("en_gb", "en-GB"), ("EN-us", "en-US"), (" pt-BR ", "pt-BR"),
    ("en", "en-US"), ("es", "es-MX"), ("fr", "fr-FR"), ("pt", "pt-BR"), ("ar", "ar-SA"), ("zh", "zh-CN"),
    ("tl", "fil-PH"), ("fil", "fil-PH"), ("no", "nb-NO"), ("nb", "nb-NO"),
    ("he", "he-IL"), ("th", "th-TH"), ("zh-tw", "zh-TW"), ("ZH_TW", "zh-TW"),
    # Older codes for the same language, alone or with the region: Hebrew's "iw", Tagalog, Norwegian.
    ("iw", "he-IL"), ("iw-IL", "he-IL"), ("iw_il", "he-IL"), ("tl-PH", "fil-PH"), ("no-NO", "nb-NO"),
    # BCP-47 script tags, as phones send Chinese.
    ("zh-Hans", "zh-CN"), ("zh-Hans-CN", "zh-CN"), ("zh_hans_cn", "zh-CN"),
    ("zh-Hant", "zh-TW"), ("zh-Hant-TW", "zh-TW"), ("ZH-HANT-TW", "zh-TW"),
])
def test_codes_resolve_to_a_supported_locale(code, locale):
    assert resolve_locale(code) == locale


def test_every_choice_in_the_apps_language_picker_is_supported():
    assert [resolve_locale(locale) for _, locale in PICKER] == [SCRIPT_TAGS.get(locale, locale) for _, locale in PICKER]
    # Its codes resolve too, but a bare code means the language's default locale: send the locale.
    by_code = {code: resolve_locale(code) for code, _ in PICKER}
    assert by_code["zh-Hant"] == "zh-TW" and by_code["he"] == "he-IL" and by_code["th"] == "th-TH"
    assert by_code["es"] == "es-MX" and by_code["no"] == "nb-NO"  # the picker's Spanish locale is es-ES


@pytest.mark.parametrize("code", [
    "yue", "ht", "bn", "es-AR", "xx", "", None, "english",
    # Chinese variants not offered: Hong Kong and Macau (Cantonese), Singapore, and a script with the wrong region.
    "zh-HK", "zh-Hant-HK", "zh-MO", "zh-SG", "zh-Hans-SG", "zh-Hans-TW", "zh-Hant-CN", "iw-US", "th-LA",
])
def test_anything_else_is_refused_with_the_list(code):
    with pytest.raises(ValueError, match="Use one of: en-US, en-GB"):
        resolve_locale(code)


def test_the_language_part_and_the_name():
    assert language_of("pt-BR") == "pt" and language_of("fil-PH") == "fil" and language_of("tl") == "fil"
    assert language_name("en-GB") == "English (United Kingdom)" and language_name("es") == "Spanish (Mexico)"
    assert is_english("en-AU") and not is_english("es-MX")


def test_the_new_locales_language_and_name():
    assert [language_of(code) for code in ("zh-TW", "zh-Hant-TW", "he-IL", "iw", "th-TH")] == ["zh", "zh", "he", "he", "th"]
    # Gemini is told the script, so Traditional Chinese answers come in Traditional characters.
    assert language_name("zh-Hant") == "Chinese (Traditional, Taiwan)" and language_name("zh") == "Chinese (Mandarin, Simplified)"
    assert language_name("iw") == "Hebrew" and language_name("th") == "Thai"


def test_every_locale_is_spoken_by_the_default_voice_model_or_the_one_it_falls_back_to():
    from services.audio_service.text_to_speech.config import DEFAULT_MODEL_ID, FALLBACK_MODELS, speaks

    by_default = [locale for locale in LOCALES if speaks(DEFAULT_MODEL_ID, locale)]
    assert [locale for locale in LOCALES if locale not in by_default] == ["he-IL", "th-TH"]  # Flash v2.5 cannot
    assert all(speaks(FALLBACK_MODELS[0], locale) for locale in LOCALES)  # v4 Turbo speaks all 42
