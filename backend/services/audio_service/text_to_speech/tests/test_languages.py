"""Speaking languages other than English: which model speaks what, what is sent to ElevenLabs, the default voice
for each language, and the cleanup in other languages. A fake provider: no network, no API key, no cost."""

import json

import pytest

import text_to_speech.service as service_module
from text_to_speech.cache import AudioCache
from text_to_speech.config import (
    DEFAULT_MODEL_ID,
    FALLBACK_MODELS,
    FLASH_LANGUAGES,
    MODEL_LANGUAGES,
    MULTILINGUAL_V2_LANGUAGES,
    V4_LANGUAGES,
    TTSConfig,
    language_base,
    speaks,
)
from text_to_speech.contract import ErrorCode, TTSRequest
from text_to_speech.elevenlabs_provider import ProviderAudio
from text_to_speech.service import TTSService
from text_to_speech.text_prep import MARK_WORDS, prepare_for_speech
from text_to_speech.voices import load_catalog

# The 34 languages of the app's 42 locales (backend/locales.py): Flash v2.5's 32, then Hebrew and Thai.
APP_LANGUAGES = {
    "en", "ja", "zh", "de", "hi", "fr", "ko", "pt", "it", "es", "id", "nl", "tr", "fil", "pl", "sv",
    "bg", "ro", "ar", "cs", "el", "fi", "hr", "ms", "sk", "da", "ta", "uk", "ru", "hu", "nb", "vi",
    "he", "th",
}
# The 39 locales the app offered before Hebrew, Thai and Traditional Chinese (2026-10-10). Flash speaks them all.
FLASH_LOCALES = [
    "en-US", "en-GB", "en-AU", "en-CA", "ja-JP", "zh-CN", "de-DE", "hi-IN", "fr-FR", "fr-CA",
    "ko-KR", "pt-BR", "pt-PT", "it-IT", "es-ES", "es-MX", "id-ID", "nl-NL", "tr-TR", "fil-PH",
    "pl-PL", "sv-SE", "bg-BG", "ro-RO", "ar-SA", "ar-AE", "cs-CZ", "el-GR", "fi-FI", "hr-HR",
    "ms-MY", "sk-SK", "da-DK", "ta-IN", "uk-UA", "ru-RU", "hu-HU", "nb-NO", "vi-VN",
]


class RecordingProvider:
    def __init__(self):
        self.calls = []  # (text, voice_id, settings)

    def generate(self, text, voice_id, settings=None):
        self.calls.append((text, voice_id, settings))
        return ProviderAudio(audio=b"AUDIO:" + text.encode(), request_id="req-1", characters_billed=len(text))


def make_service(model_id=DEFAULT_MODEL_ID, voice_id=""):
    provider = RecordingProvider()
    config = TTSConfig(api_key="test-key", voice_id=voice_id, model_id=model_id, cache_dir=None)
    return TTSService(config, provider, AudioCache(None), pronunciations={}, sleep=lambda s: None), provider


def say(service, text="Hola.", **kwargs):
    return service.synthesize(TTSRequest(request_id="r1", text=text, **kwargs))


# --- Which model speaks what -----------------------------------------------------------------------


def test_which_model_speaks_which_app_language():
    # ElevenLabs' models page, 2026-10-10: Flash v2.5 speaks 32 languages, without Hebrew and Thai; "the Eleven v4
    # model family" (v4 and v4 Turbo) speaks 90+, with them.
    assert DEFAULT_MODEL_ID == "eleven_flash_v2_5" and APP_LANGUAGES - FLASH_LANGUAGES == {"he", "th"}
    assert V4_LANGUAGES == APP_LANGUAGES and MODEL_LANGUAGES["eleven_v4_turbo"] == MODEL_LANGUAGES["eleven_v4"] == V4_LANGUAGES
    assert APP_LANGUAGES - MULTILINGUAL_V2_LANGUAGES == {"hu", "nb", "vi", "he", "th"}
    assert FALLBACK_MODELS == ("eleven_v4_turbo", "eleven_v4")


@pytest.mark.parametrize("code, base", [
    ("es-MX", "es"), ("pt_BR", "pt"), ("FIL-PH", "fil"), ("tl", "fil"), ("no", "nb"), (" en ", "en"),
    ("zh-TW", "zh"), ("he-IL", "he"), ("iw", "he"), ("th-TH", "th"),
])
def test_a_locale_or_code_stands_for_its_language(code, base):
    assert language_base(code) == base


def test_a_model_outside_the_list_is_trusted_with_english_only():
    assert speaks("model-1", "en-US") and not speaks("model-1", "es")
    assert speaks("eleven_flash_v2_5_preview", "vi")  # the Flash family speaks Flash's languages


# --- What is sent to ElevenLabs -------------------------------------------------------------------


def test_flash_is_told_the_language():
    service, provider = make_service()
    assert say(service, language="es-MX").ok
    assert provider.calls[0][2]["language_code"] == "es"


def test_norwegian_is_sent_as_elevenlabs_knows_it():
    service, provider = make_service()
    assert say(service, "Hei.", language="nb-NO").ok
    assert provider.calls[0][2]["language_code"] == "no"


def test_english_settings_and_audio_ids_are_unchanged():
    service, provider = make_service()
    ids = {say(service, "Hello.", language=code, voice="matilda").audio_id for code in ("en", "en-US", "en-GB", "EN_au")}
    assert len(ids) == 1 and len(provider.calls) == 1  # one clip per voice for every English locale, as before locales
    assert "language_code" not in provider.calls[0][2]


def test_one_clip_serves_every_locale_of_a_language():
    service, provider = make_service()
    first, second = say(service, language="es-MX"), say(service, language="es-ES")
    assert first.audio_id == second.audio_id and second.cached and len(provider.calls) == 1


def test_multilingual_v2_is_not_sent_a_language_code():
    service, provider = make_service(model_id="eleven_multilingual_v2")
    assert say(service, language="es-ES").ok
    assert "language_code" not in provider.calls[0][2]  # ElevenLabs does not support it on that model


@pytest.mark.parametrize("language, text", [("he-IL", "\u05e9\u05dc\u05d5\u05dd."), ("th-TH", "\u0e2a\u0e27\u0e31\u0e2a\u0e14\u0e35"), ("iw", "\u05e9\u05dc\u05d5\u05dd.")])
def test_hebrew_and_thai_are_spoken_by_v4_turbo_when_no_model_is_chosen(language, text):
    service, provider = make_service()  # the default, Flash v2.5, cannot speak them
    result = say(service, text, language=language)
    assert result.ok and result.model == "eleven_v4_turbo"  # the result names the model that spoke
    [(_, _, settings)] = provider.calls
    assert settings["model_id"] == "eleven_v4_turbo"
    assert "language_code" not in settings  # not documented for v4: left to the model
    assert "apply_text_normalization" not in settings  # v4 Turbo reads numbers right with ElevenLabs' default


def test_the_fallback_is_the_first_model_in_the_list_that_speaks_the_language(monkeypatch):
    monkeypatch.setattr(service_module, "FALLBACK_MODELS", ("eleven_multilingual_v2", "eleven_v4", "eleven_v4_turbo"))
    service, provider = make_service()
    assert say(service, "\u05e9\u05dc\u05d5\u05dd.", language="he-IL").model == "eleven_v4"  # Multilingual v2 cannot
    assert provider.calls[-1][2]["model_id"] == "eleven_v4"


def test_a_fallback_clip_is_cached_like_any_other():
    service, provider = make_service()
    first, second = say(service, "\u05e9\u05dc\u05d5\u05dd.", language="he-IL"), say(service, "\u05e9\u05dc\u05d5\u05dd.", language="he")
    assert first.audio_id == second.audio_id and second.cached and second.model == "eleven_v4_turbo"
    assert len(provider.calls) == 1


def test_a_configured_model_that_speaks_the_language_needs_no_fallback():
    service, provider = make_service(model_id="eleven_v4")
    assert say(service, "\u0e2a\u0e27\u0e31\u0e2a\u0e14\u0e35", language="th-TH").model == "eleven_v4"


def test_the_configured_model_still_speaks_every_language_it_can():
    service, provider = make_service()
    for number, locale in enumerate(FLASH_LOCALES):
        result = say(service, f"Text {number}.", language=locale)
        assert result.ok and result.model == "eleven_flash_v2_5", locale
        assert provider.calls[-1][2] == service.config.audio_settings("eleven_flash_v2_5", locale)  # the same settings as before


def test_a_language_the_configured_model_cannot_speak_falls_back_too():
    service, provider = make_service(model_id="eleven_multilingual_v2")
    result = say(service, "Szia.", language="hu-HU")  # Multilingual v2 does not speak Hungarian
    assert result.ok and result.model == "eleven_v4_turbo" and provider.calls[0][2]["model_id"] == "eleven_v4_turbo"
    unknown, _ = make_service(model_id="model-1")  # a model outside the list is trusted with English only
    assert say(unknown, "Hello.", language="en-US").model == "model-1"
    assert say(unknown, "Bonjour.", language="fr-FR").model == "eleven_v4_turbo"


@pytest.mark.parametrize("model, language", [
    ("eleven_multilingual_v2", "hu-HU"), ("eleven_flash_v2_5", "he-IL"), ("eleven_flash_v2_5", "th-TH"),
])
def test_a_chosen_model_that_cannot_speak_the_language_is_refused_before_anything_is_paid(model, language):
    service, provider = make_service()
    result = say(service, "Szia.", language=language, model=model)
    assert result.error_code == ErrorCode.INVALID_REQUEST
    assert f"{model} does not speak {language!r}" in result.error_message
    assert "eleven_v4_turbo or eleven_v4" in result.error_message  # it names the models that do
    assert provider.calls == []


def test_a_language_no_model_speaks_is_refused():
    service, provider = make_service()
    result = say(service, "Nei hou.", language="yue")
    assert result.error_code == ErrorCode.INVALID_REQUEST and "No voice model here speaks it" in result.error_message
    assert provider.calls == []


def test_a_requested_model_must_speak_the_language_too():
    service, provider = make_service()
    assert say(service, "Szia.", language="hu", model="eleven_multilingual_v2").error_code == ErrorCode.INVALID_REQUEST
    assert say(service, "Szia.", language="hu", model="eleven_v4").ok
    assert "language_code" not in provider.calls[-1][2]  # not documented for v4: left to the model


def test_traditional_chinese_is_mandarin_on_flash():
    service, provider = make_service()
    traditional = say(service, "\u8acb\u6838\u5c0d\u5e33\u55ae\u3002", language="zh-TW")  # Traditional characters
    assert traditional.ok and traditional.model == "eleven_flash_v2_5" and traditional.voice == "andy"
    assert provider.calls[-1][2]["language_code"] == "zh"
    again = say(service, "\u8acb\u6838\u5c0d\u5e33\u55ae\u3002", language="zh-CN")
    assert again.audio_id == traditional.audio_id and again.cached  # the same Mandarin audio for the same text


@pytest.mark.parametrize("language", ["", "   ", None, 7])
def test_a_missing_language_is_refused(language):
    service, provider = make_service()
    assert say(service, language=language).error_code == ErrorCode.INVALID_REQUEST
    assert provider.calls == []


# --- The default voice for each language -------------------------------------------------------------


def test_the_default_voice_suits_the_language():
    catalog = load_catalog()
    expected = {
        "es-MX": "elio", "es-ES": "elio", "en-GB": "alice", "en-AU": "charlie", "hi-IN": "saavi", "ta-IN": "saavi",
        "fil-PH": "rachel", "zh-CN": "andy", "en-US": "matilda", "en-CA": "matilda", "de-DE": "matilda",
    }
    assert {code: catalog.default_for(code).key for code in expected} == expected
    assert catalog.default_for(None).key == "matilda"


def test_no_choice_uses_the_languages_voice_and_a_choice_still_wins():
    service, provider = make_service(voice_id="override-id")
    assert say(service, language="es-MX").voice == "elio"
    assert provider.calls[-1][1] == service.voices.get("elio").voice_id  # ELEVENLABS_VOICE_ID replaces only "matilda"
    assert say(service, "Hello.", language="en-US").voice == "matilda" and provider.calls[-1][1] == "override-id"
    assert say(service, "Hola otra vez.", language="es-MX", voice="george").voice == "george"


def test_the_app_gets_the_language_defaults_with_the_voice_list():
    defaults = load_catalog().public()["language_defaults"]
    assert defaults["es"] == "elio" and defaults["en-GB"] == "alice" and "_comment" not in defaults


def test_language_defaults_are_checked(tmp_path):
    def catalog_with(defaults):
        path = tmp_path / "voices.json"
        voices = [{"key": "a", "name": "A", "voice_id": "id-a"}, {"key": "b", "name": "B", "voice_id": "id-b"}]
        path.write_text(json.dumps({"default": "a", "language_defaults": defaults, "voices": voices}), encoding="utf-8")
        return load_catalog(path)

    assert catalog_with({"pt_br": "b"}).default_for("pt-BR").key == "b"
    assert catalog_with({"pt_br": "b"}).public()["language_defaults"] == {"pt-BR": "b"}
    assert catalog_with({"pt_br": "b"}).default_for("pt-PT").key == "a"
    with pytest.raises(ValueError, match="not one of the voices"):
        catalog_with({"es": "nobody"})
    with pytest.raises(ValueError, match="not a language code"):
        catalog_with({"Spanish!": "b"})
    with pytest.raises(ValueError, match="must be an object"):
        catalog_with(["es", "b"])


# --- Cleanup in other languages ------------------------------------------------------------------


def test_every_app_language_has_its_words_for_marks():
    assert set(MARK_WORDS) == APP_LANGUAGES


def test_marks_are_spoken_in_the_reply_language():
    assert prepare_for_speech("Refundable: \u2705\n\u274c Covered", {}, "en") == "Refundable: yes.\nNo: Covered."
    spanish = prepare_for_speech("Reembolsable: \u2705\n\u274c Cubierto\n\u26a0\ufe0f Revisa el cargo", {}, "es-MX")
    assert spanish == "Reembolsable: s\u00ed.\nNo: Cubierto.\nAtenci\u00f3n: Revisa el cargo."
    assert prepare_for_speech("\u2705 \u4fdd\u967a\u9069\u7528: \u274c", {}, "ja") == (
        "\u306f\u3044: \u4fdd\u967a\u9069\u7528: \u3044\u3044\u3048\u3002"
    )


def test_english_only_rewrites_are_left_out_of_other_languages():
    assert prepare_for_speech("Visit on 2026-09-02, ~$5 vs. $9", {}, "en") == "Visit on September 2, 2026, about $5 versus $9."
    assert prepare_for_speech("Visita el 2026-09-02, ~$5 vs. $9", {}, "es") == "Visita el 2026-09-02, ~$5 vs. $9."
    assert prepare_for_speech("Mira:\n```\nx = 1\n```\nListo", {}, "es") == "Mira:\nListo."  # no English note


def test_sentences_end_the_way_each_language_writes_them():
    assert prepare_for_speech("\u8acb\u6c42\u66f8\u3067\u3059\n\n\u8cea\u554f\u306f", {}, "ja-JP") == (
        "\u8acb\u6c42\u66f8\u3067\u3059\u3002\n\u8cea\u554f\u306f\u3002"
    )
    for already_ended in ("\u300c\u3053\u308c\u3067\u3059\u3002\u300d", "\u0939\u093e\u0901\u0964", "\u0647\u0644 \u0647\u0630\u0627\u061f"):
        assert prepare_for_speech(already_ended, {}, "ja") == already_ended
    # Traditional Chinese ends sentences with the same full-width full stop.
    assert prepare_for_speech("\u8acb\u6838\u5c0d\u5e33\u55ae\n\n\u9019\u7b46\u8cbb\u7528", {}, "zh-TW") == (
        "\u8acb\u6838\u5c0d\u5e33\u55ae\u3002\n\u9019\u7b46\u8cbb\u7528\u3002"
    )


def test_marks_are_spoken_in_hebrew_and_thai():
    hebrew = prepare_for_speech("\u05de\u05db\u05d5\u05e1\u05d4: \u2705\n\u274c \u05d4\u05d7\u05d6\u05e8 \u05db\u05e1\u05e4\u05d9\n\u26a0\ufe0f \u05d1\u05d3\u05e7\u05d5 \u05d0\u05ea \u05d4\u05d7\u05d9\u05d5\u05d1\n\u274c \u05dc\u05d0 \u05de\u05db\u05d5\u05e1\u05d4", {}, "he-IL")
    assert hebrew == "\u05de\u05db\u05d5\u05e1\u05d4: \u05db\u05df.\n\u05dc\u05d0: \u05d4\u05d7\u05d6\u05e8 \u05db\u05e1\u05e4\u05d9.\n\u05d0\u05d6\u05d4\u05e8\u05d4: \u05d1\u05d3\u05e7\u05d5 \u05d0\u05ea \u05d4\u05d7\u05d9\u05d5\u05d1.\n\u05dc\u05d0 \u05de\u05db\u05d5\u05e1\u05d4."  # "\u05dc\u05d0" is not said twice
    thai = prepare_for_speech("\u0e04\u0e23\u0e2d\u0e1a\u0e04\u0e25\u0e38\u0e21: \u2705\n\u274c \u0e04\u0e48\u0e32\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23\n\u26a0\ufe0f \u0e15\u0e23\u0e27\u0e08\u0e2a\u0e2d\u0e1a\u0e22\u0e2d\u0e14\n\u274c \u0e44\u0e21\u0e48\u0e43\u0e0a\u0e48 \u0e04\u0e48\u0e32\u0e22\u0e32", {}, "th-TH")
    assert thai == "\u0e04\u0e23\u0e2d\u0e1a\u0e04\u0e25\u0e38\u0e21: \u0e43\u0e0a\u0e48.\n\u0e44\u0e21\u0e48\u0e43\u0e0a\u0e48: \u0e04\u0e48\u0e32\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23.\n\u0e04\u0e33\u0e40\u0e15\u0e37\u0e2d\u0e19: \u0e15\u0e23\u0e27\u0e08\u0e2a\u0e2d\u0e1a\u0e22\u0e2d\u0e14.\n\u0e44\u0e21\u0e48\u0e43\u0e0a\u0e48 \u0e04\u0e48\u0e32\u0e22\u0e32."


def test_a_line_that_already_starts_with_the_word_for_a_mark_is_not_given_it_twice():
    # Thai, Hindi and Tamil words can end in a vowel sign or tone mark, after which \b finds no word boundary.
    assert prepare_for_speech("\u274c \u0e44\u0e21\u0e48\u0e43\u0e0a\u0e48 \u0e04\u0e48\u0e32\u0e22\u0e32", {}, "th") == "\u0e44\u0e21\u0e48\u0e43\u0e0a\u0e48 \u0e04\u0e48\u0e32\u0e22\u0e32."
    assert prepare_for_speech("\u274c \u0928\u0939\u0940\u0902, \u092f\u0939 \u0936\u093e\u092e\u093f\u0932 \u0928\u0939\u0940\u0902 \u0939\u0948", {}, "hi-IN") == "\u0928\u0939\u0940\u0902, \u092f\u0939 \u0936\u093e\u092e\u093f\u0932 \u0928\u0939\u0940\u0902 \u0939\u0948."
    assert prepare_for_speech("\u274c No, not covered", {}, "en") == "No, not covered."
    assert prepare_for_speech("\u274c Nobody called", {}, "en") == "No: Nobody called."  # a longer word is not the word


def test_table_cells_with_a_mark_are_said_in_the_reply_language():
    table = "| Servicio | Cubierto |\n|---|---|\n| Rayos X | \u2705 |\n| Resonancia | \u274c |"
    assert prepare_for_speech(table, {}, "es-MX") == "Servicio, Cubierto.\nRayos X, s\u00ed.\nResonancia, no."
    assert prepare_for_speech("| \u05d1\u05d3\u05d9\u05e7\u05d4 | \u2705 |\n| \u05e0\u05d9\u05ea\u05d5\u05d7 | \u274c |", {}, "he") == "\u05d1\u05d3\u05d9\u05e7\u05d4, \u05db\u05df.\n\u05e0\u05d9\u05ea\u05d5\u05d7, \u05dc\u05d0."
    assert prepare_for_speech("| X-ray | \u2705 |\n| MRI | \u274c |", {}, "en") == "X-ray, yes.\nMRI, no."  # English as before


def test_right_to_left_hebrew_passes_cleanup_unharmed():
    # Vowel points, gershayim and an ASCII quote in abbreviations, the maqaf, digits, a dollar sign and quotes.
    text = '\u05e9\u05b8\u05c1\u05dc\u05d5\u05b9\u05dd. \u05d4\u05d7\u05d9\u05d5\u05d1 \u05e2\u05dc \u05d4\u05beMRI \u05d4\u05d5\u05d0 3,200$ (\u05e9"\u05d7: \u05dc\u05d0 \u05e8\u05dc\u05d5\u05d5\u05e0\u05d8\u05d9), \u05dc\u05e4\u05d9 \u05e6\u05d4\u05f4\u05dc \u05d5"\u05e7\u05d5\u05e4\u05ea \u05d7\u05d5\u05dc\u05d9\u05dd".'
    assert prepare_for_speech(text, {}, "he-IL") == text
    # Direction marks only steer the display: they are kept for the captions, and never hide a sentence's end.
    marked = "\u200f\u05d4\u05d7\u05d9\u05d5\u05d1 \u05d4\u05d5\u05d0 3,200$\u200f.\u200f\n\n\u202b\u05e9\u05d0\u05dc\u05d5 \u05d0\u05ea \u05de\u05e9\u05e8\u05d3 \u05d4\u05d7\u05d9\u05d5\u05d1\u05d9\u05dd\u202c"
    assert prepare_for_speech(marked, {}, "he") == "\u200f\u05d4\u05d7\u05d9\u05d5\u05d1 \u05d4\u05d5\u05d0 3,200$\u200f.\u200f\n\u202b\u05e9\u05d0\u05dc\u05d5 \u05d0\u05ea \u05de\u05e9\u05e8\u05d3 \u05d4\u05d7\u05d9\u05d5\u05d1\u05d9\u05dd\u202c."
    assert prepare_for_speech("\u0647\u0644 \u0647\u0630\u0627 \u0635\u062d\u064a\u062d\u061f\u200f", {}, "ar") == "\u0647\u0644 \u0647\u0630\u0627 \u0635\u062d\u064a\u062d\u061f\u200f"  # Arabic too
