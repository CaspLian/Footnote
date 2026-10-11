"""Build a bounded bill view omitting dedicated patient/account fields; keep amounts deterministic.

Free-text charge descriptions can still contain identifying text. This is not anonymization.
"""
from __future__ import annotations

import json
import math
import re
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

MAX_VARIABLES_BYTES = 12000
DOCTOR_ONLY_TEXT = ("Compared only with Medicare's fee for the doctor's part. The hospital's own part is not "
                    "included, so this cannot show whether the charge is high. Ask for an itemized bill.")
LABELS = {"far_above_typical": "far_above_usual", "above_typical": "above_usual", "typical": "usual",
          "no_code": "not_compared", "no_benchmark": "not_compared", "no_amount": "not_compared"}


def clean(value: object, limit: int = 600) -> str:
    text = re.sub(r"</?bill_details\s*>", "", str(value or ""), flags=re.I)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text).strip()
    if len(text.encode("utf-8")) > limit:
        text = text.encode("utf-8")[:limit - 3].decode("utf-8", errors="ignore").rstrip() + "…"
    return text


def number(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) and abs(result) <= 1e15 else None
    except (ValueError, TypeError):
        return None


def money(value: object) -> str:
    value = number(value)
    if value is None:
        return "not shown"
    return "$" + format(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), ",.2f")


def doctor_only(check: dict) -> bool:
    note = str(check.get("note") or "").lower().replace("’", "'")
    return ("covers only the doctor's fee" in note or "covers only the doctor's part" in note
            or check.get("flag") in ("doctor_fee_only", "doctor_part_only"))


def build_context(analysis: dict, language_name: str, analysis_language_name: str | None = None) -> tuple[dict, list[dict]]:
    result = analysis["result"]
    facts = [f"Document: {clean(result.get('document_type')) or 'not shown'}",
             f"Provider: {clean(result.get('provider_name'), 200) or 'not shown'}",
             f"Total billed: {money(result.get('total_billed'))}",
             f"Amount the patient is asked to pay: {money(result.get('amount_patient_owes'))}",
             f"Payment due date: {clean(result.get('due_date'), 100) or 'not shown'}"]
    if analysis.get("mock"):
        facts.append("This analysis is a sample made in test mode, not the person's own bill.")
    if analysis_language_name:
        facts.append(f"This analysis is written in {clean(analysis_language_name, 100)}; speak in the call's language.")
    checks = {c.get("line_index"): c for c in analysis.get("price_checks", [])}
    entries, lines = [], []
    for index, item in enumerate(result.get("line_items", [])):
        name = clean(item.get("plain_description") or item.get("original_description"), 180) or "Unnamed charge"
        check = checks.get(index, {})
        is_doctor = doctor_only(check)
        label = "doctor_part_only" if is_doctor else LABELS.get(check.get("flag"))
        # An unknown check cannot safely provide a quantitative comparison.
        rate = number(check.get("medicare_rate")) if label in ("usual", "above_usual", "far_above_usual") else None
        ratio = number(check.get("times_medicare")) if rate is not None and rate > 0 else None
        lines.append({"number": index + 1, "name": name, "billed_amount": number(item.get("billed_amount")),
                      "medicare_rate": rate, "times_medicare": ratio, "label": label, "in_context": False})
        entry = f"Line {index + 1}: {name}. Code {clean(item.get('cpt_code'), 30) or 'not shown'}. Billed {money(item.get('billed_amount'))}."
        if check:
            if is_doctor:
                entry += "\nPrice check: " + DOCTOR_ONLY_TEXT
            elif ratio is not None:
                entry += f"\nPrice check: Medicare national reference {money(rate)}; ratio {ratio:.1f}. This is a reference, not proof of an error or a fair hospital price."
            else:
                entry += "\nPrice check: No reliable comparison is available for this line."
        issues = [clean(x, 90) for x in item.get("possible_issues", [])][:2]
        if issues and not is_doctor:
            entry += "\nQuestions to check: " + "; ".join(issues)
        entries.append(clean(entry, 600))
    compared = sum(x["times_medicare"] is not None for x in lines)
    doctor_count = sum(x["label"] == "doctor_part_only" for x in lines)
    price_text = f"{compared} of {len(lines)} lines have a comparable Medicare national reference. A difference is a reason to ask questions, not proof of an error."
    if doctor_count:
        price_text += f" {doctor_count} lines have a doctor-only reference; it cannot show whether the hospital's charge is high."
    if (analysis.get("price_summary") or {}).get("source") == "unavailable" or not checks:
        price_text = "The price check was not available for this bill."
    variables = {"language_name": clean(language_name, 120), "today": date.today().isoformat(),
                 "bill_loaded": "yes", "bill_facts": clean("\n".join(facts), 1000), "bill_lines": "none",
                 "price_check": price_text, "bill_summary": clean(result.get("plain_summary"), 2400) or "not shown",
                 "questions_to_ask": clean("\n".join(f"{n + 1}. {clean(q, 300)}" for n, q in enumerate(result.get("questions_to_ask", [])[:8])), 1600) or "none"}
    selected = []
    # Leave room for JSON escaping, the SDK envelope and an omission notice.
    for index in sorted(range(len(lines)), key=lambda n: (lines[n]["label"] not in ("far_above_usual", "above_usual"), n)):
        trial = sorted(selected + [index])
        variables["bill_lines"] = "\n".join(entries[n] for n in trial)
        if len(json.dumps(variables, ensure_ascii=False).encode("utf-8")) > MAX_VARIABLES_BYTES - 350:
            continue
        selected = trial
        lines[index]["in_context"] = True
    variables["bill_lines"] = "\n".join(entries[n] for n in selected) or "No lines are available."
    missing = len(lines) - len(selected)
    if missing:
        variables["bill_lines"] += f"\n{missing} other lines are not included here because of the size limit. Do not guess about them."
    return variables, lines
