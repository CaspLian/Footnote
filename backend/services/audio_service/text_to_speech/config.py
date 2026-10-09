"""Settings for the TTS module, read from environment variables or a .env file.

The .env file loaded is the nearest one above the folder you run from; if there is
none, backend/.env. In the team repo that means backend/.env, which the repo's
.gitignore already keeps out of git. See ../.env.example for every variable.
Only ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID are required.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import find_dotenv, load_dotenv

SERVICE_DIR = Path(__file__).resolve().parent.parent  # backend/services/audio_service
BACKEND_DIR = SERVICE_DIR.parent.parent  # backend

# eleven_multilingual_v2: the API's own default, "most stable", recommended by ElevenLabs where
# numbers must be read correctly, and it supports the speed setting. Checked 2026-10-09 at
# https://elevenlabs.io/docs/overview/models
DEFAULT_MODEL_ID = "eleven_multilingual_v2"
DEFAULT_OUTPUT_FORMAT = "mp3_44100_128"  # MP3 plays on every phone and browser; 128 kbps works on the free plan
DEFAULT_BASE_URL = "https://api.elevenlabs.io"
# Generated audio stays inside this service's folder (git-ignored there), whichever folder
# the backend is started from.
DEFAULT_CACHE_DIR = str(SERVICE_DIR / ".tts_cache")
DEFAULT_TIMEOUT_SECONDS = 60.0
SPEED_RANGE = (0.7, 1.2)  # documented range for voice_settings.speed
PLACEHOLDER_API_KEY = "your-elevenlabs-api-key-here"  # the value in .env.example

_MIME_TYPES = {
    "mp3": "audio/mpeg",
    "wav": "audio/wav",
    "opus": "audio/ogg",
    "pcm": "audio/pcm",
    "ulaw": "audio/basic",
    "alaw": "audio/basic",
}


@dataclass(frozen=True)
class TTSConfig:
    api_key: str = field(default="", repr=False)  # repr=False keeps the key out of logs and tracebacks
    # Optional (ELEVENLABS_VOICE_ID): replaces the default voice's ID. Users pick voices from voices.json.
    voice_id: str = ""
    model_id: str = DEFAULT_MODEL_ID
    output_format: str = DEFAULT_OUTPUT_FORMAT
    speed: float | None = None  # None = use the voice's own default speed
    max_chars: int = 2500
    # Measured 2026-10-09: 873 characters took 13.9 s on eleven_multilingual_v2, so a full
    # TTS_MAX_CHARS answer (2,500) can take about 40 s. A timeout does not stop the billing.
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS
    max_retries: int = 1
    cache_dir: str | None = DEFAULT_CACHE_DIR  # None = memory-only cache
    base_url: str = DEFAULT_BASE_URL

    @classmethod
    def from_env(cls, *, load_env_file: bool = True) -> TTSConfig:
        """Build from environment variables. Real environment variables win over .env values.

        Raises ValueError for malformed values (e.g. TTS_MAX_CHARS=abc), so mistakes show up at startup.
        """
        if load_env_file:
            env_file = find_env_file()
            if env_file:
                load_dotenv(env_file, override=False)
        speed = _env_float("ELEVENLABS_SPEED", None, minimum=SPEED_RANGE[0], maximum=SPEED_RANGE[1])
        api_key = _env_str("ELEVENLABS_API_KEY", "")
        return cls(
            api_key="" if api_key == PLACEHOLDER_API_KEY else api_key,
            voice_id=_env_str("ELEVENLABS_VOICE_ID", ""),
            model_id=_env_str("ELEVENLABS_MODEL_ID", DEFAULT_MODEL_ID),
            output_format=_env_str("ELEVENLABS_OUTPUT_FORMAT", DEFAULT_OUTPUT_FORMAT),
            speed=speed,
            max_chars=_env_int("TTS_MAX_CHARS", 2500, minimum=1),
            timeout_seconds=_env_float("TTS_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS, minimum=1.0),
            max_retries=_env_int("TTS_MAX_RETRIES", 1, minimum=0, maximum=3),
            cache_dir=_cache_dir_from_env(),
            base_url=_env_str("ELEVENLABS_BASE_URL", DEFAULT_BASE_URL).rstrip("/"),
        )

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)  # voices come from voices.json

    @property
    def file_extension(self) -> str:
        return self.output_format.split("_", 1)[0]

    @property
    def mime_type(self) -> str:
        return _MIME_TYPES.get(self.file_extension, "application/octet-stream")

    def voice_settings(self) -> dict | None:
        """Voice settings sent to ElevenLabs. None = use the voice's saved settings."""
        settings = {}
        if self.speed is not None:
            settings["speed"] = self.speed
        return settings or None

    def audio_settings(self) -> dict:
        """Every setting that changes the sound, apart from the voice (chosen per request). The cache
        key is built from these plus the voice, so a change can never replay audio made with old settings."""
        return {
            "model_id": self.model_id,
            "output_format": self.output_format,
            "voice_settings": self.voice_settings(),
        }


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


def _cache_dir_from_env() -> str | None:
    """TTS_CACHE_DIR: unset = DEFAULT_CACHE_DIR, empty = memory only,
    relative = relative to this service's folder (not to wherever the backend was started)."""
    raw = os.environ.get("TTS_CACHE_DIR")
    if raw is None:
        return DEFAULT_CACHE_DIR
    raw = raw.strip()
    if not raw:
        return None
    path = Path(raw)
    return str(path if path.is_absolute() else SERVICE_DIR / path)


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


def _env_float(name: str, default, *, minimum: float | None = None, maximum: float | None = None):
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
