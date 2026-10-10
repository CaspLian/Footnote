"""Tests for voice_routes: recording -> speech-to-text -> Gemini step -> spoken reply.

The team's Gemini module is replaced by a stand-in (the real one needs the Google SDK and a key),
and ElevenLabs by fakes, so these run offline at no cost. The routes are imported the way the
backend imports them: as services.audio_service.voice_routes, with backend/ on the path.
"""

import asyncio
import importlib
import sys
import types
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
    """Stands in for services.gemini_service: records each call, returns a GeminiResult."""

    def __init__(self, models):
        self.models = models
        self.calls = []
        self.error = None
        self.delay = 0.0

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
            spoken_summary="Your MRI was billed at three thousand two hundred dollars.",
            questions_to_ask=["Can you explain the MRI charge?"],
        )


class FakePriceCheck:
    """Stands in for services.snowflake_service.check_prices (the real one queries Snowflake)."""

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
        self.error = None

    def generate(self, text, voice_id, settings=None):
        self.texts.append(text)
        self.voice_ids.append(voice_id)
        if self.error:
            raise self.error
        return self.module.ProviderAudio(audio=b"ID3" + text.encode(), request_id="tts-1", characters_billed=len(text))


@pytest.fixture
def voice(monkeypatch):
    """A FastAPI app with the voice router mounted, and handles on every fake."""
    monkeypatch.syspath_prepend(str(BACKEND_DIR))
    models = importlib.import_module("models")
    gemini = FakeGemini(models)
    fake_module = types.ModuleType("services.gemini_service")
    fake_module.analyze = gemini.analyze
    fake_module.is_mock = lambda: True
    fake_module.model_name = lambda: "fake-gemini"
    monkeypatch.setitem(sys.modules, "services.gemini_service", fake_module)
    prices = FakePriceCheck(models)
    fake_prices = types.ModuleType("services.snowflake_service")
    fake_prices.check_prices = prices.check_prices
    monkeypatch.setitem(sys.modules, "services.snowflake_service", fake_prices)
    monkeypatch.delitem(sys.modules, "services.audio_service.voice_routes", raising=False)
    routes = importlib.import_module("services.audio_service.voice_routes")

    stt_service = importlib.import_module("services.audio_service.speech_to_text.service")
    stt_config = importlib.import_module("services.audio_service.speech_to_text.config")
    stt_provider = importlib.import_module("services.audio_service.speech_to_text.elevenlabs_provider")
    tts_service = importlib.import_module("services.audio_service.text_to_speech.service")
    tts_config = importlib.import_module("services.audio_service.text_to_speech.config")
    tts_cache = importlib.import_module("services.audio_service.text_to_speech.cache")
    tts_provider = importlib.import_module("services.audio_service.text_to_speech.elevenlabs_provider")

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
        client=TestClient(app), gemini=gemini, prices=prices, scribe=scribe, speaker=speaker, routes=routes,
        stt_errors=stt_provider,
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
    assert voice.gemini.calls == [{"file_bytes": None, "mime_type": None, "text": "Why was my MRI so expensive?", "lang": "en"}]
    # "analysis" has the /api/v1/analyze shape.
    assert body["analysis"]["model"] == "fake-gemini" and body["analysis"]["mock"] is True
    assert body["analysis"]["result"]["document_type"] == "hospital_bill"
    # spoken_summary was turned into audio, which the audio route serves.
    assert voice.speaker.texts == ["Your MRI was billed at three thousand two hundred dollars."]
    assert body["speech"]["ok"] is True and body["speech"]["mime_type"] == "audio/mpeg"
    audio = voice.client.get(body["speech"]["audio_url"])
    assert audio.status_code == 200 and audio.headers["content-type"] == "audio/mpeg"
    assert audio.content == b"ID3Your MRI was billed at three thousand two hundred dollars."


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


def test_the_spoken_language_goes_to_both_speech_to_text_and_gemini(voice):
    response = ask(voice, target_language="es")
    assert response.status_code == 200
    assert voice.scribe.calls[0]["language"] == "es" and voice.gemini.calls[0]["lang"] == "es"
    # The reply voice is English-only for now: the text answer still comes back.
    assert response.json()["speech"] == {
        "ok": False, "audio_url": None, "mime_type": None, "voice": None, "streaming": False,
        "error_code": "INVALID_REQUEST", "error_message": "Only English is supported for now (language='es').",
    }


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


def test_bill_over_the_limit_is_413(voice, monkeypatch):
    monkeypatch.setattr(voice.routes, "MAX_BILL_MB", 0.001)
    response = ask(voice, bill=BILL_PHOTO)
    assert response.status_code == 413 and voice.gemini.calls == []


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
    assert probe.headers["cache-control"] == "public, max-age=31536000, immutable"
    assert voice.client.get(url).headers["accept-ranges"] == "bytes"


def test_finished_reply_is_the_default_so_iphones_can_play_it(voice):
    speech = ask(voice).json()["speech"]
    assert speech["ok"] is True and speech["streaming"] is False


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
