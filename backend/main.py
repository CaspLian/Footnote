import asyncio
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, File, Form, HTTPException, UploadFile  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from locales import resolve_locale  # noqa: E402
from models import AnalyzeResponse  # noqa: E402
from services.analytical_services.analysis_store import StoreUnavailable, load_analysis, save_analysis  # noqa: E402
from services.gemini_services.gemini_service import LANGUAGES, analyze, is_mock, model_name  # noqa: E402
from services.snowflake_services.snowflake_service import _normalize as normalize_code  # noqa: E402
from services.snowflake_services.snowflake_service import check_prices, lookup  # noqa: E402

MAX_UPLOAD_MB = 15
GEMINI_TIMEOUT_S = 150  # covers 2 attempts x 2 models

app = FastAPI(title="Footnote API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "Footnote API is running", "mock": is_mock(), "model": model_name()}


@app.get("/api/v1/languages")
def languages():
    return LANGUAGES


@app.post("/api/v1/analyze", response_model=AnalyzeResponse)
async def analyze_endpoint(
    file: Optional[UploadFile] = File(None, description="Photo or PDF of the bill/EOB"),
    files: list[UploadFile] = File(default=[], description="One or more bill pages captured as photos"),
    text: Optional[str] = Form(None, description="Typed text or a question (optional if a file is sent)"),
    target_language: str = Form("en-US", description="A locale from GET /api/v1/languages, e.g. en-US, es-MX, ja-JP"),
):
    """User input -> Gemini -> Snowflake price check. result.spoken_summary is the text for ElevenLabs."""
    try:
        target_language = resolve_locale(target_language)  # "es" -> "es-MX"; refused before any upload is read
    except ValueError as e:
        raise HTTPException(400, str(e))
    uploads = [item for item in ([file] if file is not None else []) + files if item.filename]
    image_inputs = []
    total_size = 0
    if len(uploads) > 10:
        raise HTTPException(400, "Send no more than 10 document pages at a time.")
    for upload in uploads:
        data = await upload.read(MAX_UPLOAD_MB * 1024 * 1024 + 1)
        total_size += len(data)
        if total_size > MAX_UPLOAD_MB * 1024 * 1024:
            raise HTTPException(413, f"Combined upload is larger than {MAX_UPLOAD_MB} MB.")
        image_inputs.append((data, upload.content_type or "application/octet-stream"))

    try:
        result = await asyncio.wait_for(
            analyze(image_inputs=image_inputs, text=text, target_language=target_language),
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
    # Step 3: save it to Tiger Data (never fails the request); response.audit says whether it worked
    response.audit = await save_analysis(response, source="file" if image_inputs else "text")
    return response


@app.get("/api/v1/audits/{audit_id}")
async def get_audit(audit_id: str):
    """A saved analysis, exactly as /api/v1/analyze (or /api/v1/voice/analyze) returned it."""
    try:
        saved = await load_analysis(audit_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except StoreUnavailable as e:
        raise HTTPException(503, str(e))
    if saved is None:
        raise HTTPException(404, "No saved analysis with this ID.")
    return saved


@app.get("/api/v1/benchmarks/{cpt_code}")
async def get_benchmark(cpt_code: str):
    """Medicare's national rate for one billing code, so the app can compare a line the user typed or corrected.
    Free (no Gemini call). medicare_rate is null when the code has no rate or no price source answers."""
    code = normalize_code(cpt_code)
    if code is None:
        raise HTTPException(400, "Not a billing code: use the 5 letters or digits printed on the bill.")
    try:
        found, source, error = await lookup([code])
    except Exception:  # even the local CSV failed
        found, source, error = {}, "unavailable", "No price source answered."
    bench = found.get(code)
    return {
        "cpt_code": code,
        "medicare_rate": bench["rate"] if bench else None,
        "medicare_description": bench["description"] if bench else None,
        "setting": bench.get("setting") if bench else None,
        "source": source,
        # Never the raw Snowflake error: it can name the account.
        "error": "Snowflake was unavailable; the local copy was used." if error and source == "local_csv" else error,
    }


# Voice: recording -> speech-to-text -> the same steps as above -> spoken reply (services/audio_service)
from services.audio_service.voice_routes import router as voice_router  # noqa: E402

app.include_router(voice_router)

# Claim workflow: the Tiger Data lifecycle (record, status, deadlines, resolution, timeline)
from claim_routes import router as claim_router  # noqa: E402

app.include_router(claim_router)
