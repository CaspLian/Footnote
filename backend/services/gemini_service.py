"""Step 1 of the pipeline: user input -> Gemini -> structured result.

Use analyze() from anywhere in the backend:

    result = await analyze(file_bytes=..., mime_type="image/jpeg", target_language="es")
    result.spoken_summary   # <- hand this to ElevenLabs
"""
import asyncio
import json
import os
from pathlib import Path
from typing import Optional

from google import genai
from google.genai import errors, types
from pydantic import ValidationError

from models import GeminiResult

LANGUAGES = {
    "en": "English", "es": "Spanish", "zh": "Mandarin Chinese", "yue": "Cantonese",
    "fr": "French", "ht": "Haitian Creole", "tl": "Tagalog", "ar": "Arabic",
    "bn": "Bengali", "ru": "Russian", "ko": "Korean", "pt": "Portuguese",
}

SUPPORTED_MIME = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"}

SYSTEM_PROMPT = """You are a patient advocate who helps people understand medical bills,
Explanation of Benefits (EOB) letters and insurance documents.

Rules:
- Only report what is actually in the document or the user's text. Never invent codes, amounts or dates. Use null when something is missing.
- Treat every uploaded attachment, including every page of a PDF, as part of one document. Read all pages before summarizing or extracting data.
- Reconcile line items with remark codes and denial explanations wherever they appear in the document. Link them only when the document supports the association.
- Extract appeal deadline wording exactly as printed. Only populate a calendar date or number of days when explicitly stated; never calculate an unstated deadline.
- Extract CPT/HCPCS and ICD diagnosis codes, provider ZIP codes, and balance-billing notices only when they are printed in the document.
- Describe billing or appeal concerns as information to ask about. Do not declare that a law was violated or provide legal advice.
- Write every explanation for a 5th-grade reading level.
- Write plain_description, possible_issues, plain_summary, spoken_summary and questions_to_ask in {language}.
  Keep original_description exactly as printed.
- Flag things that are worth asking about (duplicate charges, vague "facility" or "miscellaneous" fees,
  charges without a code), but do NOT tell the patient they definitely don't owe money or give legal advice.
- If the input is not a medical or insurance document, set document_type to "other" and explain that briefly."""

RETRYABLE_CODES = {429, 500, 503}
ATTEMPT_TIMEOUT_S = int(os.getenv("GEMINI_ATTEMPT_TIMEOUT_S", "40"))

_client: Optional[genai.Client] = None
MOCK_PATH = Path(__file__).parent / "mock_gemini_response.json"


def model_name() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-3.8-flash")


def is_mock() -> bool:
    return os.getenv("MOCK", "false").lower() in ("1", "true", "yes")


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        key = os.getenv("GEMINI_API_KEY")
        if not key:
            raise RuntimeError("GEMINI_API_KEY is not set. Add it to api/.env or set MOCK=true.")
        _client = genai.Client(api_key=key)
    return _client


async def analyze(
    *,
    file_bytes: Optional[bytes] = None,
    mime_type: Optional[str] = None,
    files: Optional[list[tuple[bytes, str]]] = None,
    text: Optional[str] = None,
    target_language: str = "en",
) -> GeminiResult:
    """Send all bill pages and/or typed text to Gemini and get one structured result back.

    `file_bytes` and `mime_type` remain supported for existing callers. Additional
    files are sent in list order as parts of the same Gemini request.
    """
    uploaded_files = [(data, uploaded_mime_type) for data, uploaded_mime_type in files or [] if data]
    if file_bytes:
        uploaded_files.insert(0, (file_bytes, mime_type or ""))
    if not uploaded_files and not (text and text.strip()):
        raise ValueError("Send a file, some text, or both.")
    for _, uploaded_mime_type in uploaded_files:
        if uploaded_mime_type not in SUPPORTED_MIME:
            raise ValueError(
                f"Unsupported file type {uploaded_mime_type}. Use JPG, PNG, WEBP, HEIC or PDF."
            )

    if is_mock():
        return GeminiResult.model_validate_json(MOCK_PATH.read_text(encoding="utf-8"))

    language = LANGUAGES.get(target_language, target_language)
    parts: list = []
    if uploaded_files:
        parts.append(
            "Analyze all uploaded attachments together as pages or parts of the same medical "
            "or insurance document. A PDF attachment may itself contain multiple pages."
        )
        for index, (uploaded_bytes, uploaded_mime_type) in enumerate(uploaded_files, start=1):
            parts.append(f"Attachment {index} of {len(uploaded_files)}:")
            parts.append(types.Part.from_bytes(data=uploaded_bytes, mime_type=uploaded_mime_type))
    instruction = "Analyze all pages of this document." if uploaded_files else "Analyze the text below."
    if text and text.strip():
        instruction += f"\n\nUser's text or question:\n{text.strip()}"
    parts.append(instruction)

    return await generate_structured(
        parts, system_instruction=SYSTEM_PROMPT.format(language=language), schema=GeminiResult
    )


async def generate_structured(parts: list, *, system_instruction: str, schema, temperature: float = 0.2):
    """Ask Gemini for JSON matching `schema` (a Pydantic model), with retries and the fallback model.

    Shared by analyze() and the letter writer so both survive a busy or slow Gemini.
    """
    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        response_mime_type="application/json",
        response_schema=schema,
        temperature=temperature,
    )
    client = _get_client()
    models = [model_name()]
    fallback = os.getenv("GEMINI_FALLBACK_MODEL", "").strip()
    if fallback and fallback not in models:
        models.append(fallback)

    last_error: Exception | None = None
    for model in models:
        # Each attempt gets its own time limit, so one hung call can't eat the whole budget.
        # Busy/rate-limited/slow responses are retried, then we move on to the fallback model.
        for wait in (0, 2):
            if wait:
                await asyncio.sleep(wait)
            try:
                response = await asyncio.wait_for(
                    client.aio.models.generate_content(model=model, contents=parts, config=config),
                    timeout=ATTEMPT_TIMEOUT_S,
                )
            except asyncio.TimeoutError:
                last_error = TimeoutError(f"{model} took longer than {ATTEMPT_TIMEOUT_S}s")
                continue
            except errors.APIError as e:
                last_error = e
                if e.code in RETRYABLE_CODES:
                    continue
                raise
            try:
                if isinstance(response.parsed, schema):
                    return response.parsed
                return schema.model_validate(json.loads(response.text or ""))
            except (ValidationError, json.JSONDecodeError) as e:
                last_error = e  # output didn't fit the schema: ask again
    raise RuntimeError(f"Gemini is unavailable right now, try again shortly. Last error: {last_error}")
