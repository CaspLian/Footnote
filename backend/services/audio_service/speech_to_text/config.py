"""Settings for the speech-to-text module, read from environment variables or a .env file.

Uses the same ELEVENLABS_API_KEY as text-to-speech. The .env loaded is the nearest one above
the folder you run from; if there is none, backend/.env. See ../.env.example for every variable.

This package deliberately shares no code with text_to_speech, so a change in one cannot break
the other. The small helpers below are copied on purpose.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import find_dotenv, load_dotenv

SERVICE_DIR = Path(__file__).resolve().parent.parent  # backend/services/audio_service
BACKEND_DIR = SERVICE_DIR.parent.parent  # backend

# scribe_v2: ElevenLabs' current batch model, $0.22 per hour of audio. scribe_v2_medical has the
# same price and API and is tuned for clinical audio. scribe_v1 is deprecated. Checked 2026-10-09
# at https://elevenlabs.io/docs/overview/models and https://elevenlabs.io/pricing/api
DEFAULT_MODEL_ID = "scribe_v2"
DEFAULT_BASE_URL = "https://api.elevenlabs.io"
DEFAULT_MAX_AUDIO_MB = 10.0  # Expo's HIGH_QUALITY preset records 128 kbps: about 10 minutes
DEFAULT_TIMEOUT_SECONDS = 60.0
PLACEHOLDER_API_KEY = "your-elevenlabs-api-key-here"  # the value in .env.example


@dataclass(frozen=True)
class STTConfig:
    api_key: str = field(default="", repr=False)  # repr=False keeps the key out of logs and tracebacks
    model_id: str = DEFAULT_MODEL_ID
    max_audio_mb: float = DEFAULT_MAX_AUDIO_MB
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS
    max_retries: int = 1
    base_url: str = DEFAULT_BASE_URL

    @classmethod
    def from_env(cls, *, load_env_file: bool = True) -> STTConfig:
        """Build from environment variables. Real environment variables win over .env values.

        Raises ValueError for malformed values (e.g. STT_MAX_AUDIO_MB=abc).
        """
        if load_env_file:
            env_file = find_env_file()
            if env_file:
                load_dotenv(env_file, override=False)
        api_key = _env_str("ELEVENLABS_API_KEY", "")
        return cls(
            api_key="" if api_key == PLACEHOLDER_API_KEY else api_key,
            model_id=_env_str("ELEVENLABS_STT_MODEL_ID", DEFAULT_MODEL_ID),
            max_audio_mb=_env_float("STT_MAX_AUDIO_MB", DEFAULT_MAX_AUDIO_MB, minimum=0.1),
            timeout_seconds=_env_float("STT_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS, minimum=1.0),
            max_retries=_env_int("STT_MAX_RETRIES", 1, minimum=0, maximum=3),
            base_url=_env_str("ELEVENLABS_BASE_URL", DEFAULT_BASE_URL).rstrip("/"),
        )

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    @property
    def max_audio_bytes(self) -> int:
        return int(self.max_audio_mb * 1024 * 1024)


def find_env_file() -> str | None:
    """The nearest .env above the folder you run from; otherwise backend/.env, then backend/api.env
    (the name the team's .gitignore protects)."""
    nearest = find_dotenv(usecwd=True)
    if nearest:
        return nearest
    for name in (".env", "api.env"):
        candidate = BACKEND_DIR / name
        if candidate.is_file():
            return str(candidate)
    return None


def _env_str(name: str, default: str) -> str:
    return os.environ.get(name, default).strip()


def _env_int(name: str, default: int, *, minimum: int | None = None, maximum: int | None = None) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        raise ValueError(f"{name} must be a whole number, got {raw!r}") from None
    return _check_range(name, value, minimum, maximum)


def _env_float(name: str, default: float, *, minimum: float | None = None, maximum: float | None = None) -> float:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        value = float(raw)
    except ValueError:
        raise ValueError(f"{name} must be a number, got {raw!r}") from None
    return _check_range(name, value, minimum, maximum)


def _check_range(name, value, minimum, maximum):
    if minimum is not None and value < minimum:
        raise ValueError(f"{name} must be at least {minimum}, got {value}")
    if maximum is not None and value > maximum:
        raise ValueError(f"{name} must be at most {maximum}, got {value}")
    return value
