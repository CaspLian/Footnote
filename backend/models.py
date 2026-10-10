"""Shapes of the data going into and out of the Gemini step.

GeminiResult is also handed to Gemini as the response schema, so Gemini is
forced to answer in exactly this structure.
"""
from typing import Optional

from pydantic import BaseModel, Field, field_validator

# Texts Gemini sometimes writes instead of a JSON null (seen live on 2026-10-10: "null" as the code of a line
# without one). Left as text, the app would show "null" as a code and the price check would look it up.
_MISSING_TEXTS = {"", "null", "none", "n/a"}


def _missing_to_none(value):
    if isinstance(value, str) and value.strip().lower() in _MISSING_TEXTS:
        return None
    return value


class LineItem(BaseModel):
    cpt_code: Optional[str] = Field(None, description="5-character CPT/HCPCS code if printed on the bill, else null")
    original_description: str = Field(description="Line item text exactly as printed on the bill")
    plain_description: str = Field(description="What this charge is, in simple words, in the target language")
    billed_amount: Optional[float] = Field(None, description="Amount charged for this line, as a number, else null")
    date_of_service: Optional[str] = Field(None, description="YYYY-MM-DD if shown, else null")
    possible_issues: list[str] = Field(
        default_factory=list,
        description="Short notes in the target language on anything that looks off: duplicate, vague fee, unclear charge. Empty if nothing.",
    )

    @field_validator("cpt_code", "date_of_service", mode="before")
    @classmethod
    def _missing_is_null(cls, value):
        return _missing_to_none(value)


class GeminiResult(BaseModel):
    document_type: str = Field(description="One of: hospital_bill, eob, insurance_policy, pharmacy_receipt, other")
    provider_name: Optional[str] = Field(None, description="Hospital, clinic or insurer name if shown")
    total_billed: Optional[float] = Field(None, description="Total amount billed, if shown")
    amount_patient_owes: Optional[float] = Field(None, description="Amount the patient is asked to pay, if shown")
    due_date: Optional[str] = Field(None, description="Payment due date YYYY-MM-DD, if shown")
    line_items: list[LineItem] = Field(default_factory=list)
    plain_summary: str = Field(description="3-6 sentence explanation of the document in the target language, written for a 5th-grade reading level")
    spoken_summary: str = Field(
        description="Same idea as plain_summary but written to be READ ALOUD in the target language: under 90 words, no bullet points, "
        "no symbols or codes, amounts written the way a person would say them"
    )
    questions_to_ask: list[str] = Field(
        default_factory=list,
        description="2-4 questions the patient could ask the billing office or insurer, in the target language",
    )

    @field_validator("provider_name", "due_date", mode="before")
    @classmethod
    def _missing_is_null(cls, value):
        return _missing_to_none(value)


class PriceCheck(BaseModel):
    """One line item compared against Medicare's national rate (from Snowflake)."""
    line_index: int
    cpt_code: Optional[str]
    billed_amount: Optional[float]
    medicare_rate: Optional[float] = None
    medicare_description: Optional[str] = None
    times_medicare: Optional[float] = Field(None, description="billed_amount / medicare_rate, rounded to 1 decimal")
    flag: str = Field(description="no_code | no_benchmark | no_amount | typical | above_typical | far_above_typical")
    note: str = Field(description="Short plain-English explanation of the comparison")


class PriceSummary(BaseModel):
    source: str = Field(description="snowflake | local_csv | unavailable")
    items_checked: int = 0
    items_flagged: int = 0
    billed_total_checked: float = 0.0
    medicare_total_checked: float = 0.0
    error: Optional[str] = None


class AuditInfo(BaseModel):
    """Whether this analysis was saved to Tiger Data, and the ID to load or speak it again."""
    saved: bool
    audit_id: Optional[str] = Field(None, description="GET /api/v1/audits/{audit_id}; POST /api/v1/voice/speak")
    error: Optional[str] = Field(None, description="Why it was not saved (the analysis itself is still valid)")


class AnalyzeResponse(BaseModel):
    target_language: str
    model: str
    mock: bool
    result: GeminiResult
    price_checks: list[PriceCheck] = Field(default_factory=list)
    price_summary: Optional[PriceSummary] = None
    audit: Optional[AuditInfo] = None
