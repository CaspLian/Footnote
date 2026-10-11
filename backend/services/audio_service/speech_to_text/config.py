"""Settings for the speech-to-text module, read from environment variables or a .env file.

Uses the same ELEVENLABS_API_KEY as text-to-speech. The .env loaded is the nearest one above
the folder you run from; if there is none, backend/.env. See ../.env.example for every variable.
Only the voice settings (ELEVENLABS_*, TTS_*, STT_*) are read from that file.

This package deliberately shares no code with text_to_speech, so a change in one cannot break
the other. The small helpers below are copied on purpose.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import dotenv_values, find_dotenv

SERVICE_DIR = Path(__file__).resolve().parent.parent  # backend/services/audio_service
BACKEND_DIR = SERVICE_DIR.parent.parent  # backend

# scribe_v2: ElevenLabs' current batch model, $0.22 per hour of audio. scribe_v2_medical has the
# same price and API and is tuned for clinical audio. scribe_v1 is deprecated. Checked 2026-10-09
# at https://elevenlabs.io/docs/overview/models and https://elevenlabs.io/pricing/api
DEFAULT_MODEL_ID = "scribe_v2"
DEFAULT_BASE_URL = "https://api.elevenlabs.io"
DEFAULT_MAX_AUDIO_MB = 10.0  # Expo's HIGH_QUALITY preset records 128 kbps: about 10 minutes
DEFAULT_TIMEOUT_SECONDS = 60.0
# Identifiers a spoken question never needs. Scribe v2 replaces them with their type ("{SSN}") before the
# transcript reaches Gemini or the database (entity redaction, checked live 2026-10-11). Names, places,
# conditions and procedures stay: the question needs them.
DEFAULT_REDACTED_ENTITIES = (
    "ssn", "healthcare_number", "account_number", "bank_account", "routing_number", "credit_card",
    "credit_card_expiration", "cvv", "passport_number", "driver_license", "dob", "email_address", "phone_number",
    "password", "username", "ip_address",
)
# Billing words Scribe could mishear in an English question; keyterms bias it toward them (they cost extra).
DEFAULT_KEYTERMS = (
    "Footnote", "Medicare", "Medicaid", "deductible", "coinsurance", "copay", "copayment", "explanation of benefits",
    "EOB", "itemized bill", "out-of-pocket maximum", "in-network", "out-of-network", "prior authorization",
    "allowed amount", "balance billing", "CPT code", "statement balance", "claim number",
)
BRAND_KEYTERMS = ("Footnote", "Medicare", "Medicaid")  # names, the same in every language
PLACEHOLDER_API_KEY = "your-elevenlabs-api-key-here"  # the value in .env.example


@dataclass(frozen=True)
class STTConfig:
    api_key: str = field(default="", repr=False)  # repr=False keeps the key out of logs and tracebacks
    model_id: str = DEFAULT_MODEL_ID
    max_audio_mb: float = DEFAULT_MAX_AUDIO_MB
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS
    max_retries: int = 1
    base_url: str = DEFAULT_BASE_URL
    redact_entities: tuple[str, ...] = DEFAULT_REDACTED_ENTITIES  # STT_REDACT_ENTITIES: comma list, or "none"
    keyterms: tuple[str, ...] = DEFAULT_KEYTERMS  # STT_KEYTERMS: comma list, or "none"

    @classmethod
    def from_env(cls, *, load_env_file: bool = True) -> STTConfig:
        """Build from environment variables. Real environment variables win over .env values.

        Raises ValueError for malformed values (e.g. STT_MAX_AUDIO_MB=abc).
        """
        if load_env_file:
            env_file = find_env_file()
            if env_file:
                load_settings_file(env_file)
        api_key = _env_str("ELEVENLABS_API_KEY", "")
        return cls(
            api_key="" if api_key == PLACEHOLDER_API_KEY else api_key,
            model_id=_env_str("ELEVENLABS_STT_MODEL_ID", DEFAULT_MODEL_ID),
            max_audio_mb=_env_float("STT_MAX_AUDIO_MB", DEFAULT_MAX_AUDIO_MB, minimum=0.1),
            timeout_seconds=_env_float("STT_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS, minimum=1.0),
            max_retries=_env_int("STT_MAX_RETRIES", 1, minimum=0, maximum=3),
            base_url=_env_str("ELEVENLABS_BASE_URL", DEFAULT_BASE_URL).rstrip("/"),
            redact_entities=_env_list("STT_REDACT_ENTITIES", DEFAULT_REDACTED_ENTITIES),
            keyterms=_env_list("STT_KEYTERMS", DEFAULT_KEYTERMS),
        )

    def keyterms_for(self, language: str) -> tuple[str, ...]:
        """The billing words for an English (or undetected) question; only names in other languages, where
        English words could pull the transcript toward English."""
        if language in ("", "en", "eng"):
            return self.keyterms
        return tuple(term for term in self.keyterms if term in BRAND_KEYTERMS)

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    @property
    def max_audio_bytes(self) -> int:
        return int(self.max_audio_mb * 1024 * 1024)


# Only this service's settings are taken from the .env file. The file may also hold other services'
# keys, or placeholders for them (backend/api.env does): copying those into os.environ would change
# how Gemini, Snowflake or Tiger Data behave once the first voice request has run.
SETTING_PREFIXES = ("ELEVENLABS_", "TTS_", "STT_")


def load_settings_file(path: str) -> None:
    """Copy the ELEVENLABS_*, TTS_* and STT_* settings in the file into os.environ, unless the
    environment already sets them (real environment variables win). Other names are ignored.
    PYTHON_DOTENV_DISABLED=1 turns it off, as it turns off load_dotenv()."""
    if os.environ.get("PYTHON_DOTENV_DISABLED", "").casefold() in {"1", "true", "t", "yes", "y"}:
        return
    for name, value in dotenv_values(path).items():
        # upper(): on Windows names are not case-sensitive, so "elevenlabs_api_key=" in the file also counts
        if name.upper().startswith(SETTING_PREFIXES) and value is not None and name not in os.environ:
            os.environ[name] = value


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


def _env_list(name: str, default: tuple[str, ...]) -> tuple[str, ...]:
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    if raw.strip().lower() == "none":
        return ()
    return tuple(item.strip() for item in raw.split(",") if item.strip())


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
