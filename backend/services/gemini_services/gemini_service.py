"""Step 1 of the pipeline: user input -> Gemini -> structured result.

Use analyze() from anywhere in the backend:

    result = await analyze(file_bytes=..., mime_type="image/jpeg", target_language="es-MX")
    result.spoken_summary   # <- hand this to ElevenLabs

target_language is a locale from backend/locales.py (a bare "es" means "es-MX"); anything else is a ValueError.
translate_for_speech() translates a few sentences for the reply voice (voice_routes adds the price findings with it).
"""
import asyncio
import functools
import json
import logging
import os
from pathlib import Path
from typing import Optional

from google import genai
from google.genai import errors, types
from pydantic import ValidationError

from locales import LOCALES, language_name, resolve_locale
from models import GeminiResult

logger = logging.getLogger("gemini_service")

# The languages users can choose (GET /api/v1/languages): locale -> name. The list itself is in backend/locales.py.
LANGUAGES = LOCALES

SUPPORTED_MIME = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"}

SYSTEM_PROMPT = """You are a patient advocate who helps people understand medical bills,
Explanation of Benefits (EOB) letters and insurance documents.

Rules:
- Only report what is actually in the document or the user's text. Never invent codes, amounts or dates. Use null when something is missing.
- When several page images are supplied, treat them as one document in order. Include a line item's 1-based source_page only when you can identify the image containing it; otherwise use null.
- Write every explanation for a 5th-grade reading level.
- Write plain_description, possible_issues, plain_summary, spoken_summary and questions_to_ask in {language}.
  Keep original_description exactly as printed. Keep every amount in the currency the document uses (U.S. dollars
  on U.S. bills), whatever the language: never convert it or name another currency.
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
    image_inputs: Optional[list[tuple[bytes, str]]] = None,
    text: Optional[str] = None,
    target_language: str = "en",
) -> GeminiResult:
    """Send a bill photo/PDF and/or typed text to Gemini and get a GeminiResult back."""
    inputs = image_inputs or ([(file_bytes, mime_type)] if file_bytes else [])
    if not inputs and not (text and text.strip()):
        raise ValueError("Send a file, some text, or both.")
    for _, input_mime in inputs:
        if input_mime not in SUPPORTED_MIME:
            raise ValueError(f"Unsupported file type {input_mime}. Use JPG, PNG, WEBP, HEIC or PDF.")
    target_language = resolve_locale(target_language)  # ValueError for an unsupported language

    if is_mock():
        return GeminiResult.model_validate_json(MOCK_PATH.read_text(encoding="utf-8"))

    language = language_name(target_language)  # e.g. "Spanish (Mexico)": the language and its regional variant
    parts: list = []
    for input_bytes, input_mime in inputs:
        parts.append(types.Part.from_bytes(data=input_bytes, mime_type=input_mime))
    instruction = "Analyze this document." if inputs else "Analyze the text below."
    if len(inputs) > 1:
        instruction = "Analyze these bill pages together as one document, in the order provided."
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
                if isinstance(response.parsed, GeminiResult):
                    return response.parsed
                return GeminiResult.model_validate(json.loads(response.text or ""))
            except (ValidationError, json.JSONDecodeError) as e:
                last_error = e  # output didn't fit the schema: ask again
    raise RuntimeError(f"Gemini is unavailable right now, try again shortly. Last error: {last_error}")


TRANSLATE_PROMPT = """Translate the text the user sends into {language}. A voice will read it aloud to a patient.
- Keep its meaning exactly. It compares charges on a medical bill with Medicare's national rates: a reason to ask
  questions, never proof that a charge is wrong.
- Write every number as words, the way it is said aloud in {language}. Keep names such as Medicare as they are.
- Text in “double quotes” names a charge and is already in {language}: write it as a natural name for the charge,
  without the quotes. Make each sentence read naturally.
- Answer with the translation alone, as plain text: no quotes, notes or Markdown."""
TRANSLATE_ATTEMPT_TIMEOUT_S = 10  # the small model answers a few sentences in about half a second (2026-10-10)
MAX_TRANSLATIONS = 500
_translations: dict[tuple[str, str], str] = {}  # (locale, text) -> translation, the oldest dropped first
_translating: dict[tuple[str, str], asyncio.Task] = {}
_QUOTES = {'"': '"', "\u201c": "\u201d", "\u00ab": "\u00bb", "\u300c": "\u300d", "'": "'"}


async def translate_for_speech(text: str, target_language: str) -> Optional[str]:
    """`text` (a few English sentences) in the locale's language, for the reply voice. None when Gemini cannot
    translate it now (MOCK mode, no key, quota, an outage, an unusable answer): the caller then leaves it out.

    A translation is remembered while the server runs, so a reply spoken twice has the same words, and the voice's
    cache plays the same clip again for free. Identical requests at the same time share one Gemini call.
    Raises ValueError for an unsupported language."""
    locale = resolve_locale(target_language)
    text = text.strip()
    if not text or is_mock():
        return None
    key = (locale, text)
    if key in _translations:
        return _translations[key]
    task = _translating.get(key)
    if task is None or task.get_loop() is not asyncio.get_running_loop():
        task = asyncio.ensure_future(_translate(text, locale))
        _translating[key] = task
        task.add_done_callback(functools.partial(_translation_done, key))
    return await asyncio.shield(task)  # a caller that stops waiting does not cancel it for the others


def _translation_done(key: tuple[str, str], task: asyncio.Task) -> None:
    if _translating.get(key) is task:
        del _translating[key]
    if task.cancelled() or task.exception() is not None or not task.result():
        return  # not remembered: the next request asks again
    _translations[key] = task.result()
    while len(_translations) > MAX_TRANSLATIONS:
        del _translations[next(iter(_translations))]


def _translation_models() -> list[str]:
    """The same models, in the same order, as analyze(). The small model alone answered in about half a second but
    garbled a Japanese word (2026-10-10); the reply is usually prepared before the user presses Listen, so quality
    comes first."""
    names = (model_name(), os.getenv("GEMINI_FALLBACK_MODEL", "").strip())
    return list(dict.fromkeys(name for name in names if name))


async def _translate(text: str, locale: str) -> Optional[str]:
    """One translation, with the same retries as analyze(). Never raises: None when no model gave a usable answer."""
    config = types.GenerateContentConfig(
        system_instruction=TRANSLATE_PROMPT.format(language=language_name(locale)),
        temperature=0.2,
    )
    try:
        client = _get_client()
        for model in _translation_models():
            for wait in (0, 2):
                if wait:
                    await asyncio.sleep(wait)
                try:
                    response = await asyncio.wait_for(
                        client.aio.models.generate_content(model=model, contents=text, config=config),
                        timeout=TRANSLATE_ATTEMPT_TIMEOUT_S,
                    )
                except asyncio.TimeoutError:
                    continue
                except errors.APIError as e:
                    if e.code in RETRYABLE_CODES:
                        continue
                    raise
                translated = _unquoted((response.text or "").strip())
                if translated and len(translated) <= 4 * len(text) + 200:  # not a translation plus notes
                    return translated
    except Exception as e:  # no key, a refused request, the network: the reply is said without these sentences
        logger.warning("Translation into %s failed: %s", locale, type(e).__name__)
        return None
    logger.warning("Translation into %s failed: no model gave a usable answer", locale)
    return None


def _unquoted(text: str) -> str:
    """The translation without the quotes Gemini sometimes puts around it."""
    if len(text) >= 2 and _QUOTES.get(text[0]) == text[-1]:
        return text[1:-1].strip()
    return text
