"""Tests for the wiring in main.py: every route mounted, each analysis saved, saved analyses readable.

Offline: Gemini runs in MOCK mode, prices come from data/cpt_benchmarks.csv, ElevenLabs is replaced by fakes, and the
Tiger Data store by an in-memory stand-in (tests/test_analysis_store.py checks the real store against a test database).
"""
import importlib
import sys
import types
import uuid

import dotenv
import pytest
from fastapi.testclient import TestClient

# Real environment variables win over settings files, so these keep the tests offline and away from real keys and
# databases. (main.py's own reading of backend/.env is switched off below.)
SAFE_ENV = {
    "MOCK": "true",
    "PRICE_SOURCE": "csv",
    "GEMINI_API_KEY": "test-key",
    "ELEVENLABS_API_KEY": "test-key",
    "TIGER_DATA_POSTGRES_URL": "",
}
BILL_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
RECORDING = b"ID3" + b"\x01" * 4000  # an MP3, as far as the audio check can tell
QUESTION = "Why was my head CT so expensive?"


class FakeStore:
    """Stands in for services.analytical_services.analysis_store's save_analysis and load_analysis."""

    def __init__(self, main):
        self.main = main
        self.saved = {}
        self.configured = True

    async def save_analysis(self, response, *, source, transcript=None):
        audit_info = importlib.import_module("models").AuditInfo
        if not self.configured:
            return audit_info(saved=False, error="Not saved: Tiger Data is not configured (TIGER_DATA_POSTGRES_URL).")
        audit_id = str(uuid.uuid4())
        self.saved[audit_id] = {
            "audit_id": audit_id, "created_at": "2026-10-09T12:00:00+00:00", "source": source,
            "transcript": transcript, "analysis": response.model_dump(mode="json", exclude={"audit"}),
        }
        return audit_info(saved=True, audit_id=audit_id)

    async def load_analysis(self, audit_id):
        try:
            uuid.UUID(str(audit_id))
        except ValueError:
            raise ValueError("audit_id must be a valid UUID.") from None
        if not self.configured:
            raise self.main.StoreUnavailable("Tiger Data is not configured (TIGER_DATA_POSTGRES_URL).")
        saved = self.saved.get(audit_id)
        if saved is None:
            return None
        return {**saved, "analysis": {**saved["analysis"], "audit": {"saved": True, "audit_id": audit_id, "error": None}}}


@pytest.fixture
def backend(monkeypatch):
    for name, value in SAFE_ENV.items():
        monkeypatch.setenv(name, value)
    if "main" not in sys.modules:  # main.py reads backend/.env when imported: keep a developer's real settings out
        monkeypatch.setattr(dotenv, "load_dotenv", lambda *args, **kwargs: False)
    main = importlib.import_module("main")
    prices = importlib.import_module("services.snowflake_services.snowflake_service")
    monkeypatch.setattr(prices, "_lookup_cache", {})  # each test starts with no cached price lookups
    store = FakeStore(main)
    monkeypatch.setattr(main, "save_analysis", store.save_analysis)
    monkeypatch.setattr(main, "load_analysis", store.load_analysis)
    return types.SimpleNamespace(client=TestClient(main.app), store=store, main=main)


def test_every_route_is_mounted(backend):
    paths = {getattr(route, "path", None) for route in backend.main.app.routes}
    voice = importlib.import_module("services.audio_service.voice_routes").router
    paths |= {route.path for route in voice.routes}
    for path in ("/api/v1/analyze", "/api/v1/audits/{audit_id}", "/api/v1/voice/analyze", "/api/v1/voice/speak",
                 "/api/v1/voice/audio/{audio_id}", "/api/v1/voice/voices"):
        assert path in paths
    # The voice router is part of the app itself, not just importable: its routes answer.
    assert backend.client.post("/api/v1/voice/speak", data={"audit_id": "not-a-uuid"}).status_code == 400


def test_a_typed_question_is_analyzed_price_checked_and_saved(backend):
    response = backend.client.post("/api/v1/analyze", data={"text": "Why is my CT so expensive?"})
    assert response.status_code == 200
    body = response.json()
    assert body["price_summary"]["source"] == "local_csv" and body["price_checks"]
    assert body["audit"]["saved"] is True
    stored = backend.store.saved[body["audit"]["audit_id"]]
    assert stored["source"] == "text"
    assert stored["analysis"]["price_checks"] == body["price_checks"]  # saved after the price check


def test_an_uploaded_bill_is_saved_as_a_file_analysis(backend):
    body = backend.client.post("/api/v1/analyze", files={"file": ("bill.png", BILL_PNG, "image/png")}).json()
    assert backend.store.saved[body["audit"]["audit_id"]]["source"] == "file"


def test_multiple_camera_pages_are_forwarded_to_gemini_in_order(backend, monkeypatch):
    received = {}
    original = backend.main.analyze

    async def capture_inputs(**kwargs):
        received.update(kwargs)
        return await original(**kwargs)

    monkeypatch.setattr(backend.main, "analyze", capture_inputs)
    response = backend.client.post("/api/v1/analyze", files=[
        ("files", ("page-1.jpg", b"first-page", "image/jpeg")),
        ("files", ("page-2.jpg", b"second-page", "image/jpeg")),
    ])
    assert response.status_code == 200
    assert received["image_inputs"] == [(b"first-page", "image/jpeg"), (b"second-page", "image/jpeg")]
    assert backend.store.saved[response.json()["audit"]["audit_id"]]["source"] == "file"


def test_combined_camera_upload_limit_is_enforced(backend):
    too_large = b"x" * (15 * 1024 * 1024 + 1)
    response = backend.client.post("/api/v1/analyze", files=[("files", ("page.jpg", too_large, "image/jpeg"))])
    assert response.status_code == 413


def test_the_analysis_still_comes_back_when_it_cannot_be_saved(backend):
    backend.store.configured = False
    response = backend.client.post("/api/v1/analyze", data={"text": "Hello"})
    assert response.status_code == 200
    assert response.json()["audit"] == {
        "saved": False, "audit_id": None, "error": "Not saved: Tiger Data is not configured (TIGER_DATA_POSTGRES_URL).",
    }


def test_with_the_real_store_and_no_database_nothing_is_attempted(backend, monkeypatch):
    store = importlib.import_module("services.analytical_services.analysis_store")
    monkeypatch.setattr(backend.main, "save_analysis", store.save_analysis)
    body = backend.client.post("/api/v1/analyze", data={"text": "Hello"}).json()
    assert body["audit"]["saved"] is False and "TIGER_DATA_POSTGRES_URL" in body["audit"]["error"]


def test_a_saved_analysis_can_be_read_back(backend):
    body = backend.client.post("/api/v1/analyze", data={"text": "Why is my CT so expensive?"}).json()
    saved = backend.client.get(f"/api/v1/audits/{body['audit']['audit_id']}")
    assert saved.status_code == 200
    data = saved.json()
    assert data["source"] == "text" and data["analysis"] == body  # exactly what /api/v1/analyze returned


@pytest.mark.parametrize("audit_id, status", [("not-a-uuid", 400), (str(uuid.uuid4()), 404)])
def test_unknown_or_malformed_audits(backend, audit_id, status):
    assert backend.client.get(f"/api/v1/audits/{audit_id}").status_code == status


def test_reading_audits_needs_tiger_data(backend):
    backend.store.configured = False
    response = backend.client.get(f"/api/v1/audits/{uuid.uuid4()}")
    assert response.status_code == 503 and "TIGER_DATA_POSTGRES_URL" in response.json()["detail"]


class FakeScribe:
    """Stands in for ElevenLabs speech-to-text: always hears QUESTION."""

    def __init__(self, provider_module):
        self.module = provider_module
        self.languages = []

    def transcribe(self, audio, filename, mime_type, language):
        self.languages.append(language)
        return self.module.ProviderTranscript(text=QUESTION, language=language, audio_seconds=2.0)


class FakeVoice:
    """Stands in for ElevenLabs text-to-speech: the 'audio' is the text it was asked to say."""

    def __init__(self, provider_module):
        self.module = provider_module
        self.texts = []

    def generate(self, text, voice_id, settings=None):
        self.texts.append(text)
        return self.module.ProviderAudio(audio=b"ID3" + text.encode(), request_id="fake")


@pytest.fixture
def voice(backend, monkeypatch):
    """main.app's real voice routes, with fake ElevenLabs services and the same in-memory store as main.py."""
    stt_service = importlib.import_module("services.audio_service.speech_to_text.service")
    stt_config = importlib.import_module("services.audio_service.speech_to_text.config")
    stt_provider = importlib.import_module("services.audio_service.speech_to_text.elevenlabs_provider")
    tts_service = importlib.import_module("services.audio_service.text_to_speech.service")
    tts_config = importlib.import_module("services.audio_service.text_to_speech.config")
    tts_cache = importlib.import_module("services.audio_service.text_to_speech.cache")
    tts_provider = importlib.import_module("services.audio_service.text_to_speech.elevenlabs_provider")
    scribe, speaker = FakeScribe(stt_provider), FakeVoice(tts_provider)
    monkeypatch.setattr(stt_service, "_default_service",
                        stt_service.STTService(stt_config.STTConfig(api_key="test-key"), scribe, sleep=lambda s: None))
    monkeypatch.setattr(tts_service, "_default_service", tts_service.TTSService(
        tts_config.TTSConfig(api_key="test-key", cache_dir=None), speaker, tts_cache.AudioCache(None),
        pronunciations={}, sleep=lambda s: None))
    routes = sys.modules["services.audio_service.voice_routes"]  # the module main.py mounted
    monkeypatch.setattr(routes, "save_analysis", backend.store.save_analysis)
    monkeypatch.setattr(routes, "load_analysis", backend.store.load_analysis)
    return types.SimpleNamespace(scribe=scribe, speaker=speaker, routes=routes)


def test_a_spoken_question_through_the_app_is_analyzed_price_checked_saved_and_answered(backend, voice):
    typed = backend.client.post("/api/v1/analyze", data={"text": QUESTION}).json()
    response = backend.client.post("/api/v1/voice/analyze", files={"audio": ("question.mp3", RECORDING, "audio/mpeg")})
    assert response.status_code == 200
    body = response.json()
    assert body["transcript"]["text"] == QUESTION
    assert body["analysis"]["price_checks"] == typed["price_checks"]  # the same price check as the typed question
    stored = backend.store.saved[body["analysis"]["audit"]["audit_id"]]
    assert stored["source"] == "voice" and stored["transcript"] == QUESTION
    assert body["speech"]["ok"] is True and body["speech"]["text"] == voice.speaker.texts[-1]
    assert "times Medicare's national rate" in body["speech"]["text"]  # the price findings are spoken
    audio = backend.client.get(body["speech"]["audio_url"])
    assert audio.status_code == 200 and audio.headers["content-type"] == "audio/mpeg"


def test_a_saved_analysis_is_spoken_again_through_the_app(backend, voice):
    saved = backend.client.post("/api/v1/analyze", data={"text": QUESTION}).json()["audit"]["audit_id"]
    speech = backend.client.post("/api/v1/voice/speak", data={"audit_id": saved}).json()
    assert speech["ok"] is True and "times Medicare's national rate" in speech["text"]
    assert backend.client.get(speech["audio_url"]).status_code == 200
