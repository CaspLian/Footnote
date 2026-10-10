import os
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
        "ELEVENLABS_BASE_URL", "ELEVENLABS_TEXT_NORMALIZATION",
        "PYTHON_DOTENV_DISABLED",  # a developer's own setting must not turn the file tests off
    ]:
        monkeypatch.delenv(name, raising=False)
    return monkeypatch


def test_defaults(clean_env):
    config = TTSConfig.from_env()
    assert not config.is_configured
    assert config.model_id == "eleven_flash_v2_5"
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


def test_backend_api_env_is_used_when_there_is_no_env(clean_env, tmp_path):
    backend = tmp_path / "backend"
    backend.mkdir()
    (backend / "api.env").write_text("ELEVENLABS_API_KEY=from-api-env\n", encoding="utf-8")
    clean_env.setattr(config_module, "BACKEND_DIR", backend)
    assert TTSConfig.from_env().api_key == "from-api-env"


def test_only_voice_settings_are_taken_from_the_file(clean_env, tmp_path):
    """The file may also hold other services' keys or placeholders for them (backend/api.env does). They must not
    reach os.environ, where Gemini, Snowflake and Tiger Data read their settings."""
    backend = tmp_path / "backend"
    backend.mkdir()
    (backend / "api.env").write_text(
        "ELEVENLABS_API_KEY=from-api-env\nGEMINI_API_KEY=your-gemini-key\nSNOWFLAKE_ACCOUNT=your-account\n"
        "TIGER_DATA_POSTGRES_URL=postgresql://user:password@host:port/dbname\n",
        encoding="utf-8",
    )
    others = {"GEMINI_API_KEY", "SNOWFLAKE_ACCOUNT", "TIGER_DATA_POSTGRES_URL"}
    for name in others:
        clean_env.delenv(name, raising=False)
    clean_env.setattr(config_module, "BACKEND_DIR", backend)
    assert TTSConfig.from_env().api_key == "from-api-env"
    assert not others & set(os.environ)


def test_python_dotenv_disabled_turns_the_file_off(clean_env, tmp_path):
    backend = tmp_path / "backend"
    backend.mkdir()
    (backend / "api.env").write_text("ELEVENLABS_API_KEY=from-api-env\n", encoding="utf-8")
    clean_env.setattr(config_module, "BACKEND_DIR", backend)
    clean_env.setenv("PYTHON_DOTENV_DISABLED", "True")  # the switch python-dotenv itself honors
    assert TTSConfig.from_env().api_key == ""


def test_backend_env_wins_over_api_env(clean_env, tmp_path):
    backend = tmp_path / "backend"
    backend.mkdir()
    (backend / ".env").write_text("ELEVENLABS_API_KEY=from-env\n", encoding="utf-8")
    (backend / "api.env").write_text("ELEVENLABS_API_KEY=from-api-env\n", encoding="utf-8")
    clean_env.setattr(config_module, "BACKEND_DIR", backend)
    assert TTSConfig.from_env().api_key == "from-env"


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


def test_audio_settings_keep_cache_keys_stable_per_model(clean_env):
    # The cache key is built from these. Adding a key here would make every clip already made
    # (and paid for) unreachable, so new settings are only added when they are not the default.
    # The default model changed on purpose on 2026-10-10, to Flash v2.5. Clips made with Multilingual v2 stay
    # cached for requests that choose it; the default makes new ones.
    assert TTSConfig.from_env().audio_settings() == {
        "model_id": "eleven_flash_v2_5",
        "output_format": "mp3_44100_128",
        "voice_settings": None,
        "apply_text_normalization": "on",
    }
    assert TTSConfig.from_env().audio_settings("eleven_multilingual_v2") == {
        "model_id": "eleven_multilingual_v2",
        "output_format": "mp3_44100_128",
        "voice_settings": None,
    }


def test_an_empty_model_setting_means_the_default(clean_env):
    clean_env.setenv("ELEVENLABS_MODEL_ID", "  ")
    assert TTSConfig.from_env().model_id == "eleven_flash_v2_5"


def test_flash_and_turbo_get_number_reading_on_by_default(clean_env):
    config = TTSConfig.from_env()
    for model in ("eleven_flash_v2_5", "eleven_turbo_v2_5"):
        assert config.audio_settings(model)["apply_text_normalization"] == "on"
    for model in ("eleven_multilingual_v2", "eleven_v4", "eleven_v4_turbo"):
        assert "apply_text_normalization" not in config.audio_settings(model)  # ElevenLabs' "auto"


@pytest.mark.parametrize("value, flash, multilingual", [("ON", "on", "on"), ("off", "off", "off"), ("auto", None, None)])
def test_number_reading_setting_applies_to_every_model(clean_env, value, flash, multilingual):
    clean_env.setenv("ELEVENLABS_TEXT_NORMALIZATION", value)
    config = TTSConfig.from_env()
    assert config.audio_settings("eleven_flash_v2_5").get("apply_text_normalization") == flash
    assert config.audio_settings("eleven_multilingual_v2").get("apply_text_normalization") == multilingual


def test_bad_number_reading_setting_fails_at_startup(clean_env):
    clean_env.setenv("ELEVENLABS_TEXT_NORMALIZATION", "yes")
    with pytest.raises(ValueError, match="auto, on, off"):
        TTSConfig.from_env()


def test_speed_is_left_out_for_models_without_it(clean_env):
    clean_env.setenv("ELEVENLABS_SPEED", "1.1")
    config = TTSConfig.from_env()
    assert config.audio_settings("eleven_flash_v2_5")["voice_settings"] == {"speed": 1.1}
    assert config.audio_settings("eleven_v4")["voice_settings"] is None
    assert config.audio_settings("eleven_v4_turbo")["voice_settings"] is None
