"""The text-to-speech pipeline.

    TTSRequest
      -> validate          (wrong input fails fast, no cost)
      -> pick the voice    (the user's choice from voices.json, or the default)
      -> prepare text      (text_prep.py: Markdown, links, symbols...)
      -> check limits      (empty / too long fail here, no cost)
      -> cache             (same text + same voice settings = reuse, no cost)
      -> join in-flight    (an identical request is already generating = wait for it, no extra cost)
      -> ElevenLabs        (bounded retries for temporary failures only)
      -> TTSResult         (never raises: failures come back as ok=False)
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import random
import threading
import time
from collections import Counter
from concurrent.futures import Future
from concurrent.futures import TimeoutError as FutureTimeout
from dataclasses import dataclass
from typing import Protocol

from .cache import AudioCache, is_valid_key
from .config import TTSConfig
from .contract import ErrorCode, TTSRequest, TTSResult
from .elevenlabs_provider import ElevenLabsProvider, ProviderAudio
from .errors import TTSError
from .text_prep import prepare_for_speech
from .voices import VoiceCatalog, load_catalog

logger = logging.getLogger("text_to_speech")

# Guard against absurd input before cleanup runs. The real limit is TTSConfig.max_chars,
# applied to the cleaned text, because that is what ElevenLabs bills.
MAX_INPUT_CHARS = 50_000
MAX_BACKOFF_SECONDS = 5.0


class SpeechProvider(Protocol):
    """Anything that turns text into audio. ElevenLabsProvider in production, a fake in tests."""

    def generate(self, text: str, voice_id: str) -> ProviderAudio: ...


@dataclass(frozen=True)
class _Generation:
    audio: bytes
    attempts: int
    provider_request_id: str | None
    characters_billed: int | None


class TTSService:
    def __init__(
        self,
        config: TTSConfig,
        provider: SpeechProvider | None = None,
        cache: AudioCache | None = None,
        *,
        voices: VoiceCatalog | None = None,
        pronunciations: dict[str, str] | None = None,
        sleep=time.sleep,
    ) -> None:
        self.config = config
        self.voices = voices if voices is not None else load_catalog()  # raises ValueError if voices.json is broken
        self._provider = provider if provider is not None else ElevenLabsProvider(config)
        self._cache = cache if cache is not None else AudioCache(config.cache_dir, config.file_extension)
        self._pronunciations = pronunciations
        self._sleep = sleep
        self._lock = threading.Lock()
        self._in_flight: dict[str, Future] = {}
        self._stats = _Stats()

    # --- Public -------------------------------------------------------------------

    def synthesize(self, request: TTSRequest) -> TTSResult:
        started = time.monotonic()
        request_id = _request_id_of(request)
        spoken = ""
        source = "none"
        try:
            _validate(request)
            voice_key, voice_id = self._resolve_voice(request.voice)
            spoken = self._prepare(request)
            key = self._cache_key(spoken, request.language, voice_id)
            audio, source, generation = self._get_or_generate(key, spoken, voice_id)
            result = TTSResult(
                request_id=request_id,
                ok=True,
                audio=audio,
                mime_type=self.config.mime_type,
                audio_id=key,
                voice=voice_key,
                spoken_text=spoken,
                cached=generation is None,
                characters_sent=len(spoken) * generation.attempts if generation else 0,
                characters_billed=generation.characters_billed if generation else None,
                attempts=generation.attempts if generation else 0,
                elapsed_ms=_elapsed_ms(started),
                provider_request_id=generation.provider_request_id if generation else None,
            )
        except TTSError as exc:
            result = TTSResult(
                request_id=request_id,
                ok=False,
                spoken_text=spoken,
                characters_sent=len(spoken) * exc.attempts,
                attempts=exc.attempts,
                elapsed_ms=_elapsed_ms(started),
                provider_request_id=exc.provider_request_id,
                error_code=exc.code,
                error_message=exc.message,
                retryable=exc.retryable,
            )
        except Exception:
            logger.exception("Unexpected error in text-to-speech (request_id=%s)", request_id)
            result = TTSResult(
                request_id=request_id,
                ok=False,
                spoken_text=spoken,
                elapsed_ms=_elapsed_ms(started),
                error_code=ErrorCode.INTERNAL_ERROR,
                error_message="Unexpected error in the text-to-speech module. See the server logs.",
            )
        self._stats.record(result, source)
        _log_result(result, source)
        return result

    def get_audio(self, audio_id: str) -> tuple[bytes, str] | None:
        """Audio generated earlier, by its audio_id, with its MIME type. None if unknown."""
        if not is_valid_key(audio_id):
            return None
        audio = self._cache.get(audio_id)
        return (audio, self.config.mime_type) if audio is not None else None

    def stats(self) -> dict:
        return self._stats.snapshot()

    # --- Steps --------------------------------------------------------------------

    def _resolve_voice(self, choice: str | None) -> tuple[str, str]:
        """(voice key, ElevenLabs voice ID) for the user's choice. No choice = the default voice,
        whose ID ELEVENLABS_VOICE_ID may replace."""
        if choice is None or not choice.strip():
            default = self.voices.default
            return default.key, self.config.voice_id or default.voice_id
        voice = self.voices.get(choice)
        if voice is None:
            raise TTSError(
                ErrorCode.INVALID_REQUEST,
                f"Unknown voice {choice!r}. Choose one of: {', '.join(self.voices.keys())}.",
            )
        return voice.key, voice.voice_id

    def _prepare(self, request: TTSRequest) -> str:
        use_speech_text = request.speech_text is not None and request.speech_text.strip() != ""
        source_text = request.speech_text if use_speech_text else request.text
        if len(source_text) > MAX_INPUT_CHARS:
            raise TTSError(
                ErrorCode.TEXT_TOO_LONG,
                f"Input is {len(source_text)} characters; the hard limit is {MAX_INPUT_CHARS}.",
            )
        spoken = prepare_for_speech(source_text, self._pronunciations)
        if not spoken:
            raise TTSError(ErrorCode.EMPTY_TEXT, "Nothing speakable is left after removing formatting.")
        if len(spoken) > self.config.max_chars:
            raise TTSError(
                ErrorCode.TEXT_TOO_LONG,
                f"Speech text is {len(spoken)} characters; the limit is {self.config.max_chars} (TTS_MAX_CHARS).",
            )
        return spoken

    def _cache_key(self, spoken: str, language: str, voice_id: str) -> str:
        """Same spoken text + same voice + same audio settings -> same key. Any change -> new key."""
        identity = {
            "text": spoken,
            "language": language.strip().lower(),
            "voice_id": voice_id,
            "settings": self.config.audio_settings(),
        }
        encoded = json.dumps(identity, sort_keys=True, ensure_ascii=False).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()[:32]

    def _get_or_generate(self, key: str, spoken: str, voice_id: str) -> tuple[bytes, str, _Generation | None]:
        """Return (audio, source, generation). generation is None when no new audio was made."""
        with self._lock:
            audio = self._cache.get(key)
            if audio is not None:
                return audio, "cache", None
            future = self._in_flight.get(key)
            is_owner = future is None
            if is_owner:
                if not self.config.is_configured:
                    raise TTSError(
                        ErrorCode.NOT_CONFIGURED,
                        "ELEVENLABS_API_KEY must be set (see .env.example).",
                    )
                future = Future()
                self._in_flight[key] = future

        if not is_owner:
            # An identical request is already generating: wait for its result instead of paying twice.
            try:
                generation = future.result(timeout=self._in_flight_wait_seconds())
            except FutureTimeout:
                raise TTSError(
                    ErrorCode.PROVIDER_TIMEOUT,
                    "Timed out waiting for an identical request that was already generating.",
                    retryable=True,
                ) from None
            except TTSError as exc:
                # Same failure as the request we waited for, but this call made no attempts itself.
                raise TTSError(exc.code, exc.message, retryable=exc.retryable) from exc
            return generation.audio, "shared", None

        try:
            generation = self._generate_with_retries(spoken, voice_id)
            self._cache.put(key, generation.audio)  # before leaving in-flight, so later callers hit the cache
            future.set_result(generation)
            return generation.audio, "provider", generation
        except BaseException as exc:
            future.set_exception(exc)
            raise
        finally:
            with self._lock:
                self._in_flight.pop(key, None)

    def _generate_with_retries(self, spoken: str, voice_id: str) -> _Generation:
        attempt = 0
        while True:
            attempt += 1
            try:
                audio = self._provider.generate(spoken, voice_id)
            except TTSError as exc:
                exc.attempts = attempt
                if not exc.retryable or attempt > self.config.max_retries:
                    raise
                delay = _backoff_seconds(attempt, exc.retry_after)
                logger.warning(
                    "ElevenLabs attempt %d failed (%s); retrying in %.1fs", attempt, exc.code, delay
                )
                self._sleep(delay)
                continue
            if not audio.audio:
                raise TTSError(
                    ErrorCode.PROVIDER_UNAVAILABLE,
                    "ElevenLabs returned no audio.",
                    retryable=True,
                    provider_request_id=audio.request_id,
                ).with_attempts(attempt)
            return _Generation(audio.audio, attempt, audio.request_id, audio.characters_billed)

    def _in_flight_wait_seconds(self) -> float:
        """At least as long as the request we are waiting for can take, so we never give up early.
        One attempt can take up to about twice the timeout (deadline plus one stalled read)."""
        per_attempt = 2 * self.config.timeout_seconds + 10
        return per_attempt * (self.config.max_retries + 1) + MAX_BACKOFF_SECONDS * self.config.max_retries


# --- Module-level API used by the backend ---------------------------------------------

_default_service: TTSService | None = None
_default_service_lock = threading.Lock()


def get_service() -> TTSService:
    """The shared TTSService, built from environment variables on first use."""
    global _default_service
    with _default_service_lock:
        if _default_service is None:
            _default_service = TTSService(TTSConfig.from_env())
        return _default_service


def synthesize(request: TTSRequest) -> TTSResult:
    """Turn a TTSRequest into a TTSResult. Never raises for expected failures."""
    try:
        service = get_service()
    except ValueError as exc:  # a malformed setting in .env, e.g. TTS_MAX_CHARS=abc
        return TTSResult(
            request_id=_request_id_of(request),
            ok=False,
            error_code=ErrorCode.NOT_CONFIGURED,
            error_message=str(exc),
        )
    return service.synthesize(request)


async def synthesize_async(request: TTSRequest) -> TTSResult:
    """For async backends (e.g. FastAPI `async def` routes): runs synthesize() in a worker thread."""
    return await asyncio.to_thread(synthesize, request)


def get_audio(audio_id: str) -> tuple[bytes, str] | None:
    """(audio bytes, MIME type) for an audio_id returned earlier, or None. Use it in an audio endpoint."""
    try:
        return get_service().get_audio(audio_id)
    except ValueError:  # malformed .env: synthesize() reports it; here there is simply no audio
        return None


def get_stats() -> dict:
    """Counters since the server started: requests, cache hits, characters sent, failures by code."""
    try:
        return get_service().stats()
    except ValueError as exc:
        return {"error": str(exc)}


def list_voices() -> dict:
    """The voices users can choose, for the app's voice picker:
    {"default": "matilda", "voices": [{"key", "name", "description", "accent", "gender"}, ...]}.

    It comes from the same catalog synthesize() uses, so the list and the voices that work always
    match. Restart the server after editing voices.json. Raises ValueError if voices.json is broken."""
    return get_service().voices.public()


# --- Helpers ----------------------------------------------------------------------


def _validate(request: object) -> None:
    def invalid(message: str) -> TTSError:
        return TTSError(ErrorCode.INVALID_REQUEST, message)

    if not isinstance(request, TTSRequest):
        raise invalid(f"Expected a TTSRequest, got {type(request).__name__}.")
    if not isinstance(request.request_id, str) or not request.request_id.strip():
        raise invalid("request_id must be a non-empty string.")
    if not isinstance(request.text, str):
        raise invalid(
            f"text must be a string, got {type(request.text).__name__}. "
            "Pass Gemini's answer text, not the whole response object."
        )
    if request.speech_text is not None and not isinstance(request.speech_text, str):
        raise invalid(f"speech_text must be a string or None, got {type(request.speech_text).__name__}.")
    if not isinstance(request.language, str) or not request.language.strip().lower().startswith("en"):
        raise invalid(f"Only English is supported for now (language={request.language!r}).")
    if request.voice is not None and not isinstance(request.voice, str):
        raise invalid(f"voice must be a key from voices.json or None, got {type(request.voice).__name__}.")


def _request_id_of(request: object) -> str:
    try:
        request_id = getattr(request, "request_id", "")
    except Exception:  # an odd object whose attribute raises: still never raise to the backend
        return ""
    return request_id if isinstance(request_id, str) else ""


def _backoff_seconds(attempt: int, retry_after: float | None) -> float:
    """Wait longer after each failure; honour the provider's Retry-After, within reason."""
    if retry_after is not None and retry_after >= 0:
        return min(retry_after, MAX_BACKOFF_SECONDS)
    return min(0.5 * 2 ** (attempt - 1), MAX_BACKOFF_SECONDS) + random.uniform(0, 0.25)


def _elapsed_ms(started: float) -> int:
    return int((time.monotonic() - started) * 1000)


def _log_result(result: TTSResult, source: str) -> None:
    # Lengths only: the text itself may be private.
    logger.info(
        "tts request_id=%s ok=%s source=%s spoken_chars=%d chars_sent=%d attempts=%d elapsed_ms=%d error=%s",
        result.request_id,
        result.ok,
        source,
        len(result.spoken_text),
        result.characters_sent,
        result.attempts,
        result.elapsed_ms,
        result.error_code or "-",
    )


class _Stats:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._counts: Counter = Counter()
        self._failures: Counter = Counter()

    def record(self, result: TTSResult, source: str) -> None:
        with self._lock:
            self._counts["requests"] += 1
            self._counts["succeeded" if result.ok else "failed"] += 1
            if result.ok and source == "cache":
                self._counts["cache_hits"] += 1
            if result.ok and source == "shared":
                self._counts["shared_in_flight"] += 1
            self._counts["provider_attempts"] += result.attempts
            self._counts["characters_sent"] += result.characters_sent
            if result.characters_billed:
                self._counts["characters_billed"] += result.characters_billed
            if not result.ok:
                self._failures[result.error_code] += 1

    def snapshot(self) -> dict:
        with self._lock:
            keys = (
                "requests", "succeeded", "failed", "cache_hits", "shared_in_flight",
                "provider_attempts", "characters_sent", "characters_billed",
            )
            data = {key: self._counts[key] for key in keys}
            data["failures_by_code"] = dict(self._failures)
            return data
