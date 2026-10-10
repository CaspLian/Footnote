"""The text-to-speech pipeline.

    TTSRequest
      -> validate          (wrong input fails fast, no cost)
      -> pick the voice    (the user's choice from voices.json, or the default for the language)
      -> pick the model    (the request's choice from config.MODELS, which must speak the language; else
                            ELEVENLABS_MODEL_ID, or config.FALLBACK_MODELS for a language it cannot speak)
      -> prepare text      (text_prep.py: Markdown, links, symbols..., in the reply's language)
      -> check limits      (empty / too long fail here, no cost)
      -> cache             (same text + same voice settings = reuse, no cost)
      -> join in-flight    (an identical request is already generating = share it, no extra cost)
      -> ElevenLabs        (bounded retries for temporary failures only)
      -> TTSResult         (never raises: failures come back as ok=False)

Each generation is a _Job whose audio can be read while it is still arriving. synthesize() waits
for the end of the job; synthesize_streaming() returns at the first audio, and open_audio() hands
the audio out piece by piece, so playback can start before the clip is finished.
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
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Protocol

from .cache import AudioCache, is_valid_key
from .config import FALLBACK_MODELS, MODELS, TTSConfig, language_base, speaks
from .contract import AudioCutShort, AudioStream, ErrorCode, TTSRequest, TTSResult
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
    """Anything that turns text into audio. ElevenLabsProvider in production, a fake in tests.

    It may also have open_stream(text, voice_id, settings) -> ProviderStream (see
    elevenlabs_provider.py); without it, the audio simply arrives in one piece at the end."""

    def generate(self, text: str, voice_id: str, settings: dict | None = None) -> ProviderAudio: ...


@dataclass(frozen=True)
class _Generation:
    audio: bytes
    attempts: int
    provider_request_id: str | None
    characters_billed: int | None


class _Job:
    """One generation in progress, shared by everyone who asks for the same audio.

    The generating thread adds audio as it arrives and finally finishes the job with a
    _Generation or an exception. Anyone else can wait for the first audio, wait for the end,
    or read the audio piece by piece while it is still arriving."""

    def __init__(self, key: str) -> None:
        self.key = key
        self._changed = threading.Condition()
        self._chunks: list[bytes] = []
        self._delivered = False  # a listener already has some of this audio: no starting over
        self._outcome: _Generation | BaseException | None = None
        # From the current attempt's response headers, known before its audio.
        self.attempts = 0
        self.provider_request_id: str | None = None
        self.characters_billed: int | None = None
        # (attempts, provider_request_id, characters_billed) when the first audio arrived: what a
        # streamed result reports. Anything after that is counted when the job ends (_run).
        self.at_first_audio: tuple[int, str | None, int | None] | None = None

    # --- The generating thread ---------------------------------------------------------

    def attempt_started(self, attempt: int, provider_request_id: str | None, characters_billed: int | None) -> None:
        with self._changed:
            self.attempts = attempt
            self.provider_request_id = provider_request_id
            self.characters_billed = characters_billed

    def add(self, chunk: bytes) -> None:
        with self._changed:
            if self.at_first_audio is None:
                self.at_first_audio = (self.attempts, self.provider_request_id, self.characters_billed)
            self._chunks.append(chunk)
            self._changed.notify_all()

    def start_over(self) -> bool:
        """Drop the audio so far before a retry. Refused once a listener has heard some of it,
        because the retried audio would start from the beginning again."""
        with self._changed:
            if self._delivered:
                return False
            self._chunks.clear()
            return True

    def audio(self) -> bytes:
        with self._changed:
            return b"".join(self._chunks)

    def finish(self, outcome: _Generation | BaseException) -> None:
        with self._changed:
            self._outcome = outcome
            self._changed.notify_all()

    # --- Everyone else ---------------------------------------------------------------

    def wait_for_audio(self, timeout: float) -> _Generation | None:
        """Wait for the first audio. Returns the finished _Generation if the job is already done,
        None if audio is still arriving. Raises the job's error, or TTSError on timeout."""
        with self._changed:
            if not self._changed.wait_for(lambda: self._chunks or self._outcome is not None, timeout):
                raise _waiting_timeout()
            if isinstance(self._outcome, BaseException):
                raise self._outcome
            return self._outcome

    def result(self, timeout: float) -> _Generation:
        """Wait for the end. Raises the job's error, or TTSError on timeout."""
        with self._changed:
            if not self._changed.wait_for(lambda: self._outcome is not None, timeout):
                raise _waiting_timeout()
            if isinstance(self._outcome, BaseException):
                raise self._outcome
            return self._outcome

    def read(self, timeout: float) -> Iterator[bytes]:
        """The audio piece by piece: what has arrived so far, then each new piece as it comes.
        Raises AudioCutShort if the job fails or stalls before the end, so an audio endpoint
        breaks the connection and the player reports an error, instead of a clip that just stops."""
        index = 0
        while True:
            with self._changed:
                if not self._changed.wait_for(lambda: index < len(self._chunks) or self._outcome is not None, timeout):
                    raise AudioCutShort(f"No more audio arrived for {timeout:g} s.")
                if index >= len(self._chunks):
                    if isinstance(self._outcome, BaseException):
                        raise AudioCutShort(_describe(self._outcome))
                    return  # finished and everything has been read
                chunk = self._chunks[index]
                index += 1
                self._delivered = True
            yield chunk


def _describe(error: BaseException) -> str:
    if isinstance(error, TTSError):
        return f"{error.code}: {error.message}"
    return f"{ErrorCode.INTERNAL_ERROR}: unexpected error while making the audio (see the server logs)."


def _waiting_timeout() -> TTSError:
    return TTSError(
        ErrorCode.PROVIDER_TIMEOUT,
        "Timed out waiting for an identical request that was already generating.",
        retryable=True,
    )


@dataclass(frozen=True)
class _Found:
    """What _get_or_generate found: finished audio, or a job whose audio is still arriving."""

    source: str  # "cache", "provider" (this call made it) or "shared" (another call is making it)
    audio: bytes | None = None
    generation: _Generation | None = None  # set when this call made the finished audio
    job: _Job | None = None  # set when the audio is still arriving


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
        self._in_flight: dict[str, _Job] = {}
        self._stats = _Stats()

    # --- Public -------------------------------------------------------------------

    def synthesize(self, request: TTSRequest) -> TTSResult:
        """All the audio, once it is ready (result.audio)."""
        return self._synthesize(request, streaming=False)

    def synthesize_streaming(self, request: TTSRequest) -> TTSResult:
        """Returns as soon as the first audio exists. If result.streaming is True the rest is still
        being made: point the player at your audio endpoint, which serves open_audio(audio_id)."""
        return self._synthesize(request, streaming=True)

    def _synthesize(self, request: TTSRequest, *, streaming: bool) -> TTSResult:
        started = time.monotonic()
        request_id = _request_id_of(request)
        spoken = ""
        source = "none"
        try:
            _validate(request)
            voice_key, voice_id = self._resolve_voice(request.voice, request.language)
            settings = self._settings_for(request.model, request.language)
            spoken = self._prepare(request)
            key = self._cache_key(spoken, request.language, voice_id, settings)
            found = self._get_or_generate(key, spoken, voice_id, settings, streaming=streaming)
            source = found.source
            if found.job is not None:  # still arriving: what was known at the first audio
                made_here = found.source == "provider"
                attempts, provider_request_id, characters_billed = found.job.at_first_audio
                result = TTSResult(
                    request_id=request_id,
                    ok=True,
                    mime_type=self.config.mime_type,
                    audio_id=key,
                    voice=voice_key,
                    model=settings["model_id"],
                    streaming=True,
                    spoken_text=spoken,
                    cached=not made_here,
                    characters_sent=len(spoken) * attempts if made_here else 0,
                    characters_billed=characters_billed if made_here else None,
                    attempts=attempts if made_here else 0,
                    elapsed_ms=_elapsed_ms(started),
                    provider_request_id=provider_request_id if made_here else None,
                )
            else:
                generation = found.generation
                result = TTSResult(
                    request_id=request_id,
                    ok=True,
                    audio=found.audio,
                    mime_type=self.config.mime_type,
                    audio_id=key,
                    voice=voice_key,
                    model=settings["model_id"],
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
        """Finished audio, by its audio_id, with its MIME type. None if unknown (or not finished yet)."""
        if not is_valid_key(audio_id):
            return None
        audio = self._cache.get(audio_id)
        return (audio, self.config.mime_type) if audio is not None else None

    def open_audio(self, audio_id: str) -> AudioStream | None:
        """Audio by its audio_id for an audio endpoint: finished audio in one piece, or audio that
        is still being made, piece by piece as it arrives. None if unknown."""
        if not is_valid_key(audio_id):
            return None
        with self._lock:
            job = self._in_flight.get(audio_id)
        if job is not None:
            # Finished jobs move to the cache before they leave _in_flight, so checking the
            # job first and the cache second never misses audio that exists.
            return AudioStream(job.read(self._in_flight_wait_seconds()), self.config.mime_type, complete=False)
        audio = self._cache.get(audio_id)
        if audio is None:
            return None
        return AudioStream(iter((audio,)), self.config.mime_type, complete=True, size=len(audio))

    def stats(self) -> dict:
        return self._stats.snapshot()

    # --- Steps --------------------------------------------------------------------

    def _resolve_voice(self, choice: str | None, language: str = "en") -> tuple[str, str]:
        """(voice key, ElevenLabs voice ID) for the user's choice. No choice = the default voice for the language
        (voices.json's language_defaults, else the default voice, whose ID ELEVENLABS_VOICE_ID may replace)."""
        if choice is None or not choice.strip():
            default = self.voices.default_for(language)
            if default.key != self.voices.default_key:
                return default.key, default.voice_id
            return default.key, self.config.voice_id or default.voice_id
        voice = self.voices.get(choice)
        if voice is None:
            raise TTSError(
                ErrorCode.INVALID_REQUEST,
                f"Unknown voice {choice!r}. Choose one of: {', '.join(self.voices.keys())}.",
            )
        return voice.key, voice.voice_id

    def _settings_for(self, model: str | None, language: str = "en") -> dict:
        """The audio settings for the request's model choice, in its language. No choice = ELEVENLABS_MODEL_ID, or,
        for a language it cannot speak, the first of config.FALLBACK_MODELS that can (Hebrew and Thai: v4 Turbo).
        A chosen model that cannot speak the language, or a language no model here speaks, is refused before
        anything is paid for."""
        chosen = model is not None and model.strip() != ""
        model_id = model.strip() if chosen else self.config.model_id
        if model_id != self.config.model_id and model_id not in MODELS:
            raise TTSError(
                ErrorCode.INVALID_REQUEST,
                f"Unknown model {model!r}. Choose one of: {', '.join(MODELS)}.",
            )
        if not speaks(model_id, language):
            fallback = None if chosen else next((name for name in FALLBACK_MODELS if speaks(name, language)), None)
            if fallback is None:
                able = [name for name in MODELS if speaks(name, language)]
                raise TTSError(
                    ErrorCode.INVALID_REQUEST,
                    f"{model_id} does not speak {language!r}."
                    + (f" Use {' or '.join(able)}." if able else " No voice model here speaks it."),
                )
            model_id = fallback
        return self.config.audio_settings(model_id, language)

    def _prepare(self, request: TTSRequest) -> str:
        use_speech_text = request.speech_text is not None and request.speech_text.strip() != ""
        source_text = request.speech_text if use_speech_text else request.text
        if len(source_text) > MAX_INPUT_CHARS:
            raise TTSError(
                ErrorCode.TEXT_TOO_LONG,
                f"Input is {len(source_text)} characters; the hard limit is {MAX_INPUT_CHARS}.",
            )
        spoken = prepare_for_speech(source_text, self._pronunciations, request.language)
        if not spoken:
            raise TTSError(ErrorCode.EMPTY_TEXT, "Nothing speakable is left after removing formatting.")
        if len(spoken) > self.config.max_chars:
            raise TTSError(
                ErrorCode.TEXT_TOO_LONG,
                f"Speech text is {len(spoken)} characters; the limit is {self.config.max_chars} (TTS_MAX_CHARS).",
            )
        return spoken

    def _cache_key(self, spoken: str, language: str, voice_id: str, settings: dict) -> str:
        """Same spoken text + same voice + same audio settings -> same key. Any change -> new key.
        The language part is the language alone ("en-GB" -> "en"): the region does not change the audio, and English
        keys stay what they were when English was the only language."""
        identity = {
            "text": spoken,
            "language": language_base(language),
            "voice_id": voice_id,
            "settings": settings,
        }
        encoded = json.dumps(identity, sort_keys=True, ensure_ascii=False).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()[:32]

    def _get_or_generate(self, key: str, spoken: str, voice_id: str, settings: dict, *, streaming: bool) -> _Found:
        with self._lock:
            audio = self._cache.get(key)
            if audio is not None:
                return _Found("cache", audio=audio)
            job = self._in_flight.get(key)
            is_owner = job is None
            if is_owner:
                if not self.config.is_configured:
                    raise TTSError(
                        ErrorCode.NOT_CONFIGURED,
                        "ELEVENLABS_API_KEY must be set (see .env.example).",
                    )
                job = _Job(key)
                self._in_flight[key] = job

        source = "provider" if is_owner else "shared"
        wait = self._in_flight_wait_seconds()
        try:
            if streaming:
                if is_owner:
                    self._start_in_background(job, spoken, voice_id, settings)
                generation = job.wait_for_audio(wait)
                if generation is None:
                    return _Found(source, job=job)
            else:
                if is_owner:
                    self._run(job, spoken, voice_id, settings, False)
                generation = job.result(wait)
        except TTSError as exc:
            if is_owner:
                raise
            # Same failure as the request we waited for, but this call made no attempts itself.
            raise TTSError(exc.code, exc.message, retryable=exc.retryable) from exc
        return _Found(source, audio=generation.audio, generation=generation if is_owner else None)

    def _start_in_background(self, job: _Job, spoken: str, voice_id: str, settings: dict) -> None:
        try:
            threading.Thread(
                target=self._run, args=(job, spoken, voice_id, settings, True), daemon=True, name="tts-stream"
            ).start()
        except BaseException as exc:  # e.g. "can't start new thread": don't leave a job nobody runs
            with self._lock:
                self._in_flight.pop(job.key, None)
            job.finish(exc)
            raise

    def _run(self, job: _Job, spoken: str, voice_id: str, settings: dict, in_background: bool) -> None:
        """Make the audio for a job, then cache it. Never raises: the outcome goes into the job."""
        outcome: _Generation | BaseException
        try:
            outcome = self._generate_into(job, spoken, voice_id, settings)
            self._cache.put(job.key, outcome.audio)  # before leaving in-flight, so later callers hit the cache
        except BaseException as exc:
            outcome = exc
            if in_background:  # nobody may be waiting for the outcome any more, so log it here
                if isinstance(exc, TTSError):
                    logger.warning("Streamed audio %s failed: %s (%s)", job.key, exc.code, exc.message)
                else:
                    logger.exception("Unexpected error while streaming audio %s", job.key)
        if in_background and job.at_first_audio is not None:
            # The streamed result was returned (and counted) at the first audio; count the rest.
            extra_attempts = job.attempts - job.at_first_audio[0]
            failed = isinstance(outcome, BaseException)
            self._stats.record_after_first_audio(
                extra_attempts,
                len(spoken) * extra_attempts,
                (outcome.code if isinstance(outcome, TTSError) else ErrorCode.INTERNAL_ERROR) if failed else None,
            )
        # Leave in-flight before telling anyone the outcome: a request that comes after a failure
        # then starts afresh instead of joining this finished job and getting its old error.
        with self._lock:
            self._in_flight.pop(job.key, None)
        job.finish(outcome)
        if isinstance(outcome, BaseException) and not isinstance(outcome, Exception):
            raise outcome  # KeyboardInterrupt and friends

    def _generate_into(self, job: _Job, spoken: str, voice_id: str, settings: dict) -> _Generation:
        """Fill the job with audio from ElevenLabs, retrying temporary failures. A retry starts the
        clip again, so there is none once a listener has received part of the audio."""
        attempt = 0
        while True:
            attempt += 1
            try:
                made = self._attempt(job, spoken, voice_id, settings, attempt)
                break
            except TTSError as exc:
                exc.attempts = attempt
                if not exc.retryable or attempt > self.config.max_retries or not job.start_over():
                    raise
                delay = _backoff_seconds(attempt, exc.retry_after)
                logger.warning(
                    "ElevenLabs attempt %d failed (%s); retrying in %.1fs", attempt, exc.code, delay
                )
                self._sleep(delay)
        if not made.audio:  # not retried: an empty answer is not a network hiccup
            raise TTSError(
                ErrorCode.PROVIDER_UNAVAILABLE,
                "ElevenLabs returned no audio.",
                retryable=True,
                provider_request_id=made.request_id,
            ).with_attempts(attempt)
        return _Generation(made.audio, attempt, made.request_id, made.characters_billed)

    def _attempt(self, job: _Job, spoken: str, voice_id: str, settings: dict, attempt: int) -> ProviderAudio:
        """One request to ElevenLabs; its audio goes into the job as it arrives."""
        open_stream = getattr(self._provider, "open_stream", None)
        if open_stream is None:  # a provider that cannot stream: the audio comes in one piece
            made = self._provider.generate(spoken, voice_id, settings)
            job.attempt_started(attempt, made.request_id, made.characters_billed)
            if made.audio:
                job.add(made.audio)
            return made
        stream = open_stream(spoken, voice_id, settings)
        job.attempt_started(attempt, stream.request_id, stream.characters_billed)
        try:
            for chunk in stream.chunks:
                job.add(chunk)
        finally:
            _close(stream.chunks)  # releases the connection, on errors too
        return ProviderAudio(job.audio(), stream.request_id, stream.characters_billed)

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


def synthesize_streaming(request: TTSRequest) -> TTSResult:
    """Like synthesize(), but returns as soon as the first audio exists, so the user hears the answer
    sooner. When result.streaming is True, result.audio is None: serve the audio with open_audio()."""
    try:
        service = get_service()
    except ValueError as exc:
        return TTSResult(
            request_id=_request_id_of(request),
            ok=False,
            error_code=ErrorCode.NOT_CONFIGURED,
            error_message=str(exc),
        )
    return service.synthesize_streaming(request)


async def synthesize_streaming_async(request: TTSRequest) -> TTSResult:
    """synthesize_streaming() for async backends."""
    return await asyncio.to_thread(synthesize_streaming, request)


def get_audio(audio_id: str) -> tuple[bytes, str] | None:
    """(audio bytes, MIME type) for an audio_id returned earlier, or None. Use it in an audio endpoint."""
    try:
        return get_service().get_audio(audio_id)
    except ValueError:  # malformed .env: synthesize() reports it; here there is simply no audio
        return None


def open_audio(audio_id: str) -> AudioStream | None:
    """For an audio endpoint: finished audio, or audio still being made (piece by piece), or None.
    Send complete audio with its size; stream the rest, e.g. FastAPI's StreamingResponse(stream.chunks)."""
    try:
        return get_service().open_audio(audio_id)
    except ValueError:
        return None


def get_stats() -> dict:
    """Counters since the server started: requests, cache hits, characters sent, failures by code."""
    try:
        return get_service().stats()
    except ValueError as exc:
        return {"error": str(exc)}


def list_voices() -> dict:
    """The voices users can choose, for the app's voice picker:
    {"default": "matilda", "language_defaults": {"es-MX": "elio", ...},
     "voices": [{"key", "name", "description", "accent", "gender"}, ...]}.

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
    if not isinstance(request.language, str) or not request.language.strip():
        raise invalid(f'language must be a language code such as "en-US" or "es-MX", got {request.language!r}.')
    if request.voice is not None and not isinstance(request.voice, str):
        raise invalid(f"voice must be a key from voices.json or None, got {type(request.voice).__name__}.")
    if request.model is not None and not isinstance(request.model, str):
        raise invalid(f"model must be a model ID string or None, got {type(request.model).__name__}.")


def _close(chunks: Iterator[bytes]) -> None:
    close = getattr(chunks, "close", None)  # generators have close(); a plain iterator has nothing to release
    if close is not None:
        close()


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
        "tts request_id=%s ok=%s source=%s model=%s spoken_chars=%d chars_sent=%d attempts=%d elapsed_ms=%d "
        "error=%s",
        result.request_id,
        result.ok,
        source,
        result.model or "-",
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

    def record_after_first_audio(self, extra_attempts: int, extra_characters: int, failure_code: str | None) -> None:
        """What a streamed generation did after its result went out: retries, or a failure part-way."""
        with self._lock:
            self._counts["provider_attempts"] += extra_attempts
            self._counts["characters_sent"] += extra_characters
            if failure_code:
                self._counts["streams_cut_short"] += 1
                self._failures[failure_code] += 1

    def snapshot(self) -> dict:
        with self._lock:
            keys = (
                "requests", "succeeded", "failed", "cache_hits", "shared_in_flight",
                "provider_attempts", "characters_sent", "characters_billed", "streams_cut_short",
            )
            data = {key: self._counts[key] for key in keys}
            data["failures_by_code"] = dict(self._failures)
            return data
