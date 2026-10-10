"""Claim workflow routes: the Tiger Data claim lifecycle (services/tigerdata_services/tigerdata_service.py).

The app records a claim when the user confirms a bill, then reports what happens next: the review is complete, a
request was submitted, a notice date was set, the case was resolved. Each step is saved with a timeline event.

The service needs a billing code, a description and an amount on every recorded line, so the app sends only the
lines that have all three and passes the bill's real total separately. Nothing is invented. Deadlines are estimated
from the bill's own dates (services/tigerdata_services/timeline.py): a credit-report warning 180 days after the
service, a collection date 120 days after the bill was received. They are estimates, not legal determinations, and a
correction from the user replaces them. The routes are synchronous (the service uses psycopg2), so FastAPI runs them
in its thread pool; the bill-photo route runs its blocking work in a thread.
"""
import asyncio
from datetime import date
from typing import Any, Literal, Optional

import psycopg2
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from services.gemini_services import bill_image
from services.tigerdata_services import tigerdata_service as tiger

router = APIRouter(tags=["claims"])
IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 15 * 1024 * 1024
# Placeholder codes that mean "none": never recorded as if they were real billing codes.
NO_CODE = {"", "UNKNOWN", "NULL", "NONE", "N/A"}


class ClaimLine(BaseModel):
    code: str = Field(min_length=1, max_length=20)
    description: str = Field(min_length=1, max_length=500)
    amount: float = Field(ge=0)


class ClaimIn(BaseModel):
    items: list[ClaimLine] = Field(min_length=1, max_length=200)
    provider_name: Optional[str] = Field(None, max_length=300)
    service_date: Optional[date] = None
    total_billed: Optional[float] = Field(None, ge=0)
    # The bill's own dates; the deadlines are estimated from them (none is invented when a date is missing).
    bill_received_date: Optional[date] = None
    payment_due_date: Optional[date] = None
    # The saved analysis the claim came from (GET /api/v1/audits/{id}), stored as the claim's claim_id.
    analysis_audit_id: Optional[str] = Field(None, max_length=64)
    region: Optional[str] = Field(None, max_length=20)


class StatusIn(BaseModel):
    status: Literal["audit_complete", "dispute_in_progress"]
    note: Optional[str] = Field(None, max_length=1000)
    details: Optional[dict[str, Any]] = None


class DeadlinesIn(BaseModel):
    collection_deadline: Optional[date] = None
    credit_warning_date: Optional[date] = None


class ResolveIn(BaseModel):
    final_amount: float = Field(ge=0)


class ActionIn(BaseModel):
    action: str = Field(min_length=1, max_length=200)
    note: Optional[str] = Field(None, max_length=1000)


def _call(function, *args):
    try:
        return function(*args)
    except LookupError as e:
        raise HTTPException(404, str(e)) from e
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    except (RuntimeError, psycopg2.Error) as e:  # not configured, unreachable, or failing: never echo the URL
        raise HTTPException(503, "Tiger Data is not available. Try again later.") from e


@router.post("/api/v1/claims")
def record_claim(body: ClaimIn):
    """Record a confirmed bill as a claim; its timeline starts here. Returns the claim, with its audit_id."""
    claim: dict[str, Any] = {
        "claim_id": body.analysis_audit_id,
        "provider": {"name": body.provider_name},
        "service_date": body.service_date.isoformat() if body.service_date else None,
        "bill_received_date": body.bill_received_date.isoformat() if body.bill_received_date else None,
        "payment_due_date": body.payment_due_date.isoformat() if body.payment_due_date else None,
        "items": [line.model_dump() for line in body.items],
    }
    if body.total_billed is not None:
        claim["total_billed"] = body.total_billed
    return _call(tiger.record_bill_audit, claim, body.region)


@router.get("/api/v1/claims/{claim_id}")
def get_claim(claim_id: str):
    """A claim with its lines, deadlines (and whether each is an estimate), countdowns and timeline."""
    found = _call(tiger.get_bill_audit, claim_id)
    if found is None:
        raise HTTPException(404, "No claim with this ID.")
    return found


# POST, or PATCH as in the Tiger Data notes (backend/API_INTEGRATION.md).
@router.api_route("/api/v1/claims/{claim_id}/status", methods=["POST", "PATCH"])
def update_claim_status(claim_id: str, body: StatusIn):
    details = {**(body.details or {}), **({"note": body.note} if body.note else {})}
    return _call(tiger.update_claim_status, claim_id, body.status, details)


@router.api_route("/api/v1/claims/{claim_id}/deadlines", methods=["POST", "PATCH"])
def set_claim_deadlines(claim_id: str, body: DeadlinesIn):
    """The user's own dates, for example from a notice. They replace the estimates."""
    return _call(tiger.set_claim_deadlines, claim_id, body.collection_deadline, body.credit_warning_date)


@router.post("/api/v1/claims/{claim_id}/resolve")
def resolve_claim(claim_id: str, body: ResolveIn):
    return _call(tiger.resolve_claim, claim_id, body.final_amount)


@router.post("/api/v1/claims/{claim_id}/actions", status_code=201)
def add_claim_action(claim_id: str, body: ActionIn):
    """Something the user did, for example "Called provider", added to the claim's timeline."""
    return _call(tiger.record_claim_action, claim_id, body.action, {"note": body.note} if body.note else {})


@router.post("/api/v1/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    """One bill photo -> Gemini reads its dates and lines -> a claim with estimated deadlines (the Tiger Data flow).

    The app's full analysis (every page, the price check, the saved record and the voice) is POST /api/v1/analyze;
    this route does not replace it. Only complete lines are recorded (a code, a description and an amount); the
    response's extracted_bill keeps every line Gemini read.
    """
    if file.content_type not in IMAGE_TYPES:
        raise HTTPException(415, "Upload a JPEG, PNG, or WebP bill image.")
    image = await file.read(MAX_IMAGE_BYTES + 1)
    if not image or len(image) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image must be non-empty and at most 15 MB.")

    def work():
        extracted = bill_image.analyze_bill_image(image, file.content_type)
        recordable = [item for item in extracted["items"]
                      if str(item.get("code") or "").strip().upper() not in NO_CODE
                      and str(item.get("description") or "").strip() and item.get("amount") is not None]
        if not recordable:
            raise ValueError("No line on this bill has a billing code, so there is nothing to record as a claim.")
        created = tiger.record_bill_audit({**extracted, "items": recordable})
        return extracted, tiger.get_bill_audit(created["audit_id"])

    try:
        extracted, audit = await asyncio.to_thread(work)  # Gemini and the database block: keep the server responsive
    except RuntimeError as e:  # not configured: the message names the setting, never its value
        raise HTTPException(503, str(e)) from e
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    except Exception as e:  # provider or database details are not shown to clients
        raise HTTPException(503, "Bill analysis or Tiger Data persistence failed.") from e
    if audit is None:
        raise HTTPException(500, "Tiger Data saved the claim but it could not be read back.")
    return {"extracted_bill": extracted, "audit": audit}
