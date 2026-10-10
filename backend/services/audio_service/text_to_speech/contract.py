"""The agreement between the backend and the text-to-speech module.

The backend builds a TTSRequest and calls synthesize(). It always gets a
TTSResult back: synthesize() does not raise for expected failures such as
empty text or an ElevenLabs outage, so the backend can always show the text
answer and treat audio as optional.

synthesize_streaming() is the faster variant: it returns as soon as the first
audio exists, and open_audio(audio_id) hands out the audio while the rest is
still being made, so the user starts hearing the answer sooner.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import asdict, dataclass


class ErrorCode:
    """Stable error strings the backend can branch on (TTSResult.error_code)."""

    # Problems with the request itself. Retrying the same request will not help.
    INVALID_REQUEST = "INVALID_REQUEST"  # wrong types, missing request_id, ...
    EMPTY_TEXT = "EMPTY_TEXT"  # nothing speakable left after cleanup
    TEXT_TOO_LONG = "TEXT_TOO_LONG"  # over TTS_MAX_CHARS after cleanup

    # Problems with our setup or account. A person has to fix these.
    NOT_CONFIGURED = "NOT_CONFIGURED"  # API key missing, or a malformed setting in .env
    AUTH_FAILED = "AUTH_FAILED"  # key rejected or lacks permission
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED"  # out of ElevenLabs credits
    PROVIDER_REJECTED = "PROVIDER_REJECTED"  # ElevenLabs refused the request (bad voice/model/format, plan restriction)

    # Temporary problems. Worth retrying later (TTSResult.retryable is True).
    RATE_LIMITED = "RATE_LIMITED"  # too many requests at once
    PROVIDER_TIMEOUT = "PROVIDER_TIMEOUT"  # ElevenLabs did not answer in time
    PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE"  # network error or ElevenLabs server error

    # A bug on our side. Check the logs.
    INTERNAL_ERROR = "INTERNAL_ERROR"


@dataclass(frozen=True)
class TTSRequest:
    """What the backend sends to the TTS module."""

    request_id: str
    """The backend's ID for this answer (e.g. the chat message ID). Echoed back in the result."""

    text: str
    """Gemini's complete answer as it is displayed. May contain Markdown."""

    speech_text: str | None = None
    """Optional speech-ready version of the answer. Used instead of `text` when provided."""

    language: str = "en"
    """Language of the text. Only English is used for now."""

    voice: str | None = None
    """The user's voice choice: a key from voices.json, e.g. "bunty". None means the default voice."""

    model: str | None = None
    """Optional ElevenLabs model for this request, e.g. "eleven_flash_v2_5" (see config.MODELS).
    None means the configured one (ELEVENLABS_MODEL_ID)."""


@dataclass(frozen=True)
class TTSResult:
    """What the TTS module returns to the backend."""

    request_id: str
    ok: bool

    # Present when ok is True.
    audio: bytes | None = None  # None while streaming is True: read it with open_audio(audio_id)
    mime_type: str | None = None  # e.g. "audio/mpeg"; use it as the HTTP Content-Type
    audio_id: str | None = None  # same text + same voice settings -> same ID; see get_audio()
    voice: str | None = None  # key of the voice used, e.g. "matilda"
    model: str | None = None  # ElevenLabs model used, e.g. "eleven_multilingual_v2"
    streaming: bool = False  # True: the audio is still being made (from synthesize_streaming())

    # What was actually spoken, after cleanup. Useful for captions and debugging.
    spoken_text: str = ""

    # Cost and performance evidence.
    cached: bool = False  # True means no new ElevenLabs generation was needed
    characters_sent: int = 0  # characters this call sent to ElevenLabs (0 when cached)
    characters_billed: int | None = None  # as reported by ElevenLabs, when it reports it
    attempts: int = 0  # ElevenLabs HTTP attempts made by this call
    elapsed_ms: int = 0  # until all the audio was ready; until the first audio when streaming
    provider_request_id: str | None = None  # quote this to ElevenLabs support

    # Present when ok is False.
    error_code: str | None = None
    error_message: str | None = None
    retryable: bool = False

    def metadata(self) -> dict:
        """Everything except the audio bytes, safe to log or return as JSON."""
        data = asdict(self)
        data.pop("audio")
        data["audio_bytes"] = len(self.audio) if self.audio else 0
        return data


class AudioCutShort(Exception):
    """Raised while reading AudioStream.chunks when the audio stops before the end: the
    generation failed or stalled part-way. The message says why (e.g. "PROVIDER_TIMEOUT: ...")."""


@dataclass(frozen=True)
class AudioStream:
    """Audio to send to a player, from open_audio(). Finished audio comes in one piece
    (complete=True, safe to cache for good); audio still being made comes piece by piece
    as it arrives (complete=False: don't let browsers cache it; reading it raises
    AudioCutShort if it stops early)."""

    chunks: Iterator[bytes]
    mime_type: str
    complete: bool
    size: int | None = None  # bytes, when complete
