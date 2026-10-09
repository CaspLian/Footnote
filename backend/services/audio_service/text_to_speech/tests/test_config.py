from pathlib import Path

import pytest

import text_to_speech.config as config_module
from text_to_speech.config import SERVICE_DIR, TTSConfig


@pytest.fixture
def clean_env(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)  # no real .env nearby
    for name in [
        "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID", "ELEVENLABS_MODEL_ID", "ELEVENLABS_OUTPUT_FORMAT",
        "ELEVENLABS_SPEED", "TTS_MAX_CHARS", "TTS_TIMEOUT_SECONDS", "TTS_MAX_RETRIES", "TTS_CACHE_DIR",
        "ELEVENLABS_BASE_URL",
    ]:
        monkeypatch.delenv(name, raising=False)
    return monkeypatch


def test_defaults(clean_env):
    config = TTSConfig.from_env()
    assert not config.is_configured
    assert config.model_id == "eleven_multilingual_v2"
    assert config.output_format == "mp3_44100_128"
    assert config.mime_type == "audio/mpeg" and config.file_extension == "mp3"
    assert config.speed is None and config.voice_settings() is None
    assert config.max_chars == 2500 and config.max_retries == 1
    assert config.cache_dir == str(SERVICE_DIR / ".tts_cache")  # inside audio_service, wherever we run from


def test_relative_cache_dir_is_inside_the_service_folder(clean_env, tmp_path):
    clean_env.setenv("TTS_CACHE_DIR", "my_cache")
    assert TTSConfig.from_env().cache_dir == str(SERVICE_DIR / "my_cache")
    clean_env.setenv("TTS_CACHE_DIR", str(tmp_path / "absolute"))
    assert TTSConfig.from_env().cache_dir == str(tmp_path / "absolute")


def test_backend_env_is_used_when_no_env_file_is_nearby(clean_env, tmp_path):
    backend = tmp_path / "backend"
    backend.mkdir()
    (backend / ".env").write_text("ELEVENLABS_API_KEY=from-backend\nELEVENLABS_VOICE_ID=v\n", encoding="utf-8")
    elsewhere = tmp_path / "repo-root"
    elsewhere.mkdir()
    clean_env.chdir(elsewhere)  # e.g. `uvicorn backend.main:app` started from the repo root
    clean_env.setattr(config_module, "BACKEND_DIR", backend)
    config = TTSConfig.from_env()
    assert config.api_key == "from-backend" and config.is_configured


def test_service_folder_is_where_this_package_lives():
    assert SERVICE_DIR == Path(config_module.__file__).resolve().parent.parent


def test_reads_dotenv_file_but_real_environment_wins(clean_env, tmp_path):
    (tmp_path / ".env").write_text(
        "\N{BYTE ORDER MARK}ELEVENLABS_API_KEY=from-file\nELEVENLABS_VOICE_ID=voice-from-file\n", encoding="utf-8"
    )  # saved with a BOM, as some Windows editors do
    clean_env.setenv("ELEVENLABS_VOICE_ID", "voice-from-environment")
    config = TTSConfig.from_env()
    assert config.api_key == "from-file"  # the BOM did not swallow the first variable
    assert config.voice_id == "voice-from-environment"


def test_placeholder_key_counts_as_missing(clean_env):
    clean_env.setenv("ELEVENLABS_API_KEY", "your-elevenlabs-api-key-here")
    clean_env.setenv("ELEVENLABS_VOICE_ID", "voice-1")
    assert not TTSConfig.from_env().is_configured


def test_empty_cache_dir_means_memory_only(clean_env):
    clean_env.setenv("TTS_CACHE_DIR", "")
    assert TTSConfig.from_env().cache_dir is None


@pytest.mark.parametrize(
    "name, value, message",
    [
        ("TTS_MAX_CHARS", "abc", "whole number"),
        ("TTS_MAX_CHARS", "0", "at least 1"),
        ("TTS_MAX_RETRIES", "9", "at most 3"),
        ("TTS_TIMEOUT_SECONDS", "fast", "number"),
        ("ELEVENLABS_SPEED", "2.0", "at most 1.2"),
        ("ELEVENLABS_SPEED", "0.5", "at least 0.7"),
    ],
)
def test_bad_values_fail_at_startup_with_a_clear_message(clean_env, name, value, message):
    clean_env.setenv(name, value)
    with pytest.raises(ValueError, match=message):
        TTSConfig.from_env()


def test_speed_goes_into_voice_settings_and_audio_settings(clean_env):
    clean_env.setenv("ELEVENLABS_SPEED", "1.1")
    config = TTSConfig.from_env()
    assert config.voice_settings() == {"speed": 1.1}
    assert config.audio_settings()["voice_settings"] == {"speed": 1.1}
