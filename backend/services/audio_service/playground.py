"""Voice playground: a local page to try the voices. Type anything, pick a voice, hear it.

    cd backend/services/audio_service
    python -m playground                 # starts the server and opens the page in your browser

The page sends your text to POST /api/speak on this small server: the text-to-speech receiver.
It uses the same text_to_speech module the backend uses, so it costs the same credits (about
0.44 per character; the same text in the same voice again is free).

It only listens on this computer (127.0.0.1), so nobody else on the network can use it to spend
your credits. Stop it with Ctrl+C.
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

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel, Field

from text_to_speech import TTSRequest, get_audio, list_voices, synthesize_async
from text_to_speech.config import TTSConfig

PAGE_FILE = Path(__file__).with_name("playground.html")
SAMPLE_TEXT = "Hi, I'm {name}. I can read your medical bill explanations out loud."
DEFAULT_PORT = 8765

app = FastAPI(title="ClaimPulse voice playground")


class SpeakRequest(BaseModel):
    text: str = Field(max_length=10_000)  # the module's own limit (TTS_MAX_CHARS) is checked after cleanup
    voice: Optional[str] = None


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


@app.post("/api/speak")
async def speak(body: SpeakRequest):
    """The text-to-speech receiver: text and a voice in; a link to the audio and the cost out."""
    result = await synthesize_async(
        TTSRequest(request_id=f"playground-{uuid.uuid4().hex[:8]}", text=body.text, voice=body.voice)
    )
    data = result.metadata()
    data["audio_url"] = f"/api/audio/{result.audio_id}" if result.ok else None
    return data


@app.get("/api/audio/{audio_id}")
def audio(audio_id: str):
    found = get_audio(audio_id)
    if found is None:
        raise HTTPException(404, detail="Audio not found.")
    data, mime_type = found
    return Response(content=data, media_type=mime_type)


@app.get("/api/voices/{voice_key}/sample")
async def sample(voice_key: str):
    """A short sample of one voice. Made once (about 30 credits), then served from the cache."""
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
