"""Test setup shared by text_to_speech and speech_to_text."""

import os

import pytest

import speech_to_text.config as stt_config
import text_to_speech.config as tts_config

_SETTING_PREFIXES = ("ELEVENLABS_", "TTS_", "STT_")


@pytest.fixture(autouse=True)
def never_read_the_real_backend_env(monkeypatch, tmp_path_factory):
    """Tests must not load the team's real backend/.env: it may hold real API keys."""
    fake_backend = tmp_path_factory.mktemp("no-backend")
    monkeypatch.setattr(tts_config, "BACKEND_DIR", fake_backend)
    monkeypatch.setattr(stt_config, "BACKEND_DIR", fake_backend)


@pytest.fixture(autouse=True)
def restore_audio_settings():
    """load_dotenv() writes straight into os.environ, so undo any setting a test loaded."""
    before = {name: value for name, value in os.environ.items() if name.startswith(_SETTING_PREFIXES)}
    yield
    for name in [name for name in os.environ if name.startswith(_SETTING_PREFIXES)]:
        if name not in before:
            del os.environ[name]
    os.environ.update(before)
