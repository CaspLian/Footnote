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
import re
import unicodedata
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
- Uploads can be different documents or pages of one document. Classify EACH uploaded file with its 1-based document_index. Never assume an EOB and a bill are pages of one statement.
- Give each line its document_index and source_page within that file (1 for a single photo). Do not sum a bill's charges with the same services shown on an EOB.
- Extract financials separately from the provider statement and EOB. Preserve different billed totals and insurer payments. Credits/payments/adjustments are positive magnitudes. Missing values remain null, not zero. Do not infer prior patient payment from an EOB's deductible or responsibility.
- A combined Copay/Coins column belongs in copay_coinsurance. Leave separate copayment and coinsurance null unless each is separately printed; do not guess how the combined amount splits.
- Prefer provider statement lines for line_items when a bill is present; use EOB lines when only an EOB is present. Explain differences in services, repeated bill lines or claim scope in document_mismatch_reason. Set documents_match true only with clear matching claim/services evidence; false for different scope; otherwise null.
- total_billed uses the provider statement when present, otherwise the EOB. amount_patient_owes uses the printed statement balance when present, otherwise EOB responsibility. Populate financials with every explicitly shown amount, including adjustments, patient payment, allowed amount and responsibility; never fill missing fields by guessing.
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
    for index, (input_bytes, input_mime) in enumerate(inputs, start=1):
        parts.append(f"Uploaded file {index} (document_index={index}):")
        parts.append(types.Part.from_bytes(data=input_bytes, mime_type=input_mime))
    instruction = "Analyze this document." if inputs else "Analyze the text below."
    if len(inputs) > 1:
        instruction = "Review all available evidence. Identify each uploaded file and keep bill and EOB finances separate. Some files may be consecutive pages; others may be separate documents or different claim scopes."
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
- Keep every number exactly as written, in digits (30, 4.5, 1,234,567). Keep names such as Medicare as they are.
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
                if not translated or len(translated) > 4 * len(text) + 200:  # nothing, or a translation plus notes
                    continue
                if not _same_numbers(text, translated):
                    # Seen live (2026-10-10): the small model turned "about 30 times" into 31 or 3 times in
                    # Traditional Chinese. A wrong number must never be spoken: ask again, else leave it out.
                    logger.warning("Translation into %s by %s changed a number; asking again", locale, model)
                    continue
                return translated
    except Exception as e:  # no key, a refused request, the network: the reply is said without these sentences
        logger.warning("Translation into %s failed: %s", locale, type(e).__name__)
        return None
    logger.warning("Translation into %s failed: no model gave a usable answer", locale)
    return None


_NUMBER = re.compile(r"\d+(?:[.,]\d+)*")


def _numbers(text: str) -> list[str]:
    """The numbers in a text, written one way: digits of any script as 0-9 ("٣٠" -> "30"), thousands separators
    removed ("1,234,567" and "1.234.567" -> "1234567"), a decimal comma as a point ("4,5" -> "4.5"). A single
    separator followed by exactly three digits is a thousands separator: the price findings' ratios have at most one
    decimal (voice_routes._times)."""
    digits = "".join(str(unicodedata.digit(ch)) if ch.isdigit() else ch for ch in text)
    # Arabic's own separators, and the no-break spaces French and others put between thousands ("1 234 567").
    digits = digits.replace("٫", ".").replace("٬", ",")
    digits = re.sub(r"(?<=\d)[  ](?=\d{3})", ",", digits)
    found = []
    for raw in _NUMBER.findall(digits):
        parts = re.split(r"[.,]", raw)
        decimal = parts.pop() if len(parts) > 1 and len(parts[-1]) != 3 else ""
        whole = "".join(parts).lstrip("0") or "0"
        found.append(f"{whole}.{decimal}" if decimal else whole)
    return sorted(found)


def _same_numbers(source: str, translation: str) -> bool:
    """Whether a translation has exactly the numbers of its source, however each language writes them."""
    return _numbers(source) == _numbers(translation)


def _unquoted(text: str) -> str:
    """The translation without the quotes Gemini sometimes puts around it."""
    if len(text) >= 2 and _QUOTES.get(text[0]) == text[-1]:
        return text[1:-1].strip()
    return text
