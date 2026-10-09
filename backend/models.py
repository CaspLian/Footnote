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


class AnalyzeResponse(BaseModel):
    target_language: str
    model: str
    mock: bool
    result: GeminiResult
