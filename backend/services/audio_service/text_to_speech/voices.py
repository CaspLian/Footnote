"""The voices users can choose, read from voices.json.

    TTSRequest(..., voice="bunty")   # one of the keys in voices.json
    TTSRequest(...)                   # no choice: the default voice ("matilda")
    TTSRequest(..., language="es-MX") # no choice: the language's default voice (language_defaults: "elio")

To add or swap a voice, edit voices.json: no code change is needed.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

VOICES_FILE = Path(__file__).with_name("voices.json")
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

    def public(self) -> dict:
        """What the app needs for a voice picker."""
        return {
            "key": self.key,
            "name": self.name,
            "description": self.description,
            "accent": self.accent,
            "gender": self.gender,
            "verified_languages": list(self.verified_languages),
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
        language alone ("es"), else the default voice. Every voice speaks every language its model speaks; these
        defaults are voices whose own accent suits the language."""
        code = str(language or "").strip().replace("_", "-").lower()
        for candidate in (code, code.split("-")[0]):
            key = self.language_defaults.get(candidate)
            if key:
                return self.get(key)
        return self.default

    def get(self, key: str) -> Voice | None:
        key = key.strip().lower()
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
