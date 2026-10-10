"""Gemini extraction for photographed medical bills.

The prompt asks for bill fields only. Dates not visible on the document must be null;
the API never invents a date based on upload time.
"""
import json
import os
from datetime import date
from typing import Any

from dotenv import load_dotenv


def validate_extracted_bill(payload: dict[str, Any]) -> dict[str, Any]:
    """Normalize and validate Gemini JSON before it is persisted."""
    normalized = dict(payload)
    for field in ("service_date", "bill_received_date", "payment_due_date"):
        value = normalized.get(field)
        if value in (None, "", "null", "unknown"):
            normalized[field] = None
            continue
        try:
            normalized[field] = date.fromisoformat(str(value)).isoformat()
        except ValueError as exc:
            raise ValueError(f"Gemini returned invalid {field}; expected YYYY-MM-DD.") from exc
    items = normalized.get("items")
    if not isinstance(items, list) or not items:
        raise ValueError("Gemini did not find any bill line items.")
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise ValueError(f"Gemini line item {index} is not an object.")
        item.setdefault("code", "UNKNOWN")
        if not item.get("description") or item.get("amount") is None:
            raise ValueError(f"Gemini line item {index} is missing description or amount.")
    if normalized.get("total_billed") is None:
        normalized["total_billed"] = sum(float(item["amount"]) for item in items)
    normalized.setdefault("provider", {})
    normalized.setdefault("currency", "USD")
    return normalized


def analyze_bill_image(image: bytes, mime_type: str = "image/jpeg") -> dict[str, Any]:
    """Call Gemini and return validated extracted bill data."""
    load_dotenv()
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key.startswith("your_"):
        raise RuntimeError("GEMINI_API_KEY is not configured on the backend.")
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    prompt = """Read this photographed medical bill. Return only JSON with this shape:
    {"claim_id":null,"provider":{"name":null,"npi":null},
    "service_date":null,"bill_received_date":null,"payment_due_date":null,
    "total_billed":null,"currency":"USD","items":[{"description":"...",
    "code":"...","amount":0.00}]}. Dates must be ISO YYYY-MM-DD only when
    printed clearly; otherwise null. bill_received_date means date bill was issued/
    received as printed, not the date of this photo. payment_due_date is optional.
    Do not infer dates, codes, or amounts. Use numeric amounts and preserve each
    visible line item. If unreadable or not a medical bill, return {"items":[]}.
    """
    response = client.models.generate_content(
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        contents=[prompt, types.Part.from_bytes(data=image, mime_type=mime_type)],
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )
    try:
        result = json.loads(response.text or "")
    except (json.JSONDecodeError, TypeError) as exc:
        raise ValueError("Gemini returned invalid JSON for this bill image.") from exc
    if not isinstance(result, dict):
        raise ValueError("Gemini response must be a JSON object.")
    return validate_extracted_bill(result)
