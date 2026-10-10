"""Shapes of the data going into and out of the Gemini step.

GeminiResult is also handed to Gemini as the response schema, so Gemini is
forced to answer in exactly this structure.
"""
from typing import Optional

from pydantic import BaseModel, Field


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


class GeminiResult(BaseModel):
    document_type: str = Field(description="One of: hospital_bill, eob, insurance_policy, pharmacy_receipt, other")
    provider_name: Optional[str] = Field(None, description="Hospital, clinic or insurer name if shown")
    provider_billing_address: Optional[str] = Field(None, description="Billing or mailing address of the provider/insurer if shown")
    account_number: Optional[str] = Field(None, description="Patient account, claim or statement number if shown")
    service_date: Optional[str] = Field(None, description="Main date of service YYYY-MM-DD if shown")
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


class PriceCheck(BaseModel):
    """One line item compared against Medicare's national rate (from Snowflake)."""
    line_index: int
    cpt_code: Optional[str]
    billed_amount: Optional[float]
    medicare_rate: Optional[float] = None
    medicare_description: Optional[str] = None
    times_medicare: Optional[float] = Field(None, description="billed_amount / medicare_rate, rounded to 1 decimal")
    medicare_covers: Optional[str] = Field(None, description="full_service, or physician_only when the hospital bills a separate facility fee")
    flag: str = Field(description="no_code | no_benchmark | no_amount | typical | above_typical | far_above_typical")
    note: str = Field(description="Short plain-English explanation of the comparison")


class PriceSummary(BaseModel):
    source: str = Field(description="snowflake | local_csv | unavailable")
    items_checked: int = 0
    items_flagged: int = 0
    billed_total_checked: float = 0.0
    medicare_total_checked: float = 0.0
    error: Optional[str] = None


class AnalyzeResponse(BaseModel):
    target_language: str
    model: str
    mock: bool
    result: GeminiResult
    price_checks: list[PriceCheck] = Field(default_factory=list)
    price_summary: Optional[PriceSummary] = None
    letter_suggested: bool = Field(False, description="True when there is something worth disputing; show the 'Draft a letter' button")
    letter_reasons: list[str] = Field(default_factory=list, description="Letter types that apply: itemized_request, billing_error, price_review, insurance_appeal")


# ---------- Dispute / request letter ----------

class LetterRequest(BaseModel):
    """Sent by the app when the user taps 'Draft a letter'. `analysis` is the /analyze response, sent back unchanged."""
    analysis: AnalyzeResponse
    patient_name: Optional[str] = None
    patient_address: Optional[str] = None
    patient_phone: Optional[str] = None
    patient_email: Optional[str] = None
    account_number: Optional[str] = Field(None, description="Overrides the account number Gemini found, if any")
    user_notes: Optional[str] = Field(None, description="Anything the patient wants included, e.g. 'I only had one EKG'")
    target_language: Optional[str] = Field(None, description="Language for the explanation and next steps; defaults to the analysis language")


class LetterDraft(BaseModel):
    """What Gemini writes. Also used as Gemini's response schema."""
    subject: str = Field(description="Letter subject line in English, including the account number if known")
    body: str = Field(description="Full letter in English, from greeting to signature. Use [BRACKETED PLACEHOLDERS] for anything unknown.")
    key_points: list[str] = Field(description="3-5 short English bullets summarizing what the letter asks for")
    explanation: str = Field(description="2-4 sentences in the target language explaining what the letter says and why")
    next_steps: list[str] = Field(description="3-5 short, practical next steps in the target language (how to send it, what to keep, when to follow up)")


class LetterResponse(BaseModel):
    letter_types: list[str]
    recipient: str
    subject: str
    body: str
    key_points: list[str]
    explanation: str
    next_steps: list[str]
    placeholders: list[str] = Field(default_factory=list, description="Bracketed fields the user still needs to fill in")
    disclaimer: str
    mock: bool = False
