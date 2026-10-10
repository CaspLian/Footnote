import asyncio
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, File, Form, HTTPException, UploadFile  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from models import AnalyzeResponse, LetterRequest, LetterResponse  # noqa: E402
from services.gemini_service import LANGUAGES, analyze, is_mock, model_name  # noqa: E402
from services.snowflake_service import check_prices  # noqa: E402
from services.letter_service import draft_letter, suggest_letter  # noqa: E402

MAX_UPLOAD_MB = 15
GEMINI_TIMEOUT_S = 150  # covers 2 attempts x 2 models

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
    files: Optional[list[UploadFile]] = File(
        None, description="Additional bill/EOB pages in order; repeat this field for each page"
    ),
    text: Optional[str] = Form(None, description="Typed text or a question (optional if a file is sent)"),
    target_language: str = Form("en", description="Language code, e.g. en, es, zh, ar"),
):
    """Analyze one PDF/image or ordered `files` uploads, then check extracted CPT prices."""
    uploads = ([file] if file is not None else []) + (files or [])
    page_files: list[tuple[bytes, str]] = []
    total_bytes = 0
    for upload in uploads:
        if not upload.filename:
            continue
        remaining_bytes = MAX_UPLOAD_MB * 1024 * 1024 - total_bytes
        upload_bytes = await upload.read(remaining_bytes + 1)
        total_bytes += len(upload_bytes)
        if total_bytes > MAX_UPLOAD_MB * 1024 * 1024:
            raise HTTPException(
                413, f"Combined upload is larger than {MAX_UPLOAD_MB} MB."
            )
        if not upload_bytes:
            raise HTTPException(400, f"Uploaded file {upload.filename!r} is empty.")
        page_files.append((upload_bytes, upload.content_type or ""))

    try:
        result = await asyncio.wait_for(
            analyze(files=page_files, text=text, target_language=target_language),
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

    response = AnalyzeResponse(
        target_language=target_language,
        model=model_name(),
        mock=is_mock(),
        result=result,
        price_checks=price_checks,
        price_summary=price_summary,
    )
    # Step 3: tell the app whether to offer the "Draft a letter" button
    response.letter_reasons = suggest_letter(response)
    response.letter_suggested = bool(response.letter_reasons)
    return response


@app.post("/api/v1/letter", response_model=LetterResponse)
async def letter_endpoint(req: LetterRequest):
    """Draft a dispute/request letter from an /analyze response (sent back unchanged in `analysis`)."""
    try:
        return await asyncio.wait_for(draft_letter(req), timeout=GEMINI_TIMEOUT_S)
    except asyncio.TimeoutError:
        raise HTTPException(504, "Gemini took too long writing the letter. Please try again.")
    except Exception as e:
        raise HTTPException(502, f"Letter step failed: {e}")
