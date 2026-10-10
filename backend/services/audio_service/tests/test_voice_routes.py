"""Tests for voice_routes: recording -> speech-to-text -> Gemini step -> spoken reply.

The team's Gemini module is replaced by a stand-in (the real one needs the Google SDK and a key),
and ElevenLabs by fakes, so these run offline at no cost. The routes are imported the way the
backend imports them: as services.audio_service.voice_routes, with backend/ on the path.
"""

import asyncio
import importlib
import sys
import types
import uuid
from pathlib import Path

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")
pytest.importorskip("python_multipart")

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parents[3]
PHONE_RECORDING = b"\x00\x00\x00\x20ftypM4A " + b"\x01" * 5000
SILENT_RECORDING = b"\x00\x00\x00\x20ftypM4A " + b"\x00" * 5000
BILL_PHOTO = b"\x89PNG\r\n\x1a\n" + b"\x02" * 3000


class FakeGemini:
    """Stands in for services.gemini_services.gemini_service: records each call, returns a GeminiResult."""

    def __init__(self, models):
        self.models = models
        self.calls = []
        self.error = None
        self.delay = 0.0
        self.spoken_summary = "Your MRI was billed at three thousand two hundred dollars."
        self.translations = []  # what translate_for_speech was asked
        self.translated = {}  # locale -> the translation to answer with (None: Gemini could not translate)
        self.translation_delay = 0.0

    async def translate_for_speech(self, text, target_language):
        self.translations.append({"text": text, "lang": target_language})
        locale = importlib.import_module("locales").resolve_locale(target_language)  # ValueError, like the real one
        if self.translation_delay:
            await asyncio.sleep(self.translation_delay)
        return self.translated.get(locale, f"{locale}: {text}")

    async def analyze(self, *, file_bytes=None, mime_type=None, text=None, target_language="en"):
        self.calls.append({"file_bytes": file_bytes, "mime_type": mime_type, "text": text, "lang": target_language})
        if self.delay:
            await asyncio.sleep(self.delay)
        if self.error:
            raise self.error
        return self.models.GeminiResult(
            document_type="hospital_bill",
            line_items=[
                self.models.LineItem(
                    cpt_code="70551", original_description="MRI BRAIN W/O DYE", plain_description="Brain MRI",
                    billed_amount=3200.0,
                )
            ],
            plain_summary="Your MRI was billed at $3,200, more than a typical $1,400.",
            spoken_summary=self.spoken_summary,
            questions_to_ask=["Can you explain the MRI charge?"],
        )


class FakePriceCheck:
    """Stands in for services.snowflake_services.snowflake_service.check_prices (the real one queries Snowflake)."""

    def __init__(self, models):
        self.models = models
        self.calls = []

    async def check_prices(self, line_items):
        self.calls.append(line_items)
        checks = [
            self.models.PriceCheck(
                line_index=0, cpt_code="70551", billed_amount=3200.0, medicare_rate=400.0, times_medicare=8.0,
                flag="far_above_typical", note="About 8 times Medicare's rate.",
            )
        ]
        summary = self.models.PriceSummary(
            source="local_csv", items_checked=1, items_flagged=1, billed_total_checked=3200.0, medicare_total_checked=400.0
        )
        return checks, summary


class StoreUnavailable(Exception):
    """Stands in for services.analytical_services.analysis_store.StoreUnavailable."""


class FakeStore:
    """Stands in for services.analytical_services.analysis_store (the real one writes to Tiger Data): keeps analyses in memory."""

    def __init__(self, models):
        self.models = models
        self.saved = {}
        self.configured = True

    async def save_analysis(self, response, *, source, transcript=None):
        if not self.configured:
            return self.models.AuditInfo(saved=False, error="Not saved: Tiger Data is not configured (TIGER_DATA_POSTGRES_URL).")
        audit_id = str(uuid.uuid4())
        self.saved[audit_id] = {
            "audit_id": audit_id, "created_at": "2026-10-09T12:00:00+00:00", "source": source, "transcript": transcript,
            "analysis": response.model_dump(mode="json", exclude={"audit"}),
        }
        return self.models.AuditInfo(saved=True, audit_id=audit_id)

    async def load_analysis(self, audit_id):
        try:
            uuid.UUID(str(audit_id))
        except ValueError:
            raise ValueError("audit_id must be a valid UUID.") from None
        if not self.configured:
            raise StoreUnavailable("Tiger Data is not configured (TIGER_DATA_POSTGRES_URL).")
        return self.saved.get(audit_id)


class FakeScribe:
    def __init__(self, provider_module):
        self.module = provider_module
        self.calls = []
        self.error = None

    def transcribe(self, audio, filename, mime_type, language):
        self.calls.append({"language": language, "mime_type": mime_type})
        if self.error:
            raise self.error
        if audio.count(b"\x00") > len(audio) // 2:
            return self.module.ProviderTranscript(text="", audio_seconds=2.0)
        words = [{"text": "Why", "type": "word", "logprob": -0.05}, {"text": "MRI", "type": "word", "logprob": -0.1}]
        return self.module.ProviderTranscript(
            text="Why was my MRI so expensive?", language="eng", words=words, audio_seconds=2.4
        )


class FakeVoice:
    def __init__(self, provider_module):
        self.module = provider_module
        self.texts = []
        self.voice_ids = []
        self.settings = []
        self.error = None

    def generate(self, text, voice_id, settings=None):
        self.texts.append(text)
        self.voice_ids.append(voice_id)
        self.settings.append(settings)
        if self.error:
            raise self.error
        return self.module.ProviderAudio(audio=b"ID3" + text.encode(), request_id="tts-1", characters_billed=len(text))


@pytest.fixture
def voice(monkeypatch, no_real_settings_files):
    """A FastAPI app with the voice router mounted, and handles on every fake."""
    monkeypatch.syspath_prepend(str(BACKEND_DIR))
    models = importlib.import_module("models")
    gemini = FakeGemini(models)
    fake_module = types.ModuleType("services.gemini_services.gemini_service")
    fake_module.analyze = gemini.analyze
    fake_module.translate_for_speech = gemini.translate_for_speech
    fake_module.is_mock = lambda: True
    fake_module.model_name = lambda: "fake-gemini"
    fake_module.SUPPORTED_MIME = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"}
    monkeypatch.setitem(sys.modules, "services.gemini_services.gemini_service", fake_module)
    prices = FakePriceCheck(models)
    fake_prices = types.ModuleType("services.snowflake_services.snowflake_service")
    fake_prices.check_prices = prices.check_prices
    monkeypatch.setitem(sys.modules, "services.snowflake_services.snowflake_service", fake_prices)
    store = FakeStore(models)
    fake_store = types.ModuleType("services.analytical_services.analysis_store")
    fake_store.save_analysis, fake_store.load_analysis = store.save_analysis, store.load_analysis
    fake_store.StoreUnavailable = StoreUnavailable
    monkeypatch.setitem(sys.modules, "services.analytical_services.analysis_store", fake_store)
    # A fresh voice_routes bound to these fakes, removed again afterwards: main.py imports the real one, and in a
    # combined test run it must not find this one. (setitem first, so monkeypatch remembers it was not there.)
    monkeypatch.setitem(sys.modules, "services.audio_service.voice_routes", None)
    monkeypatch.delitem(sys.modules, "services.audio_service.voice_routes")
    routes = importlib.import_module("services.audio_service.voice_routes")

    stt_service = importlib.import_module("services.audio_service.speech_to_text.service")
    stt_config = importlib.import_module("services.audio_service.speech_to_text.config")
    stt_provider = importlib.import_module("services.audio_service.speech_to_text.elevenlabs_provider")
    tts_service = importlib.import_module("services.audio_service.text_to_speech.service")
    tts_config = importlib.import_module("services.audio_service.text_to_speech.config")
    tts_cache = importlib.import_module("services.audio_service.text_to_speech.cache")
    tts_provider = importlib.import_module("services.audio_service.text_to_speech.elevenlabs_provider")
    no_real_settings_files(stt_config)  # these copies of the config modules are new: keep real settings files out
    no_real_settings_files(tts_config)

    scribe = FakeScribe(stt_provider)
    speaker = FakeVoice(tts_provider)
    monkeypatch.setattr(
        stt_service, "_default_service", stt_service.STTService(stt_config.STTConfig(api_key="k"), scribe, sleep=lambda s: None)
    )
    monkeypatch.setattr(
        tts_service,
        "_default_service",
        tts_service.TTSService(
            tts_config.TTSConfig(api_key="k", voice_id="v", cache_dir=None), speaker, tts_cache.AudioCache(None),
            pronunciations={}, sleep=lambda s: None,
        ),
    )
    app = FastAPI()
    app.include_router(routes.router)
    return types.SimpleNamespace(
        client=TestClient(app), gemini=gemini, prices=prices, store=store, scribe=scribe, speaker=speaker,
        routes=routes, stt_errors=stt_provider,
    )


def ask(app, recording=PHONE_RECORDING, bill=None, **form):
    files = {"audio": ("question.m4a", recording, "audio/m4a")}
    if bill is not None:
        files["file"] = ("bill.png", bill, "image/png")
    return app.client.post("/api/v1/voice/analyze", files=files, data={"message_id": "msg-1", **form})


# --- The whole path ------------------------------------------------------------------------


def test_spoken_question_reaches_gemini_and_the_reply_is_spoken(voice):
    response = ask(voice)
    assert response.status_code == 200
    body = response.json()

    assert body["transcript"]["text"] == "Why was my MRI so expensive?"
    assert body["transcript"]["needs_confirmation"] is False
    # The transcript went to the team's Gemini step as the user's text, like /api/v1/analyze does.
    assert voice.gemini.calls == [{"file_bytes": None, "mime_type": None, "text": "Why was my MRI so expensive?", "lang": "en-US"}]
    assert body["analysis"]["target_language"] == "en-US" and voice.gemini.translations == []  # English: nothing to translate
    # "analysis" has the /api/v1/analyze shape.
    assert body["analysis"]["model"] == "fake-gemini" and body["analysis"]["mock"] is True
    assert body["analysis"]["result"]["document_type"] == "hospital_bill"
    # spoken_summary, then what the price check found, was turned into audio, which the audio route serves.
    [spoken] = voice.speaker.texts
    assert spoken.startswith(
        "Your MRI was billed at three thousand two hundred dollars. I also compared the charges with Medicare's national rates."
    )
    assert "Brain MRI was billed about 8 times Medicare's national rate, which is far above the usual range." in spoken
    assert body["speech"]["ok"] is True and body["speech"]["mime_type"] == "audio/mpeg"
    assert body["speech"]["text"] == spoken  # the captions are exactly what the voice says
    audio = voice.client.get(body["speech"]["audio_url"])
    assert audio.status_code == 200 and audio.headers["content-type"] == "audio/mpeg"
    assert audio.content == b"ID3" + spoken.encode()


def test_the_bill_gets_the_same_price_check_as_the_analyze_endpoint(voice):
    analysis = ask(voice).json()["analysis"]
    # Gemini's line items went to the team's price check, and its answer is in the response.
    assert [item.cpt_code for item in voice.prices.calls[0]] == ["70551"]
    assert analysis["price_checks"][0]["flag"] == "far_above_typical"
    assert analysis["price_summary"]["source"] == "local_csv" and analysis["price_summary"]["items_flagged"] == 1


def test_gemini_gets_as_long_as_on_the_analyze_endpoint(voice):
    assert voice.routes.GEMINI_TIMEOUT_S == 150  # main.py: 2 attempts x 2 models


def test_a_bill_photo_can_come_with_the_question(voice):
    assert ask(voice, bill=BILL_PHOTO).status_code == 200
    assert voice.gemini.calls[0]["file_bytes"] == BILL_PHOTO and voice.gemini.calls[0]["mime_type"] == "image/png"


def test_the_users_language_goes_to_speech_to_text_gemini_and_the_reply_voice(voice):
    response = ask(voice, target_language="es")
    assert response.status_code == 200
    body = response.json()
    # "es" means es-MX. Speech-to-text gets the language alone; Gemini and the answer get the locale.
    assert voice.scribe.calls[0]["language"] == "es" and voice.gemini.calls[0]["lang"] == "es-MX"
    assert body["analysis"]["target_language"] == "es-MX"
    # The reply: Gemini's summary (written in Spanish), then the price findings, which Gemini translated.
    [asked] = voice.gemini.translations
    assert asked["lang"] == "es-MX" and asked["text"].startswith("I also compared the charges with Medicare's national rates.")
    assert "“Brain MRI” was billed about 8 times" in asked["text"]  # names quoted, so the translator knows them
    assert body["speech"]["ok"] is True and body["speech"]["text"] == voice.speaker.texts[-1]
    assert body["speech"]["text"].startswith(voice.gemini.spoken_summary + " es-MX: I also compared the charges")
    # In Elio's voice (voices.json's default for Spanish), with Flash told the language.
    assert body["speech"]["voice"] == "elio" and voice.speaker.settings[-1]["language_code"] == "es"


@pytest.mark.parametrize("language", ["yue", "es-AR", "klingon"])
def test_a_language_not_offered_is_refused_before_paying_for_anything(voice, language):
    response = ask(voice, target_language=language)
    assert response.status_code == 400
    detail = response.json()["detail"]
    assert detail["stage"] == "language" and "Use one of: en-US, en-GB" in detail["message"]
    assert voice.scribe.calls == [] and voice.gemini.calls == [] and voice.speaker.texts == []


@pytest.mark.parametrize("language, hint", [("pt-BR", "pt"), ("fil-PH", "fil"), ("nb-NO", "no"), ("zh-CN", "zh"), ("en-GB", "en")])
def test_speech_to_text_gets_the_language_as_elevenlabs_knows_it(voice, language, hint):
    assert ask(voice, target_language=language).status_code == 200
    assert voice.scribe.calls[0]["language"] == hint


def test_without_a_translation_the_reply_is_the_summary_alone(voice):
    voice.gemini.spoken_summary = "MRIの請求額は三千二百ドルです"
    voice.gemini.translated["ja-JP"] = None  # Gemini could not translate (quota, outage)
    speech = ask(voice, target_language="ja-JP").json()["speech"]
    assert speech["ok"] is True and speech["text"] == "MRIの請求額は三千二百ドルです。"  # never the English findings


def test_a_japanese_summary_and_its_findings_read_as_two_sentences(voice):
    voice.gemini.spoken_summary = "MRIの請求額は三千二百ドルです"
    voice.gemini.translated["ja-JP"] = "メディケアの全国料金と比べました。"
    speech = ask(voice, target_language="ja-JP").json()["speech"]
    assert speech["text"] == "MRIの請求額は三千二百ドルです。メディケアの全国料金と比べました。"


def test_a_slow_translation_does_not_hold_up_the_reply(voice, monkeypatch):
    monkeypatch.setattr(voice.routes, "TRANSLATION_TIMEOUT_S", 0.05)
    voice.gemini.translation_delay = 2.0
    speech = ask(voice, target_language="de-DE").json()["speech"]
    assert speech["ok"] is True and speech["text"] == voice.gemini.spoken_summary


def test_an_analysis_saved_with_a_bare_language_code_is_spoken_in_it(voice):
    audit_id = ask(voice).json()["analysis"]["audit"]["audit_id"]
    voice.store.saved[audit_id]["analysis"]["target_language"] = "es"  # how analyses were saved before locales
    speech = voice.client.post("/api/v1/voice/speak", data={"audit_id": audit_id}).json()
    assert speech["ok"] is True and speech["voice"] == "elio" and "es-MX: I also compared" in speech["text"]


def test_an_analysis_in_a_language_no_longer_offered_still_gets_an_answer(voice):
    audit_id = ask(voice).json()["analysis"]["audit"]["audit_id"]
    voice.store.saved[audit_id]["analysis"]["target_language"] = "yue"  # Cantonese was offered before 2026-10-10
    response = voice.client.post("/api/v1/voice/speak", data={"audit_id": audit_id})
    assert response.status_code == 200
    speech = response.json()
    assert speech["ok"] is False and speech["error_code"] == "INVALID_REQUEST" and "'yue'" in speech["error_message"]


def test_reply_audio_can_be_switched_off(voice):
    body = ask(voice, speak_reply="false").json()
    assert body["speech"]["error_code"] == "NOT_REQUESTED" and voice.speaker.texts == []


def test_a_failed_reply_voice_still_returns_the_text_answer(voice):
    voice.speaker.error = RuntimeError("voice down")
    response = ask(voice)
    assert response.status_code == 200
    assert response.json()["analysis"]["result"]["plain_summary"].startswith("Your MRI")
    assert response.json()["speech"]["ok"] is False and response.json()["speech"]["error_code"] == "INTERNAL_ERROR"


# --- Speech-to-text stage failures: Gemini is never called -------------------------------------


@pytest.mark.parametrize(
    "recording, mime, status, error_code",
    [
        (SILENT_RECORDING, "audio/m4a", 422, "NO_SPEECH"),
        (b'{"not": "audio"}' * 100, "application/json", 422, "UNSUPPORTED_AUDIO"),
        (b"\x00" * 10, "audio/m4a", 422, "EMPTY_AUDIO"),
    ],
    ids=["silence", "not-audio", "empty"],
)
def test_unusable_recordings_are_reported_before_gemini(voice, recording, mime, status, error_code):
    response = voice.client.post(
        "/api/v1/voice/analyze", files={"audio": ("q.m4a", recording, mime)}, data={"message_id": "m"}
    )
    assert response.status_code == status
    assert response.json()["detail"]["stage"] == "speech_to_text"
    assert response.json()["detail"]["error_code"] == error_code
    assert voice.gemini.calls == []


def test_temporary_speech_to_text_outage_is_503_and_retryable(voice):
    errors = importlib.import_module("services.audio_service.speech_to_text.errors")
    voice.scribe.error = errors.STTError("PROVIDER_UNAVAILABLE", "ElevenLabs down", retryable=True)
    response = ask(voice)
    assert response.status_code == 503
    assert response.json()["detail"]["retryable"] is True and voice.gemini.calls == []


def test_missing_recording_is_rejected_by_fastapi(voice):
    assert voice.client.post("/api/v1/voice/analyze", data={"message_id": "m"}).status_code == 422


def test_bill_over_the_limit_is_413_before_paying_for_speech_to_text(voice, monkeypatch):
    monkeypatch.setattr(voice.routes, "MAX_BILL_MB", 0.001)
    response = ask(voice, bill=BILL_PHOTO)
    assert response.status_code == 413 and response.json()["detail"]["stage"] == "upload"
    assert voice.scribe.calls == [] and voice.gemini.calls == []  # the recording was never sent to ElevenLabs


# --- Gemini stage failures, mapped like /api/v1/analyze --------------------------------------


@pytest.mark.parametrize(
    "error, status",
    [(ValueError("Send a file, some text, or both."), 400), (RuntimeError("quota"), 502)],
    ids=["bad-input", "gemini-error"],
)
def test_gemini_errors_are_mapped_like_the_analyze_endpoint(voice, error, status):
    voice.gemini.error = error
    response = ask(voice)
    assert response.status_code == status
    assert response.json()["detail"]["stage"] == "gemini"
    assert voice.speaker.texts == []


def test_gemini_timeout_is_504(voice, monkeypatch):
    monkeypatch.setattr(voice.routes, "GEMINI_TIMEOUT_S", 0.05)
    voice.gemini.delay = 1.0
    response = ask(voice)
    assert response.status_code == 504 and response.json()["detail"]["stage"] == "gemini"


# --- Audio route ---------------------------------------------------------------------------


@pytest.mark.parametrize("audio_id", ["0" * 32, "..%2F..%2Fsecret", "not-an-id"])
def test_unknown_or_unsafe_audio_ids_are_404(voice, audio_id):
    assert voice.client.get(f"/api/v1/voice/audio/{audio_id}").status_code == 404


# --- Voice choice --------------------------------------------------------------------------


def test_the_reply_uses_the_voice_the_user_chose(voice):
    body = ask(voice, voice="bunty").json()
    assert body["speech"]["ok"] is True and body["speech"]["voice"] == "bunty"
    assert voice.speaker.voice_ids == ["nwj0s2LU9bDWRKND5yzA"]


def test_no_voice_choice_uses_the_default_voice(voice):
    assert ask(voice).json()["speech"]["voice"] == "matilda"


def test_an_unknown_voice_still_returns_the_text_answer(voice):
    response = ask(voice, voice="nobody")
    assert response.status_code == 200
    speech = response.json()["speech"]
    assert speech["ok"] is False and speech["error_code"] == "INVALID_REQUEST"
    assert "bunty" in speech["error_message"]  # the message lists the valid choices
    assert response.json()["analysis"]["result"]["plain_summary"]


def test_the_app_can_list_the_voices(voice):
    body = voice.client.get("/api/v1/voice/voices").json()
    assert body["default"] == "matilda"
    keys = [v["key"] for v in body["voices"]]
    assert len(keys) == 20 and keys[:5] == ["matilda", "sarah", "george", "charlie", "bunty"]
    assert body["voices"][4]["accent"] == "Indian"
    assert body["language_defaults"]["es"] == "elio" and body["language_defaults"]["en-GB"] == "alice"
    assert all("voice_id" not in v for v in body["voices"])


def test_a_voice_sample_is_spoken_in_that_voice_and_made_only_once(voice):
    first = voice.client.get("/api/v1/voice/voices/bunty/sample")
    assert first.status_code == 200 and first.headers["content-type"] == "audio/mpeg"
    assert first.content == b"ID3Hi, I'm Bunty. I can read your medical bill explanations out loud."
    again = voice.client.get("/api/v1/voice/voices/Bunty/sample")
    assert again.content == first.content
    assert voice.speaker.voice_ids == ["nwj0s2LU9bDWRKND5yzA"]  # the second one came from the cache


def test_sample_of_an_unknown_voice_is_404(voice):
    assert voice.client.get("/api/v1/voice/voices/nobody/sample").status_code == 404


def test_sample_failure_is_reported(voice):
    voice.speaker.error = RuntimeError("voice down")
    response = voice.client.get("/api/v1/voice/voices/george/sample")
    assert response.status_code == 502 and response.json()["detail"]["stage"] == "text_to_speech"


# --- Speed: byte ranges and streaming ------------------------------------------------------------


def test_reply_audio_supports_byte_ranges_for_iphones(voice):
    url = ask(voice).json()["speech"]["audio_url"]
    probe = voice.client.get(url, headers={"Range": "bytes=0-1"})  # what AVPlayer asks for first
    assert probe.status_code == 206 and probe.content == b"ID"
    assert probe.headers["content-range"].startswith("bytes 0-1/")
    # Kept by the phone, never by shared caches: the reply explains someone's bill.
    assert probe.headers["cache-control"] == "private, max-age=31536000, immutable"
    assert voice.client.get(url).headers["accept-ranges"] == "bytes"


def test_finished_reply_is_the_default_so_iphones_can_play_it(voice, monkeypatch):
    async def must_not_stream(request):
        raise AssertionError("by default the reply must wait for the finished clip")

    monkeypatch.setattr(voice.routes, "synthesize_streaming_async", must_not_stream)
    speech = ask(voice).json()["speech"]
    assert speech["ok"] is True and speech["streaming"] is False


def test_voice_samples_support_byte_ranges_for_iphones(voice):
    probe = voice.client.get("/api/v1/voice/voices/bunty/sample", headers={"Range": "bytes=0-1"})
    assert probe.status_code == 206 and probe.content == b"ID"
    assert probe.headers["cache-control"] == "public, max-age=86400"


class GatedStreamingVoice:
    """open_stream() sends the first piece at once and the rest when the test says so."""

    def __init__(self, provider_module):
        import threading

        self.module = provider_module
        self.release = threading.Event()

    def generate(self, text, voice_id, settings=None):
        raise AssertionError("streaming should use open_stream()")

    def open_stream(self, text, voice_id, settings=None):
        def chunks():
            yield b"ID3"
            assert self.release.wait(5), "the test never released the rest of the audio"
            yield b"-rest of the reply"

        return self.module.ProviderStream(chunks(), request_id="tts-s", characters_billed=len(text))


def test_stream_reply_answers_at_the_first_audio_and_streams_the_rest(voice, monkeypatch):
    import threading
    import time

    tts_service = importlib.import_module("services.audio_service.text_to_speech.service")
    tts_config = importlib.import_module("services.audio_service.text_to_speech.config")
    tts_cache = importlib.import_module("services.audio_service.text_to_speech.cache")
    tts_provider = importlib.import_module("services.audio_service.text_to_speech.elevenlabs_provider")
    speaker = GatedStreamingVoice(tts_provider)
    service = tts_service.TTSService(
        tts_config.TTSConfig(api_key="k", voice_id="v", cache_dir=None), speaker, tts_cache.AudioCache(None),
        pronunciations={}, sleep=lambda s: None,
    )
    monkeypatch.setattr(tts_service, "_default_service", service)

    speech = ask(voice, stream_reply="true").json()["speech"]  # returns while the rest is held back
    assert speech["ok"] is True and speech["streaming"] is True

    received = {}
    listener = threading.Thread(target=lambda: received.update(response=voice.client.get(speech["audio_url"])))
    listener.start()
    audio_id = speech["audio_url"].rsplit("/", 1)[1]
    deadline = time.monotonic() + 5
    while not getattr(service._in_flight.get(audio_id), "_delivered", True) and time.monotonic() < deadline:
        time.sleep(0.01)  # until the listener has the first piece
    speaker.release.set()
    listener.join(5)

    response = received["response"]
    assert response.status_code == 200 and response.content == b"ID3-rest of the reply"
    assert response.headers["cache-control"] == "no-store"  # a stream is never cached for good


# --- Saving, speaking a saved analysis, and the spoken price findings -----------------------------


def test_a_voice_analysis_is_saved_with_its_transcript(voice):
    body = ask(voice).json()
    audit = body["analysis"]["audit"]
    assert audit["saved"] is True and audit["error"] is None
    stored = voice.store.saved[audit["audit_id"]]
    assert stored["source"] == "voice" and stored["transcript"] == "Why was my MRI so expensive?"
    assert stored["analysis"]["price_checks"][0]["flag"] == "far_above_typical"  # saved after the price check


def test_without_tiger_data_the_answer_still_comes_back(voice):
    voice.store.configured = False
    body = ask(voice).json()
    assert body["analysis"]["audit"] == {
        "saved": False, "audit_id": None, "error": "Not saved: Tiger Data is not configured (TIGER_DATA_POSTGRES_URL).",
    }
    assert body["speech"]["ok"] is True


def test_a_saved_analysis_can_be_spoken_again_without_analyzing_it_again(voice):
    audit_id = ask(voice).json()["analysis"]["audit"]["audit_id"]
    gemini_calls, [first_reply] = len(voice.gemini.calls), voice.speaker.texts
    speech = voice.client.post("/api/v1/voice/speak", data={"audit_id": audit_id, "voice": "george"}).json()
    assert len(voice.gemini.calls) == gemini_calls  # Gemini was not asked again
    assert speech["ok"] is True and speech["voice"] == "george"
    assert voice.speaker.texts[-1] == first_reply  # the same words, now in George's voice
    audio = voice.client.get(speech["audio_url"])
    assert audio.status_code == 200 and audio.content == b"ID3" + first_reply.encode()


@pytest.mark.parametrize("audit_id, status", [("not-a-uuid", 400), (str(uuid.uuid4()), 404)])
def test_speaking_an_unknown_analysis_is_refused(voice, audit_id, status):
    response = voice.client.post("/api/v1/voice/speak", data={"audit_id": audit_id})
    assert response.status_code == status and response.json()["detail"]["stage"] == "audit"
    assert voice.speaker.texts == []


def test_speaking_a_saved_analysis_needs_tiger_data(voice):
    voice.store.configured = False
    assert voice.client.post("/api/v1/voice/speak", data={"audit_id": str(uuid.uuid4())}).status_code == 503


def _analysis(models, checks, language="en"):
    result = models.GeminiResult(
        document_type="hospital_bill",
        line_items=[
            models.LineItem(cpt_code="70450", original_description="CT HEAD", plain_description="The head CT scan", billed_amount=3200.0),
            models.LineItem(cpt_code="99284", original_description="ER VISIT", plain_description="The ER visit", billed_amount=1200.0),
            models.LineItem(cpt_code="80053", original_description="LAB PANEL", plain_description="The lab panel", billed_amount=90.0),
        ],
        plain_summary="Summary.",
        spoken_summary="Here is your bill.",
    )
    return models.AnalyzeResponse(target_language=language, model="m", mock=True, result=result, price_checks=checks)


def _check(models, index, flag, times, note="note"):
    return models.PriceCheck(
        line_index=index, cpt_code="x", billed_amount=1.0, medicare_rate=1.0, times_medicare=times, flag=flag, note=note
    )


def test_the_spoken_reply_adds_what_the_price_check_found(voice):
    models = importlib.import_module("models")
    checks = [_check(models, 0, "far_above_typical", 30.0), _check(models, 1, "above_typical", 4.5), _check(models, 2, "typical", 1.2)]
    assert voice.routes.spoken_reply(_analysis(models, checks)) == (
        "Here is your bill. I also compared the charges with Medicare's national rates. "
        "The head CT scan was billed about 30 times Medicare's national rate, which is far above the usual range. "
        "The ER visit was billed about 4.5 times Medicare's national rate, which is higher than usual. "
        "It's worth asking the billing office about them."
    )


def test_the_spoken_reply_names_a_charge_listed_twice_only_once(voice):
    models = importlib.import_module("models")
    ekg = dict(cpt_code="93000", original_description="EKG", plain_description="The EKG", billed_amount=310.0)
    result = models.GeminiResult(
        document_type="hospital_bill",
        line_items=[models.LineItem(**ekg), models.LineItem(**ekg),
                    models.LineItem(cpt_code="70450", original_description="CT HEAD", plain_description="The head CT scan", billed_amount=3200.0)],
        plain_summary="Summary.", spoken_summary="Here is your bill.",
    )
    checks = [_check(models, 0, "far_above_typical", 20.0), _check(models, 1, "far_above_typical", 20.0), _check(models, 2, "far_above_typical", 15.0)]
    analysis = models.AnalyzeResponse(target_language="en", model="m", mock=True, result=result, price_checks=checks)
    assert voice.routes.spoken_reply(analysis) == (
        "Here is your bill. I also compared the charges with Medicare's national rates. "
        "The EKG was billed about 20 times Medicare's national rate, which is far above the usual range. "
        "The head CT scan was billed about 15 times Medicare's national rate, which is far above the usual range. "
        "It's worth asking the billing office about them."
    )


def test_the_spoken_reply_when_prices_look_usual_or_were_not_compared(voice):
    models = importlib.import_module("models")
    usual = voice.routes.spoken_reply(_analysis(models, [_check(models, 2, "typical", 1.2)]))
    assert usual == (
        "Here is your bill. I also compared 1 charge with Medicare's national rates, and it looks within the "
        "usual range for hospital prices."
    )
    no_code = models.PriceCheck(line_index=0, cpt_code=None, billed_amount=3200.0, flag="no_code", note="n")
    assert voice.routes.spoken_reply(_analysis(models, [no_code])) == "Here is your bill."
    spanish = _analysis(models, [_check(models, 0, "far_above_typical", 30.0)], language="es-MX")
    assert voice.routes.spoken_reply(spanish) == "Here is your bill."  # English findings never join another language
    assert voice.routes.spoken_reply(spanish, "Un cargo es alto.") == "Here is your bill. Un cargo es alto."


def test_the_spoken_reply_never_claims_overcharging(voice):
    models = importlib.import_module("models")
    facility = "Medicare's rate here covers only the doctor's fee; hospitals also bill a separate facility fee."
    checks = [_check(models, i, "far_above_typical", 30.0, note=facility) for i in range(3)]
    reply = voice.routes.spoken_reply(_analysis(models, checks)).lower()
    assert "1 other charge also looks high." in reply
    assert "covers only the doctor's part, so some difference is expected." in reply  # the caveat is spoken too
    for word in ("overcharg", "illegal", "fraud", "negotiat", "rip"):
        assert word not in reply


def test_the_worst_charges_are_named_first(voice):
    models = importlib.import_module("models")
    checks = [_check(models, 0, "above_typical", 3.1), _check(models, 1, "above_typical", 3.2), _check(models, 2, "far_above_typical", 50.0)]
    assert voice.routes.spoken_reply(_analysis(models, checks)) == (
        "Here is your bill. I also compared the charges with Medicare's national rates. "
        "The lab panel was billed about 50 times Medicare's national rate, which is far above the usual range. "
        "The ER visit was billed about 3.2 times Medicare's national rate, which is higher than usual. "
        "1 other charge also looks high. It's worth asking the billing office about them."
    )


def test_large_ratios_are_said_as_plain_numbers(voice):
    models = importlib.import_module("models")
    reply = voice.routes.spoken_reply(_analysis(models, [_check(models, 0, "far_above_typical", 1234567.0)]))
    assert "billed about 1,234,567 times Medicare's national rate" in reply and "e+" not in reply
    assert [voice.routes._times(value) for value in (30.0, 4.5, 99.9, 123.4)] == ["30", "4.5", "99.9", "123"]


def test_the_reply_reads_well_without_a_final_full_stop_or_a_plain_name(voice):
    models = importlib.import_module("models")
    analysis = _analysis(models, [_check(models, 0, "far_above_typical", 30.0), _check(models, 1, "far_above_typical", 20.0)])
    analysis.result.spoken_summary = "Here is your bill"
    analysis.result.line_items[0].plain_description = "   "  # blank: the printed description is used
    analysis.result.line_items[1].plain_description = ""
    analysis.result.line_items[1].original_description = " "  # nothing to say: "Line 2"
    assert voice.routes.spoken_reply(analysis) == (
        "Here is your bill. I also compared the charges with Medicare's national rates. "
        "CT HEAD was billed about 30 times Medicare's national rate, which is far above the usual range. "
        "Line 2 was billed about 20 times Medicare's national rate, which is far above the usual range. "
        "It's worth asking the billing office about them."
    )


def test_a_charge_described_in_sentences_is_named_by_its_first(voice):
    models = importlib.import_module("models")
    analysis = _analysis(models, [_check(models, 0, "far_above_typical", 30.0)], language="ja-JP")
    analysis.result.line_items[0].plain_description = "頭部のCT検査です。薬を使わずに頭の中を写真に撮ります。"
    assert voice.routes.price_findings(analysis).split(" was billed")[0].endswith("頭部のCT検査です")
    analysis.result.line_items[0].plain_description = "Dr. visit, E.R."  # Latin abbreviations are not sentence ends
    assert "Dr. visit, E.R was billed" in voice.routes.price_findings(analysis)


def test_english_locales_get_the_price_findings_too(voice):
    models = importlib.import_module("models")
    for language in ("en-US", "en_GB", "EN"):
        reply = voice.routes.spoken_reply(_analysis(models, [_check(models, 0, "far_above_typical", 30.0)], language=language))
        assert "I also compared the charges with Medicare's national rates." in reply


def test_a_phone_locale_reaches_speech_to_text_as_the_language_alone(voice):
    response = ask(voice, target_language="en-US")
    assert response.status_code == 200
    assert voice.scribe.calls[0]["language"] == "en"  # speech-to-text takes "en", not "en-US"
    assert voice.gemini.calls[0]["lang"] == "en-US"  # Gemini and the answer get the locale, as on /api/v1/analyze
    assert "I also compared the charges" in response.json()["speech"]["text"]


def test_captions_are_exactly_the_text_sent_to_elevenlabs(voice):
    voice.gemini.spoken_summary = "Your visit on 2026-09-02 was billed three thousand two hundred dollars"
    speech = ask(voice).json()["speech"]
    assert speech["ok"] is True
    assert speech["text"] == voice.speaker.texts[-1]  # after the module's cleanup, as ElevenLabs received it
    assert "2026-09-02" not in speech["text"]  # the cleanup says dates the way people do


def test_an_unsupported_bill_type_is_refused_before_paying_for_speech_to_text(voice):
    response = voice.client.post(
        "/api/v1/voice/analyze",
        files={"audio": ("question.m4a", PHONE_RECORDING, "audio/m4a"), "file": ("bill.gif", b"GIF89a" + b"\x00" * 500, "image/gif")},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == {"stage": "gemini", "message": "Unsupported file type image/gif. Use JPG, PNG, WEBP, HEIC or PDF."}
    assert voice.scribe.calls == [] and voice.gemini.calls == []


def test_an_oversized_recording_is_refused_without_reading_it_all(voice, monkeypatch):
    stt_service = importlib.import_module("services.audio_service.speech_to_text.service")
    stt_config = importlib.import_module("services.audio_service.speech_to_text.config")
    small = stt_service.STTService(stt_config.STTConfig(api_key="k", max_audio_mb=0.001), voice.scribe, sleep=lambda s: None)
    monkeypatch.setattr(stt_service, "_default_service", small)
    response = ask(voice)  # about 5 KB, over the 1 KB limit
    assert response.status_code == 413
    detail = response.json()["detail"]
    assert detail["stage"] == "speech_to_text" and detail["error_code"] == "AUDIO_TOO_LARGE" and "STT_MAX_AUDIO_MB" in detail["message"]
    assert voice.scribe.calls == [] and voice.gemini.calls == []


def test_speaking_an_analysis_saved_in_an_older_shape_is_409(voice):
    audit_id = str(uuid.uuid4())
    voice.store.saved[audit_id] = {"audit_id": audit_id, "created_at": "2026-10-09T12:00:00+00:00", "source": "text",
                                   "transcript": None, "analysis": {"target_language": "en", "model": "m"}}  # no result
    response = voice.client.post("/api/v1/voice/speak", data={"audit_id": audit_id})
    assert response.status_code == 409 and response.json()["detail"]["stage"] == "audit"
    assert voice.speaker.texts == []


def test_the_reply_audio_is_made_while_the_analysis_is_saved(voice, monkeypatch):
    import threading

    speaking = threading.Event()
    real_generate = voice.speaker.generate

    def generate(*args, **kwargs):
        speaking.set()
        return real_generate(*args, **kwargs)

    monkeypatch.setattr(voice.speaker, "generate", generate)
    seen = {}

    async def slow_save(response, *, source, transcript=None):
        seen["speaking_during_save"] = await asyncio.to_thread(speaking.wait, 5)  # sequential code would wait 5 s here
        return await voice.store.save_analysis(response, source=source, transcript=transcript)

    monkeypatch.setattr(voice.routes, "save_analysis", slow_save)
    body = ask(voice).json()
    assert seen == {"speaking_during_save": True}
    assert body["speech"]["ok"] is True and body["analysis"]["audit"]["saved"] is True
