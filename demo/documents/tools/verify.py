"""Independent checks of the demo documents against ground-truth.json.

    <python> -I tools/verify.py demo/documents

1. Arithmetic, recomputed from the line level in integer cents (it does not reuse build.py):
   statement lines -> total charges; total - insurance payments - adjustments - patient payments = balance due;
   every EOB line: billed = plan discount + not covered + allowed, allowed = plan paid + deductible + copay +
   coinsurance; column totals; summary = totals; plan-year accumulators; the cross-document difference.
2. The story: the duplicate pair is identical, the supply line has no code and is CO-97, the duplicate is
   OA-18, both are $0 to the patient, and the balance difference equals exactly those two lines.
3. Price references: every Medicare rate, setting and ratio re-read from backend/data/cpt_benchmarks.csv.
4. With pypdfium2: page counts, the specimen line on every page, every printed value from ground truth
   found in the right PDF and page, the required notices, and the hard rules on the extracted text (phone
   numbers only in 555-0100..0199, no toll-free, SSN-like, NPI or tax ID numbers, web addresses only on
   .example). With Pillow: PNG and photo sizes.
Exits 1 on any failure.
"""
import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
failures: list[str] = []
checks = 0


def check(cond: bool, what: str) -> None:
    global checks
    checks += 1
    if not cond:
        failures.append(what)


def c(x) -> int:
    """Dollars (float from JSON) -> integer cents, exactly."""
    return int(round(float(x) * 100))


def money(cents: int) -> str:
    return f"{cents / 100:,.2f}"


def us(iso: str) -> str:
    y, mth, d = iso.split("-")
    return f"{mth}/{d}/{y}"


gt = json.loads((ROOT / "ground-truth.json").read_text(encoding="utf-8"))
bill, eob, cross = gt["documents"]["itemized_bill"], gt["documents"]["eob"], gt["cross_document"]

# ---------------------------------------------------------------- 1. statement arithmetic
lines = bill["line_items"]
total = sum(c(x["amount"]) for x in lines)
s = bill["summary"]
check(total == c(s["total_charges"]), f"statement: lines sum {money(total)} != total charges {s['total_charges']}")
bal = c(s["total_charges"]) - c(s["insurance_payments"]) - c(s["insurance_adjustments"]) - c(s["patient_payments"])
check(bal == c(s["balance_due"]), f"statement: summary formula gives {money(bal)} != balance due {s['balance_due']}")
check(c(s["amount_due"]) == c(s["balance_due"]), "statement: amount due != balance due")
check(c(bill["coupon"]["amount_due"]) == c(s["balance_due"]), "coupon amount due != balance due")
act = sum(c(a["amount"]) for a in bill["account_activity"])
check(-act == c(s["insurance_payments"]) + c(s["insurance_adjustments"]), "statement: account activity != payments + adjustments")
check(-act == c(s["total_payments_and_adjustments"]), "statement: total payments and adjustments mismatch")
for page, pt in bill["page_totals"].items():
    on_page = [x for x in lines if str(x["page"]) == page]
    check(len(on_page) == pt["line_items"], f"statement page {page}: line count")
    check(sum(c(x["amount"]) for x in on_page) == c(pt["charges"]), f"statement page {page}: page total")
check(len(lines) == bill["line_item_count"], "statement: line_item_count")
aging = bill["account_aging"]
check(sum(c(v) for v in aging.values()) == c(s["balance_due"]), "statement: account aging buckets != balance due")
check(all(x["date_of_service"] == bill["visit"]["date_of_service"] for x in lines), "statement: a line has another date")

# scan line: account + amount in cents + Luhn digit
acct, cents, digit = bill["coupon"]["scan_line"].split()
check(acct == bill["guarantor_account"] and int(cents) == c(s["balance_due"]), "scan line content")
tot = 0
for i, ch in enumerate(reversed(acct + cents)):
    n = int(ch) * (2 if i % 2 == 0 else 1)
    tot += n - 9 if n > 9 else n
check(str((10 - tot % 10) % 10) == digit, "scan line check digit")

# ---------------------------------------------------------------- EOB arithmetic
cols = ["billed", "plan_discount", "not_covered", "allowed", "deductible", "copay", "coinsurance", "plan_paid", "you_owe"]
for x in eob["lines"]:
    n = x["line"]
    check(c(x["billed"]) == c(x["plan_discount"]) + c(x["not_covered"]) + c(x["allowed"]), f"EOB line {n}: billed split")
    check(c(x["allowed"]) == c(x["plan_paid"]) + c(x["deductible"]) + c(x["copay"]) + c(x["coinsurance"]), f"EOB line {n}: allowed split")
    check(c(x["you_owe"]) == c(x["deductible"]) + c(x["copay"]) + c(x["coinsurance"]), f"EOB line {n}: you owe")
    if c(x["not_covered"]):
        check(c(x["allowed"]) == 0 and c(x["you_owe"]) == 0, f"EOB line {n}: denied line must allow and owe 0")
    check(("PR-1" in x["codes"]) == (c(x["deductible"]) > 0), f"EOB line {n}: PR-1 code vs deductible")
    check(("PR-2" in x["codes"]) == (c(x["coinsurance"]) > 0), f"EOB line {n}: PR-2 code vs coinsurance")
    check(("PR-3" in x["codes"]) == (c(x["copay"]) > 0), f"EOB line {n}: PR-3 code vs copay")
    check(("CO-45" in x["codes"]) == (c(x["plan_discount"]) > 0), f"EOB line {n}: CO-45 code vs discount")
    if c(x["coinsurance"]):
        expect = round((c(x["allowed"]) - c(x["deductible"])) * 0.20)
        check(abs(expect - c(x["coinsurance"])) <= 0, f"EOB line {n}: coinsurance is not 20% after deductible")
for k in cols:
    check(sum(c(x[k]) for x in eob["lines"]) == c(eob["totals"][k]), f"EOB totals: {k}")
sm, t = eob["summary"], eob["totals"]
pairs = [("amount_billed", "billed"), ("plan_discount", "plan_discount"), ("not_covered", "not_covered"),
         ("allowed_amount", "allowed"), ("plan_paid", "plan_paid"), ("your_responsibility", "you_owe"),
         ("deductible", "deductible"), ("copay", "copay"), ("coinsurance", "coinsurance")]
for a, b in pairs:
    check(c(sm[a]) == c(t[b]), f"EOB summary {a} != totals {b}")
check(c(eob["payment"]["amount"]) == c(t["plan_paid"]), "EOB payment amount != plan paid")
py = eob["plan_year"]
for k, applied_now in (("deductible", t["deductible"]), ("out_of_pocket_max", t["you_owe"])):
    acc = py[k]
    check(c(acc["applied_before_this_claim"]) + c(applied_now) == c(acc["applied_to_date"]), f"accumulator {k}: applied")
    check(c(acc["annual"]) - c(acc["applied_to_date"]) == c(acc["remaining"]), f"accumulator {k}: remaining")
check(c(py["deductible"]["applied_by_this_claim"]) == c(t["deductible"]), "accumulator: deductible by this claim")

# ---------------------------------------------------------------- 2. the story, across documents
check(len(lines) == len(eob["lines"]), "bill and EOB have different line counts")
for bl, el in zip(lines, eob["lines"]):
    check(c(bl["amount"]) == c(el["billed"]) and bl["cpt_hcpcs"] == el["cpt_hcpcs"] and bl.get("modifier") == el.get("modifier") and bl["revenue_code"] == el["revenue_code"]
          and bl["date_of_service"] == el["date_of_service"] and bl["units"] == el["units"], f"line {bl['line']}: bill vs EOB")
check(c(s["total_charges"]) == c(t["billed"]), "statement total charges != EOB billed")
check(c(s["insurance_payments"]) == c(t["plan_paid"]), "statement insurance payments != EOB plan paid")
check(c(s["insurance_adjustments"]) == c(t["plan_discount"]), "statement adjustments != EOB plan discount (CO-45)")
diff = c(s["balance_due"]) - c(t["you_owe"])
check(diff == c(cross["difference"]), "cross-document difference")
check(diff == sum(c(x["amount"]) for x in cross["difference_explained_by"]), "difference != duplicate + supply")
check(diff == c(t["not_covered"]) - c(s["patient_payments"]), "difference != EOB not covered - patient payments")
check(c(cross["statement_balance_due"]) == c(s["balance_due"]) and c(cross["eob_your_responsibility"]) == c(t["you_owe"]), "cross summary")

finding = {f["id"]: f for f in gt["expected_findings"]}
dup = finding["duplicate_charge"]
a, b = (next(x for x in lines if x["line"] == n) for n in dup["bill_lines"])
check({k: a[k] for k in a if k != "line"} == {k: b[k] for k in b if k != "line"}, "duplicate lines are not identical")
check("OA-18" in next(x for x in eob["lines"] if x["line"] == dup["eob_line"])["codes"], "duplicate not OA-18 on the EOB")
sup = finding["vague_supply_charge"]
sl = next(x for x in lines if x["line"] == sup["bill_line"])
check(sl["cpt_hcpcs"] is None and "MISC" in sl["description"], "supply line has a code or is not vague")
se = next(x for x in eob["lines"] if x["line"] == sup["bill_line"])
check(se["codes"] == ["CO-97"] and c(se["you_owe"]) == 0, "supply line not CO-97 / not $0 to patient")

# ---------------------------------------------------------------- 3. CSV references
with open(REPO / "backend" / "data" / "cpt_benchmarks.csv", newline="", encoding="utf-8") as f:
    bench = {r["CPT_CODE"]: r for r in csv.DictReader(f)}
refs = gt["price_reference"]["lines"]
far = 0
for r in refs:
    code = r["code"]
    if code and code in bench:
        rate = float(bench[code]["MEDICARE_RATE"])
        check(abs(rate - r["medicare_rate"]) < 1e-9, f"CSV rate for {code}")
        check(bench[code]["SETTING"] == r["setting"], f"CSV setting for {code}")
        check(round(r["billed"] / rate, 1) == r["times_medicare"], f"ratio for {code}")
        far += r["flag"] == "far_above_typical" and r["setting"] == "non-facility"
    else:
        check(r["flag"] in ("no_code", "no_benchmark"), f"line {r['line']} should be no_code/no_benchmark")
check(far >= 2, "fewer than two far-above-reference coded lines")
check(any(r.get("doctors_part_only") for r in refs), "no doctor's-part-only reference line")

# ---------------------------------------------------------------- 4. PDFs, PNGs, photos
try:
    import pypdfium2 as pdfium
except ImportError:
    pdfium = None
    print("  (pypdfium2 not installed: PDF text checks skipped)")

squash = lambda text: re.sub(r"\s+", "", text)


def pdf_pages(path: Path) -> list[str]:
    doc = pdfium.PdfDocument(str(path))
    try:
        return [squash(doc[i].get_textpage().get_text_range()) for i in range(len(doc))]
    finally:
        doc.close()


if pdfium:
    bp = pdf_pages(ROOT / bill["file"])
    ep = pdf_pages(ROOT / eob["file"])
    check(len(bp) == bill["pages"], f"statement has {len(bp)} pages")
    check(len(ep) == eob["pages"], f"EOB has {len(ep)} pages")
    foot = squash(gt["specimen_footer"])
    for i, p in enumerate(bp + ep):
        check(foot in p, f"specimen footer missing on page {i + 1} of {'statement' if i < len(bp) else 'EOB'}")

    def on(pages, idx, needle, what):
        n = squash(needle)
        hay = pages if idx is None else [pages[idx - 1]]
        check(any(n in p for p in hay), f"{what}: '{needle}' not found")

    # statement, page 1 and coupon
    for v in [bill["provider"]["name"], bill["provider"]["phone_billing"], bill["provider"]["phone_financial_assistance"],
              bill["provider"]["financial_assistance_url"], bill["guarantor_account"], bill["hospital_account"],
              us(bill["statement_date"]), us(bill["due_date"]), us(bill["visit"]["date_of_service"]),
              bill["insurance"]["member_id"], bill["insurance"]["group_number"], "$" + money(c(s["balance_due"])),
              money(c(s["total_charges"])), "-" + money(c(s["insurance_payments"])), "-" + money(c(s["insurance_adjustments"])),
              bill["coupon"]["scan_line"], *bill["guarantor"]["mailing_address"], "ELECTRONIC SERVICE REQUESTED"]:
        on(bp, 1, v, "statement p1")
    # statement, page 2 lines
    for x in lines:
        row = us(x["date_of_service"]) + x["revenue_code"] + (x["cpt_hcpcs"] or "") + (x.get("modifier") or "") + x["description"] + str(x["units"]) + x["amount_printed"]
        on(bp, x["page"], row, f"statement line {x['line']} (whole row)")
    for a_ in bill["account_activity"]:
        on(bp, 2, "-" + money(-c(a_["amount"])), "statement activity")
    on(bp, 2, "$" + money(c(s["balance_due"])), "statement p2 balance")
    on(bp, 1, "CURRENT31–60DAYS61–90DAYSOVER90DAYS" + "".join(money(c(aging[k])) for k in
              ("current", "31_60_days", "61_90_days", "over_90_days")), "statement p1 account aging")
    # EOB
    for v in [eob["insurer"]["name"], "THIS IS NOT A BILL", eob["member"]["member_id"], eob["member"]["group_number"],
              eob["member"]["plan"], eob["insurer"]["phone_member_services"], "$" + money(c(t["you_owe"])),
              "$" + money(c(t["billed"])), "-" + money(c(t["plan_discount"])), "-" + money(c(t["not_covered"])),
              "$" + money(c(t["allowed"])), "-" + money(c(t["plan_paid"])), eob["claim"]["claim_number"],
              eob["payment"]["trace"], *eob["member"]["mailing_address"]]:
        on(ep, 1, v, "EOB p1")
    for k in ("deductible", "out_of_pocket_max"):
        for f_ in ("annual", "applied_to_date", "remaining"):
            on(ep, 1, money(c(py[k][f_])), f"EOB accumulator {k} {f_}")
    for x in eob["lines"]:
        cells = "".join(money(c(x[k])) for k in cols) + "".join(x["codes"])
        on(ep, 2, cells, f"EOB line {x['line']} (all amounts and codes in order)")
        on(ep, 2, f"{x['line']}.{x['description']}", f"EOB line {x['line']} description")
    on(ep, 2, "Claimtotals" + "".join(money(c(t[k])) for k in cols), "EOB claim totals row")
    for code in eob["codes"]:
        on(ep, 2, code["code"] + code["title"] + ".", f"EOB code table {code['code']}")
    on(ep, 3, eob["insurer"]["appeals_address"].split(", Attn")[0], "EOB appeals")
    on(ep, 1, "Group name" + eob["member"]["group_name"], "EOB p1 group name")
    on(ep, 3, "PROTECTION FROM SURPRISE MEDICAL BILLS", "EOB p3 No Surprises Act notice")
    on(ep, 3, "section 502(a) of ERISA", "EOB p3 ERISA civil action")
    on(bp, 3, "PROTECTION FROM SURPRISE MEDICAL BILLS", "statement p3 No Surprises Act notice")
    on(bp, 3, bill["provider"]["surprise_billing_url"], "statement p3 surprise billing URL")

    # Hard rules, on the text a reader (or Gemini) actually gets: fictional phone numbers only, no toll-free or
    # SSN-like numbers, no NPI/TIN, and web addresses only on the reserved .example domain.
    raw_pages = []
    for path in (ROOT / bill["file"], ROOT / eob["file"]):
        doc = pdfium.PdfDocument(str(path))
        try:
            raw_pages += [(path.stem, i + 1, doc[i].get_textpage().get_text_range()) for i in range(len(doc))]
        finally:
            doc.close()
    for stem, pg, text in raw_pages:
        where = f"{stem} p{pg}"
        for ph in re.findall(r"\(\d{3}\)\s*\d{3}-\d{4}|\b\d{3}-\d{3}-\d{4}\b", text):
            check(re.fullmatch(r"\(\d{3}\)\s*555-01\d\d", ph) is not None, f"{where}: phone number {ph} is not 555-0100..0199")
        check(not re.search(r"\b1?[-. ]?8(00|33|44|55|66|77|88)[-. ]\d{3}[-. ]\d{4}\b", text), f"{where}: toll-free number")
        check(not re.search(r"\b\d{3}-\d{2}-\d{4}\b", text), f"{where}: SSN-like number")
        check(not re.search(r"\b(NPI|TIN|EIN|Tax ID)\b", text), f"{where}: prints an NPI or tax ID")
        for host in re.findall(r"\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|gov|edu|us|health|io)\b", text.lower()):
            check(False, f"{where}: web address on a real domain: {host}")

try:
    from PIL import Image
    for rel in gt["outputs"]["png_300dpi"]:
        im = Image.open(ROOT / rel)
        check(im.size == (2550, 3300), f"{rel} is {im.size}, expected 2550x3300 (300 dpi)")
    for rel in gt["outputs"]["photos"]:
        im = Image.open(ROOT / rel)
        check(im.size == (3000, 4000) and im.format == "JPEG", f"{rel} is {im.size} {im.format}")
except ImportError:
    print("  (Pillow not installed: image checks skipped)")
except FileNotFoundError as e:
    check(False, f"missing image: {e}")

print(f"  verify: {checks} checks, {len(failures)} failed")
for f_ in failures:
    print("   FAIL", f_)
sys.exit(1 if failures else 0)
