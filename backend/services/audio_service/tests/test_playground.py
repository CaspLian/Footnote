"""Tests for the voice playground server, with a fake ElevenLabs: no network, no cost."""

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from fastapi.testclient import TestClient  # noqa: E402

import playground  # noqa: E402
import text_to_speech.service as tts_service  # noqa: E402
from text_to_speech.cache import AudioCache  # noqa: E402
from text_to_speech.config import TTSConfig  # noqa: E402
from text_to_speech.elevenlabs_provider import ProviderAudio  # noqa: E402

BUNTY_ID = "nwj0s2LU9bDWRKND5yzA"


class FakeVoice:
    def __init__(self):
        self.calls = []

    def generate(self, text, voice_id):
        self.calls.append((text, voice_id))
        return ProviderAudio(audio=b"ID3" + text.encode(), request_id="req-1", characters_billed=len(text) // 2)


@pytest.fixture
def client(monkeypatch):
    fake = FakeVoice()
    service = tts_service.TTSService(
        TTSConfig(api_key="k", cache_dir=None), fake, AudioCache(None), pronunciations={}, sleep=lambda s: None
    )
    monkeypatch.setattr(tts_service, "_default_service", service)
    test_client = TestClient(playground.app)
    test_client.fake = fake
    return test_client


def speak(client, text, voice=None):
    return client.post("/api/speak", json={"text": text, "voice": voice}).json()


def test_the_page_loads(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "ClaimPulse voice playground" in response.text and "/api/speak" in response.text


def test_all_voices_are_listed(client):
    data = client.get("/api/voices").json()
    assert data["default"] == "matilda"
    keys = [v["key"] for v in data["voices"]]
    assert len(keys) == 20 and keys[:5] == ["matilda", "sarah", "george", "charlie", "bunty"]


def test_typed_text_is_spoken_in_the_chosen_voice(client):
    result = speak(client, "Hello **there**", "bunty")
    assert result["ok"] and result["voice"] == "bunty"
    assert result["spoken_text"] == "Hello there."  # cleaned up like any Gemini answer
    assert client.fake.calls == [("Hello there.", BUNTY_ID)]
    assert "audio" not in result  # the JSON carries a link, not the audio bytes
    audio = client.get(result["audio_url"])
    assert audio.status_code == 200 and audio.headers["content-type"] == "audio/mpeg"
    assert audio.content == b"ID3Hello there."


def test_no_voice_choice_uses_the_default(client):
    assert speak(client, "Hello")["voice"] == "matilda"


def test_the_same_text_in_the_same_voice_again_is_free(client):
    speak(client, "Hello", "george")
    again = speak(client, "Hello", "george")
    assert again["cached"] and again["characters_sent"] == 0
    assert len(client.fake.calls) == 1


def test_problems_come_back_as_error_codes(client):
    unknown = speak(client, "Hi", "nobody")
    assert unknown["ok"] is False and unknown["error_code"] == "INVALID_REQUEST" and unknown["audio_url"] is None
    assert speak(client, "   ", "george")["error_code"] == "EMPTY_TEXT"
    assert client.fake.calls == []


def test_missing_text_is_rejected(client):
    assert client.post("/api/speak", json={"voice": "george"}).status_code == 422


def test_a_voice_sample_is_made_once(client):
    first = client.get("/api/voices/bunty/sample")
    assert first.status_code == 200 and first.content.startswith(b"ID3Hi, I'm Bunty.")
    assert client.get("/api/voices/bunty/sample").content == first.content
    assert len(client.fake.calls) == 1
    assert client.get("/api/voices/nobody/sample").status_code == 404


def test_unknown_audio_is_404(client):
    assert client.get("/api/audio/" + "0" * 32).status_code == 404
    assert client.get("/api/audio/not-an-id").status_code == 404


def test_port_helpers():
    port = playground._free_port()
    assert playground._port_is_free(port)
