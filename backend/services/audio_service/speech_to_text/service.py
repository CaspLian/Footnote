"""The speech-to-text pipeline.

    STTRequest (the recording uploaded by the app)
      -> validate          (wrong input fails fast, no cost)
      -> check the audio   (format from the file's bytes, size limit; no cost)
      -> cache             (the exact same recording again = reuse the transcript, no cost)
      -> ElevenLabs        (bounded retries for temporary failures only)
      -> tidy transcript   (spacing, sound tags; NO_SPEECH if nothing was said)
      -> STTResult         (never raises: failures come back as ok=False)

Then handoff.to_gemini_handoff(result) gives the backend what to send to Gemini.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import random
import re
import threading
import time
from collections import Counter, OrderedDict
from dataclasses import dataclass
from typing import Protocol

from .audio_check import FORMATS, MIN_AUDIO_BYTES, detect_format, looks_like_audio_mime
from .config import STTConfig
from .contract import ErrorCode, STTRequest, STTResult
from .elevenlabs_provider import ElevenLabsSTTProvider, ProviderTranscript
from .errors import STTError
from .transcript import audio_seconds_from_words, average_word_confidence, clean_transcript, has_speech

logger = logging.getLogger("speech_to_text")

MAX_BACKOFF_SECONDS = 5.0
_LANGUAGE_PATTERN = re.compile(r"[a-z]{2,3}")


class TranscriptionProvider(Protocol):
    """Anything that turns audio into text. ElevenLabsSTTProvider in production, a fake in tests."""

    def transcribe(self, audio: bytes, filename: str, mime_type: str, language: str) -> ProviderTranscript: ...


@dataclass(frozen=True)
class _Transcript:
    text: str
    language: str | None
    confidence: float | None
    audio_seconds: float | None
    provider_request_id: str | None


class STTService:
    def __init__(
        self,
        config: STTConfig,
        provider: TranscriptionProvider | None = None,
        *,
        cache_size: int = 200,
        sleep=time.sleep,
    ) -> None:
        self.config = config
        self._provider = provider if provider is not None else ElevenLabsSTTProvider(config)
        self._sleep = sleep
        self._cache_size = cache_size
        self._cache: OrderedDict[str, _Transcript] = OrderedDict()  # memory only: transcripts may be private
        self._lock = threading.Lock()
        self._stats = _Stats()

    # --- Public -------------------------------------------------------------------

    def transcribe(self, request: STTRequest) -> STTResult:
        started = time.monotonic()
        request_id = _request_id_of(request)
        audio_format = None
        source = "none"
        try:
            audio = _validate(request)
            audio_format, filename, mime_type = self._check_audio(audio, request.mime_type)
            language = request.language.strip().lower()
            key = self._cache_key(audio, language)
            transcript = self._cached(key)
            attempts = 0
            if transcript is not None:
                source = "cache"
            else:
                if not self.config.is_configured:
                    raise STTError(ErrorCode.NOT_CONFIGURED, "ELEVENLABS_API_KEY must be set (see .env.example).")
                transcript, attempts = self._transcribe_with_retries(audio, filename, mime_type, language)
                source = "provider"
                if transcript.text:
                    self._remember(key, transcript)
            if not transcript.text:
                raise STTError(ErrorCode.NO_SPEECH, "No speech was found in the recording.").with_attempts(attempts)
            result = STTResult(
                request_id=request_id,
                ok=True,
                text=transcript.text,
                language=transcript.language,
                confidence=transcript.confidence,
                audio_seconds=transcript.audio_seconds,
                audio_format=audio_format,
                cached=source == "cache",
                attempts=attempts,
                elapsed_ms=_elapsed_ms(started),
                provider_request_id=transcript.provider_request_id,
            )
        except STTError as exc:
            result = STTResult(
                request_id=request_id,
                ok=False,
                audio_format=audio_format,
                attempts=exc.attempts,
                elapsed_ms=_elapsed_ms(started),
                provider_request_id=exc.provider_request_id,
                error_code=exc.code,
                error_message=exc.message,
                retryable=exc.retryable,
            )
        except Exception:
            logger.exception("Unexpected error in speech-to-text (request_id=%s)", request_id)
            result = STTResult(
                request_id=request_id,
                ok=False,
                audio_format=audio_format,
                elapsed_ms=_elapsed_ms(started),
                error_code=ErrorCode.INTERNAL_ERROR,
                error_message="Unexpected error in the speech-to-text module. See the server logs.",
            )
        self._stats.record(result, source)
        _log_result(result, source)
        return result

    def stats(self) -> dict:
        return self._stats.snapshot()

    # --- Steps --------------------------------------------------------------------

    def _check_audio(self, audio: bytes, mime_type: str | None) -> tuple[str | None, str, str]:
        """Return (detected format, filename, MIME type) to send, or raise if this cannot be speech."""
        if len(audio) < MIN_AUDIO_BYTES:
            raise STTError(ErrorCode.EMPTY_AUDIO, f"The recording is only {len(audio)} bytes: too short to hold speech.")
        if len(audio) > self.config.max_audio_bytes:
            raise STTError(
                ErrorCode.AUDIO_TOO_LARGE,
                f"The recording is {len(audio) / 1024 / 1024:.1f} MB; the limit is {self.config.max_audio_mb:g} MB "
                "(STT_MAX_AUDIO_MB).",
            )
        audio_format = detect_format(audio)
        if audio_format is not None:
            extension, detected_mime = FORMATS[audio_format]
            return audio_format, f"recording.{extension}", detected_mime
        if looks_like_audio_mime(mime_type):
            # A format we do not recognise, but the app says it is audio: let ElevenLabs decide.
            return None, "recording", mime_type.split(";")[0].strip()
        raise STTError(
            ErrorCode.UNSUPPORTED_AUDIO,
            f"This does not look like an audio file (content type {mime_type or 'unknown'}).",
        )

    def _cache_key(self, audio: bytes, language: str) -> str:
        digest = hashlib.sha256(audio)
        digest.update(f"|{self.config.model_id}|{language}".encode())
        return digest.hexdigest()

    def _cached(self, key: str) -> _Transcript | None:
        with self._lock:
            transcript = self._cache.get(key)
            if transcript is not None:
                self._cache.move_to_end(key)
            return transcript

    def _remember(self, key: str, transcript: _Transcript) -> None:
        with self._lock:
            self._cache[key] = transcript
            self._cache.move_to_end(key)
            while len(self._cache) > self._cache_size:
                self._cache.popitem(last=False)

    def _transcribe_with_retries(
        self, audio: bytes, filename: str, mime_type: str, language: str
    ) -> tuple[_Transcript, int]:
        attempt = 0
        while True:
            attempt += 1
            try:
                raw = self._provider.transcribe(audio, filename, mime_type, language)
            except STTError as exc:
                exc.attempts = attempt
                if not exc.retryable or attempt > self.config.max_retries:
                    raise
                delay = _backoff_seconds(attempt, exc.retry_after)
                logger.warning("ElevenLabs STT attempt %d failed (%s); retrying in %.1fs", attempt, exc.code, delay)
                self._sleep(delay)
                continue
            text = clean_transcript(raw.text, raw.words)
            transcript = _Transcript(
                text=text if has_speech(text) else "",
                language=raw.language or (language or None),
                confidence=average_word_confidence(raw.words),
                audio_seconds=raw.audio_seconds if raw.audio_seconds is not None else audio_seconds_from_words(raw.words),
                provider_request_id=raw.request_id,
            )
            # Billed even when nobody spoke, so count it before the NO_SPEECH check.
            self._stats.add_audio_seconds(transcript.audio_seconds)
            return transcript, attempt


# --- Module-level API used by the backend ---------------------------------------------

_default_service: STTService | None = None
_default_service_lock = threading.Lock()


def get_service() -> STTService:
    """The shared STTService, built from environment variables on first use."""
    global _default_service
    with _default_service_lock:
        if _default_service is None:
            _default_service = STTService(STTConfig.from_env())
        return _default_service


def transcribe(request: STTRequest) -> STTResult:
    """Turn a recording into text. Never raises for expected failures."""
    try:
        service = get_service()
    except ValueError as exc:  # a malformed setting in .env, e.g. STT_MAX_AUDIO_MB=abc
        return STTResult(
            request_id=_request_id_of(request),
            ok=False,
            error_code=ErrorCode.NOT_CONFIGURED,
            error_message=str(exc),
        )
    return service.transcribe(request)


async def transcribe_async(request: STTRequest) -> STTResult:
    """For async backends (e.g. FastAPI `async def` routes): runs transcribe() in a worker thread."""
    return await asyncio.to_thread(transcribe, request)


def get_stats() -> dict:
    """Counters since the server started: requests, cache hits, audio seconds, failures by code."""
    try:
        return get_service().stats()
    except ValueError as exc:
        return {"error": str(exc)}


# --- Helpers ----------------------------------------------------------------------


def _validate(request: object) -> bytes:
    def invalid(message: str) -> STTError:
        return STTError(ErrorCode.INVALID_REQUEST, message)

    if not isinstance(request, STTRequest):
        raise invalid(f"Expected an STTRequest, got {type(request).__name__}.")
    if not isinstance(request.request_id, str) or not request.request_id.strip():
        raise invalid("request_id must be a non-empty string.")
    if not isinstance(request.audio, (bytes, bytearray, memoryview)):
        raise invalid(
            f"audio must be bytes, got {type(request.audio).__name__}. "
            "Pass the uploaded file's content (e.g. await upload.read())."
        )
    if request.mime_type is not None and not isinstance(request.mime_type, str):
        raise invalid(f"mime_type must be a string or None, got {type(request.mime_type).__name__}.")
    if not isinstance(request.language, str) or not (
        request.language.strip() == "" or _LANGUAGE_PATTERN.fullmatch(request.language.strip().lower())
    ):
        raise invalid(f'language must be an ISO code such as "en", or "" to detect it (got {request.language!r}).')
    return bytes(request.audio)


def _request_id_of(request: object) -> str:
    try:
        request_id = getattr(request, "request_id", "")
    except Exception:
        return ""
    return request_id if isinstance(request_id, str) else ""


def _backoff_seconds(attempt: int, retry_after: float | None) -> float:
    if retry_after is not None and retry_after >= 0:
        return min(retry_after, MAX_BACKOFF_SECONDS)
    return min(0.5 * 2 ** (attempt - 1), MAX_BACKOFF_SECONDS) + random.uniform(0, 0.25)


def _elapsed_ms(started: float) -> int:
    return int((time.monotonic() - started) * 1000)


def _log_result(result: STTResult, source: str) -> None:
    # Lengths only: what people say about their medical bills is private.
    logger.info(
        "stt request_id=%s ok=%s source=%s format=%s audio_seconds=%s text_chars=%d attempts=%d elapsed_ms=%d error=%s",
        result.request_id,
        result.ok,
        source,
        result.audio_format or "-",
        result.audio_seconds if result.audio_seconds is not None else "-",
        len(result.text),
        result.attempts,
        result.elapsed_ms,
        result.error_code or "-",
    )


class _Stats:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._counts: Counter = Counter()
        self._failures: Counter = Counter()
        self._audio_seconds = 0.0

    def record(self, result: STTResult, source: str) -> None:
        with self._lock:
            self._counts["requests"] += 1
            self._counts["succeeded" if result.ok else "failed"] += 1
            if result.ok and source == "cache":
                self._counts["cache_hits"] += 1
            self._counts["provider_attempts"] += result.attempts
            if not result.ok:
                self._failures[result.error_code] += 1

    def add_audio_seconds(self, seconds: float | None) -> None:
        if seconds:
            with self._lock:
                self._audio_seconds += seconds

    def snapshot(self) -> dict:
        with self._lock:
            keys = ("requests", "succeeded", "failed", "cache_hits", "provider_attempts")
            data = {key: self._counts[key] for key in keys}
            data["audio_seconds_transcribed"] = round(self._audio_seconds, 2)  # what ElevenLabs bills for
            data["failures_by_code"] = dict(self._failures)
            return data
