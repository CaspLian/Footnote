"""Developer console: try the whole ClaimPulse backend in a browser. Local only.

    cd backend
    python dev_console.py                       # opens http://127.0.0.1:8770/console
    python dev_console.py --tiger-url URL       # save analyses to a local test database (or set TIGER_DATA_POSTGRES_URL)

It runs the real app from main.py, so every route is the one the mobile app will call:
/api/v1/analyze, /api/v1/audits/{id} and /api/v1/voice/*. Settings are read exactly as the app reads them:
Gemini, Snowflake and Tiger Data from backend/.env; the voice settings (ELEVENLABS_*) from backend/.env or, if
there is none, backend/api.env. What it does when a service has no key or credentials (the page shows which):
  - Gemini: MOCK mode, a fixed sample answer whatever you send (services/gemini_services/mock_gemini_response.json)
  - Snowflake: the price check uses data/cpt_benchmarks.csv
  - Tiger Data: analyses are not saved (so "Hear it" and "Saved analyses" are off)
  - ElevenLabs: the voice features answer with an error

It listens on 127.0.0.1 only, answers only requests addressed to 127.0.0.1 or localhost (so a web page using a
look-alike address cannot reach it), and refuses requests sent by other web pages, so no other site you visit can
use it to spend your credits. Stop it with Ctrl+C.
"""
import argparse
import os
import socket
import sys
import threading
import webbrowser
from pathlib import Path

from starlette.responses import PlainTextResponse

BACKEND = Path(__file__).resolve().parent
PAGE = BACKEND / "dev_console.html"
DEFAULT_PORT = 8770
ALLOWED_HOSTS = ("127.0.0.1", "localhost")


def _real(value: str | None) -> bool:
    """A setting holding a real value, not empty and not an .env.example placeholder."""
    value = (value or "").strip()
    return bool(value) and not value.lower().startswith("your") and "your_" not in value.lower()


def _decide_services() -> dict:
    """What the app will use, once main.py has loaded its settings. Without credentials, Gemini runs in MOCK mode
    and prices come from the CSV, so the console works with no keys at all. Gemini, the price check and the store
    read these settings on every request, so changing them here, after main.py is imported, takes effect."""
    from services.analytical_services.analysis_store import database_host
    from services.audio_service.text_to_speech.config import TTSConfig

    gemini = _real(os.getenv("GEMINI_API_KEY")) and os.getenv("MOCK", "false").lower() not in ("1", "true", "yes")
    if not gemini:
        os.environ["MOCK"] = "true"
    snowflake = all(_real(os.getenv(name)) for name in ("SNOWFLAKE_ACCOUNT", "SNOWFLAKE_USER", "SNOWFLAKE_PASSWORD"))
    if not snowflake or os.getenv("PRICE_SOURCE", "snowflake").lower() == "csv":
        snowflake = False
        os.environ["PRICE_SOURCE"] = "csv"
    host = database_host() or ""
    try:
        voice = "live" if TTSConfig.from_env().is_configured else "off"  # the settings the voice routes will use
    except ValueError:  # a malformed voice setting; the voice routes report it in their errors
        voice = "settings error"
    return {
        "gemini": "live" if gemini else "mock",
        "prices": "snowflake" if snowflake else "local_csv",
        "saving": ("local test database" if host in ("127.0.0.1", "localhost", "::1") else "Tiger Data") if host else "off",
        "voice": voice,
    }


class OnlyThisPage:
    """Refuse requests that a browser marks as sent by another web page.

    main.py allows every origin (CORS "*"), which is right for the phone app. On a developer's computer it would
    let any site they visit post to this console and spend their credits. Requests typed into the address bar,
    sent by the console page itself, or sent by tools such as curl (no browser marks) are let through. Browsers
    without Sec-Fetch-Site still send Origin with such requests: it must be this very server (scheme, host and port),
    so pages served by other local programs, such as the playground on another port, are refused too."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            headers = {name.decode("latin-1"): value.decode("latin-1") for name, value in scope["headers"]}
            origin = headers.get("origin")
            if headers.get("sec-fetch-site", "same-origin") not in ("same-origin", "none") or (
                origin is not None and origin.lower() != f"http://{headers.get('host', '')}".lower()
            ):
                refused = PlainTextResponse("Only the console page itself may use this server.", status_code=403)
                await refused(scope, receive, send)
                return
        await self.app(scope, receive, send)


def build_app(tiger_url: str | None = None):
    """The team's app from main.py, plus the console page. Returns (app, services)."""
    if tiger_url:
        os.environ["TIGER_DATA_POSTGRES_URL"] = tiger_url  # real environment variables win over backend/.env
    sys.path.insert(0, str(BACKEND))
    import main  # loads backend/.env itself, exactly as when the app runs
    from fastapi.responses import HTMLResponse
    from starlette.middleware.trustedhost import TrustedHostMiddleware

    services = _decide_services()
    app = main.app
    app.add_middleware(OnlyThisPage)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=list(ALLOWED_HOSTS))  # added last, so checked first

    @app.get("/console", response_class=HTMLResponse, include_in_schema=False)
    def console():
        return PAGE.read_text(encoding="utf-8")  # re-read each time: edits to the page need no restart

    @app.get("/console/status", include_in_schema=False)
    def status():
        return services  # which services are live; never any value or key

    return app, services


def main_cli(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python dev_console.py", description=__doc__.split("\n\n")[0])
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"port to use (default {DEFAULT_PORT})")
    parser.add_argument("--tiger-url", help="PostgreSQL URL to save analyses to (use a test database)")
    parser.add_argument("--no-browser", action="store_true", help="do not open the page automatically")
    args = parser.parse_args(argv)

    import uvicorn

    app, services = build_app(args.tiger_url)
    port = args.port if args.port and _port_is_free(args.port) else _free_port()  # --port 0: any free port
    url = f"http://127.0.0.1:{port}/console"
    print(f"ClaimPulse developer console: {url}   (Ctrl+C to stop)")
    print("Services:", ", ".join(f"{name} {state}" for name, state in services.items()))
    opener = threading.Timer(1.5, webbrowser.open, args=(url,))
    opener.daemon = True  # Ctrl+C before it fires: stop at once, and do not open a page that is gone
    if not args.no_browser:
        opener.start()
    try:
        uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
    finally:
        opener.cancel()
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
    sys.exit(main_cli())
