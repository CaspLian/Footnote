"""Test setup shared by text_to_speech, speech_to_text and the voice routes."""

import os
import sys
from pathlib import Path

import dotenv
import pytest
from dotenv import dotenv_values, find_dotenv

import speech_to_text.config as stt_config
import text_to_speech.config as tts_config

_SETTING_PREFIXES = ("ELEVENLABS_", "TTS_", "STT_")
# The voice routes import the same files as services.audio_service.*: separate modules, so they need the guard too.
_CONFIG_MODULES = (
    "speech_to_text.config",
    "text_to_speech.config",
    "services.audio_service.speech_to_text.config",
    "services.audio_service.text_to_speech.config",
)


@pytest.fixture(autouse=True)
def no_real_settings_files(monkeypatch, tmp_path_factory):
    """Tests must not load the team's real backend/.env or backend/api.env: they may hold real API keys.

    Only settings files that a test made itself, under pytest's temporary folder, can be read. The config
    modules already imported are guarded here; python-dotenv itself is guarded too, so a config module first
    imported during a test reads through the guarded functions. A test that imports a config module itself
    (as the voice routes test does) may also call the returned guard on it."""
    fake_backend = tmp_path_factory.mktemp("no-backend")
    allowed = tmp_path_factory.getbasetemp().resolve()

    def inside_tests(path) -> bool:
        return bool(path) and Path(path).resolve().is_relative_to(allowed)

    def find_test_dotenv(*args, **kwargs):
        found = find_dotenv(*args, **kwargs)
        return found if inside_tests(found) else ""

    def test_dotenv_values(dotenv_path=None, *args, **kwargs):
        if dotenv_path is not None and not inside_tests(dotenv_path):
            return {}
        return dotenv_values(dotenv_path, *args, **kwargs)

    def guard(module):
        monkeypatch.setattr(module, "BACKEND_DIR", fake_backend)
        monkeypatch.setattr(module, "find_dotenv", find_test_dotenv)
        monkeypatch.setattr(module, "dotenv_values", test_dotenv_values)

    monkeypatch.setattr(dotenv, "find_dotenv", find_test_dotenv)
    monkeypatch.setattr(dotenv, "dotenv_values", test_dotenv_values)
    for module in {stt_config, tts_config, *(sys.modules[name] for name in _CONFIG_MODULES if name in sys.modules)}:
        guard(module)
    return guard


@pytest.fixture(autouse=True)
def restore_audio_settings():
    """Loading a settings file writes straight into os.environ, so undo any setting a test loaded."""
    before = {name: value for name, value in os.environ.items() if name.startswith(_SETTING_PREFIXES)}
    yield
    for name in [name for name in os.environ if name.startswith(_SETTING_PREFIXES)]:
        if name not in before:
            del os.environ[name]
    os.environ.update(before)
