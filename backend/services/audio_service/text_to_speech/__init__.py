"""Text-to-speech for the backend.

    from text_to_speech import TTSRequest, synthesize

    result = synthesize(TTSRequest(request_id=message_id, text=gemini_answer_text, voice="bunty"))
    if result.ok:
        ...  # result.audio (bytes), result.mime_type, result.audio_id, result.voice
    else:
        ...  # still show the text; log result.error_code

synthesize_streaming() returns as soon as the first audio exists; open_audio(audio_id) serves the
audio while the rest is still being made. list_voices() gives the voices users can choose (from
voices.json). See README.md in this folder for the full contract.
"""

from .contract import AudioStream, ErrorCode, TTSRequest, TTSResult
from .service import (
    TTSService,
    get_audio,
    get_stats,
    list_voices,
    open_audio,
    synthesize,
    synthesize_async,
    synthesize_streaming,
    synthesize_streaming_async,
)

__all__ = [
    "AudioStream",
    "ErrorCode",
    "TTSRequest",
    "TTSResult",
    "TTSService",
    "get_audio",
    "get_stats",
    "list_voices",
    "open_audio",
    "synthesize",
    "synthesize_async",
    "synthesize_streaming",
    "synthesize_streaming_async",
]
