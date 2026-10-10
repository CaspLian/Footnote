"""Draft a dispute / request letter from an /analyze result.

    reasons = suggest_letter(analysis)          # [] means "don't offer a letter"
    letter  = await draft_letter(request)       # LetterResponse

Privacy: the patient's name, address, phone and email are never sent to Gemini. Gemini writes
[PLACEHOLDERS] and they are filled in here, on our server.
"""
import json
import re
from datetime import date, datetime
from pathlib import Path

from models import AnalyzeResponse, LetterDraft, LetterRequest, LetterResponse
from services.gemini_service import LANGUAGES, generate_structured, is_mock

MOCK_PATH = Path(__file__).parent / "mock_letter_response.json"
DISCLAIMER = (
    "This letter is a template to help you communicate with your provider or insurer. "
    "It is not legal advice. Check every detail against your own records before sending."
)

LETTER_TYPE_INSTRUCTIONS = {
    "itemized_request": "Request a fully itemized bill listing every charge with its CPT/HCPCS or revenue code, "
                        "date, quantity and price, specifically naming the vague or uncoded charges.",
    "billing_error": "Point out the specific charges that appear to be duplicates or errors (cite description, date "
                     "and amount) and ask for them to be reviewed and corrected.",
    "price_review": "Ask for a review of the specific charges that are far above typical prices. For each, state the "
                    "billed amount and, for comparison, Medicare's national rate. Ask for a reduction or discount, "
                    "ask whether the patient qualifies for the hospital's financial assistance / charity care program, "
                    "and ask about an interest-free payment plan.",
    "insurance_appeal": "Address the insurer. Identify the denied or unpaid services by description, code and amount, "
                        "and request a review/appeal of those decisions and a written explanation. Ask what "
                        "documentation is needed.",
}

SYSTEM_PROMPT = """You write clear, polite, professional letters for patients disputing or asking questions about
medical bills and insurance decisions. You will receive the facts as JSON.

Rules:
- Use ONLY the facts provided. Never invent charges, codes, amounts, dates, names or policies.
- Write the letter in English. Keep it under 400 words, in short paragraphs, from "Dear ..." to the signature.
- Tone: calm, factual and cooperative. No threats, no mentions of lawsuits or lawyers, and never claim the
  patient legally does not owe the money.
- When citing Medicare rates, present them only as a reference point ("for comparison, Medicare's national rate
  for this service is $X"), never as the price the patient is entitled to. When a line item's
  medicare_rate_covers says "physician/professional fee only", say so explicitly (e.g. "Medicare's national rate
  for the physician portion of this service is $X; I understand the hospital facility fee is billed separately").
- Write dates in words, like "September 14, 2026".
- Ask the provider to place the account on hold (no collections referral, no late fees) while the review is pending.
- Ask for a written response.
- Use these exact placeholders instead of real personal details, which will be filled in later:
  [DATE], [PATIENT NAME], [PATIENT ADDRESS], [PATIENT PHONE], [PATIENT EMAIL], [ACCOUNT NUMBER].
  Use [ACCOUNT NUMBER] wherever the account number belongs.
- If any other needed fact is missing, use a short [BRACKETED PLACEHOLDER] instead of guessing.
- Write `explanation` and `next_steps` in {language}, at a 5th-grade reading level. Next steps should be practical:
  e.g. send by certified mail or the billing portal, keep a copy, note who you spoke with, follow up in 30 days.
  If blanks remain, refer to them generally ("fill in any blank spaces in brackets"), without listing specific fields.

This letter must cover:
{type_instructions}"""


def _pretty_date(d):
    """2026-09-14 -> September 14, 2026 (leaves anything else unchanged)."""
    try:
        return datetime.strptime(d, "%Y-%m-%d").strftime("%B %d, %Y").replace(" 0", " ")
    except (TypeError, ValueError):
        return d


def _norm(code):
    return re.sub(r"[^A-Za-z0-9]", "", code).upper()[:5] if code else None


def _duplicates(analysis: AnalyzeResponse) -> list[dict]:
    seen, dups = {}, []
    for i, li in enumerate(analysis.result.line_items):
        key = (_norm(li.cpt_code), li.date_of_service, li.billed_amount)
        if key[0] and key[2]:
            if key in seen:
                dups.append({"line_indexes": [seen[key], i], "cpt_code": key[0],
                             "description": li.original_description, "date": _pretty_date(key[1]), "amount": key[2]})
            else:
                seen[key] = i
    return dups


def suggest_letter(analysis: AnalyzeResponse) -> list[str]:
    """Which letter types apply. Empty list = nothing worth disputing, so don't show the button."""
    flags = {pc.flag for pc in analysis.price_checks}
    if analysis.result.document_type == "eob":
        has_issue = any(li.possible_issues for li in analysis.result.line_items)
        return ["insurance_appeal"] if has_issue else []
    if analysis.result.document_type == "other":
        return []
    reasons = []
    if "no_code" in flags:
        reasons.append("itemized_request")
    if _duplicates(analysis):
        reasons.append("billing_error")
    if flags & {"above_typical", "far_above_typical"}:
        reasons.append("price_review")
    return reasons


def _facts(req: LetterRequest, types_: list[str]) -> dict:
    a, r = req.analysis, req.analysis.result
    checks = {pc.line_index: pc for pc in a.price_checks}
    lines = []
    for i, li in enumerate(r.line_items):
        pc = checks.get(i)
        lines.append({
            "line": i, "code": li.cpt_code, "description": li.original_description,
            "date": _pretty_date(li.date_of_service), "billed": li.billed_amount, "issues_noted": li.possible_issues,
            "medicare_national_rate": pc.medicare_rate if pc else None,
            "medicare_rate_covers": ("physician/professional fee only; the hospital facility fee is paid separately"
                                     if pc and pc.medicare_covers == "physician_only" else
                                     "the full service" if pc and pc.medicare_rate else None),
            "times_medicare": pc.times_medicare if pc else None,
            "price_flag": pc.flag if pc else None,
        })
    return {
        "document_type": r.document_type,
        "letter_types": types_,
        "recipient_organization": r.provider_name,
        "recipient_address": r.provider_billing_address,
        "service_date": _pretty_date(r.service_date),
        "total_billed": r.total_billed,
        "amount_patient_owes": r.amount_patient_owes,
        "due_date": _pretty_date(r.due_date),
        "line_items": lines,
        "duplicate_charges": _duplicates(a),
        "patient_notes": (req.user_notes or "").strip() or None,
        "medicare_source": "CMS 2026 Medicare Physician Fee Schedule, national rates" if a.price_checks else None,
    }


def _fill(text: str, req: LetterRequest) -> str:
    account = req.account_number or req.analysis.result.account_number
    values = {
        "[DATE]": date.today().strftime("%B %d, %Y").replace(" 0", " "),
        "[PATIENT NAME]": req.patient_name,
        "[PATIENT ADDRESS]": req.patient_address,
        "[PATIENT PHONE]": req.patient_phone,
        "[PATIENT EMAIL]": req.patient_email,
        "[ACCOUNT NUMBER]": account,
    }
    for ph, val in values.items():
        if val and val.strip():
            text = text.replace(ph, val.strip())
    return text


def _recipient(analysis: AnalyzeResponse) -> str:
    r = analysis.result
    org = r.provider_name or "[PROVIDER NAME]"
    dept = "Appeals Department" if r.document_type == "eob" else "Patient Billing Department"
    return f"{org}, {dept}" + (f", {r.provider_billing_address}" if r.provider_billing_address else "")


async def draft_letter(req: LetterRequest) -> LetterResponse:
    types_ = suggest_letter(req.analysis)
    if not types_:
        # The user asked anyway (e.g. they want an itemized bill): default to the safest letter.
        types_ = ["insurance_appeal"] if req.analysis.result.document_type == "eob" else ["itemized_request"]

    lang_code = req.target_language or req.analysis.target_language or "en"
    language = LANGUAGES.get(lang_code, lang_code)

    if is_mock():
        draft = LetterDraft.model_validate_json(MOCK_PATH.read_text(encoding="utf-8"))
    else:
        system = SYSTEM_PROMPT.format(
            language=language,
            type_instructions="\n".join(f"- {LETTER_TYPE_INSTRUCTIONS[t]}" for t in types_),
        )
        prompt = "Write the letter using these facts:\n" + json.dumps(_facts(req, types_), indent=2, default=str)
        draft = await generate_structured([prompt], system_instruction=system, schema=LetterDraft, temperature=0.3)

    subject, body = _fill(draft.subject, req), _fill(draft.body, req)
    placeholders = sorted(set(re.findall(r"\[[A-Z][A-Z0-9 /&'_-]{1,40}\]", subject + "\n" + body)))
    return LetterResponse(
        letter_types=types_,
        recipient=_recipient(req.analysis),
        subject=subject,
        body=body,
        key_points=draft.key_points,
        explanation=draft.explanation,
        next_steps=draft.next_steps,
        placeholders=placeholders,
        disclaimer=DISCLAIMER,
        mock=is_mock(),
    )
