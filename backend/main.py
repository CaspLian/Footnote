from datetime import date

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.gemini_service import analyze_bill_image
from services.tigerdata_service import (
    create_manual_case,
    get_bill_audit,
    record_claim_action,
    record_bill_audit,
    set_claim_deadlines,
    update_claim_status,
)

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
    return {"message": "ClaimPulse AI API is running"}


@app.post("/api/v1/analyze")
@app.post("/api/v1/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    """Analyze a captured bill image, then persist extracted fields and timeline."""
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(415, "Upload a JPEG, PNG, or WebP bill image.")
    image = await file.read()
    if not image or len(image) > 15 * 1024 * 1024:
        raise HTTPException(413, "Image must be non-empty and at most 15 MB.")
    try:
        extracted = analyze_bill_image(image, file.content_type)
        created = record_bill_audit(extracted)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        # Database/Gemini provider details should not be exposed to API clients.
        raise HTTPException(503, "Bill analysis or Tiger Data persistence failed.") from exc
    audit = get_bill_audit(created["audit_id"])
    if audit is None:
        raise HTTPException(500, "Tiger Data saved the audit but it could not be read back.")
    return {"extracted_bill": extracted, "audit": audit}


@app.get("/api/v1/audits/{audit_id}")
def fetch_audit(audit_id: str):
    """Frontend integration point: return the persisted audit and timeline."""
    try:
        result = get_bill_audit(audit_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if result is None:
        raise HTTPException(404, "Audit not found.")
    return result


class StatusUpdate(BaseModel):
    status: str
    note: str | None = Field(default=None, max_length=1000)


class DeadlineUpdate(BaseModel):
    collection_deadline: date | None = None
    credit_warning_date: date | None = None
    payment_due_date: date | None = None


class ManualCaseCreate(BaseModel):
    provider_name: str = Field(min_length=1, max_length=200)
    service_date: date
    bill_received_date: date
    payment_due_date: date | None = None


class ActionCreate(BaseModel):
    action: str = Field(min_length=1, max_length=200)
    note: str | None = Field(default=None, max_length=1000)


@app.post("/api/v1/audits/manual", status_code=201)
def create_manual_audit(case: ManualCaseCreate):
    """Create a backend-persisted tracking case without bill line items."""
    try:
        created = create_manual_case(
            case.provider_name,
            case.service_date,
            case.bill_received_date,
            case.payment_due_date,
        )
        audit = get_bill_audit(created["audit_id"])
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(503, "Manual case could not be saved to Tiger Data.") from exc
    if audit is None:
        raise HTTPException(500, "Tiger Data saved the case but it could not be read back.")
    return audit


@app.patch("/api/v1/audits/{audit_id}/status")
def patch_audit_status(audit_id: str, update: StatusUpdate):
    """Change case status and append a timeline event."""
    try:
        return update_claim_status(audit_id, update.status, {"note": update.note} if update.note else {})
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@app.patch("/api/v1/audits/{audit_id}/deadlines")
def patch_audit_deadlines(audit_id: str, update: DeadlineUpdate):
    """Allow the user to correct estimates after checking their bill/notice."""
    try:
        return set_claim_deadlines(
            audit_id,
            update.collection_deadline,
            update.credit_warning_date,
            update.payment_due_date,
            clear_payment_due_date=(
                "payment_due_date" in update.model_fields_set
                and update.payment_due_date is None
            ),
        )
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@app.post("/api/v1/audits/{audit_id}/actions", status_code=201)
def add_audit_action(audit_id: str, action: ActionCreate):
    """Record a patient action in the case timeline."""
    try:
        return record_claim_action(
            audit_id,
            action.action,
            {"note": action.note} if action.note else {},
        )
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
