"""The voices users can choose, read from voices.json.

    TTSRequest(..., voice="bunty")   # one of the keys in voices.json
    TTSRequest(...)                   # no choice: the default voice ("matilda")
    TTSRequest(..., language="es-MX") # no choice: the language's default voice (language_defaults: "elio")
    TTSRequest(..., voice="george", language="ja-JP")  # George is verified for Japanese: George speaks
    TTSRequest(..., voice="ololade", language="ja-JP") # not verified for Japanese: the Japanese default speaks

A voice speaks a language only if ElevenLabs verified it for that language (verified_languages, with the
accent it was verified with); otherwise the language's default voice speaks, so no language is read with a
foreign accent. To add or swap a voice, edit voices.json: no code change is needed.
"""

from __future__ import annotations

import functools
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from .config import language_base

VOICES_FILE = Path(__file__).with_name("voices.json")
SAMPLE_TEXTS_FILE = Path(__file__).with_name("sample_texts.json")  # what a voice preview says, per language
_KEY_PATTERN = re.compile(r"[a-z0-9_-]{1,30}")
_LANGUAGE_CODE_PATTERN = re.compile(r"[a-z]{2,3}(-[a-z0-9]{2,4})?")


@dataclass(frozen=True)
class Voice:
    key: str  # what the app sends, e.g. "bunty"
    name: str
    description: str
    accent: str
    gender: str
    voice_id: str  # the ElevenLabs voice ID; stays on the server

    verified_languages: tuple[dict, ...] = field(default=(), hash=False)

    source: str = ""  # "ElevenLabs default voice" or "ElevenLabs Voice Library"

    def verified_for(self, language: str | None) -> tuple[dict, ...]:
        """This voice's verified_languages entries for a language ("es-MX", "es"; "nb" also matches
        ElevenLabs' "no"): each says the accent ElevenLabs verified it speaking that language with."""
        base = language_base(language or "en")
        return tuple(item for item in self.verified_languages if language_base(item["language"]) == base)

    def speaks(self, language: str | None) -> bool:
        """Whether ElevenLabs verified this voice for the language. A voice listed without verified languages is
        trusted with English only: its accent field describes its English."""
        if not self.verified_languages:
            return language_base(language or "en") == "en"
        return bool(self.verified_for(language))

    def preview_language(self, requested: str | None) -> str:
        """The language a preview of this voice is spoken in: the requested one if the voice is verified for it,
        else the first language it is verified for (so a Hebrew voice previews in Hebrew)."""
        if requested and self.speaks(requested):
            return requested
        return self.verified_languages[0]["language"] if self.verified_languages else "en"

    def public(self) -> dict:
        """What the app needs for a voice picker."""
        return {
            "key": self.key,
            "name": self.name,
            "description": self.description,
            "accent": self.accent,
            "gender": self.gender,
            "verified_languages": list(self.verified_languages),
            "source": self.source,
        }


@dataclass(frozen=True)
class VoiceCatalog:
    voices: tuple[Voice, ...]
    default_key: str
    # Lowercase locale ("es-mx") or language ("es") -> the voice key used when the user has not chosen one.
    language_defaults: dict[str, str] = field(default_factory=dict, hash=False)

    @property
    def default(self) -> Voice:
        return self.get(self.default_key)

    def default_for(self, language: str | None) -> Voice:
        """The default voice for a language: language_defaults for the exact locale ("es-MX"), then for the
        language alone ("es"); else the default voice if it is verified for the language, else the first voice
        verified for it. A configured default that is not verified for the language is skipped."""
        code = str(language or "").strip().replace("_", "-").lower()
        if not code:
            return self.default
        for candidate in (code, code.split("-")[0]):
            voice = self.get(self.language_defaults.get(candidate, ""))
            if voice is not None and voice.speaks(code):
                return voice
        if self.default.speaks(code):
            return self.default
        return next((voice for voice in self.voices if voice.speaks(code)), self.default)

    def choose(self, key: str | None, language: str | None) -> Voice | None:
        """The voice that speaks this language for the user's choice: the chosen voice if it is verified for the
        language, else the language's default (a choice made for one language must not read another one with
        a foreign accent). No choice = the language's default. None = no voice has this key."""
        if key is None or not key.strip():
            return self.default_for(language)
        voice = self.get(key)
        if voice is None:
            return None
        return voice if voice.speaks(language) else self.default_for(language)

    def get(self, key: str | None) -> Voice | None:
        key = (key or "").strip().lower()
        return next((voice for voice in self.voices if voice.key == key), None)

    def keys(self) -> list[str]:
        return [voice.key for voice in self.voices]

    def public(self) -> dict:
        """The voice list for the app: {"default": "matilda", "language_defaults": {"es-MX": "elio", ...},
        "voices": [{key, name, ...}, ...]}."""
        return {
            "default": self.default_key,
            "language_defaults": {_as_sent(code): key for code, key in self.language_defaults.items()},
            "voices": [voice.public() for voice in self.voices],
        }


def load_catalog(path: Path = VOICES_FILE) -> VoiceCatalog:
    """Read and check voices.json. Raises ValueError with a clear message if it is broken."""
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        raise ValueError(f"{path.name} is missing") from None
    except ValueError as exc:
        raise ValueError(f"{path.name} is not valid JSON: {exc}") from None

    entries = data.get("voices") if isinstance(data, dict) else None
    if not isinstance(entries, list) or not entries:
        raise ValueError(f'{path.name} needs a non-empty "voices" list')

    voices = []
    for number, entry in enumerate(entries, 1):
        if not isinstance(entry, dict):
            raise ValueError(f"{path.name}: voice #{number} is not an object")
        missing = [name for name in ("key", "name", "voice_id") if not str(entry.get(name) or "").strip()]
        if missing:
            raise ValueError(f"{path.name}: voice #{number} is missing {', '.join(missing)}")
        key = str(entry["key"]).strip()
        if not _KEY_PATTERN.fullmatch(key):
            raise ValueError(f'{path.name}: key {key!r} must be lowercase letters, digits, "-" or "_"')
        voices.append(
            Voice(
                key=key,
                name=str(entry["name"]).strip(),
                description=str(entry.get("description") or "").strip(),
                accent=str(entry.get("accent") or "").strip(),
                gender=str(entry.get("gender") or "").strip(),
                voice_id=str(entry["voice_id"]).strip(),
                verified_languages=tuple({k: str(item[k]).strip() for k in ("language", "locale", "accent") if item.get(k)} for item in entry.get("verified_languages", []) if isinstance(item, dict) and item.get("language")),
                source=str(entry.get("source") or "").strip(),
            )
        )

    keys = [voice.key for voice in voices]
    duplicates = sorted({key for key in keys if keys.count(key) > 1})
    if duplicates:
        raise ValueError(f"{path.name}: duplicate keys {', '.join(duplicates)}")
    default_key = str(data.get("default") or voices[0].key).strip()
    if default_key not in keys:
        raise ValueError(f"{path.name}: default {default_key!r} is not one of the voices")
    return VoiceCatalog(tuple(voices), default_key, _language_defaults(data.get("language_defaults"), keys, path.name))


def _language_defaults(entries: object, keys: list[str], file_name: str) -> dict[str, str]:
    """voices.json's optional "language_defaults": {"es-MX": "elio", "hi": "saavi", ...}, checked."""
    if entries is None:
        return {}
    if not isinstance(entries, dict):
        raise ValueError(f'{file_name}: "language_defaults" must be an object of language code -> voice key')
    defaults = {}
    for code, key in entries.items():
        if str(code).strip().startswith("_"):  # a comment
            continue
        cleaned = str(code).strip().replace("_", "-").lower()
        if not _LANGUAGE_CODE_PATTERN.fullmatch(cleaned):
            raise ValueError(f'{file_name}: language_defaults: {code!r} is not a language code such as "es" or "es-MX"')
        if str(key).strip() not in keys:
            raise ValueError(f"{file_name}: language_defaults: {code!r} names {key!r}, which is not one of the voices")
        defaults[cleaned] = str(key).strip()
    return defaults


def _as_sent(code: str) -> str:
    """"es-mx" -> "es-MX": a code cased the way clients send it."""
    language, _, region = code.partition("-")
    return f"{language}-{region.upper()}" if region else language


def list_voices() -> dict:
    """The voice list for the app (reads voices.json). Raises ValueError if the file is broken."""
    return load_catalog().public()


@functools.lru_cache(maxsize=1)
def _sample_texts() -> dict[str, str]:
    data = json.loads(SAMPLE_TEXTS_FILE.read_text(encoding="utf-8"))
    return {code.lower(): text for code, text in data["texts"].items()}


def sample_text(language: str | None, name: str) -> str:
    """The preview sentence in a language (sample_texts.json: the exact locale, then the language, then English),
    with the voice's name in it."""
    texts = _sample_texts()
    code = str(language or "en").strip().replace("_", "-").lower()
    return (texts.get(code) or texts.get(language_base(code)) or texts["en"]).replace("{name}", name)
