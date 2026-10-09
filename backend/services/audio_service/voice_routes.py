"""Voice endpoints: the user's recording -> speech-to-text -> the Gemini step -> spoken reply.

To switch them on, add two lines to backend/main.py, after `app = FastAPI(...)`:

    from services.audio_service.voice_routes import router as voice_router
    app.include_router(voice_router)

    POST /api/v1/voice/analyze              recording (+ optional bill photo/PDF) -> transcript, Gemini result, reply audio URL
    GET  /api/v1/voice/audio/{id}           the reply audio (MP3)
    GET  /api/v1/voice/voices               the voices users can choose for replies (from voices.json)
    GET  /api/v1/voice/voices/{key}/sample  a short sample of one voice (MP3), to hear it before choosing

The Gemini step is the team's services.gemini_service.analyze(), called the same way as
/api/v1/analyze calls it, with the transcript as the user's text. The response's "analysis" field
has exactly the shape /api/v1/analyze returns, so the app can show both the same way.
"""

from __future__ import annotations

import asyncio
import uuid
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from models import AnalyzeResponse
from services.audio_service.speech_to_text import ErrorCode as STTErrorCode
from services.audio_service.speech_to_text import STTRequest, to_gemini_handoff, transcribe_async
from services.audio_service.text_to_speech import TTSRequest, get_audio, list_voices, synthesize_async
from services.gemini_service import analyze, is_mock, model_name

MAX_BILL_MB = 15  # same limits as /api/v1/analyze in main.py
GEMINI_TIMEOUT_S = 45
SAMPLE_TEXT = "Hi, I'm {name}. I can read your medical bill explanations out loud."

router = APIRouter(prefix="/api/v1/voice", tags=["voice"])

# Recording problems the user can fix by trying again -> 422; everything else is on our side.
_USER_FIXABLE = {
    STTErrorCode.INVALID_REQUEST,
    STTErrorCode.EMPTY_AUDIO,
    STTErrorCode.UNSUPPORTED_AUDIO,
    STTErrorCode.NO_SPEECH,
}


class Transcript(BaseModel):
    text: str
    language: Optional[str] = None
    confidence: Optional[float] = None
    needs_confirmation: bool = False  # True when the transcript may be misheard: show it to the user
    audio_seconds: Optional[float] = None


class Speech(BaseModel):
    ok: bool
    audio_url: Optional[str] = None  # GET this to play the reply
    mime_type: Optional[str] = None
    voice: Optional[str] = None  # key of the voice used, e.g. "bunty"
    error_code: Optional[str] = None  # set when ok is False; the text answer is still valid
    error_message: Optional[str] = None


class VoiceAnalyzeResponse(BaseModel):
    transcript: Transcript
    analysis: AnalyzeResponse  # the same shape /api/v1/analyze returns
    speech: Speech


@router.post("/analyze", response_model=VoiceAnalyzeResponse)
async def voice_analyze(
    audio: UploadFile = File(description="The user's spoken question: m4a from the app, webm, mp3, wav, ..."),
    file: Optional[UploadFile] = File(None, description="Optional photo or PDF of the bill/EOB"),
    target_language: str = Form("en", description="Language the user speaks and wants the answer in"),
    message_id: Optional[str] = Form(None, description="Your ID for this message; one is made if missing"),
    speak_reply: bool = Form(True, description="Also turn result.spoken_summary into audio"),
    voice: Optional[str] = Form(None, description="Reply voice: a key from GET /api/v1/voice/voices; default if missing"),
):
    """Recording -> transcript -> Gemini -> spoken reply. Errors say which stage failed."""
    request_id = message_id or uuid.uuid4().hex

    heard = await transcribe_async(
        STTRequest(
            request_id=request_id,
            audio=await audio.read(),
            mime_type=audio.content_type,
            language=target_language,
        )
    )
    handoff = to_gemini_handoff(heard)
    if handoff is None:
        raise HTTPException(
            _status_for_speech_error(heard.error_code, heard.retryable),
            detail={
                "stage": "speech_to_text",
                "error_code": heard.error_code,
                "message": heard.error_message,
                "retryable": heard.retryable,
            },
        )

    file_bytes, mime = None, None
    if file is not None and file.filename:
        file_bytes = await file.read()
        mime = file.content_type
        if len(file_bytes) > MAX_BILL_MB * 1024 * 1024:
            raise HTTPException(413, detail={"stage": "upload", "message": f"File is larger than {MAX_BILL_MB} MB."})

    analysis = await _ask_gemini(file_bytes, mime, handoff.text, target_language)
    if speak_reply:
        speech = await _speak(request_id, analysis.result.spoken_summary, target_language, voice)
    else:
        speech = Speech(ok=False, error_code="NOT_REQUESTED", error_message="speak_reply was false.")

    return VoiceAnalyzeResponse(
        transcript=Transcript(
            text=handoff.text,
            language=handoff.language,
            confidence=handoff.confidence,
            needs_confirmation=handoff.needs_confirmation,
            audio_seconds=heard.audio_seconds,
        ),
        analysis=analysis,
        speech=speech,
    )


@router.get("/audio/{audio_id}")
def voice_audio(audio_id: str):
    """The reply audio made by /analyze. The ID is checked, so paths like "../secret" are refused."""
    found = get_audio(audio_id)
    if found is None:
        raise HTTPException(404, detail={"stage": "audio", "message": "Audio not found."})
    data, mime_type = found
    # The same audio_id always means the same audio, so it may be cached for good.
    return Response(content=data, media_type=mime_type, headers={"Cache-Control": "public, max-age=31536000, immutable"})


@router.get("/voices")
def voices():
    """The voices users can choose for spoken replies: {"default": "matilda", "voices": [...]}."""
    try:
        return list_voices()
    except ValueError as e:  # voices.json is broken
        raise HTTPException(500, detail={"stage": "voices", "message": str(e)})


@router.get("/voices/{voice_key}/sample")
async def voice_sample(voice_key: str):
    """A short sample of one voice, so users can hear it before choosing. Made once, then cached."""
    try:
        catalog = list_voices()
    except ValueError as e:
        raise HTTPException(500, detail={"stage": "voices", "message": str(e)})
    entry = next((v for v in catalog["voices"] if v["key"] == voice_key.strip().lower()), None)
    if entry is None:
        raise HTTPException(404, detail={"stage": "voices", "message": f"Unknown voice {voice_key!r}."})
    spoken = await synthesize_async(
        TTSRequest(request_id=f"sample-{entry['key']}", text=SAMPLE_TEXT.format(name=entry["name"]), voice=entry["key"])
    )
    if not spoken.ok:
        raise HTTPException(
            503 if spoken.retryable else 502,
            detail={"stage": "text_to_speech", "error_code": spoken.error_code, "message": spoken.error_message},
        )
    return Response(content=spoken.audio, media_type=spoken.mime_type, headers={"Cache-Control": "public, max-age=86400"})


async def _ask_gemini(file_bytes: Optional[bytes], mime: Optional[str], text: str, target_language: str) -> AnalyzeResponse:
    """The same call and error handling as /api/v1/analyze in main.py."""
    try:
        result = await asyncio.wait_for(
            analyze(file_bytes=file_bytes, mime_type=mime, text=text, target_language=target_language),
            timeout=GEMINI_TIMEOUT_S,
        )
    except ValueError as e:
        raise HTTPException(400, detail={"stage": "gemini", "message": str(e)})
    except asyncio.TimeoutError:
        raise HTTPException(504, detail={"stage": "gemini", "message": "Gemini took too long. Try again."})
    except Exception as e:  # API key problems, quota, network, bad output
        raise HTTPException(502, detail={"stage": "gemini", "message": f"Gemini step failed: {e}"})
    return AnalyzeResponse(target_language=target_language, model=model_name(), mock=is_mock(), result=result)


async def _speak(request_id: str, text: str, language: str, voice: Optional[str]) -> Speech:
    """A failed reply audio never fails the request: the text answer is still shown."""
    spoken = await synthesize_async(TTSRequest(request_id=request_id, text=text, language=language, voice=voice))
    if not spoken.ok:
        return Speech(ok=False, voice=voice, error_code=spoken.error_code, error_message=spoken.error_message)
    return Speech(
        ok=True, audio_url=f"{router.prefix}/audio/{spoken.audio_id}", mime_type=spoken.mime_type, voice=spoken.voice
    )


def _status_for_speech_error(error_code: Optional[str], retryable: bool) -> int:
    if error_code == STTErrorCode.AUDIO_TOO_LARGE:
        return 413
    if error_code in _USER_FIXABLE:
        return 422
    return 503 if retryable else 502
