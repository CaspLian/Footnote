"""Voice endpoints: the user's recording -> speech-to-text -> the Gemini step -> spoken reply.

backend/main.py mounts this router (app.include_router(voice_router)):

    POST /api/v1/voice/analyze              recording (+ optional bill photo/PDF) -> transcript, analysis, reply audio URL
    POST /api/v1/voice/speak                a saved analysis (audit_id) -> reply audio URL, without analyzing again
    GET  /api/v1/voice/audio/{id}           the reply audio (MP3)
    GET  /api/v1/voice/voices               the voices users can choose for replies (from voices.json)
    GET  /api/v1/voice/voices/{key}/sample  a short sample of one voice (MP3) in the listener's language (?language=)
    POST /api/v1/voice/agent/session         a private live conversation about a saved bill, or about one Guide term

The Gemini step is the team's services.gemini_services.gemini_service.analyze(), followed by the team's
Snowflake price check (services.snowflake_services.snowflake_service.check_prices) and saving to Tiger Data
(services.analytical_services.analysis_store), called the same way as /api/v1/analyze calls them, with the transcript as
the user's text. The response's "analysis" field has exactly what /api/v1/analyze returns, price checks
and audit included, so the app can show both the same way. The spoken reply is Gemini's spoken summary
followed by what the price check found (spoken_reply()), in the user's language: target_language is one of the
locales in backend/locales.py, and for languages other than English Gemini translates the price findings.

By default /analyze answers once the reply audio is finished. With stream_reply=true it answers as
soon as the first audio exists and the audio URL plays while the rest is being made: faster, and
tested in Chrome; Android is expected to play it too, iPhones may not, so test on both phones before
turning it on (README, "Speed"). Streaming needs the backend to run as one process: audio that is
still being made exists only in the process making it.
"""

from __future__ import annotations

import asyncio
import re
import uuid
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError

from locales import language_name, language_of, resolve_locale
from models import AnalyzeResponse, PriceCheck
from services.analytical_services.analysis_store import StoreUnavailable, load_analysis, save_analysis
from services.audio_service.audio_http import audio_response
from services.audio_service.voice_agent.client import AgentError
from services.audio_service.voice_agent.bill_context import doctor_only
from services.audio_service.voice_agent.session import get_service as get_agent_service, start_session_async
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
from services.audio_service.text_to_speech.voices import load_catalog, sample_text
from services.gemini_services.gemini_service import SUPPORTED_MIME, analyze, is_mock, model_name, translate_for_speech
from services.snowflake_services.snowflake_service import check_prices

MAX_BILL_MB = 15  # same limits as /api/v1/analyze in main.py
GEMINI_TIMEOUT_S = 150  # same as main.py: covers 2 attempts x 2 models
# A Guide term the live agent explains: the app's own glossary text, bounded like other untrusted input.
TERM_LIMITS = {"term_id": 80, "term_title": 120, "term_definition": 1500, "term_example": 1000}
TRANSLATION_TIMEOUT_S = 15  # the longest a reply waits for its price findings' translation; then it is said without them
# Where ElevenLabs' speech-to-text knows a language by another code than backend/locales.py: Norwegian is "no".
# Scribe takes the ISO 639-1 codes and uses them: "he" is heard as Hebrew, "th" as Thai, "zh" as Chinese in either
# script; it refuses "zh-TW" and "cmn" (checked 2026-10-10).
_SPEECH_TO_TEXT_CODES = {"nb": "no"}
# What ends a sentence, in the reply languages; and what may follow it (closing quotes and brackets, and the invisible
# direction marks Hebrew and Arabic text may carry: LRM, RLM, ALM, embeddings and isolates).
_SENTENCE_ENDS = (".", "!", "?", "\u2026", "\u3002", "\uff01", "\uff1f", "\u0964", "\u061f")
_DIRECTION_MARKS = "\u200e\u200f\u061c\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069"
_CLOSING_MARKS = "\"')]\u201d\u2019\u00bb\u300d\u300f" + _DIRECTION_MARKS
_NAME_END = re.compile("[\u3002\uff01\uff1f\u0964\u061f]")

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
    target_language: str = Form(
        "en-US", description="The user's language, spoken and for the answer: a locale from GET /api/v1/languages"
    ),
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
    try:
        locale = resolve_locale(target_language)  # "es" -> "es-MX"
    except ValueError as e:
        raise HTTPException(400, detail={"stage": "language", "message": str(e)})
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
            language=_speech_to_text_language(locale),  # the language alone: "pt-BR" -> "pt"
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

    analysis = await _ask_gemini(file_bytes, mime, handoff.text, locale)
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


@router.post("/agent/session")
async def voice_agent_session(
    request: Request,
    audit_id: Optional[str] = Form(None, description="UUID of a saved analysis, for a conversation about that bill"),
    target_language: Optional[str] = Form(None, description="App locale; saved analysis language when omitted"),
    voice: Optional[str] = Form(None, description="A key from GET /api/v1/voice/voices"),
    connection_type: str = Form("webrtc", description="webrtc token or websocket signed URL"),
    term_id: Optional[str] = Form(None, description="Without audit_id: the Guide term to talk about"),
    term_title: Optional[str] = Form(None, description="The Guide term's title, e.g. Deductible"),
    term_definition: Optional[str] = Form(None, description="The Guide's definition of the term"),
    term_example: Optional[str] = Form(None, description="The Guide's example for the term"),
):
    """Prepare one private live conversation about a saved bill (audit_id) or, without one, about a Guide term
    (term_title and target_language). The key and agent ID stay on the server."""
    try:
        get_agent_service().check_origin(request.headers.get("origin"))
        if connection_type not in ("webrtc", "websocket"):
            raise AgentError("INVALID_REQUEST", "connection_type must be webrtc or websocket.", 400)
        if not audit_id and term_title and term_title.strip():
            return await _guide_session(request, target_language, voice, connection_type,
                                        {"id": term_id, "title": term_title, "definition": term_definition, "example": term_example})
        if not audit_id:
            raise HTTPException(400, detail={"stage": "audit", "message": "audit_id or a Guide term (term_title) is required for a live conversation."})
        try:
            uuid.UUID(audit_id)
        except ValueError:
            raise HTTPException(400, detail={"stage": "audit", "message": "audit_id must be a valid UUID."}) from None
        locale = None
        if target_language is not None:
            try:
                locale = resolve_locale(target_language)
            except ValueError as exc:
                raise HTTPException(400, detail={"stage": "language", "message": str(exc)}) from None
        try:
            saved = await load_analysis(audit_id)
        except ValueError as exc:
            raise HTTPException(400, detail={"stage": "audit", "message": str(exc)}) from None
        except StoreUnavailable as exc:
            raise HTTPException(503, detail={"stage": "audit", "message": str(exc)}) from None
        if saved is None:
            raise HTTPException(404, detail={"stage": "audit", "message": "No saved analysis with this ID."})
        try:
            analysis = AnalyzeResponse.model_validate(saved["analysis"])
        except (ValidationError, KeyError, TypeError):
            raise HTTPException(409, detail={"stage": "audit", "message": "This saved analysis is in an older format."}) from None
        try:
            analysis_locale = resolve_locale(analysis.target_language)
            analysis_name = language_name(analysis_locale)
        except ValueError:
            analysis_locale, analysis_name = None, analysis.target_language
        if locale is None:
            if analysis_locale is None:
                raise HTTPException(400, detail={"stage": "language", "message": "Send a supported target_language for this saved analysis."})
            locale = analysis_locale
        different_language = analysis_locale is None or language_of(analysis_locale) != language_of(locale)
        session = await start_session_async(
            analysis=analysis.model_dump(mode="json"), audit_id=audit_id, locale=locale,
            language_name=language_name(locale), analysis_language_name=analysis_name if different_language else None,
            voice=voice, connection_type=connection_type, client_address=request.client.host if request.client else "unknown",
        )
        return JSONResponse(session, headers={"Cache-Control": "no-store"})
    except AgentError as exc:
        headers = {"Retry-After": str(exc.retry_after)} if exc.retry_after is not None else None
        raise HTTPException(exc.status, detail={"stage": "language" if exc.code == "LANGUAGE_NOT_SUPPORTED" else "agent",
                                              "message": str(exc), "error_code": exc.code, "retryable": exc.retryable}, headers=headers) from None


async def _guide_session(request: Request, target_language: Optional[str], voice: Optional[str], connection_type: str,
                         term: dict) -> JSONResponse:
    """A live conversation about one Guide term: no saved analysis is loaded."""
    for name, value in (("term_id", term["id"]), ("term_title", term["title"]),
                        ("term_definition", term["definition"]), ("term_example", term["example"])):
        if value is not None and len(value) > TERM_LIMITS[name]:
            raise HTTPException(400, detail={"stage": "term", "message": f"{name} is longer than {TERM_LIMITS[name]} characters."})
    if not target_language:
        raise HTTPException(400, detail={"stage": "language", "message": "Send target_language for a Guide conversation."})
    try:
        locale = resolve_locale(target_language)
    except ValueError as exc:
        raise HTTPException(400, detail={"stage": "language", "message": str(exc)}) from None
    session = await start_session_async(
        analysis=None, audit_id=None, term=term, locale=locale, language_name=language_name(locale),
        voice=voice, connection_type=connection_type, client_address=request.client.host if request.client else "unknown",
    )
    return JSONResponse(session, headers={"Cache-Control": "no-store"})


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
async def voice_sample(voice_key: str, request: Request,
                       language: Optional[str] = Query(None, description="The listener's locale, e.g. ja-JP; English when omitted")):
    """A short sample of one voice in the listener's language, so users hear the accent it will speak with before
    choosing. A voice ElevenLabs has not verified for that language speaks one it is verified for instead. Made
    once per voice and language, then cached. Supports byte ranges, like the reply audio, because iPhones ask for them."""
    try:
        catalog = load_catalog()
    except ValueError as e:
        raise HTTPException(500, detail={"stage": "voices", "message": str(e)})
    voice = catalog.get(voice_key)
    if voice is None:
        raise HTTPException(404, detail={"stage": "voices", "message": f"Unknown voice {voice_key!r}."})
    try:
        locale = resolve_locale(language) if language else "en-US"
    except ValueError as exc:
        raise HTTPException(400, detail={"stage": "language", "message": str(exc)}) from None
    spoken_in = voice.preview_language(locale)
    spoken = await synthesize_async(
        TTSRequest(request_id=f"sample-{voice.key}-{spoken_in}", text=sample_text(spoken_in, voice.name),
                   voice=voice.key, language=spoken_in)
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
    said = await _spoken_text(analysis)
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


async def _spoken_text(analysis: AnalyzeResponse) -> str:
    """spoken_reply() in the analysis' language. Gemini wrote the summary in it; for a language other than English,
    Gemini also translates the price findings, and if it cannot (in time), the summary is said alone."""
    findings = price_findings(analysis, quote_names=True)  # quoted, so the translator can tell names from the rest
    if not findings or _base_language(analysis.target_language) == "en":
        return spoken_reply(analysis)
    try:
        translated = await asyncio.wait_for(translate_for_speech(findings, analysis.target_language), TRANSLATION_TIMEOUT_S)
    except (ValueError, asyncio.TimeoutError):  # a language no longer offered (an older saved analysis), or too slow
        translated = None
    return spoken_reply(analysis, translated or "")


def spoken_reply(analysis: AnalyzeResponse, findings: Optional[str] = None) -> str:
    """What the reply voice says: Gemini's spoken summary, then a sentence or two on the price check.

    Gemini writes its summary before the price check runs, so the findings are added here. They are
    comparisons with Medicare's national rates: a reason to ask questions, never proof that a charge is wrong.
    `findings` are those sentences in the analysis' language. By default they are price_findings(), which is English,
    so they are added to English replies only; _spoken_text() has them translated for the other languages."""
    summary = analysis.result.spoken_summary.strip()
    language = _base_language(analysis.target_language)
    if findings is None:
        findings = price_findings(analysis) if language == "en" else ""
    if not findings:
        return summary
    if summary and summary.rstrip(_CLOSING_MARKS)[-1:] not in _SENTENCE_ENDS:
        summary += "\u3002" if language in ("ja", "zh") else "."  # so the findings do not run on from the summary
    if language in ("ja", "zh"):  # written without spaces between sentences
        return summary + findings
    return _sentences(summary, findings)


def price_findings(analysis: AnalyzeResponse, quote_names: bool = False) -> str:
    """Medicare reference findings, with doctor-only comparisons kept out of ratios and price claims.
    `quote_names` puts each charge's name in quotes, for translation: Gemini wrote the names in the user's language."""
    doctor_checks = [check for check in analysis.price_checks if doctor_only(check.model_dump())]
    compared = [check for check in analysis.price_checks
                if check.times_medicare is not None and not doctor_only(check.model_dump())]
    doctor_note = (f"For {_charges(len(doctor_checks))}, Medicare's reference covers only the doctor's part. "
                   "The hospital's part is not included, so this cannot show whether those charges are high. "
                   "Ask the billing office for an itemized explanation.") if doctor_checks else ""
    if not compared:
        return doctor_note
    reference_note = "Medicare's rates are a reference, not proof of an error or a fair hospital price."
    # The furthest above Medicare's rate first, so the charges named are the ones most worth asking about.
    flagged = sorted(
        (check for check in compared if check.flag in ("above_typical", "far_above_typical")),
        key=lambda check: (check.flag != "far_above_typical", -check.times_medicare),
    )
    if not flagged:
        return _sentences(f"I also compared {_charges(len(compared))} with Medicare's national rates. "
                          "This check did not flag a price question.", reference_note, doctor_note)
    sentences, named = [], 0
    for check in flagged:
        name = f"“{_line_name(analysis, check)}”" if quote_names else _line_name(analysis, check)
        sentence = (f"{name} was billed about {_times(check.times_medicare)} times Medicare's national rate.")
        if sentence in sentences:  # the same charge listed twice on the bill: said once
            named += 1
            continue
        if len(sentences) == 2:
            break
        sentences.append(sentence)
        named += 1
    others = len(flagged) - named
    if others > 0:
        sentences.append(f"{_charges(others, 'other')} also {'has' if others == 1 else 'have'} a difference worth asking about.")
    sentences.append(reference_note)
    sentences.append(doctor_note)
    sentences.append(f"It's worth asking the billing office about {'it' if len(flagged) == 1 else 'them'}.")
    return _sentences("I also compared the charges with Medicare's national rates.", *sentences)


def _sentences(*parts: str) -> str:
    return " ".join(part for part in parts if part)


def _times(value: float) -> str:
    """30.0 -> "30", 4.5 -> "4.5", 1234567.0 -> "1,234,567" (never exponent notation, which a voice cannot read)."""
    return f"{value:,.0f}" if value >= 100 else f"{value:g}"


def _line_name(analysis: AnalyzeResponse, check: PriceCheck) -> str:
    items = analysis.result.line_items
    if 0 <= check.line_index < len(items):
        item = items[check.line_index]
        name = item.plain_description.strip() or item.original_description.strip()
        # Up to its first full stop in a script without abbreviations (Japanese, Chinese, Hindi, Arabic): Gemini
        # sometimes describes a charge in sentences there, and the name must fit inside one.
        name = _NAME_END.split(name, 1)[0].strip().rstrip(".")
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
    """"en-US" or "pt_BR" -> "en" or "pt", for any code, even one no longer offered (an older saved analysis)."""
    return code.strip().replace("_", "-").split("-")[0].lower()


def _speech_to_text_language(locale: str) -> str:
    """The hint speech-to-text takes for a supported locale: its language alone, as ElevenLabs knows it."""
    language = language_of(locale)
    return _SPEECH_TO_TEXT_CODES.get(language, language)


def _charges(count: int, kind: str = "") -> str:
    noun = "charge" if count == 1 else "charges"
    return f"{count} {kind + ' ' if kind else ''}{noun}"


def _status_for_speech_error(error_code: Optional[str], retryable: bool) -> int:
    if error_code == STTErrorCode.AUDIO_TOO_LARGE:
        return 413
    if error_code in _USER_FIXABLE:
        return 422
    return 503 if retryable else 502
