"""Voice endpoints: the user's recording -> speech-to-text -> the Gemini step -> spoken reply.

backend/main.py mounts this router (app.include_router(voice_router)):

    POST /api/v1/voice/analyze              recording (+ optional bill photo/PDF) -> transcript, analysis, reply audio URL
    POST /api/v1/voice/speak                a saved analysis (audit_id) -> reply audio URL, without analyzing again
    GET  /api/v1/voice/audio/{id}           the reply audio (MP3)
    GET  /api/v1/voice/voices               the voices users can choose for replies (from voices.json)
    GET  /api/v1/voice/voices/{key}/sample  a short sample of one voice (MP3), to hear it before choosing

The Gemini step is the team's services.gemini_services.gemini_service.analyze(), followed by the team's
Snowflake price check (services.snowflake_services.snowflake_service.check_prices) and saving to Tiger Data
(services.analytical_services.analysis_store), called the same way as /api/v1/analyze calls them, with the transcript as
the user's text. The response's "analysis" field has exactly what /api/v1/analyze returns, price checks
and audit included, so the app can show both the same way. The spoken reply is Gemini's spoken summary
followed by what the price check found (spoken_reply()).

By default /analyze answers once the reply audio is finished. With stream_reply=true it answers as
soon as the first audio exists and the audio URL plays while the rest is being made: faster, and
tested in Chrome; Android is expected to play it too, iPhones may not, so test on both phones before
turning it on (README, "Speed"). Streaming needs the backend to run as one process: audio that is
still being made exists only in the process making it.
"""

from __future__ import annotations

import asyncio
import uuid
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, ValidationError

from models import AnalyzeResponse, PriceCheck
from services.analytical_services.analysis_store import StoreUnavailable, load_analysis, save_analysis
from services.audio_service.audio_http import audio_response
from services.audio_service.speech_to_text import ErrorCode as STTErrorCode
from services.audio_service.speech_to_text import STTRequest, to_gemini_handoff, transcribe_async
from services.audio_service.speech_to_text.service import get_service as get_stt_service
from services.audio_service.text_to_speech import (
    AudioStream,
    TTSRequest,
    list_voices,
    open_audio,
    synthesize_async,
    synthesize_streaming_async,
)
from services.gemini_services.gemini_service import SUPPORTED_MIME, analyze, is_mock, model_name
from services.snowflake_services.snowflake_service import check_prices

MAX_BILL_MB = 15  # same limits as /api/v1/analyze in main.py
GEMINI_TIMEOUT_S = 150  # same as main.py: covers 2 attempts x 2 models
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
    streaming: bool = False  # True: the audio is still being made, and audio_url plays it as it arrives
    text: Optional[str] = None  # what the voice says (the spoken summary plus the price check), for captions
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
    stream_reply: bool = Form(
        False, description="Answer at the first reply audio and stream the rest (faster; test on phones first)"
    ),
):
    """Recording -> transcript -> Gemini -> spoken reply. Errors say which stage failed."""
    request_id = message_id or uuid.uuid4().hex

    # Everything that can be refused is checked first: a refused request must not pay for speech-to-text.
    # Uploads are read only up to their limit, so an oversized one never sits in memory whole.
    file_bytes, mime = None, None
    if file is not None and file.filename:
        bill_limit = int(MAX_BILL_MB * 1024 * 1024)
        file_bytes = await file.read(bill_limit + 1)
        mime = file.content_type
        if len(file_bytes) > bill_limit:
            raise HTTPException(413, detail={"stage": "upload", "message": f"File is larger than {MAX_BILL_MB} MB."})
        if file_bytes and mime not in SUPPORTED_MIME:  # the check Gemini's analyze() makes, with its message
            raise HTTPException(
                400, detail={"stage": "gemini", "message": f"Unsupported file type {mime}. Use JPG, PNG, WEBP, HEIC or PDF."}
            )
    recording = await _read_recording(audio)

    heard = await transcribe_async(
        STTRequest(
            request_id=request_id,
            audio=recording,
            mime_type=audio.content_type,
            language=_base_language(target_language),  # phones send locales such as "en-US"
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

    analysis = await _ask_gemini(file_bytes, mime, handoff.text, target_language)
    # Save it to Tiger Data, as main.py does (never fails the request; analysis.audit says how it went), while the
    # reply audio is made: the audio does not need the saved copy, so the user does not wait for both in turn.
    saving = asyncio.create_task(save_analysis(analysis, source="voice", transcript=handoff.text))
    try:
        if speak_reply:
            speech = await _speak(request_id, analysis, voice, stream_reply)
        else:
            speech = Speech(ok=False, error_code="NOT_REQUESTED", error_message="speak_reply was false.")
    finally:
        analysis.audit = await saving

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


@router.post("/speak", response_model=Speech)
async def voice_speak(
    audit_id: str = Form(description="response.audit.audit_id from /api/v1/analyze or /api/v1/voice/analyze"),
    voice: Optional[str] = Form(None, description="Reply voice: a key from GET /api/v1/voice/voices; default if missing"),
    stream_reply: bool = Form(False, description="Answer at the first audio and stream the rest (test on phones first)"),
):
    """Speak an analysis that was already made, without analyzing the bill again. Only saved analyses can
    be spoken: the server never reads out text sent to it directly. Each voice is its own (paid) clip."""
    try:
        saved = await load_analysis(audit_id)
    except ValueError as e:
        raise HTTPException(400, detail={"stage": "audit", "message": str(e)})
    except StoreUnavailable as e:
        raise HTTPException(503, detail={"stage": "audit", "message": str(e)})
    if saved is None:
        raise HTTPException(404, detail={"stage": "audit", "message": "No saved analysis with this ID."})
    try:
        analysis = AnalyzeResponse.model_validate(saved["analysis"])
    except ValidationError:  # saved before a change to models.py that it no longer fits
        raise HTTPException(
            409, detail={"stage": "audit", "message": "This saved analysis is in an older format and cannot be spoken."}
        ) from None
    return await _speak(f"speak-{saved['audit_id']}", analysis, voice, stream_reply)


@router.get("/audio/{audio_id}")
def voice_audio(audio_id: str, request: Request):
    """The reply audio made by /analyze. The ID is checked, so paths like "../secret" are refused.
    Finished audio supports byte ranges (iPhones need them); audio still being made is streamed."""
    stream = open_audio(audio_id)
    if stream is None:
        raise HTTPException(404, detail={"stage": "audio", "message": "Audio not found."})
    # The same audio_id always means the same finished audio, so the phone may keep it for good. "private":
    # it explains someone's bill, so shared caches (proxies, CDNs) must not store it.
    return audio_response(
        stream, request.headers.get("range"), finished_headers={"Cache-Control": "private, max-age=31536000, immutable"}
    )


@router.get("/voices")
def voices():
    """The voices users can choose for spoken replies: {"default": "matilda", "voices": [...]}."""
    try:
        return list_voices()
    except ValueError as e:  # voices.json is broken
        raise HTTPException(500, detail={"stage": "voices", "message": str(e)})


@router.get("/voices/{voice_key}/sample")
async def voice_sample(voice_key: str, request: Request):
    """A short sample of one voice, so users can hear it before choosing. Made once, then cached.
    Supports byte ranges, like the reply audio, because iPhones ask for them."""
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
    finished = AudioStream(iter((spoken.audio,)), spoken.mime_type, complete=True, size=len(spoken.audio))
    return audio_response(finished, request.headers.get("range"), finished_headers={"Cache-Control": "public, max-age=86400"})


async def _ask_gemini(file_bytes: Optional[bytes], mime: Optional[str], text: str, target_language: str) -> AnalyzeResponse:
    """The same calls and error handling as /api/v1/analyze in main.py: Gemini, then the price check."""
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

    # Compare each line item to Medicare's rate in Snowflake (never fails the request), as main.py does.
    price_checks, price_summary = await check_prices(result.line_items)
    return AnalyzeResponse(
        target_language=target_language,
        model=model_name(),
        mock=is_mock(),
        result=result,
        price_checks=price_checks,
        price_summary=price_summary,
    )


async def _speak(request_id: str, analysis: AnalyzeResponse, voice: Optional[str], stream: bool = False) -> Speech:
    """Speak the analysis (spoken_reply). A failed reply audio never fails the request: the text answer is still shown."""
    said = spoken_reply(analysis)
    request = TTSRequest(
        request_id=request_id,
        text=analysis.result.spoken_summary,
        speech_text=said,
        language=analysis.target_language,
        voice=voice,
    )
    spoken = await (synthesize_streaming_async(request) if stream else synthesize_async(request))
    if not spoken.ok:
        return Speech(ok=False, voice=voice, error_code=spoken.error_code, error_message=spoken.error_message)
    return Speech(
        ok=True,
        audio_url=f"{router.prefix}/audio/{spoken.audio_id}",
        mime_type=spoken.mime_type,
        voice=spoken.voice,
        streaming=spoken.streaming,
        text=spoken.spoken_text or said,  # after the module's cleanup: exactly what was sent to ElevenLabs
    )


def spoken_reply(analysis: AnalyzeResponse) -> str:
    """What the reply voice says: Gemini's spoken summary, then a sentence or two on the price check.

    Gemini writes its summary before the price check runs, so the findings are added here. They are
    comparisons with Medicare's national rates: a reason to ask questions, never proof that a charge is wrong."""
    summary = analysis.result.spoken_summary.strip()
    compared = [check for check in analysis.price_checks if check.times_medicare is not None]
    # These sentences are English, like the reply voices for now; "en-US" and other English codes count.
    if not compared or not analysis.target_language.strip().lower().startswith("en"):
        return summary
    if summary and summary.rstrip("\"')]”’")[-1:] not in (".", "!", "?"):
        summary += "."  # so the added sentences do not run on from the summary
    # The furthest above Medicare's rate first, so the charges named are the ones most worth asking about.
    flagged = sorted(
        (check for check in compared if check.flag in ("above_typical", "far_above_typical")),
        key=lambda check: (check.flag != "far_above_typical", -check.times_medicare),
    )
    if not flagged:
        they = "it looks" if len(compared) == 1 else "they look"
        return _sentences(summary, f"I also compared {_charges(len(compared))} with Medicare's national rates, and {they} "
                                   "within the usual range for hospital prices.")
    sentences = [
        f"{_line_name(analysis, check)} was billed about {_times(check.times_medicare)} times Medicare's national rate, "
        f"which is {'far above the usual range' if check.flag == 'far_above_typical' else 'higher than usual'}."
        for check in flagged[:2]
    ]
    others = len(flagged) - 2
    if others > 0:
        sentences.append(f"{_charges(others, 'other')} also {'looks' if others == 1 else 'look'} high.")
    if any("facility fee" in check.note for check in flagged):
        sentences.append("For some services Medicare's rate covers only the doctor's part, so some difference is expected.")
    sentences.append(f"It's worth asking the billing office about {'it' if len(flagged) == 1 else 'them'}.")
    return _sentences(summary, "I also compared the charges with Medicare's national rates.", *sentences)


def _sentences(*parts: str) -> str:
    return " ".join(part for part in parts if part)


def _times(value: float) -> str:
    """30.0 -> "30", 4.5 -> "4.5", 1234567.0 -> "1,234,567" (never exponent notation, which a voice cannot read)."""
    return f"{value:,.0f}" if value >= 100 else f"{value:g}"


def _line_name(analysis: AnalyzeResponse, check: PriceCheck) -> str:
    items = analysis.result.line_items
    if 0 <= check.line_index < len(items):
        item = items[check.line_index]
        name = (item.plain_description.strip() or item.original_description.strip()).rstrip(".")
        if name:
            return name
    return f"Line {check.line_index + 1}"


async def _read_recording(audio: UploadFile) -> bytes:
    """The recording, read only up to the speech-to-text limit (STT_MAX_AUDIO_MB) plus one byte."""
    try:
        config = get_stt_service().config
    except ValueError:  # a malformed speech-to-text setting: read it all, and let transcribe_async report the setting
        return await audio.read()
    recording = await audio.read(config.max_audio_bytes + 1)
    if len(recording) > config.max_audio_bytes:
        raise HTTPException(
            413,
            detail={
                "stage": "speech_to_text",
                "error_code": STTErrorCode.AUDIO_TOO_LARGE,
                "message": f"The recording is larger than {config.max_audio_mb:g} MB (STT_MAX_AUDIO_MB).",
                "retryable": False,
            },
        )
    return recording


def _base_language(code: str) -> str:
    """"en-US" or "pt_BR" -> "en" or "pt": phones report locales, speech-to-text takes the language alone."""
    return code.strip().replace("_", "-").split("-")[0].lower()


def _charges(count: int, kind: str = "") -> str:
    noun = "charge" if count == 1 else "charges"
    return f"{count} {kind + ' ' if kind else ''}{noun}"


def _status_for_speech_error(error_code: Optional[str], retryable: bool) -> int:
    if error_code == STTErrorCode.AUDIO_TOO_LARGE:
        return 413
    if error_code in _USER_FIXABLE:
        return 422
    return 503 if retryable else 502
