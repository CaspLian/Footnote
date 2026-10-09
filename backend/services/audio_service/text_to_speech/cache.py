"""Keeps generated audio so the same text is never paid for twice.

Two layers:
- memory: fast, bounded to `max_memory_bytes`, lost when the process stops
- disk (optional): one file per audio clip in `directory`, survives restarts,
  so audio you generated while rehearsing still plays during the demo

Each server process has its own memory layer; the disk layer is shared.
"""

from __future__ import annotations

import contextlib
import logging
import os
import re
import threading
from collections import OrderedDict
from pathlib import Path

logger = logging.getLogger(__name__)

_KEY_PATTERN = re.compile(r"[0-9a-f]{32}")
DEFAULT_MAX_MEMORY_BYTES = 50 * 1024 * 1024  # 50 MB: about 50 minutes of 128 kbps MP3


def is_valid_key(key: str) -> bool:
    """Cache keys are 32 hex characters. Checking this blocks paths like "../secret"."""
    return isinstance(key, str) and _KEY_PATTERN.fullmatch(key) is not None


class AudioCache:
    def __init__(
        self,
        directory: str | Path | None = None,
        file_extension: str = "mp3",
        max_memory_bytes: int = DEFAULT_MAX_MEMORY_BYTES,
    ):
        self._directory = Path(directory) if directory else None
        self._extension = file_extension
        self._max_memory_bytes = max_memory_bytes
        self._memory: OrderedDict[str, bytes] = OrderedDict()
        self._memory_bytes = 0
        self._lock = threading.Lock()

    def get(self, key: str) -> bytes | None:
        if not is_valid_key(key):
            return None
        with self._lock:
            audio = self._memory.get(key)
            if audio is not None:
                self._memory.move_to_end(key)
                return audio
        audio = self._read_file(key)
        if audio is not None:
            self._remember(key, audio)
        return audio

    def put(self, key: str, audio: bytes) -> None:
        if not is_valid_key(key) or not audio:
            return
        self._remember(key, audio)
        self._write_file(key, audio)

    def _remember(self, key: str, audio: bytes) -> None:
        if len(audio) > self._max_memory_bytes:
            return  # too big to keep in memory; the disk layer still has it
        with self._lock:
            previous = self._memory.pop(key, None)
            if previous is not None:
                self._memory_bytes -= len(previous)
            self._memory[key] = audio
            self._memory_bytes += len(audio)
            while self._memory_bytes > self._max_memory_bytes:
                _, dropped = self._memory.popitem(last=False)  # drop the least recently used clip
                self._memory_bytes -= len(dropped)

    def _path(self, key: str) -> Path:
        return self._directory / f"{key}.{self._extension}"

    def _read_file(self, key: str) -> bytes | None:
        if self._directory is None:
            return None
        try:
            return self._path(key).read_bytes() or None
        except FileNotFoundError:
            return None
        except OSError as exc:
            logger.warning("Could not read cached audio %s: %s", key, exc)
            return None

    def _write_file(self, key: str, audio: bytes) -> None:
        if self._directory is None:
            return
        # Write to a temporary file, then rename, so a crash never leaves half a clip behind.
        temporary = self._path(key).with_suffix(f".{os.getpid()}.{threading.get_ident()}.tmp")
        try:
            self._directory.mkdir(parents=True, exist_ok=True)
            temporary.write_bytes(audio)
            os.replace(temporary, self._path(key))
        except OSError as exc:
            # Caching is an optimisation: a failed write must not fail the request.
            logger.warning("Could not write cached audio %s: %s", key, exc)
            with contextlib.suppress(OSError):
                temporary.unlink(missing_ok=True)
