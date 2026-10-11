# Demo documents: a hospital itemized statement and its EOB

Two synthetic documents for the Footnote demo, built to look like what a patient actually gets in the mail:

- `out/itemized-bill.pdf`: **Linnet Valley Medical Center** itemized statement, 3 pages (summary and payment
  coupon, itemized charges, notices).
- `out/eob.pdf`: **Pellridge Health Plan** Explanation of Benefits for the same claim, 3 pages (summary, claim
  detail, appeal rights and notices).

Everything is fictional: the hospital, the insurer, the plan, the patient, addresses, phone numbers
(555-0100 to 555-0199 only), web addresses (the reserved `.example` domain) and every account, member, claim and
trace number. Every page carries the line "SPECIMEN · Synthetic document for product demonstration · All names and
numbers are fictional". How the names were checked against real organizations, the 26 references the layouts
are based on and the 11 used in the review are in [RESEARCH.md](RESEARCH.md).

## The story

On Monday, September 14, 2026, Daniel Kessler went to the emergency department with right lower abdominal pain
and nausea. To rule out appendicitis he had blood and urine tests and a CT scan of the abdomen and pelvis with IV
contrast, and he got IV fluids, an anti-nausea drug and morphine. It was not appendicitis; he went home the same
day. He has an employer PPO plan; the hospital is in network.

| | Amount |
|---|---:|
| Hospital total charges (16 lines) | $9,149.50 |
| Insurance payment (Pellridge paid) | -$1,691.70 |
| Insurance contractual adjustment (CO-45 plan discount) | -$5,894.45 |
| Patient payments | $0.00 |
| **Statement balance due, by 11/02/2026** | **$1,563.35** |
| **EOB "Your responsibility"** (deductible $320.00 + ER copay $250.00 + coinsurance $238.85) | **$808.85** |
| **Difference** | **$754.50** |

The difference is exactly the two lines the insurer said the patient does not owe, which the hospital never
adjusted off: the duplicate metabolic panel ($268.00, OA-18) and the miscellaneous supplies ($486.50, CO-97).

## What a viewer should notice

1. **A duplicate charge.** Statement page 2, lines 7 and 8: `0301 80053 HC COMPREHENSIVE METABOLIC PANEL`,
   $268.00, twice on 09/14/2026. Neither line carries modifier 91, which a hospital adds when a lab test is
   deliberately repeated on the same day. EOB page 2, line 8: not covered, code **OA-18** (exact duplicate), you
   owe $0.00.
2. **A vague charge with no code.** Statement line 5: `0270 HC MED/SURG SUPPLIES MISC`, $486.50, CPT/HCPCS blank.
   EOB line 5: not covered, code **CO-97** (included in the emergency room payment), you owe $0.00.
3. **The bill asks for more than the EOB says.** Statement page 1: balance due $1,563.35. EOB page 1: your
   responsibility $808.85, "the most the provider may bill you for this claim". $1,563.35 - $808.85 = $754.50 =
   $268.00 + $486.50. The statement's insurance adjustment ($5,894.45) equals only the EOB's plan discount; the
   EOB's "not covered" $754.50 was never written off.
4. **Prices far above the Medicare reference** (from `backend/data/cpt_benchmarks.csv`, the offline copy of the
   Snowflake table). These are normal for hospital list prices: a reason to ask how a charge was priced, never
   proof of an error.

   | Line | Code | Billed | CSV Medicare rate | Setting | Times | Backend result |
   |---|---|---:|---:|---|---:|---|
   | 12 | 74177 CT abdomen and pelvis with contrast | $4,182.00 | $300.27 | non-facility | 13.9 | `far_above_typical` |
   | 2 | 96374 IV push, first drug | $486.00 | $37.74 | non-facility | 12.9 | `far_above_typical` |
   | 3 | 96375 IV push, each additional drug | $214.00 | $15.70 | non-facility | 13.6 | `far_above_typical` |
   | 4 | 96361 IV hydration, additional hour | $158.00 | $13.03 | non-facility | 12.1 | `far_above_typical` |
   | 13 | 99284-25 ER facility level 4 | $2,148.00 | $118.24 | **facility** | 18.2 | `far_above_typical` plus the note "Medicare's rate here covers only the doctor's fee" |

   For 99284 the CSV row is the facility-setting physician rate, so it covers only the doctor's part. The backend
   still returns `far_above_typical` for it, but its note says the rate covers only the doctor's fee, and the voice
   layer (`voice_agent/bill_context.doctor_only`) then treats the line as doctor's part only and keeps it out of
   the price claims: the app should say "clarify the doctor's fee", not call the hospital's $2,148.00 facility
   charge high. The line prints modifier 25 in its own column; the price check reads `99284-25` or `99284 25` as
   99284 either way (checked). The other 10 lines have no Medicare reference in the CSV (labs, drugs, contrast) or
   no code (the supplies).
5. **More bills may come.** Statement page 1 says the emergency physician and the radiologist bill separately.

Good questions to ask, all grounded in the two documents, are in `ground-truth.json` under `expected_findings`.

## Printing for the live demo

- Print `out/itemized-bill.pdf` and `out/eob.pdf` on US Letter paper at **100% / Actual size** (turn off "Fit to
  page" and "Shrink oversized pages"). Single-sided, 6 sheets in all. Color is best; grayscale also works.
- Everything sits at least 0.3 in from the paper edge, so ordinary desktop printers do not clip anything.
- For realism, fold the statement in thirds like a mailed letter: page 1 folds at its dashed tear line (7.33 in from
  the top). The coupon can be torn off along that line.
- For the laptop demo, upload the two PDFs. `out/photos/` has phone-camera versions of all six pages, and `out/png/`
  has clean 300 dpi page images.

## Files

| Path | What it is |
|---|---|
| `out/itemized-bill.pdf`, `out/eob.pdf` | Vector PDFs, US Letter, 3 pages each |
| `out/png/<doc>-p<N>.png` | Each page at 300 dpi (2550 x 3300) |
| `out/photos/<doc>-p<N>.jpg` | A synthetic phone photo of each printed page, 3000 x 4000: desk, slight rotation and perspective, shadows, uneven light, focus falloff, noise, JPEG. Deterministic. |
| `out/html/` | The filled-in HTML that Chrome printed (open in a browser to inspect) |
| `ground-truth.json` | Every printed value, line by line, the EOB adjudication, plan-year totals, codes, the cross-document difference, expected findings, the CSV references used and the expected `financials` for the analysis |
| `src/scenario.json` | The only place amounts live (charges, allowed amounts, plan design, dates, names) |
| `src/itemized-bill.html`, `src/eob.html`, `src/css/` | Page templates and print CSS (`@page` Letter, physical units) |
| `src/taglines.json` | Language assistance notices (HHS sample taglines; CMS/DOL model language lines) |
| `src/assets/`, `src/fonts/` | Invented logos (SVG), the pay QR code (points to `linnetvalley.example`), Source Sans 3 (SIL OFL) |
| `build.py` | Builds everything (standard library only) |
| `tools/rasterize.py`, `tools/photos.py`, `tools/verify.py`, `tools/make_qr.py` | Imaging, checks and the QR asset (need Pillow, numpy, pypdfium2; segno for the QR) |
| `VALIDATION.md`, `validation/` | End-to-end runs through the real backend (PDFs, phone photos, the bill alone): raw responses, timings, comparison with `ground-truth.json` |

## Rebuilding

Needs Google Chrome and Python 3.10 or newer. Amounts change only in `src/scenario.json`; the build recomputes the
EOB and every total, so the documents and `ground-truth.json` cannot drift apart.

```sh
# PDFs and ground truth only (standard library):
python demo/documents/build.py --skip-images

# Everything: also PNGs, phone photos and the checks. Keep the imaging packages out of the repo:
python -m venv "$TEMP/footnote-docs-venv"
"$TEMP/footnote-docs-venv/Scripts/pip" install pillow numpy pypdfium2      # bin/pip on macOS/Linux
python demo/documents/build.py --imaging-python "$TEMP/footnote-docs-venv/Scripts/python.exe"
```

Options: `--chrome PATH` (or `CHROME_PATH`), `--imaging-python PATH` (or `FOOTNOTE_DOCS_IMAGING_PYTHON`),
`--dpi N`. A full build takes about 1.5 minutes, most of it the photos. Right after printing each PDF, the build
measures every line of text in headless Chrome and stops if any text is clipped, overlaps other text, runs into
the footer or comes closer than 0.3 in to the paper edge (each page is a fixed 8.5 x 11 in box, so overflowing
text would otherwise be cut off silently without adding a page); it prints how low the text goes on each page.
`tools/verify.py` then re-derives every sum from the line level in integer cents, re-reads the CSV, finds every
ground-truth value in the right PDF page, and checks the hard rules on the extracted text: phone numbers only in
555-0100 to 555-0199, no toll-free, SSN-like, NPI or tax ID numbers, web addresses only on `.example` (412
checks). The build fails if any check fails.

Fonts: the statement uses Arial and the EOB uses the bundled Source Sans 3; the coupon scan line uses OCR A
Extended when installed (it comes with Microsoft Office on Windows) and falls back to Courier New elsewhere.
Language notices use the system's CJK, Arabic and Devanagari fonts. The committed outputs were built on Windows 11
with Chrome; another machine may shift line breaks slightly.

## Limitations

- **No imaging line has a doctor's-part-only reference.** In the CSV every common ER imaging code (74177, 74176,
  70450, 71046, 76705) is a non-facility (global) row; the only facility imaging rows (70010, 77469) do not fit an
  ER visit. The doctor's-part case is carried by the ER facility level, 99284, instead. Changing that would mean
  changing the benchmark data, which is outside this folder.
- **The duplicate is OA-18, not CO-18.** X12 restricts reason code 18 to group code OA. The teaching point is the
  same: the patient does not owe it.
- The barcode above each address only looks like an Intelligent Mail barcode; it does not encode a real routing
  code. The QR code is real and points to `https://linnetvalley.example/pay?acct=3041872296`, which does not exist.
- The language notices use the HHS sample wording for 15 common languages (the HHS Arabic sample's untranslated
  placeholder was replaced with "Arabic"); they have not been reviewed by native speakers, and the set is not a
  particular state's required top-15 list.
- No NPI, tax ID, SSN or date of birth is printed. TTY 711 is the national relay number. Federal agencies
  (including the No Surprises Help Desk) are named without contact details.
- The ZIP codes are real Ohio ZIP codes (43066 is Radnor, 43617 is Toledo) paired with invented towns, streets
  and PO boxes, so no printed address is a real one ("Cottonwood Run" was searched: no such street in 43066).
- Member Services and the other insurer lines are local (614) numbers, because toll-free numbers cannot be made
  fictional; real EOBs usually print a toll-free number.
- The physician bills (emergency physician, radiologist) that would follow a real visit are mentioned but not
  included.

## Review

An independent review on 2026-10-11, after the first build. Everything below was rebuilt with `build.py`; the
full build passes (layout check on all 6 pages, `tools/verify.py` 412 checks, 0 failed).

### What was checked

- **Against real documents.** Ten public references the builder had not used (5 hospital statements, 4 EOB
  guides and the CMS surprise-billing model notice) plus a re-check of the X12 code list, listed as R1 to R11 in
  [RESEARCH.md](RESEARCH.md) section 5. Codes, revenue codes, descriptions, units, chargemaster prices, allowed
  amounts, dates (all business days; the claim number encodes the received date, day 264 of 2026), the IV
  coding (96374 initial push, 96375 sequential push, 96361 hydration after another initial service) and the OA-18
  choice all hold up.
- **Every number, independently.** A separate script (not reusing `build.py` or `verify.py`) parsed the rendered
  HTML and the PDF text, recomputed every line, column and page total in integer cents, both account summaries,
  the coupon, the scan line's check digit, the EOB cascade, 20% coinsurance after the deductible, the deductible
  order, the plan-year accumulators and the cross-document difference ($1,563.35 - $808.85 = $754.50 = $268.00 +
  $486.50 = the EOB's not-covered total), and compared every value with `ground-truth.json`: 285 checks, 0
  problems. Every money value printed on statement page 2 and EOB page 2 is accounted for.
- **The price check.** The backend's own `check_prices`, run with `PRICE_SOURCE=csv` on the ground-truth lines,
  returns exactly `expected_price_summary` (5 checked, 5 flagged, $7,188.00 billed against $484.98), with or
  without the modifier on 99284. Confirmed in the CSV: the only `facility` imaging rows are 70010 and 77469, so no
  ER imaging line can carry the doctor's-part case.
- **Every image.** All 6 PNGs and all 6 photos, before and after the changes, plus 300 dpi crops of the coupon, the
  EOB table header and the member box: no clipping, overlap or illegible text; the specimen line is present and
  faint on every page.
- **Hard rules.** Web searches for Linnet Valley, Pellridge, Pellridge Preferred / Pellridge Health Plan,
  Wellridge and Bellridge (near-matches), Brayford OH, Merrowfield OH, Quillmere and Cottonwood Run: no real
  hospital, insurer, plan or company uses them. Every phone number in the PDF text is (614) 555-01XX; no
  toll-free, SSN-like, NPI or tax ID number; every web address is on `.example`.

### What was changed

| Severity | Issue | Fix |
|---|---|---|
| Medium | The EOB had no surprise-billing (No Surprises Act) section, which federal law requires on each EOB for emergency services (CMS model notice instructions, R10); the statement had none either (hospitals give the notice when they request payment). | Added "Protection from surprise medical bills" to EOB page 3 (model-notice wording) and a shorter version with a notice URL to statement page 3. |
| Medium | The build's overflow guard could not work: each page is a fixed 11 in box with `overflow: hidden`, so text that no longer fits is clipped without adding a page, and the page count never changes. | `build.py` now measures every line of text in Chrome (`LAYOUT_PROBE`) and stops on clipped, overlapping or too-close-to-the-edge text, or a table cell narrower than its content. Tested by forcing an overflow and an over-wide number: both caught. |
| Low-Medium | EOB page 1 said "If you receive a bill for more than $808.85 for this visit", but the ER physician and radiologist bill separately for the same visit. | Now "If Linnet Valley Medical Center bills you more than $808.85 for this claim...", plus one sentence that doctors' claims get their own EOBs. |
| Low | The ER facility line (99284 billed with an IV push) had no modifier 25, which a billing reviewer expects on an emergency facility claim. | Added a Mod column to the itemized table (25 on line 13, `99284-25` on the EOB); `ground-truth.json` lines carry `modifier`. The duplicate panels carry no modifier 91, which makes the "exact duplicate" point visible. |
| Low | Phone numbers broke across lines in 6 places: "(614)" / "555-0143" in the statement's financial-assistance bullet and its Spanish, Russian and Polish notices, and "(614) 555-" / "0186" in the EOB's Russian and Polish notices. | `build.py` wraps every phone number in a no-wrap span. |
| Low | The EOB member box had no group (employer) name, a standard field on the Anthem and CMS samples. | Added "Group name: Quillmere Fabrication Co." (searched: not a real company); page-1 blocks moved down 0.2 in. |
| Low | The appeal section lacked the ERISA 502(a) civil-action sentence that employer-plan denial notices carry. | Added one sentence to "What happens next?". |
| Low | The statement had no account aging and no collections sentence, both on most real statements (R2, R5). | Added an account-aging row under the account summary (all $1,563.35 current) and one collections sentence (not before 120 days after the first statement); "Ways to pay" and the boxes below moved down slightly. "Keep this statement" was folded into "Questions and fraud" on the EOB, and two notices were shortened, to keep page 3 clear of the footer. |
| Low | This README called 99284's backend flag "doctor's part only"; the backend actually returns `far_above_typical` with the doctor's-fee note, and the voice layer turns that into doctor's part only. | Corrected the table and the explanation. |
| Low | `tools/verify.py` did not check the hard rules or the notices. | Added the phone, toll-free, SSN, NPI/TIN and web-address checks, the group name, aging, surprise-billing and ERISA checks (335 -> 412 checks). |
| Trivial | `build.py` computed an unused `card_boxes_html`. | Removed. |

`ground-truth.json` was regenerated by the build; new fields: `modifier` on every line, `account_aging`,
`collections`, `notices`, `surprise_billing_url`, `member.group_name`, `appeal.erisa_502a_civil_action`. All
amounts, the story and the expected findings are unchanged.

### Agreed with the builder, not changed

- OA-18 rather than the brief's CO-18 (confirmed on x12.org), and 99284 instead of an imaging line for the
  doctor's-part case (no ER imaging code has a `facility` row in the CSV).
- The CO-45-only posting on the statement, which leaves the OA-18 and CO-97 lines in the balance: real hospitals
  sometimes transfer denied lines to the patient by mistake, and the documents never claim the charge is illegal.

### Not fixed (known limits)

- Run through the real backend on 2026-10-11, by PDF and by phone photo, with no misreadings: see
  [VALIDATION.md](VALIDATION.md). Not yet tried in the app itself, or with real phone photos of printed copies.
- Member-facing EOBs usually print the insurer's own remark codes; these print X12 group and reason codes because
  the brief asks for them, with plain explanations.
- The 15 language notices are a common national set, not a particular state's required top-15 list (Ohio's list
  was not checked), and have not been reviewed by native speakers.
- ZIP codes are real; the insurer's numbers are local rather than toll-free (see Limitations).
