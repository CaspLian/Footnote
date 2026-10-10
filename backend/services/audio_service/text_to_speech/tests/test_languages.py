"""Speaking languages other than English: which model speaks what, what is sent to ElevenLabs, the default voice
for each language, and the cleanup in other languages. A fake provider: no network, no API key, no cost."""

import json

import pytest

from text_to_speech.cache import AudioCache
from text_to_speech.config import (
    DEFAULT_MODEL_ID,
    FLASH_LANGUAGES,
    MULTILINGUAL_V2_LANGUAGES,
    TTSConfig,
    language_base,
    speaks,
)
from text_to_speech.contract import ErrorCode, TTSRequest
from text_to_speech.elevenlabs_provider import ProviderAudio
from text_to_speech.service import TTSService
from text_to_speech.text_prep import MARK_WORDS, prepare_for_speech
from text_to_speech.voices import load_catalog

# The 32 languages of the app's 39 locales (backend/locales.py).
APP_LANGUAGES = {
    "en", "ja", "zh", "de", "hi", "fr", "ko", "pt", "it", "es", "id", "nl", "tr", "fil", "pl", "sv",
    "bg", "ro", "ar", "cs", "el", "fi", "hr", "ms", "sk", "da", "ta", "uk", "ru", "hu", "nb", "vi",
}


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


def test_flash_speaks_every_app_language_and_multilingual_v2_all_but_three():
    assert DEFAULT_MODEL_ID == "eleven_flash_v2_5" and FLASH_LANGUAGES == APP_LANGUAGES
    assert APP_LANGUAGES - MULTILINGUAL_V2_LANGUAGES == {"hu", "nb", "vi"}


@pytest.mark.parametrize("code, base", [("es-MX", "es"), ("pt_BR", "pt"), ("FIL-PH", "fil"), ("tl", "fil"), ("no", "nb"), (" en ", "en")])
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


def test_a_language_the_model_cannot_speak_is_refused_before_anything_is_paid():
    service, provider = make_service(model_id="eleven_multilingual_v2")
    result = say(service, "Szia.", language="hu-HU")
    assert result.error_code == ErrorCode.INVALID_REQUEST
    assert "eleven_multilingual_v2 does not speak 'hu-HU'" in result.error_message
    assert "eleven_flash_v2_5" in result.error_message  # it names the models that do
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
