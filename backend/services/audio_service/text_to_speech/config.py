"""Settings for the TTS module, read from environment variables or a .env file.

The .env file loaded is the nearest one above the folder you run from; if there is
none, backend/.env. In the team repo that means backend/.env, which the repo's
.gitignore already keeps out of git. See ../.env.example for every variable.
Only the voice settings (ELEVENLABS_*, TTS_*, STT_*) are read from that file.
Only ELEVENLABS_API_KEY is required: the voices come from voices.json.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import dotenv_values, find_dotenv

SERVICE_DIR = Path(__file__).resolve().parent.parent  # backend/services/audio_service
BACKEND_DIR = SERVICE_DIR.parent.parent  # backend

# eleven_flash_v2_5 since 2026-10-10 (docs/decisions/2026-10-09-tts-default-model.md). The app's 918-character
# reading of a test bill took 1.89 s, against 8.49 s on eleven_multilingual_v2, for about half the credits, and
# every amount, date and ratio was read right (transcribed back). That needs ElevenLabs' number reading on, which
# default_text_normalization() sends for Flash. 19 of the 20 voices are tuned for Flash (not "sarah").
# ElevenLabs calls Flash "fast, affordable" and Multilingual v2 "lifelike"; ELEVENLABS_MODEL_ID switches back.
DEFAULT_MODEL_ID = "eleven_flash_v2_5"
DEFAULT_OUTPUT_FORMAT = "mp3_44100_128"  # MP3 plays on every phone and browser; 128 kbps works on the free plan
DEFAULT_BASE_URL = "https://api.elevenlabs.io"
# Generated audio stays inside this service's folder (git-ignored there), whichever folder
# the backend is started from.
DEFAULT_CACHE_DIR = str(SERVICE_DIR / ".tts_cache")
DEFAULT_TIMEOUT_SECONDS = 60.0
SPEED_RANGE = (0.7, 1.2)  # documented range for voice_settings.speed
PLACEHOLDER_API_KEY = "your-elevenlabs-api-key-here"  # the value in .env.example
TEXT_NORMALIZATION_VALUES = ("auto", "on", "off")  # ElevenLabs' apply_text_normalization

# Models a request may choose (TTSRequest.model), besides ELEVENLABS_MODEL_ID. Measured 2026-10-09
# on our Creator plan, voice Matilda, a 222-character bill text full of numbers (README, "Speed"):
#                              first audio   all audio   credits per character   numbers read right
#   eleven_multilingual_v2     3.6 s         4.0 s       0.44                    yes
#   eleven_flash_v2_5          1.0 s         1.8 s       0.22                    yes (with number reading on)
#   eleven_v4_turbo            1.0 s         5.7 s       0.06                    yes
#   eleven_v4                  1.2 s         6.7 s       0.12                    yes
MODELS = {
    "eleven_multilingual_v2": "Multilingual v2",
    "eleven_flash_v2_5": "Flash v2.5",
    "eleven_v4_turbo": "v4 Turbo",
    "eleven_v4": "v4",
}


def default_text_normalization(model_id: str) -> str:
    """How ElevenLabs should read numbers, money and dates for a model.

    Flash v2.5 misread money, codes and ranges with ElevenLabs' default ("auto") in our test:
    "$12,345.67" became "12,340.67", "E11.9" became "11.9". With "on" it read every one
    correctly. The deprecated Turbo v2/v2.5 models, which ElevenLabs calls functionally
    equivalent to Flash, get "on" too (not measured). The other models read them right with
    "auto", including eleven_v4_turbo."""
    return "on" if model_id.startswith(("eleven_flash_", "eleven_turbo_")) else "auto"


# The languages each model speaks, as ISO 639-1 codes (Filipino has none: "fil"). From ElevenLabs' models page,
# checked 2026-10-10: Flash v2.5 speaks Multilingual v2's 29 plus Hungarian, Norwegian and Vietnamese; the v4
# models speak 90+, these 32 included. The product's own list of locales is backend/locales.py.
MULTILINGUAL_V2_LANGUAGES = frozenset({
    "en", "ja", "zh", "de", "hi", "fr", "ko", "pt", "it", "es", "id", "nl", "tr", "fil", "pl", "sv",
    "bg", "ro", "ar", "cs", "el", "fi", "hr", "ms", "sk", "da", "ta", "uk", "ru",
})
FLASH_LANGUAGES = MULTILINGUAL_V2_LANGUAGES | {"hu", "nb", "vi"}
MODEL_LANGUAGES = {
    "eleven_multilingual_v2": MULTILINGUAL_V2_LANGUAGES,
    "eleven_flash_v2_5": FLASH_LANGUAGES,
    "eleven_v4_turbo": FLASH_LANGUAGES,
    "eleven_v4": FLASH_LANGUAGES,
}
_LANGUAGE_ALIASES = {"tl": "fil", "no": "nb"}  # Tagalog (Filipino's base), Norwegian
# What ElevenLabs' language_code takes for a language, where it differs from the code above.
_ELEVENLABS_LANGUAGE_CODE = {"nb": "no"}


def language_base(language: str) -> str:
    """"en-US", "pt_BR" or "tl" -> "en", "pt" or "fil": the language a locale or code stands for."""
    base = str(language or "").strip().replace("_", "-").split("-")[0].lower()
    return _LANGUAGE_ALIASES.get(base, base)


def speaks(model_id: str, language: str) -> bool:
    """Whether the model can speak this language. A model outside MODELS is trusted with English only, except
    the Flash and Turbo v2.5 family, which shares Flash's languages."""
    languages = MODEL_LANGUAGES.get(model_id)
    if languages is None:
        languages = FLASH_LANGUAGES if model_id.startswith(("eleven_flash_v2_5", "eleven_turbo_v2_5")) else frozenset({"en"})
    return language_base(language) in languages


def sends_language_code(model_id: str) -> bool:
    """ElevenLabs' language_code enforces the language, and how numbers are read, on Flash and Turbo v2.5. It is
    not supported on Multilingual v2 (API reference, checked 2026-10-10), and not documented for v4."""
    return model_id.startswith(("eleven_flash_v2_5", "eleven_turbo_v2_5"))


def supports_speed(model_id: str) -> bool:
    """voice_settings.speed is not available on the v3 and v4 models."""
    return not model_id.startswith(("eleven_v3", "eleven_v4"))

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
    # ELEVENLABS_TEXT_NORMALIZATION: "auto", "on" or "off". None = default_text_normalization().
    text_normalization: str | None = None
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
                load_settings_file(env_file)
        speed = _env_float("ELEVENLABS_SPEED", None, minimum=SPEED_RANGE[0], maximum=SPEED_RANGE[1])
        api_key = _env_str("ELEVENLABS_API_KEY", "")
        return cls(
            api_key="" if api_key == PLACEHOLDER_API_KEY else api_key,
            voice_id=_env_str("ELEVENLABS_VOICE_ID", ""),
            model_id=_env_str("ELEVENLABS_MODEL_ID", DEFAULT_MODEL_ID) or DEFAULT_MODEL_ID,
            output_format=_env_str("ELEVENLABS_OUTPUT_FORMAT", DEFAULT_OUTPUT_FORMAT),
            speed=speed,
            text_normalization=_env_choice("ELEVENLABS_TEXT_NORMALIZATION", TEXT_NORMALIZATION_VALUES),
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

    def voice_settings(self, model_id: str | None = None) -> dict | None:
        """Voice settings sent to ElevenLabs. None = use the voice's saved settings."""
        settings = {}
        if self.speed is not None and supports_speed(model_id or self.model_id):
            settings["speed"] = self.speed
        return settings or None

    def audio_settings(self, model_id: str | None = None, language: str = "en") -> dict:
        """Every setting that changes the sound, apart from the voice (chosen per request), for this
        config's model or the given one, in this language. The cache key is built from these plus the
        voice, so a change can never replay audio made with old settings."""
        model_id = model_id or self.model_id
        settings = {
            "model_id": model_id,
            "output_format": self.output_format,
            "voice_settings": self.voice_settings(model_id),
        }
        normalization = self.text_normalization or default_text_normalization(model_id)
        if normalization != "auto":  # "auto" is ElevenLabs' default: leaving it out keeps older cache keys
            settings["apply_text_normalization"] = normalization
        base = language_base(language)
        if base != "en" and sends_language_code(model_id):  # English is left as it was, so its cache keys stay
            settings["language_code"] = _ELEVENLABS_LANGUAGE_CODE.get(base, base)
        return settings


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


def _env_choice(name: str, choices: tuple[str, ...]) -> str | None:
    raw = os.environ.get(name, "").strip().lower()
    if not raw:
        return None
    if raw not in choices:
        raise ValueError(f"{name} must be one of {', '.join(choices)}, got {raw!r}")
    return raw


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
