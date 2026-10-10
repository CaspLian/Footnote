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

    def generate(self, text, voice_id, settings=None):
        self.calls.append((text, voice_id))
        return ProviderAudio(audio=b"ID3" + text.encode(), request_id="req-1", characters_billed=len(text) // 2)


@pytest.fixture
def client(monkeypatch):
    fake = FakeVoice()
    service = tts_service.TTSService(
        TTSConfig(api_key="k", cache_dir=None), fake, AudioCache(None), pronunciations={}, sleep=lambda s: None
    )
    monkeypatch.setattr(tts_service, "_default_service", service)
    test_client = TestClient(playground.app, base_url="http://127.0.0.1")  # the only hosts it answers
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


def test_the_page_can_list_the_models_to_compare(client):
    data = client.get("/api/models").json()
    assert data["default"] == "eleven_flash_v2_5"
    ids = [m["id"] for m in data["models"]]
    assert ids == ["eleven_multilingual_v2", "eleven_flash_v2_5", "eleven_v4_turbo", "eleven_v4"]
    flash = next(m for m in data["models"] if m["id"] == "eleven_flash_v2_5")
    assert flash["label"] == "Flash v2.5" and flash["credits_per_character"] == 0.22 and flash["note"]
    assert flash["note"].startswith("today's default.")  # marked from the configured model, not hard-coded
    assert not next(m for m in data["models"] if m["id"] == "eleven_multilingual_v2")["note"].startswith("today's")


def test_the_chosen_model_is_used_and_reported(client):
    multilingual = client.post("/api/speak", json={"text": "Hello", "voice": "george", "model": "eleven_multilingual_v2"}).json()
    assert multilingual["ok"] and multilingual["model"] == "eleven_multilingual_v2"
    default = speak(client, "Hello", "george")
    assert default["model"] == "eleven_flash_v2_5" and default["audio_id"] != multilingual["audio_id"]
    unknown = client.post("/api/speak", json={"text": "Hello", "model": "gpt-4"}).json()
    assert unknown["ok"] is False and unknown["error_code"] == "INVALID_REQUEST"


def test_finished_audio_answers_byte_range_requests(client):
    url = speak(client, "Hello there")["audio_url"]
    probe = client.get(url, headers={"Range": "bytes=0-1"})
    assert probe.status_code == 206 and probe.content == b"ID"
    whole = client.get(url)
    assert whole.status_code == 200 and whole.headers["accept-ranges"] == "bytes"


def test_requests_for_other_host_names_are_refused(client):
    # A web page that points its own name at 127.0.0.1 ("DNS rebinding") must not spend credits here.
    attack = client.post("/api/speak", json={"text": "Spend my credits"}, headers={"Host": "attacker.example:8765"})
    assert attack.status_code == 400 and client.fake.calls == []
    assert client.get("/", headers={"Host": "localhost:8765"}).status_code == 200


def test_each_answer_gets_its_own_audio_link(client):
    first, again = speak(client, "Hello", "george"), speak(client, "Hello", "george")
    assert first["audio_id"] == again["audio_id"]  # the same clip, made once...
    assert first["audio_url"] != again["audio_url"]  # ...but a fresh link, so no stale browser copy plays
    assert client.get(again["audio_url"]).content == client.get(first["audio_url"]).content
