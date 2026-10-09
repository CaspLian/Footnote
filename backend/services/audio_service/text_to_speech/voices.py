"""The voices users can choose, read from voices.json.

    TTSRequest(..., voice="bunty")   # one of the keys in voices.json
    TTSRequest(...)                   # no choice: the default voice ("matilda")

To add or swap a voice, edit voices.json: no code change is needed.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

VOICES_FILE = Path(__file__).with_name("voices.json")
_KEY_PATTERN = re.compile(r"[a-z0-9_-]{1,30}")


@dataclass(frozen=True)
class Voice:
    key: str  # what the app sends, e.g. "bunty"
    name: str
    description: str
    accent: str
    gender: str
    voice_id: str  # the ElevenLabs voice ID; stays on the server

    def public(self) -> dict:
        """What the app needs for a voice picker."""
        return {
            "key": self.key,
            "name": self.name,
            "description": self.description,
            "accent": self.accent,
            "gender": self.gender,
        }


@dataclass(frozen=True)
class VoiceCatalog:
    voices: tuple[Voice, ...]
    default_key: str

    @property
    def default(self) -> Voice:
        return self.get(self.default_key)

    def get(self, key: str) -> Voice | None:
        key = key.strip().lower()
        return next((voice for voice in self.voices if voice.key == key), None)

    def keys(self) -> list[str]:
        return [voice.key for voice in self.voices]

    def public(self) -> dict:
        """The voice list for the app: {"default": "matilda", "voices": [{key, name, ...}, ...]}."""
        return {"default": self.default_key, "voices": [voice.public() for voice in self.voices]}


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
            )
        )

    keys = [voice.key for voice in voices]
    duplicates = sorted({key for key in keys if keys.count(key) > 1})
    if duplicates:
        raise ValueError(f"{path.name}: duplicate keys {', '.join(duplicates)}")
    default_key = str(data.get("default") or voices[0].key).strip()
    if default_key not in keys:
        raise ValueError(f"{path.name}: default {default_key!r} is not one of the voices")
    return VoiceCatalog(tuple(voices), default_key)


def list_voices() -> dict:
    """The voice list for the app (reads voices.json). Raises ValueError if the file is broken."""
    return load_catalog().public()
