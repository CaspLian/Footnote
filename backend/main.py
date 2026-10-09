import asyncio
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, File, Form, HTTPException, UploadFile  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from models import AnalyzeResponse  # noqa: E402
from services.gemini_service import LANGUAGES, analyze, is_mock, model_name  # noqa: E402
from services.snowflake_service import check_prices  # noqa: E402

MAX_UPLOAD_MB = 15
GEMINI_TIMEOUT_S = 75

app = FastAPI(title="ClaimPulse AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "ClaimPulse AI API is running", "mock": is_mock(), "model": model_name()}


@app.get("/api/v1/languages")
def languages():
    return LANGUAGES


@app.post("/api/v1/analyze", response_model=AnalyzeResponse)
async def analyze_endpoint(
    file: Optional[UploadFile] = File(None, description="Photo or PDF of the bill/EOB"),
    text: Optional[str] = Form(None, description="Typed text or a question (optional if a file is sent)"),
    target_language: str = Form("en", description="Language code, e.g. en, es, zh, ar"),
):
    """User input -> Gemini -> Snowflake price check. result.spoken_summary is the text for ElevenLabs."""
    file_bytes, mime = None, None
    if file is not None and file.filename:
        file_bytes = await file.read()
        mime = file.content_type
        if len(file_bytes) > MAX_UPLOAD_MB * 1024 * 1024:
            raise HTTPException(413, f"File is larger than {MAX_UPLOAD_MB} MB.")

    try:
        result = await asyncio.wait_for(
            analyze(file_bytes=file_bytes, mime_type=mime, text=text, target_language=target_language),
            timeout=GEMINI_TIMEOUT_S,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    except asyncio.TimeoutError:
        raise HTTPException(504, "Gemini took too long. Try again or use a smaller image.")
    except Exception as e:  # API key problems, quota, network, bad output
        raise HTTPException(502, f"Gemini step failed: {e}")

    # Step 2: compare each line item to Medicare's rate in Snowflake (never fails the request)
    price_checks, price_summary = await check_prices(result.line_items)

    return AnalyzeResponse(
        target_language=target_language,
        model=model_name(),
        mock=is_mock(),
        result=result,
        price_checks=price_checks,
        price_summary=price_summary,
    )
