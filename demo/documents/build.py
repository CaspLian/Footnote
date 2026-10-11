#!/usr/bin/env python3
"""Build the Footnote demo documents: a hospital itemized statement and the matching insurer EOB.

    python demo/documents/build.py                      # PDFs, PNGs, phone photos, ground truth, checks
    python demo/documents/build.py --skip-images        # PDFs + ground truth only (no imaging environment needed)

Pipeline
  1. src/scenario.json (the only place amounts live) -> EOB adjudication and statement totals, in Decimal.
  2. src/itemized-bill.html and src/eob.html are templates; every {{token}} is filled here -> out/html/.
  3. Headless Chrome prints them to vector US Letter PDFs -> out/itemized-bill.pdf, out/eob.pdf, then measures
     every line of text on each page (LAYOUT_PROBE) and stops the build if any text is clipped, overlaps other
     text, runs into the footer or sits closer than 0.3 in to the paper edge.
  4. ground-truth.json records every printed value, the expected findings and the CSV price references.
  5. With an imaging Python (Pillow, numpy, pypdfium2; kept outside the repo): 300 dpi PNG per page
     (out/png/) and one synthetic phone photo per page (out/photos/), then tools/verify.py re-checks all sums
     and that every ground-truth value is present in the PDF text.

This script uses only the Python standard library. Everything it writes stays under demo/documents/.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import html
import json
import os
import random
import re
import shutil
import subprocess
import sys
import tempfile
import time
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent            # demo/documents
SRC = ROOT / "src"
OUT = ROOT / "out"
TOOLS = ROOT / "tools"
REPO = ROOT.parents[1]                            # claimpulse-ai
CSV_PATH = REPO / "backend" / "data" / "cpt_benchmarks.csv"

DEFAULT_CHROME = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
]
# The imaging environment used on the machine where these files were first built. Override with
# --imaging-python or FOOTNOTE_DOCS_IMAGING_PYTHON (see README.md for how to create one).
DEFAULT_IMAGING_PYTHON = (r"C:\Users\nnime\AppData\Local\Temp\claude\c--Users-nnime-Downloads-Nimesh"
                          r"\947ac23f-3674-4590-9699-d1ebf5e4596a\scratchpad\demo_docs_venv\Scripts\python.exe")

PAGE_COUNT = {"itemized-bill": 3, "eob": 3}
CODE_ORDER = ["CO-45", "PR-1", "PR-2", "PR-3", "OA-18", "CO-97"]
CENT = Decimal("0.01")


# --------------------------------------------------------------------------------------------- formatting
def D(value) -> Decimal:
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


def m(value: Decimal) -> str:
    """1234.5 -> '1,234.50' (no sign handling: callers print credits with a leading '-')."""
    return f"{D(value):,.2f}"


def md(value: Decimal) -> str:
    return "$" + m(value)


def us_date(iso: str) -> str:
    return dt.date.fromisoformat(iso).strftime("%m/%d/%Y")


def long_date(iso: str) -> str:
    d = dt.date.fromisoformat(iso)
    return f"{d.strftime('%B')} {d.day}, {d.year}"


def esc(text: str) -> str:
    return html.escape(str(text), quote=False)


def luhn_digit(digits: str) -> str:
    total = 0
    for i, ch in enumerate(reversed(digits)):
        n = int(ch)
        if i % 2 == 0:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return str((10 - total % 10) % 10)


# --------------------------------------------------------------------------------------------- the money
def adjudicate(s: dict) -> dict:
    """Process the claim the way the fictional plan does, line by line in claim order.

    Denied lines (duplicate OA-18, bundled CO-97) allow nothing. Covered lines: plan discount (CO-45) =
    charge - allowed. The ER facility line takes the $250 copay (PR-3) and the plan pays the rest. Every other
    covered line goes to the deductible (PR-1) until it is met, then 20% coinsurance (PR-2), rounded half up.
    """
    plan = s["plan"]
    remaining_ded = D(plan["deductible"]) - D(plan["deductible_met_before_claim"])
    rate = Decimal(plan["coinsurance_rate"])
    zero = D(0)
    lines = []
    for n, src in enumerate(s["lines"], 1):
        charge = D(src["charge"])
        row = {
            "line": n, "date_of_service": s["visit"]["date_of_service"], "revenue_code": src["rev"],
            "code": src["code"], "modifier": src.get("modifier"), "bill_description": src["bill_description"],
            "eob_description": src["eob_description"], "units": src["units"], "billed": charge,
        }
        denial = src.get("denial")
        if denial:
            row.update(plan_discount=zero, not_covered=charge, allowed=zero, deductible=zero, copay=zero,
                       coinsurance=zero, plan_paid=zero, codes=[denial])
        else:
            allowed = D(src["allowed"])
            discount = charge - allowed
            codes = ["CO-45"] if discount > 0 else []
            if src.get("er_copay_line"):
                copay, ded, coins = min(D(plan["er_copay"]), allowed), zero, zero
                codes.append("PR-3")
            else:
                ded = min(remaining_ded, allowed)
                remaining_ded -= ded
                coins = D((allowed - ded) * rate)
                copay = zero
                if ded > 0:
                    codes.append("PR-1")
                if coins > 0:
                    codes.append("PR-2")
            row.update(plan_discount=discount, not_covered=zero, allowed=allowed, deductible=ded, copay=copay,
                       coinsurance=coins, plan_paid=allowed - ded - copay - coins, codes=codes)
        row["you_owe"] = row["deductible"] + row["copay"] + row["coinsurance"]
        # invariants, line by line
        assert row["billed"] == row["plan_discount"] + row["not_covered"] + row["allowed"], row
        assert row["allowed"] == row["plan_paid"] + row["you_owe"], row
        assert min(row["plan_paid"], row["you_owe"], row["plan_discount"]) >= 0, row
        lines.append(row)

    keys = ["billed", "plan_discount", "not_covered", "allowed", "deductible", "copay", "coinsurance",
            "plan_paid", "you_owe"]
    totals = {k: sum((r[k] for r in lines), zero) for k in keys}
    assert totals["billed"] == totals["plan_discount"] + totals["not_covered"] + totals["allowed"]
    assert totals["allowed"] == totals["plan_paid"] + totals["you_owe"]
    assert totals["you_owe"] == totals["deductible"] + totals["copay"] + totals["coinsurance"]

    acct = s["hospital_account"]
    statement = {
        "total_charges": totals["billed"],
        "insurance_payments": totals["plan_paid"],
        # the hospital posted only the contractual (CO-45) write-off; the OA-18 and CO-97 lines stayed open
        "insurance_adjustments": totals["plan_discount"],
        "patient_payments": D(acct["patient_payments"]),
    }
    statement["balance_due"] = (statement["total_charges"] - statement["insurance_payments"]
                                - statement["insurance_adjustments"] - statement["patient_payments"])
    statement["total_credits"] = statement["insurance_payments"] + statement["insurance_adjustments"]

    ded_annual, oop_annual = D(plan["deductible"]), D(plan["out_of_pocket_max"])
    accum = {
        "deductible_annual": ded_annual,
        "deductible_applied": D(plan["deductible_met_before_claim"]) + totals["deductible"],
        "oop_annual": oop_annual,
        "oop_applied": D(plan["out_of_pocket_met_before_claim"]) + totals["you_owe"],
    }
    accum["deductible_remaining"] = ded_annual - accum["deductible_applied"]
    accum["oop_remaining"] = oop_annual - accum["oop_applied"]
    assert accum["deductible_remaining"] >= 0 and accum["oop_remaining"] >= 0

    difference = statement["balance_due"] - totals["you_owe"]
    denied = [r for r in lines if r["not_covered"] > 0]
    assert difference == sum((r["billed"] for r in denied), zero) - statement["patient_payments"], difference
    return {"lines": lines, "totals": totals, "statement": statement, "accum": accum, "difference": difference,
            "denied": denied}


def price_reference(lines: list[dict], s: dict) -> list[dict]:
    """Same comparison as backend/services/snowflake_services/snowflake_service.py, against the offline CSV."""
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        bench = {r["CPT_CODE"]: r for r in csv.DictReader(f)}
    typical, above = s["price_reference"]["typical_max_ratio"], s["price_reference"]["above_max_ratio"]
    out = []
    for r in lines:
        code = r["code"]
        item = {"line": r["line"], "code": code, "bill_description": r["bill_description"],
                "billed": float(r["billed"]), "units": r["units"]}
        if not code:
            item.update(flag="no_code")
        elif code not in bench:
            item.update(flag="no_benchmark")
        else:
            b = bench[code]
            rate = float(b["MEDICARE_RATE"])
            ratio = round(float(r["billed"]) / rate, 1)
            flag = "typical" if ratio <= typical else "above_typical" if ratio <= above else "far_above_typical"
            item.update(flag=flag, medicare_rate=rate, csv_description=b["DESCRIPTION"], setting=b["SETTING"],
                        times_medicare=ratio, doctors_part_only=b["SETTING"] == "facility",
                        csv_source=b["SOURCE"])
        out.append(item)
    return out


# --------------------------------------------------------------------------------------------- html bits
def imb_svg(seed: str) -> str:
    """A 65-bar, four-state Intelligent Mail barcode lookalike (deterministic, not a real routing code)."""
    rnd = random.Random(seed)
    states = [rnd.choice("FADT") for _ in range(65)]
    pitch, width, full, track = 45.5, 20.0, 145.0, 50.0       # thousandths of an inch
    top_track = (full - track) / 2
    rects = []
    for i, st in enumerate(states):
        x = i * pitch
        y, h = {"F": (0, full), "A": (0, top_track + track), "D": (top_track, full - top_track),
                "T": (top_track, track)}[st]
        rects.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{width:.0f}" height="{h:.1f}"/>')
    total_w = 64 * pitch + width
    return (f'<svg class="imb" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total_w:.1f} {full:.0f}" '
            f'style="width:{total_w / 1000:.3f}in;height:{full / 1000:.3f}in" aria-hidden="true">'
            + "".join(rects) + "</svg>")


_svg_counter = 0


def inline_svg(name: str) -> str:
    """Inline an SVG asset so its text uses the page's fonts; ids get a unique suffix per use."""
    global _svg_counter
    _svg_counter += 1
    svg = (SRC / "assets" / name).read_text(encoding="utf-8").strip()
    svg = re.sub(r'id="([^"]+)"', lambda mt: f'id="{mt.group(1)}-{_svg_counter}"', svg)
    svg = re.sub(r'url\(#([^)]+)\)', lambda mt: f'url(#{mt.group(1)}-{_svg_counter})', svg)
    return svg


def taglines_html(taglines: list[dict], phone: str, tty: str) -> str:
    rows = []
    for t in taglines:
        text = esc(t["text"])
        rtl = t.get("dir") == "rtl"
        ph = f'<span dir="ltr">{esc(phone)}</span>' if rtl else esc(phone)
        tt = f'<span dir="ltr">{esc(tty)}</span>' if rtl else esc(tty)
        text = text.replace("{phone}", ph).replace("{tty}", tt)
        attrs = f' lang="{t["lang"]}"' + (' dir="rtl"' if rtl else "")
        rows.append(f'      <p class="tl"{attrs}><span class="ln">{esc(t["name"])}</span><br>{text}</p>')
    return "\n".join(rows)


PHONE_RE = re.compile(r"\(\d{3}\) \d{3}-\d{4}")


def render(template: str, ctx: dict, base_href: str) -> str:
    def sub(mt):
        key = mt.group(1)
        if key not in ctx:
            raise KeyError(f"template token {{{{{key}}}}} has no value")
        val = ctx[key]
        return str(val) if key.endswith("_html") else esc(val)

    out = re.sub(r"\{\{\s*([A-Za-z0-9_]+)\s*\}\}", sub, template)
    # A phone number never breaks across lines ("(614)" / "555-0143"): wrap every one in the body in a nowrap span.
    head, body_tag, body = out.partition("<body>")
    out = head + body_tag + PHONE_RE.sub(lambda mt: f'<span class="nowrap">{mt.group(0)}</span>', body)
    return out.replace("<head>", f'<head>\n<base href="{base_href}">', 1)


def common_ctx(s: dict) -> dict:
    h, i, p, v, a, c = s["hospital"], s["insurer"], s["patient"], s["visit"], s["hospital_account"], s["claim"]
    ctx = {
        "specimen_footer": s["specimen_footer"],
        "patient_name": p["name"],
        "patient_mailing_name": p["mailing_name"],
        "patient_street_caps": p["street"].upper(),
        "patient_city_caps": p["city"].upper(),
        "patient_state": p["state"],
        "patient_zip4": p["zip4"],
        "member_id": p["member_id"],
        "group_number": p["group_number"],
        "group_name": p["group_name"],
        "date_of_service": us_date(v["date_of_service"]),
        "patient_type": v["patient_type"],
        "visit_location": v["location"],
        "insurer_name": i["name"],
        "plan_name": i["plan_name"],
        "hosp_name": h["name"],
        "guarantor_account": a["guarantor_account"],
        "hospital_account": a["hospital_account"],
        "claim_number": c["claim_number"],
        "claim_received_date": us_date(c["received_date"]),
        "claim_processed_date": us_date(c["processed_date"]),
        "network_status": c["network_status"],
    }
    for k, val in h.items():
        ctx[f"hosp_{k}"] = val
    for k, val in i.items():
        ctx[f"ins_{k}"] = val
    return ctx


# --------------------------------------------------------------------------------------------- documents
def bill_context(s: dict, adj: dict, taglines: dict) -> dict:
    h, a = s["hospital"], s["hospital_account"]
    st = adj["statement"]
    ctx = common_ctx(s)
    amount_cents = int((st["balance_due"] * 100).to_integral_value())
    scan_digits = a["guarantor_account"] + f"{amount_cents:010d}"
    rows = []
    for r in adj["lines"]:
        code = r["code"] or ""
        cls = "cpt" if code else "cpt none"
        rows.append(f'      <tr><td>{us_date(r["date_of_service"])}</td><td>{r["revenue_code"]}</td>'
                    f'<td class="{cls}">{esc(code)}</td><td class="mod">{esc(r["modifier"] or "")}</td>'
                    f'<td>{esc(r["bill_description"])}</td>'
                    f'<td class="num">{r["units"]}</td><td class="num">{m(r["billed"])}</td></tr>')
    posted = us_date(a["payment_posted_date"])
    activity = [
        (posted, f'Insurance payment &ndash; {esc(s["insurer"]["name"])}', st["insurance_payments"]),
        (posted, f'Insurance contractual adjustment &ndash; {esc(s["insurer"]["name"])}', st["insurance_adjustments"]),
    ]
    act_rows = [f'      <tr><td>{d}</td><td>{desc}</td><td class="num">-{m(amt)}</td></tr>'
                for d, desc, amt in activity]
    ctx.update({
        "doc_title": f'Itemized Statement - {h["name"]} (SPECIMEN)',
        "page_count": str(PAGE_COUNT["itemized-bill"]),
        "logo_html": inline_svg("lvmc-logo.svg"),
        "logo_small_html": inline_svg("lvmc-logo.svg"),
        "qr_html": (SRC / "assets" / "qr-pay.svg").read_text(encoding="utf-8").strip(),
        "imb_guarantor_html": imb_svg("guarantor:" + a["guarantor_account"]),
        "imb_remit_html": imb_svg("remit:" + h["remit_po_box"]),
        "presort_line": f'AUTO**5-DIGIT {h["zip"]} T4 P1 B014',
        "statement_date": us_date(a["statement_date"]),
        "due_date": us_date(a["due_date"]),
        "insurance_billed_date": us_date(a["insurance_billed_date"]),
        "payment_posted_date": posted,
        "hosp_correspondence_po_box_caps": h["correspondence_po_box"].upper(),
        "hosp_remit_po_box_caps": h["remit_po_box"].upper(),
        "hosp_city_caps": h["city"].upper(),
        "total_charges": m(st["total_charges"]),
        "insurance_payments": m(st["insurance_payments"]),
        "insurance_adjustments": m(st["insurance_adjustments"]),
        "patient_payments_display": m(st["patient_payments"]),
        "balance_due_dollar": md(st["balance_due"]),
        "amount_due_dollar": md(st["balance_due"]),
        "aging_current": m(st["balance_due"]),   # first statement after insurance: the whole balance is current
        "total_credits": m(st["total_credits"]),
        "line_count": str(len(adj["lines"])),
        "itemized_rows_html": "\n".join(rows),
        "activity_rows_html": "\n".join(act_rows),
        "scan_line": f"{a['guarantor_account']} {amount_cents:010d} {luhn_digit(scan_digits)}",
        "taglines_html": taglines_html(taglines["section_1557"], h["phone_billing"], h["tty"]),
    })
    return ctx


def eob_context(s: dict, adj: dict, taglines: dict) -> dict:
    i, c, plan = s["insurer"], s["claim"], s["plan"]
    t, acc = adj["totals"], adj["accum"]
    ctx = common_ctx(s)
    rows = []
    for r in adj["lines"]:
        code = r["code"]
        meta = [us_date(r["date_of_service"])]
        meta.append((code + (f'-{r["modifier"]}' if r["modifier"] else "")) if code else "no code")
        meta.append(f'Rev {r["revenue_code"]}')
        if r["units"] > 1:
            meta.append(f'{r["units"]} units')
        cells = []
        for k in ("billed", "plan_discount", "not_covered", "allowed", "deductible", "copay", "coinsurance",
                  "plan_paid", "you_owe"):
            v = r[k]
            cells.append(f'<td class="zero">0.00</td>' if v == 0 and k != "billed" else f"<td>{m(v)}</td>")
        rows.append(
            f'      <tr><td class="l"><div class="svc">{r["line"]}. {esc(r["eob_description"])}</div>'
            f'<div class="svm">{" &middot; ".join(esc(x) for x in meta)}</div></td>'
            + "".join(cells) + f'<td class="l codes">{" ".join(r["codes"])}</td></tr>')
    used = []
    for r in adj["lines"]:
        for code in r["codes"]:
            if code not in used:
                used.append(code)
    used.sort(key=CODE_ORDER.index)
    code_rows = []
    for code in used:
        info = s["codes"][code]
        code_rows.append(f'      <tr><td class="code">{code}</td><td><b>{esc(info["title"])}.</b> {esc(info["plain"])}</td>'
                         f'<td>{esc(info["responsibility"])}</td></tr>')
    aca = "".join(
        f'<p lang="{x["lang"]}"><b>{esc(x["name"])}:</b> {esc(x["text"]).replace("{phone}", esc(i["phone_member_services"]))}</p>'
        for x in taglines["aca"])
    pct = lambda part, whole: f"{min(100.0, float(part) / float(whole) * 100):.1f}"
    ctx.update({
        "doc_title": f'Explanation of Benefits - {i["name"]} (SPECIMEN)',
        "page_count": str(PAGE_COUNT["eob"]),
        "logo_html": inline_svg("pellridge-logo.svg"),
        "imb_member_html": imb_svg("member:" + s["patient"]["member_id"]),
        "presort_line": f'AUTO**5-DIGIT {s["hospital"]["zip"]} T2 P7 B031',
        "eob_statement_date_long": long_date(c["eob_statement_date"]),
        "payment_date": us_date(c["payment_date"]),
        "payment_method": c["payment_method"],
        "payment_method_lower": c["payment_method"].lower(),
        "payment_trace": c["payment_trace"],
        "plan_year_label": f'{us_date(plan["plan_year_start"])}\u2013{us_date(plan["plan_year_end"])}',
        "coverage_tier": plan["coverage_tier"],
        "cost_sharing_note": plan["cost_sharing_note"],
        "line_count": str(len(adj["lines"])),
        "t_billed": m(t["billed"]), "t_billed_dollar": md(t["billed"]),
        "t_discount": m(t["plan_discount"]),
        "t_not_covered": m(t["not_covered"]),
        "t_allowed": m(t["allowed"]), "t_allowed_dollar": md(t["allowed"]),
        "t_deductible": m(t["deductible"]), "t_deductible_dollar": md(t["deductible"]),
        "t_copay": m(t["copay"]), "t_copay_dollar": md(t["copay"]),
        "t_coinsurance": m(t["coinsurance"]), "t_coinsurance_dollar": md(t["coinsurance"]),
        "t_plan_paid": m(t["plan_paid"]), "t_plan_paid_dollar": md(t["plan_paid"]),
        "t_you_owe": m(t["you_owe"]), "t_you_owe_dollar": md(t["you_owe"]),
        "deductible_annual": m(acc["deductible_annual"]), "deductible_applied": m(acc["deductible_applied"]),
        "deductible_remaining": m(acc["deductible_remaining"]),
        "deductible_pct": pct(acc["deductible_applied"], acc["deductible_annual"]),
        "oop_annual": m(acc["oop_annual"]), "oop_applied": m(acc["oop_applied"]),
        "oop_remaining": m(acc["oop_remaining"]),
        "oop_pct": pct(acc["oop_applied"], acc["oop_annual"]),
        "eob_rows_html": "\n".join(rows),
        "code_rows_html": "\n".join(code_rows),
        "aca_taglines_html": aca,
        "taglines_html": taglines_html(taglines["section_1557"], i["phone_member_services"], i["tty"]),
    })
    return ctx


# --------------------------------------------------------------------------------------------- ground truth
def f2(x: Decimal) -> float:
    return float(D(x))


def ground_truth(s: dict, adj: dict, refs: list[dict], bill_ctx: dict) -> dict:
    h, i, p, v, a, c, plan = (s["hospital"], s["insurer"], s["patient"], s["visit"], s["hospital_account"],
                              s["claim"], s["plan"])
    st, t, acc = adj["statement"], adj["totals"], adj["accum"]
    dup = next(r for r in adj["lines"] if "OA-18" in r["codes"])
    original = next(r for r in adj["lines"] if r["code"] == dup["code"] and r is not dup)
    supply = next(r for r in adj["lines"] if "CO-97" in r["codes"])
    far = [x for x in refs if x.get("flag") == "far_above_typical" and not x.get("doctors_part_only")]
    doctor = [x for x in refs if x.get("doctors_part_only")]
    lines_bill = [{
        "line": r["line"], "page": 2, "date_of_service": r["date_of_service"], "revenue_code": r["revenue_code"],
        "cpt_hcpcs": r["code"], "modifier": r["modifier"], "description": r["bill_description"], "units": r["units"],
        "amount": f2(r["billed"]), "amount_printed": m(r["billed"]),
    } for r in adj["lines"]]
    lines_eob = [{
        "line": r["line"], "page": 2, "date_of_service": r["date_of_service"], "revenue_code": r["revenue_code"],
        "cpt_hcpcs": r["code"], "modifier": r["modifier"], "description": r["eob_description"], "units": r["units"],
        "billed": f2(r["billed"]), "plan_discount": f2(r["plan_discount"]), "not_covered": f2(r["not_covered"]),
        "allowed": f2(r["allowed"]), "deductible": f2(r["deductible"]), "copay": f2(r["copay"]),
        "coinsurance": f2(r["coinsurance"]), "plan_paid": f2(r["plan_paid"]), "you_owe": f2(r["you_owe"]),
        "codes": r["codes"],
    } for r in adj["lines"]]
    used_codes = []
    for r in adj["lines"]:
        used_codes += [x for x in r["codes"] if x not in used_codes]
    used_codes.sort(key=CODE_ORDER.index)                     # the order printed in the EOB code table
    return {
        "_about": ("Ground truth for the Footnote demo documents. Generated by demo/documents/build.py from "
                   "src/scenario.json; do not edit by hand. Amounts are numbers in U.S. dollars; '*_printed' "
                   "fields are the exact text on the page. Everything is fictional."),
        "date_format_printed": "MM/DD/YYYY on both documents, except the EOB statement date (Month D, YYYY)",
        "specimen_footer": s["specimen_footer"],
        "story": {
            "summary": v["story"],
            "date_of_service": v["date_of_service"],
            "teaching_points": [
                "The statement repeats the comprehensive metabolic panel (80053) on the same date; the EOB denies the second line as an exact duplicate (OA-18) and the patient owes $0 for it.",
                "A $486.50 miscellaneous medical/surgical supply line has no CPT/HCPCS code; the EOB treats it as included in the emergency room payment (CO-97) and the patient owes $0 for it.",
                "The statement balance due is higher than the EOB's patient responsibility by exactly the two lines above, because the hospital posted only the contractual (CO-45) adjustment.",
                "Four coded lines are billed far above the Medicare national reference in the CSV; the ER facility level (99284) is compared with a doctor's-part-only (facility) reference, so the right question is to clarify the doctor's fee, not to call the hospital charge high.",
            ],
        },
        "documents": {
            "itemized_bill": {
                "file": "out/itemized-bill.pdf",
                "pages": PAGE_COUNT["itemized-bill"],
                "document_type": "hospital_bill",
                "title": "Itemized Statement",
                "provider": {
                    "name": h["name"], "department": h["department"],
                    "street": h["street"], "city": h["city"], "state": h["state"], "zip": h["zip"],
                    "correspondence_address": f'{h["correspondence_po_box"]}, {h["city"]}, {h["state"]} {h["correspondence_zip4"]}',
                    "remit_to_address": f'{h["name"]}, {h["remit_po_box"]}, {h["city"]}, {h["state"]} {h["remit_zip4"]}',
                    "phone_billing": h["phone_billing"], "billing_hours": h["billing_hours"],
                    "phone_financial_assistance": h["phone_financial_assistance"],
                    "phone_civil_rights": h["phone_civil_rights"], "tty": h["tty"],
                    "pay_url": h["pay_url"], "financial_assistance_url": h["financial_assistance_url"],
                    "surprise_billing_url": h["surprise_billing_url"],
                    "qr_code_payload": "https://linnetvalley.example/pay?acct=" + a["guarantor_account"],
                },
                "statement_date": a["statement_date"],
                "due_date": a["due_date"],
                "guarantor": {"name": p["name"], "mailing_address": [p["mailing_name"], p["street"].upper(),
                              f'{p["city"].upper()} {p["state"]} {p["zip4"]}']},
                "patient": {"name": p["name"], "relationship": p["relationship_to_subscriber"]},
                "guarantor_account": a["guarantor_account"],
                "hospital_account": a["hospital_account"],
                "visit": {"date_of_service": v["date_of_service"], "admit_date": v["date_of_service"],
                          "discharge_date": v["date_of_service"], "patient_type": v["patient_type"],
                          "location": v["location"]},
                "insurance": {"payer": i["name"], "member_id": p["member_id"], "group_number": p["group_number"],
                              "billed_date": a["insurance_billed_date"], "processed_date": c["processed_date"]},
                "line_items": lines_bill,
                "line_item_count": len(lines_bill),
                "account_activity": [
                    {"posted": a["payment_posted_date"], "description": f'Insurance payment \u2013 {i["name"]}',
                     "amount": -f2(st["insurance_payments"])},
                    {"posted": a["payment_posted_date"], "description": f'Insurance contractual adjustment \u2013 {i["name"]}',
                     "amount": -f2(st["insurance_adjustments"])},
                ],
                "summary": {
                    "total_charges": f2(st["total_charges"]),
                    "insurance_payments": f2(st["insurance_payments"]),
                    "insurance_adjustments": f2(st["insurance_adjustments"]),
                    "patient_payments": f2(st["patient_payments"]),
                    "balance_due": f2(st["balance_due"]),
                    "amount_due": f2(st["balance_due"]),
                    "total_payments_and_adjustments": f2(st["total_credits"]),
                    "formula": "total_charges - insurance_payments - insurance_adjustments - patient_payments = balance_due",
                },
                "account_aging": {"current": f2(st["balance_due"]), "31_60_days": 0.0, "61_90_days": 0.0,
                                  "over_90_days": 0.0},
                "page_totals": {"2": {"line_items": len(lines_bill), "charges": f2(st["total_charges"])}},
                "coupon": {
                    "statement_date": a["statement_date"], "guarantor_account": a["guarantor_account"],
                    "due_date": a["due_date"], "amount_due": f2(st["balance_due"]),
                    "scan_line": bill_ctx["scan_line"],
                    "scan_line_format": "guarantor account (10) + amount due in cents (10) + Luhn mod-10 check digit",
                    "presort_line": bill_ctx["presort_line"],
                    "endorsement": "ELECTRONIC SERVICE REQUESTED",
                },
                "financial_assistance": {"discount_by_income_fpl": {"up_to_200": "100%", "201_to_300": "75%",
                                                                    "301_to_400": "50%"},
                                         "application_window_days": 240},
                "collections": {"earliest_referral_days_after_first_statement": 120},
                "notices": ["financial assistance notice and plain language summary (26 CFR 1.501(r))",
                            "physicians bill separately", "protection from surprise medical bills (No Surprises Act)",
                            "written disputes", "address or insurance change form", "notice of nondiscrimination",
                            "language assistance in English and 15 languages (45 CFR 92.11)"],
                "form_id": h["form_id"],
            },
            "eob": {
                "file": "out/eob.pdf",
                "pages": PAGE_COUNT["eob"],
                "document_type": "eob",
                "title": "Explanation of Benefits",
                "not_a_bill": True,
                "insurer": {
                    "name": i["name"], "legal_name": i["legal_name"],
                    "address": f'{i["po_box"]}, {i["city"]}, {i["state"]} {i["zip4"]}',
                    "appeals_address": f'{i["name"]}, Attn: Member Appeals, {i["appeals_po_box"]}, {i["city"]}, {i["state"]} {i["appeals_zip4"]}',
                    "phone_member_services": i["phone_member_services"], "member_services_hours": i["member_services_hours"],
                    "fax_appeals": i["fax_appeals"], "phone_fraud": i["phone_fraud"],
                    "phone_civil_rights": i["phone_civil_rights"], "tty": i["tty"], "website": i["website"],
                },
                "statement_date": c["eob_statement_date"],
                "statement_date_printed": long_date(c["eob_statement_date"]),
                "member": {"name": p["name"], "member_id": p["member_id"], "group_number": p["group_number"],
                           "group_name": p["group_name"],
                           "plan": i["plan_name"], "mailing_address": [p["mailing_name"], p["street"].upper(),
                           f'{p["city"].upper()} {p["state"]} {p["zip4"]}']},
                "claim": {
                    "claim_number": c["claim_number"], "patient": p["name"], "relationship": p["relationship_to_subscriber"],
                    "provider": h["name"], "provider_type": "Hospital outpatient", "network_status": c["network_status"],
                    "provider_account": a["hospital_account"], "dates_of_service": [v["date_of_service"], v["date_of_service"]],
                    "received_date": c["received_date"], "processed_date": c["processed_date"],
                },
                "lines": lines_eob,
                "totals": {k: f2(val) for k, val in t.items()},
                "summary": {
                    "amount_billed": f2(t["billed"]), "plan_discount": f2(t["plan_discount"]),
                    "not_covered": f2(t["not_covered"]), "allowed_amount": f2(t["allowed"]),
                    "plan_paid": f2(t["plan_paid"]), "your_responsibility": f2(t["you_owe"]),
                    "deductible": f2(t["deductible"]), "copay": f2(t["copay"]), "coinsurance": f2(t["coinsurance"]),
                },
                "codes": [{"code": code, **s["codes"][code]} for code in used_codes],
                "payment": {"paid_to": h["name"], "amount": f2(t["plan_paid"]), "method": c["payment_method"],
                            "date": c["payment_date"], "trace": c["payment_trace"]},
                "plan_year": {
                    "start": plan["plan_year_start"], "end": plan["plan_year_end"], "tier": plan["coverage_tier"],
                    "network": "In-network",
                    "deductible": {"annual": f2(acc["deductible_annual"]), "applied_to_date": f2(acc["deductible_applied"]),
                                   "remaining": f2(acc["deductible_remaining"]),
                                   "applied_before_this_claim": f2(D(plan["deductible_met_before_claim"])),
                                   "applied_by_this_claim": f2(t["deductible"])},
                    "out_of_pocket_max": {"annual": f2(acc["oop_annual"]), "applied_to_date": f2(acc["oop_applied"]),
                                          "remaining": f2(acc["oop_remaining"]),
                                          "applied_before_this_claim": f2(D(plan["out_of_pocket_met_before_claim"])),
                                          "applied_by_this_claim": f2(t["you_owe"])},
                    "cost_sharing": {"er_copay": f2(D(plan["er_copay"])), "coinsurance_rate": float(plan["coinsurance_rate"]),
                                     "note": plan["cost_sharing_note"]},
                },
                "appeal": {"internal_appeal_deadline_days": 180, "expedited_decision_hours": 72,
                           "external_review_request_months": 4, "erisa_502a_civil_action": True},
                "notices": ["appeal rights (29 CFR 2590.715-2719)", "diagnosis and treatment codes on request",
                            "protection from surprise medical bills (No Surprises Act, required on each EOB for "
                            "emergency services)", "fraud line", "notice of nondiscrimination",
                            "language assistance in English and 15 languages (45 CFR 92.11)",
                            "Spanish, Tagalog, Chinese and Navajo assistance lines"],
                "form_id": i["form_id"],
            },
        },
        "cross_document": {
            "same_claim": True,
            "documents_match": True,
            "matching_fields": {
                "date_of_service": v["date_of_service"], "provider": h["name"],
                "provider_account_on_eob_equals_hospital_account": a["hospital_account"],
                "total_charges_equals_eob_billed": f2(t["billed"]),
                "insurance_payments_equals_eob_plan_paid": f2(t["plan_paid"]),
                "insurance_adjustments_equals_eob_plan_discount": f2(t["plan_discount"]),
            },
            "statement_balance_due": f2(st["balance_due"]),
            "eob_your_responsibility": f2(t["you_owe"]),
            "difference": f2(adj["difference"]),
            "difference_explained_by": [
                {"line": dup["line"], "code": dup["code"], "description": dup["bill_description"],
                 "amount": f2(dup["billed"]), "eob_code": "OA-18"},
                {"line": supply["line"], "code": None, "revenue_code": supply["revenue_code"],
                 "description": supply["bill_description"], "amount": f2(supply["billed"]), "eob_code": "CO-97"},
            ],
            "formula": "statement balance_due - EOB your_responsibility = duplicate line + bundled supply line = EOB not_covered total",
        },
        "expected_findings": [
            {"id": "duplicate_charge", "kind": "duplicate",
             "bill_lines": [original["line"], dup["line"]], "code": dup["code"],
             "description": dup["bill_description"], "date_of_service": dup["date_of_service"],
             "amount_each": f2(dup["billed"]), "eob_line": dup["line"], "eob_code": "OA-18",
             "patient_owes_for_duplicate": 0.0,
             "question": f'Line {dup["line"]} repeats line {original["line"]} ({dup["code"]}, {us_date(dup["date_of_service"])}, ${m(dup["billed"])}). '
                         "My insurer denied it as an exact duplicate (OA-18). Can you remove the duplicate charge?"},
            {"id": "vague_supply_charge", "kind": "no_code_bundled",
             "bill_line": supply["line"], "revenue_code": supply["revenue_code"], "code": None,
             "description": supply["bill_description"], "amount": f2(supply["billed"]),
             "eob_code": "CO-97", "patient_owes_for_line": 0.0,
             "question": "What does the $486.50 miscellaneous supply charge include? My insurer says supplies are included in the emergency room payment (CO-97)."},
            {"id": "balance_mismatch", "kind": "statement_vs_eob",
             "statement_balance_due": f2(st["balance_due"]), "eob_your_responsibility": f2(t["you_owe"]),
             "difference": f2(adj["difference"]),
             "explanation": "The statement adjusted only the contractual discount (CO-45). The duplicate (OA-18) and bundled supply (CO-97) lines were not adjusted, so they remain in the balance.",
             "question": f'My Explanation of Benefits says I owe ${m(t["you_owe"])}, but your statement says ${m(st["balance_due"])}. '
                         f'Can you adjust the ${m(adj["difference"])} my insurer marked as not my responsibility and send a corrected statement?'},
            {"id": "price_reference_far_above", "kind": "medicare_reference",
             "lines": [{"line": x["line"], "code": x["code"], "billed": x["billed"], "csv_medicare_rate": x["medicare_rate"],
                        "csv_setting": x["setting"], "times_medicare": x["times_medicare"], "flag": x["flag"]} for x in far],
             "note": "Chargemaster prices are commonly several times Medicare's rate; this is a reason to ask how the charge was priced, not proof of an error."},
            {"id": "doctors_part_only_reference", "kind": "medicare_reference_scope",
             "lines": [{"line": x["line"], "code": x["code"], "billed": x["billed"], "csv_medicare_rate": x["medicare_rate"],
                        "csv_setting": x["setting"], "times_medicare": x["times_medicare"], "backend_flag": x["flag"]} for x in doctor],
             "note": "The CSV row is the facility-setting physician rate: it covers only the doctor's part, so the app should say 'clarify the doctor's fee' and not call the hospital's facility charge high.",
             "limitation": "No common emergency imaging code in backend/data/cpt_benchmarks.csv has a facility (doctor's-part-only) row, so this case is carried by the ER facility level line instead of an imaging line."},
            {"id": "physicians_bill_separately", "kind": "context",
             "note": "The statement says the emergency physician and the radiologist bill separately; more bills may follow."},
        ],
        "price_reference": {
            "source_file": s["price_reference"]["source_file"],
            "source_label": s["price_reference"]["source_label"],
            "bands": {"typical_max_ratio": s["price_reference"]["typical_max_ratio"],
                      "above_max_ratio": s["price_reference"]["above_max_ratio"],
                      "ratio": "round(billed / medicare_rate, 1), per line, ignoring units (as the backend does)"},
            "lines": refs,
            "expected_price_summary": {
                "items_checked": sum(1 for x in refs if "medicare_rate" in x),
                "items_flagged": sum(1 for x in refs if x.get("flag") in ("above_typical", "far_above_typical")),
                "billed_total_checked": round(sum(x["billed"] for x in refs if "medicare_rate" in x), 2),
                "medicare_total_checked": round(sum(x["medicare_rate"] for x in refs if "medicare_rate" in x), 2),
            },
        },
        "expected_gemini_line_items": {
            "_note": ("The statement's charge lines in the shape of GeminiResult.line_items (backend/models.py), "
                      "assuming the statement is uploaded first (document_index 1) and the EOB second. Line 13 "
                      "also prints modifier 25 in its own column; if Gemini returns '99284-25', the price check "
                      "still looks up 99284 (snowflake_service._normalize keeps the first 5 characters)."),
            "lines": [{"cpt_code": r["code"], "original_description": r["bill_description"],
                       "billed_amount": f2(r["billed"]), "date_of_service": r["date_of_service"],
                       "source_page": 2, "document_index": 1} for r in adj["lines"]],
        },
        "expected_gemini_financials": {
            "statement_billed": f2(st["total_charges"]),
            "bill_adjustments": f2(st["insurance_adjustments"]),
            "after_bill_adjustments": None,
            "_after_bill_adjustments_derived": f2(st["total_charges"] - st["insurance_adjustments"]),
            "_note": "after_bill_adjustments is not printed on the statement (it would be total charges minus adjustments).",
            "statement_insurer_paid": f2(st["insurance_payments"]),
            "prior_patient_payment": f2(st["patient_payments"]),
            "statement_balance": f2(st["balance_due"]),
            "eob_billed": f2(t["billed"]),
            "eob_allowed": f2(t["allowed"]),
            "eob_insurer_paid": f2(t["plan_paid"]),
            "eob_patient_responsibility": f2(t["you_owe"]),
            "deductible": f2(t["deductible"]),
            "coinsurance": f2(t["coinsurance"]),
            "copayment": f2(t["copay"]),
            "copay_coinsurance": None,
            "due_date": a["due_date"],
            "provider_name_bill": h["name"],
            "provider_name_eob": i["name"],
        },
        "outputs": {
            "pdf": ["out/itemized-bill.pdf", "out/eob.pdf"],
            "png_300dpi": [f"out/png/{d}-p{n}.png" for d in ("itemized-bill", "eob") for n in range(1, 4)],
            "photos": [f"out/photos/{d}-p{n}.jpg" for d in ("itemized-bill", "eob") for n in range(1, 4)],
        },
    }


# --------------------------------------------------------------------------------------------- chrome
def find_chrome(explicit: str | None) -> str:
    for cand in [explicit, os.environ.get("CHROME_PATH"), *DEFAULT_CHROME]:
        if cand and Path(cand).exists():
            return cand
    sys.exit("Chrome not found. Pass --chrome PATH or set CHROME_PATH.")


def print_pdf(chrome: str, html_path: Path, pdf_path: Path) -> None:
    """Never call chrome.exe --version on Windows: it opens a normal browser window instead of printing."""
    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    if pdf_path.exists():
        pdf_path.unlink()
    with tempfile.TemporaryDirectory(prefix="footnote-docs-chrome-") as profile:
        cmd = [chrome, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
               "--disable-extensions", "--disable-background-networking", "--disable-sync",
               "--disable-component-update", "--allow-file-access-from-files", f"--user-data-dir={profile}",
               "--no-pdf-header-footer", "--print-to-pdf-no-header", "--virtual-time-budget=8000",
               f"--print-to-pdf={pdf_path}", html_path.resolve().as_uri()]
        started = time.time()
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        if not pdf_path.exists() or pdf_path.stat().st_size < 1000:
            sys.stderr.write(proc.stderr[-2000:])
            sys.exit(f"Chrome did not write {pdf_path}")
        print(f"  {pdf_path.relative_to(ROOT)}  ({pdf_path.stat().st_size // 1024} KB, {time.time() - started:.1f} s)")


def pdf_page_count(pdf_path: Path) -> int:
    data = pdf_path.read_bytes()
    return len(re.findall(rb"/Type\s*/Page(?![a-zA-Z])", data))


# Every .page is a fixed 8.5 x 11 in box with overflow hidden, so text that no longer fits is clipped silently
# instead of adding a page: the page count alone cannot catch it. This probe measures every line of text in
# headless Chrome and reports text outside the printer-safe area (0.3 in), text running into the footer zone,
# text overlapping other text, and table cells whose content is wider than the cell.
LAYOUT_PROBE = r"""<script>
(async () => {
  await document.fonts.ready;
  const IN = 96, SAFE = 0.3 * IN, TOL = 0.02 * IN, FOOT_TOP = 11 * IN - 0.45 * IN;
  const out = [];
  document.querySelectorAll('section.page').forEach((page, pi) => {
    const pr = page.getBoundingClientRect(), p = pi + 1, inch = v => (v / IN).toFixed(2);
    const rects = [];
    const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim() || n.parentElement.closest('svg')) continue;
      const footer = !!n.parentElement.closest('.specimen, .form-id');
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const b of range.getClientRects()) {
        if (b.width < 0.5 || b.height < 0.5) continue;
        rects.push({x0: b.left - pr.left, y0: b.top - pr.top, x1: b.right - pr.left, y1: b.bottom - pr.top,
                    node: n, footer, t: n.textContent.trim().slice(0, 40)});
      }
    }
    for (const r of rects) {
      if (r.x0 < SAFE - TOL || r.y0 < SAFE - TOL || r.x1 > pr.width - SAFE + TOL || r.y1 > pr.height - SAFE + TOL)
        out.push(`page ${p}: "${r.t}" is outside the printable area (${inch(r.x0)}, ${inch(r.y0)}) to (${inch(r.x1)}, ${inch(r.y1)}) in`);
      else if (!r.footer && r.y1 > FOOT_TOP)
        out.push(`page ${p}: "${r.t}" runs into the footer zone (bottom at ${inch(r.y1)} in)`);
    }
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (a.node === b.node) continue;
      const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (w > 1.5 && h > 2.5) out.push(`page ${p}: "${a.t}" overlaps "${b.t}"`);
    }
    for (const c of page.querySelectorAll('td, th, .num')) {
      if (c.clientWidth > 0 && c.scrollWidth > c.clientWidth + 1)
        out.push(`page ${p}: "${c.textContent.trim().slice(0, 40)}" is wider than its cell`);
    }
    const body = rects.filter(r => !r.footer).map(r => r.y1);
    out.push(`INFO page ${p}: lowest text ${inch(Math.max(...body))} in from the top (footer zone starts at 10.55 in)`);
  });
  const pre = document.createElement('pre');
  pre.id = 'layout-report';
  pre.textContent = JSON.stringify(out);
  document.body.appendChild(pre);
})();
</script>"""


def layout_check(chrome: str, html_path: Path) -> list[str]:
    """Run LAYOUT_PROBE on a filled-in page (a temporary copy outside the repo). Lines starting 'INFO ' are notes."""
    page = html_path.read_text(encoding="utf-8")
    page = re.sub(r'<base href="[^"]*">', f'<base href="{SRC.as_uri()}/">', page, count=1)
    page = page.replace("</body>", LAYOUT_PROBE + "\n</body>", 1)
    with tempfile.TemporaryDirectory(prefix="footnote-docs-layout-") as tmp:
        probe = Path(tmp) / html_path.name
        probe.write_text(page, encoding="utf-8")
        cmd = [chrome, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
               "--disable-extensions", "--disable-background-networking", "--disable-sync",
               "--disable-component-update", "--allow-file-access-from-files",
               f"--user-data-dir={Path(tmp) / 'profile'}", "--virtual-time-budget=10000", "--dump-dom",
               probe.as_uri()]
        proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=180)
    mt = re.search(r'<pre id="layout-report">(.*?)</pre>', proc.stdout, re.S)
    if not mt:
        return [f"{html_path.name}: the layout check did not run (Chrome returned no report)"]
    return json.loads(html.unescape(mt.group(1)))


# --------------------------------------------------------------------------------------------- main
def run_tool(py: str, script: str, *args: str) -> None:
    cmd = [py, "-I", str(TOOLS / script), *args]
    print("  $", Path(py).name, script, *args)
    subprocess.run(cmd, check=True)


def main() -> int:
    sys.stdout.reconfigure(line_buffering=True)  # keep our lines in order with the tools' output
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--chrome", help="path to Chrome/Chromium")
    ap.add_argument("--imaging-python", help="Python with Pillow, numpy and pypdfium2 (outside the repo)")
    ap.add_argument("--skip-images", action="store_true", help="only PDFs and ground truth")
    ap.add_argument("--dpi", type=int, default=300, help="PNG resolution (default 300)")
    args = ap.parse_args()

    scenario = json.loads((SRC / "scenario.json").read_text(encoding="utf-8"))
    taglines = json.loads((SRC / "taglines.json").read_text(encoding="utf-8"))
    adj = adjudicate(scenario)
    refs = price_reference(adj["lines"], scenario)

    st, t = adj["statement"], adj["totals"]
    print("Story numbers")
    print(f"  total charges {md(st['total_charges'])}  insurance paid {md(st['insurance_payments'])}  "
          f"contractual adj {md(st['insurance_adjustments'])}")
    print(f"  statement balance due {md(st['balance_due'])}  EOB your responsibility {md(t['you_owe'])}  "
          f"difference {md(adj['difference'])}")

    html_dir = OUT / "html"
    html_dir.mkdir(parents=True, exist_ok=True)
    base_href = os.path.relpath(SRC, html_dir).replace(os.sep, "/") + "/"   # "../../src/": portable
    bill_ctx = bill_context(scenario, adj, taglines)
    eob_ctx = eob_context(scenario, adj, taglines)
    docs = {"itemized-bill": bill_ctx, "eob": eob_ctx}

    chrome = find_chrome(args.chrome)
    print("Rendering PDFs")
    for name, ctx in docs.items():
        page = render((SRC / f"{name}.html").read_text(encoding="utf-8"), ctx, base_href)
        out_html = html_dir / f"{name}.html"
        out_html.write_text(page, encoding="utf-8")
        pdf = OUT / f"{name}.pdf"
        print_pdf(chrome, out_html, pdf)
        pages = pdf_page_count(pdf)
        if pages and pages != PAGE_COUNT[name]:
            sys.exit(f"{pdf.name} has {pages} pages, expected {PAGE_COUNT[name]}: something overflowed")
        report = layout_check(chrome, out_html)
        for line in report:
            if line.startswith("INFO "):
                print("    " + line[5:])
        problems = [line for line in report if not line.startswith("INFO ")]
        if problems:
            sys.exit(f"{out_html.name}: layout problems (text clipped, overlapping or too close to the edge):\n  "
                     + "\n  ".join(problems))

    gt = ground_truth(scenario, adj, refs, bill_ctx)
    (ROOT / "ground-truth.json").write_text(json.dumps(gt, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("  ground-truth.json")

    if args.skip_images:
        print("Skipped PNGs, photos and PDF-text verification (--skip-images).")
        return 0

    py = args.imaging_python or os.environ.get("FOOTNOTE_DOCS_IMAGING_PYTHON") or DEFAULT_IMAGING_PYTHON
    if not Path(py).exists():
        print(f"Imaging Python not found ({py}).\nCreate one outside the repo, e.g.\n"
              "  python -m venv %TEMP%\\footnote-docs-venv\n"
              "  %TEMP%\\footnote-docs-venv\\Scripts\\pip install pillow numpy pypdfium2\n"
              "then pass --imaging-python. PDFs and ground-truth.json are already written.")
        return 1
    print("Rasterizing, photographing and verifying")
    for sub in ("png", "photos"):
        d = OUT / sub
        if d.exists():
            shutil.rmtree(d)
        d.mkdir(parents=True)
    for name in docs:
        run_tool(py, "rasterize.py", str(OUT / f"{name}.pdf"), str(OUT / "png"), str(args.dpi))
    run_tool(py, "photos.py", str(OUT / "png"), str(OUT / "photos"))
    run_tool(py, "verify.py", str(ROOT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
