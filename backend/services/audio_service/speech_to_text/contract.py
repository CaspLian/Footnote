"""The agreement between the backend and the speech-to-text module.

The backend receives the user's recording from the app and calls transcribe(). It always gets
an STTResult back: transcribe() does not raise for expected failures such as silence or an
ElevenLabs outage. A successful result becomes a GeminiHandoff (see handoff.py): the user's
question, ready for the Gemini service.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass


class ErrorCode:
    """Stable error strings the backend can branch on (STTResult.error_code)."""

    # Problems with the recording. Ask the user to try again.
    INVALID_REQUEST = "INVALID_REQUEST"  # wrong types, missing request_id, ...
    EMPTY_AUDIO = "EMPTY_AUDIO"  # no audio, or far too short to hold speech
    AUDIO_TOO_LARGE = "AUDIO_TOO_LARGE"  # over STT_MAX_AUDIO_MB
    UNSUPPORTED_AUDIO = "UNSUPPORTED_AUDIO"  # not an audio file we recognise
    NO_SPEECH = "NO_SPEECH"  # transcribed fine, but nothing was said

    # Problems with our setup or account. A person has to fix these.
    NOT_CONFIGURED = "NOT_CONFIGURED"  # ELEVENLABS_API_KEY missing
    AUTH_FAILED = "AUTH_FAILED"  # key rejected, or missing the "Speech to Text" permission
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED"  # out of ElevenLabs credits
    PROVIDER_REJECTED = "PROVIDER_REJECTED"  # ElevenLabs refused the request (bad model, unreadable audio, ...)

    # Temporary problems. Worth retrying later (STTResult.retryable is True).
    RATE_LIMITED = "RATE_LIMITED"
    PROVIDER_TIMEOUT = "PROVIDER_TIMEOUT"
    PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE"

    # A bug on our side. Check the logs.
    INTERNAL_ERROR = "INTERNAL_ERROR"


@dataclass(frozen=True)
class STTRequest:
    """What the backend sends to the STT module."""

    request_id: str
    """The backend's ID for this voice message. Echoed back in the result."""

    audio: bytes
    """The recording exactly as uploaded: m4a from a phone, webm from a browser, mp3, wav, ..."""

    mime_type: str | None = None
    """The upload's content type, if known. Only used when the format cannot be detected from the bytes."""

    language: str = "en"
    """ISO code of the spoken language. "" lets ElevenLabs detect it."""


@dataclass(frozen=True)
class STTResult:
    """What the STT module returns to the backend."""

    request_id: str
    ok: bool

    # Present when ok is True.
    text: str = ""  # what the user said, tidied: this is what goes to Gemini
    language: str | None = None  # language ElevenLabs used or detected
    confidence: float | None = None  # 0 to 1, average word probability; low means it may be misheard
    audio_seconds: float | None = None  # length of the recording; speech-to-text is billed per hour of audio
    audio_format: str | None = None  # detected from the file, e.g. "m4a"
    redacted: tuple[str, ...] = ()  # identifiers removed before the text left this module, e.g. ("ssn", "phone_number")

    # Cost and performance evidence.
    cached: bool = False  # True means no new ElevenLabs transcription was needed
    attempts: int = 0  # ElevenLabs HTTP attempts made by this call
    elapsed_ms: int = 0
    provider_request_id: str | None = None  # quote this to ElevenLabs support

    # Present when ok is False.
    error_code: str | None = None
    error_message: str | None = None
    retryable: bool = False

    def metadata(self) -> dict:
        """Every field, safe to log or return as JSON."""
        return asdict(self)


@dataclass(frozen=True)
class GeminiHandoff:
    """The user's spoken question, ready for the Gemini service. Made by handoff.to_gemini_handoff()."""

    request_id: str
    text: str  # send this to Gemini as the user's message
    language: str | None
    confidence: float | None
    needs_confirmation: bool  # True when confidence is low: consider asking "Did you mean ...?"
    input_mode: str = "voice"

    def to_dict(self) -> dict:
        return asdict(self)
