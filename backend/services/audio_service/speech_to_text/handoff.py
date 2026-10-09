"""Turn a transcript into what the Gemini service needs.

The teammate's Gemini code receives a GeminiHandoff and sends handoff.text to Gemini as the
user's message. Nothing here calls Gemini: the backend connects the two.
"""

from __future__ import annotations

from .contract import GeminiHandoff, STTResult

# Below this average word probability the transcript may be misheard. A starting point:
# the first real test (clear speech) scored far above it; tune it with real recordings.
DEFAULT_CONFIRM_BELOW = 0.5

# Optional line for the Gemini system prompt, so Gemini knows the message came from speech.
VOICE_INPUT_NOTE = (
    "The user's message was spoken and transcribed automatically, so it may contain "
    "recognition errors. If a word looks misheard, ask the user to confirm it."
)


def to_gemini_handoff(result: STTResult, *, confirm_below: float = DEFAULT_CONFIRM_BELOW) -> GeminiHandoff | None:
    """The user's question, ready for Gemini. None when there is nothing to send:
    the transcription failed or found no speech (result.error_code says why)."""
    if not result.ok or not result.text:
        return None
    return GeminiHandoff(
        request_id=result.request_id,
        text=result.text,
        language=result.language,
        confidence=result.confidence,
        needs_confirmation=result.confidence is not None and result.confidence < confirm_below,
    )
