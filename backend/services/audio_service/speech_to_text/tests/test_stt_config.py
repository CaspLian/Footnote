import os

import pytest

import speech_to_text.config as config_module
from speech_to_text.config import STTConfig

ENV_NAMES = [
    "ELEVENLABS_API_KEY", "ELEVENLABS_STT_MODEL_ID", "STT_MAX_AUDIO_MB", "STT_TIMEOUT_SECONDS",
    "STT_MAX_RETRIES", "ELEVENLABS_BASE_URL",
    "PYTHON_DOTENV_DISABLED",  # a developer's own setting must not turn the file tests off
]


@pytest.fixture
def clean_env(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)  # no real .env nearby
    for name in ENV_NAMES:
        monkeypatch.delenv(name, raising=False)
    return monkeypatch


def test_defaults(clean_env):
    config = STTConfig.from_env()
    assert not config.is_configured
    assert config.model_id == "scribe_v2"
    assert config.max_audio_mb == 10.0 and config.max_audio_bytes == 10 * 1024 * 1024
    assert config.timeout_seconds == 60.0 and config.max_retries == 1


def test_values_come_from_the_environment(clean_env):
    clean_env.setenv("ELEVENLABS_API_KEY", "k")
    clean_env.setenv("ELEVENLABS_STT_MODEL_ID", "scribe_v2_medical")
    clean_env.setenv("STT_MAX_AUDIO_MB", "2.5")
    config = STTConfig.from_env()
    assert config.is_configured and config.model_id == "scribe_v2_medical"
    assert config.max_audio_bytes == int(2.5 * 1024 * 1024)
    assert "ssn" in config.redact_entities and "deductible" in config.keyterms  # on by default


def test_redaction_and_keyterms_come_from_the_environment(clean_env):
    clean_env.setenv("STT_REDACT_ENTITIES", "none")
    clean_env.setenv("STT_KEYTERMS", "Footnote, coinsurance ,")
    config = STTConfig.from_env()
    assert config.redact_entities == () and config.keyterms == ("Footnote", "coinsurance")
    assert config.keyterms_for("en") == ("Footnote", "coinsurance") and config.keyterms_for("ja") == ("Footnote",)


def test_placeholder_key_counts_as_missing(clean_env):
    clean_env.setenv("ELEVENLABS_API_KEY", "your-elevenlabs-api-key-here")
    assert not STTConfig.from_env().is_configured


def test_backend_env_is_used_when_no_env_file_is_nearby(clean_env, tmp_path):
    backend = tmp_path / "backend"
    backend.mkdir()
    (backend / ".env").write_text("ELEVENLABS_API_KEY=from-backend\n", encoding="utf-8")
    clean_env.setattr(config_module, "BACKEND_DIR", backend)
    assert STTConfig.from_env().api_key == "from-backend"


def test_backend_api_env_is_used_when_there_is_no_env(clean_env, tmp_path):
    backend = tmp_path / "backend"
    backend.mkdir()
    (backend / "api.env").write_text("ELEVENLABS_API_KEY=from-api-env\n", encoding="utf-8")
    clean_env.setattr(config_module, "BACKEND_DIR", backend)
    assert STTConfig.from_env().api_key == "from-api-env"


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
    assert STTConfig.from_env().api_key == "from-api-env"
    assert not others & set(os.environ)


def test_python_dotenv_disabled_turns_the_file_off(clean_env, tmp_path):
    backend = tmp_path / "backend"
    backend.mkdir()
    (backend / "api.env").write_text("ELEVENLABS_API_KEY=from-api-env\n", encoding="utf-8")
    clean_env.setattr(config_module, "BACKEND_DIR", backend)
    clean_env.setenv("PYTHON_DOTENV_DISABLED", "True")  # the switch python-dotenv itself honors
    assert STTConfig.from_env().api_key == ""


@pytest.mark.parametrize(
    "name, value, message",
    [
        ("STT_MAX_AUDIO_MB", "lots", "number"),
        ("STT_MAX_AUDIO_MB", "0", "at least 0.1"),
        ("STT_MAX_RETRIES", "7", "at most 3"),
        ("STT_TIMEOUT_SECONDS", "0.5", "at least 1.0"),
    ],
)
def test_bad_values_fail_with_a_clear_message(clean_env, name, value, message):
    clean_env.setenv(name, value)
    with pytest.raises(ValueError, match=message):
        STTConfig.from_env()


def test_api_key_is_hidden_from_repr():
    assert "secret" not in repr(STTConfig(api_key="secret"))
