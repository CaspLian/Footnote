"""Text-to-speech for the backend.

    from text_to_speech import TTSRequest, synthesize

    result = synthesize(TTSRequest(request_id=message_id, text=gemini_answer_text, voice="bunty"))
    if result.ok:
        ...  # result.audio (bytes), result.mime_type, result.audio_id, result.voice
    else:
        ...  # still show the text; log result.error_code

list_voices() gives the voices users can choose (from voices.json).
See README.md in this folder for the full contract.
"""

from .contract import ErrorCode, TTSRequest, TTSResult
from .service import TTSService, get_audio, get_stats, list_voices, synthesize, synthesize_async

__all__ = [
    "ErrorCode",
    "TTSRequest",
    "TTSResult",
    "TTSService",
    "get_audio",
    "get_stats",
    "list_voices",
    "synthesize",
    "synthesize_async",
]
