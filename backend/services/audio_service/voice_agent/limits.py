from __future__ import annotations

import math
import threading
import time
import uuid
from urllib.parse import urlsplit

from .client import AgentError


def check_origin(origin: str | None, allowed: tuple[str, ...]) -> None:
    if origin is None:
        return
    try:
        url = urlsplit(origin)
        local = url.scheme in ("http", "https") and url.hostname in ("localhost", "127.0.0.1", "::1")
        local = local and not url.username and not url.password and url.path in ("", "/") and not url.query and not url.fragment
        # Force validation of malformed ports.
        url.port
    except ValueError:
        local = False
    if not local and origin not in allowed:
        raise AgentError("ORIGIN_NOT_ALLOWED", "This web page is not allowed to start a conversation.", 403)


class SessionLimiter:
    def __init__(self, per_hour: int, clock=time.monotonic):
        self.per_hour, self.clock = per_hour, clock
        self.entries: dict[str, tuple[float, str]] = {}
        self.lock = threading.Lock()

    def reserve(self, client: str) -> str:
        with self.lock:
            now = self.clock()
            self.entries = {key: value for key, value in self.entries.items() if now - value[0] < 3600}
            waits = [10 - (now - when) for when, host in self.entries.values() if host == client and now - when < 10]
            if len(self.entries) >= self.per_hour:
                waits.append(3600 - (now - min(when for when, _ in self.entries.values())))
            if waits:
                raise AgentError("RATE_LIMITED", "Please wait before starting another conversation.", 429, True,
                                 max(1, math.ceil(max(waits))))
            key = uuid.uuid4().hex
            self.entries[key] = (now, client)
            return key

    def release(self, key: str) -> None:
        with self.lock:
            self.entries.pop(key, None)
