"""Voice playground: a local page to try the voices. Type anything, pick a voice, hear it.

    cd backend/services/audio_service
    python -m playground                 # starts the server and opens the page in your browser

The page sends your text to POST /api/speak on this small server: the text-to-speech receiver.
It uses the same text_to_speech module the backend uses, so it costs the same credits (about
0.22 per character on Flash v2.5, the default, 0.44 on Multilingual v2; the same text in the same voice again is free).

The audio is streamed: /api/speak answers as soon as the first audio exists, and the page plays
/api/audio/{id} while the rest is still being made. The page can also switch models, to compare
speed and sound (see MODEL_NOTES).

It only listens on this computer (127.0.0.1), so nobody else on the network can use it to spend
your credits, and it only answers requests addressed to 127.0.0.1 or localhost, so a web page
cannot reach it through a look-alike address ("DNS rebinding"). Stop it with Ctrl+C.
"""

from __future__ import annotations

import argparse
import socket
import sys
import threading
import uuid
import webbrowser
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel, Field
from starlette.middleware.trustedhost import TrustedHostMiddleware

from audio_http import audio_response
from text_to_speech import TTSRequest, list_voices, open_audio, synthesize_async, synthesize_streaming_async
from text_to_speech.config import MODELS, TTSConfig
from text_to_speech.service import get_service

PAGE_FILE = Path(__file__).with_name("playground.html")
SAMPLE_TEXT = "Hi, I'm {name}. I can read your medical bill explanations out loud."
DEFAULT_PORT = 8765

# Measured 2026-10-09 on our Creator plan: first audio for a 95-character / 222-character text full
# of numbers. Credits per character are what ElevenLabs' character-cost header reported; for v4 and
# v4 Turbo they are the regular rates, because the 72%-off launch price we measured ends Oct 12, 2026.
MODEL_NOTES = {
    "eleven_multilingual_v2": (0.44, "the most lifelike. First audio in about 1.5 s, or 3.6 s for longer text"),
    "eleven_flash_v2_5": (0.22, "the fastest. First audio in about 0.3-1 s; numbers are read right with number "
                                "reading on (sent automatically); ElevenLabs says the quality is slightly lower"),
    "eleven_v4_turbo": (0.22, "newest real-time model. First audio in about 0.4-1 s, but slow to finish; "
                              "ElevenLabs documents it for its dialogue API, it works here too"),
    "eleven_v4": (0.44, "newest quality model. First audio in about 0.7-1.7 s, slow to finish"),
}

app = FastAPI(title="Footnote voice playground")
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost"])


class SpeakRequest(BaseModel):
    text: str = Field(max_length=10_000)  # the module's own limit (TTS_MAX_CHARS) is checked after cleanup
    voice: Optional[str] = None
    model: Optional[str] = None  # a key of text_to_speech.config.MODELS; None = ELEVENLABS_MODEL_ID


@app.get("/", response_class=HTMLResponse)
def page():
    return PAGE_FILE.read_text(encoding="utf-8")


@app.get("/api/voices")
def voices():
    """The voices from voices.json: {"default": "matilda", "voices": [...]}."""
    try:
        return list_voices()
    except ValueError as e:
        raise HTTPException(500, detail=str(e))


@app.get("/api/models")
def models():
    """The models the page can switch between, with what we measured for each."""
    try:
        default = get_service().config.model_id
    except ValueError as e:
        raise HTTPException(500, detail=str(e))
    choices = dict(MODELS)
    choices.setdefault(default, default)  # an ELEVENLABS_MODEL_ID outside the list is still offered
    return {
        "default": default,
        "models": [
            {
                "id": model_id,
                "label": label,
                "credits_per_character": MODEL_NOTES.get(model_id, (None, ""))[0],
                "note": ("today's default. " if model_id == default else "") + MODEL_NOTES.get(model_id, (None, ""))[1],
            }
            for model_id, label in choices.items()
        ],
    }


@app.post("/api/speak")
async def speak(body: SpeakRequest):
    """The text-to-speech receiver: text, a voice and a model in; a link to the audio and the cost out.
    It answers as soon as the first audio exists; the link plays while the rest is being made."""
    request_id = f"playground-{uuid.uuid4().hex[:8]}"
    result = await synthesize_streaming_async(
        TTSRequest(request_id=request_id, text=body.text, voice=body.voice, model=body.model)
    )
    data = result.metadata()
    # ?r= makes each answer's link new, so the browser never replays bytes from an earlier attempt
    # that broke off; the server ignores it.
    data["audio_url"] = f"/api/audio/{result.audio_id}?r={request_id}" if result.ok else None
    return data


@app.get("/api/audio/{audio_id}")
def audio(audio_id: str, request: Request):
    """The clip: whole (or a byte range) when finished, piece by piece while it is still being made."""
    stream = open_audio(audio_id)
    if stream is None:
        raise HTTPException(404, detail="Audio not found.")
    return audio_response(stream, request.headers.get("range"))


@app.get("/api/voices/{voice_key}/sample")
async def sample(voice_key: str):
    """A short sample of one voice. Made once (about 15 credits on Flash v2.5), then served from the cache."""
    try:
        catalog = list_voices()
    except ValueError as e:
        raise HTTPException(500, detail=str(e))
    entry = next((v for v in catalog["voices"] if v["key"] == voice_key.strip().lower()), None)
    if entry is None:
        raise HTTPException(404, detail=f"Unknown voice {voice_key!r}.")
    result = await synthesize_async(
        TTSRequest(request_id=f"sample-{entry['key']}", text=SAMPLE_TEXT.format(name=entry["name"]), voice=entry["key"])
    )
    if not result.ok:
        raise HTTPException(503 if result.retryable else 502, detail=f"{result.error_code}: {result.error_message}")
    return Response(content=result.audio, media_type=result.mime_type)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m playground", description=__doc__.split("\n\n")[0])
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"port to use (default {DEFAULT_PORT})")
    parser.add_argument("--no-browser", action="store_true", help="do not open the page automatically")
    args = parser.parse_args(argv)

    import uvicorn  # imported here so the tests can import this file without uvicorn

    try:
        configured = TTSConfig.from_env().is_configured
    except ValueError as exc:
        print(f"Setting error: {exc}")
        return 1
    if not configured:
        print("Warning: no ELEVENLABS_API_KEY found (backend/.env or backend/api.env). The page will show NOT_CONFIGURED.")

    port = args.port if _port_is_free(args.port) else _free_port()
    url = f"http://127.0.0.1:{port}/"
    print(f"Voice playground: {url}   (press Ctrl+C here to stop it)")
    if not args.no_browser:
        threading.Timer(1.5, webbrowser.open, args=(url,)).start()
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
    return 0


def _port_is_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
        except OSError:
            return False
        return True


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


if __name__ == "__main__":
    sys.exit(main())
