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
- Write every explanation for a 5th-grade reading level.
- Write plain_description, possible_issues, plain_summary, spoken_summary and questions_to_ask in {language}.
  Keep original_description exactly as printed.
- Flag things that are worth asking about (duplicate charges, vague "facility" or "miscellaneous" fees,
  charges without a code), but do NOT tell the patient they definitely don't owe money or give legal advice.
- If the input is not a medical or insurance document, set document_type to "other" and explain that briefly."""

RETRYABLE_CODES = {429, 500, 503}

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
    text: Optional[str] = None,
    target_language: str = "en",
) -> GeminiResult:
    """Send a bill photo/PDF and/or typed text to Gemini and get a GeminiResult back."""
    if not file_bytes and not (text and text.strip()):
        raise ValueError("Send a file, some text, or both.")
    if file_bytes and mime_type not in SUPPORTED_MIME:
        raise ValueError(f"Unsupported file type {mime_type}. Use JPG, PNG, WEBP, HEIC or PDF.")

    if is_mock():
        return GeminiResult.model_validate_json(MOCK_PATH.read_text(encoding="utf-8"))

    language = LANGUAGES.get(target_language, target_language)
    parts: list = []
    if file_bytes:
        parts.append(types.Part.from_bytes(data=file_bytes, mime_type=mime_type))
    instruction = "Analyze this document." if file_bytes else "Analyze the text below."
    if text and text.strip():
        instruction += f"\n\nUser's text or question:\n{text.strip()}"
    parts.append(instruction)

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT.format(language=language),
        response_mime_type="application/json",
        response_schema=GeminiResult,
        temperature=0.2,
    )

    client = _get_client()
    models = [model_name()]
    fallback = os.getenv("GEMINI_FALLBACK_MODEL", "").strip()
    if fallback and fallback not in models:
        models.append(fallback)

    last_error: Exception | None = None
    for model in models:
        # Busy/rate-limited errors (429, 500, 503) are usually temporary: wait a bit and retry,
        # then move on to the fallback model if one is set.
        for wait in (0, 2, 5):
            if wait:
                await asyncio.sleep(wait)
            try:
                response = await client.aio.models.generate_content(model=model, contents=parts, config=config)
            except errors.APIError as e:
                last_error = e
                if e.code in RETRYABLE_CODES:
                    continue
                raise
            try:
                if isinstance(response.parsed, GeminiResult):
                    return response.parsed
                return GeminiResult.model_validate(json.loads(response.text or ""))
            except (ValidationError, json.JSONDecodeError) as e:
                last_error = e  # output didn't fit the schema: ask again
    raise RuntimeError(f"Gemini is unavailable right now, try again shortly. Last error: {last_error}")
