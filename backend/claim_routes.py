"""Claim workflow routes: the Tiger Data claim lifecycle (services/tigerdata_services/tigerdata_service.py).

The app records a claim when the user confirms a bill, then reports what happens next: the review is complete, a
request was submitted, a notice date was set, the case was resolved. Each step is saved with a timeline event.

The service needs a billing code, a description and an amount on every recorded line, so the app sends only the
lines that have all three and passes the bill's real total separately. Nothing is invented. The routes are
synchronous (the service uses psycopg2), so FastAPI runs them in its thread pool.
"""
from datetime import date
from typing import Any, Literal, Optional

import psycopg2
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.tigerdata_services import tigerdata_service as tiger

router = APIRouter(prefix="/api/v1/claims", tags=["claims"])


class ClaimLine(BaseModel):
    code: str = Field(min_length=1, max_length=20)
    description: str = Field(min_length=1, max_length=500)
    amount: float = Field(ge=0)


class ClaimIn(BaseModel):
    items: list[ClaimLine] = Field(min_length=1, max_length=200)
    provider_name: Optional[str] = Field(None, max_length=300)
    service_date: Optional[date] = None
    total_billed: Optional[float] = Field(None, ge=0)
    # The saved analysis the claim came from (GET /api/v1/audits/{id}), stored as the claim's claim_id.
    analysis_audit_id: Optional[str] = Field(None, max_length=64)
    region: Optional[str] = Field(None, max_length=20)


class StatusIn(BaseModel):
    status: Literal["audit_complete", "dispute_in_progress"]
    details: Optional[dict[str, Any]] = None


class DeadlinesIn(BaseModel):
    collection_deadline: Optional[date] = None
    credit_warning_date: Optional[date] = None


class ResolveIn(BaseModel):
    final_amount: float = Field(ge=0)


def _call(function, *args):
    try:
        return function(*args)
    except LookupError as e:
        raise HTTPException(404, str(e)) from e
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    except (RuntimeError, psycopg2.Error) as e:  # not configured, unreachable, or failing: never echo the URL
        raise HTTPException(503, "Tiger Data is not available. Try again later.") from e


@router.post("")
def record_claim(body: ClaimIn):
    """Record a confirmed bill as a claim; its timeline starts here. Returns the claim, with its audit_id."""
    claim: dict[str, Any] = {
        "claim_id": body.analysis_audit_id,
        "provider": {"name": body.provider_name},
        "service_date": body.service_date.isoformat() if body.service_date else None,
        "items": [line.model_dump() for line in body.items],
    }
    if body.total_billed is not None:
        claim["total_billed"] = body.total_billed
    return _call(tiger.record_bill_audit, claim, body.region)


@router.get("/{claim_id}")
def get_claim(claim_id: str):
    """A claim with its lines, deadlines, countdowns and timeline."""
    found = _call(tiger.get_bill_audit, claim_id)
    if found is None:
        raise HTTPException(404, "No claim with this ID.")
    return found


@router.post("/{claim_id}/status")
def update_claim_status(claim_id: str, body: StatusIn):
    return _call(tiger.update_claim_status, claim_id, body.status, body.details)


@router.post("/{claim_id}/deadlines")
def set_claim_deadlines(claim_id: str, body: DeadlinesIn):
    return _call(tiger.set_claim_deadlines, claim_id, body.collection_deadline, body.credit_warning_date)


@router.post("/{claim_id}/resolve")
def resolve_claim(claim_id: str, body: ResolveIn):
    return _call(tiger.resolve_claim, claim_id, body.final_amount)
