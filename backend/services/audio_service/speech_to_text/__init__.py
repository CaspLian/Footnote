"""Speech-to-text for the backend: the user's recording in, their question (for Gemini) out.

    from services.audio_service.speech_to_text import STTRequest, to_gemini_handoff, transcribe

    result = transcribe(STTRequest(request_id=message_id, audio=uploaded_bytes, mime_type=content_type))
    handoff = to_gemini_handoff(result)
    if handoff:
        ...  # send handoff.text to Gemini
    else:
        ...  # ask the user to try again; result.error_code says why

See README.md in this folder for the full contract.
"""

from .contract import ErrorCode, GeminiHandoff, STTRequest, STTResult
from .handoff import VOICE_INPUT_NOTE, to_gemini_handoff
from .service import STTService, get_stats, transcribe, transcribe_async

__all__ = [
    "ErrorCode",
    "GeminiHandoff",
    "STTRequest",
    "STTResult",
    "STTService",
    "VOICE_INPUT_NOTE",
    "get_stats",
    "to_gemini_handoff",
    "transcribe",
    "transcribe_async",
]
