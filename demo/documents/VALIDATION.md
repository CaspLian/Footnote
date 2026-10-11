# Validation: the demo documents through Footnote's real backend

Run on 2026-10-11 against the real backend (Gemini, Snowflake price check, Tiger Data save, ElevenLabs voice).
The backend and app code were not changed, and the documents were not changed either: nothing was misread
because of their design, so step 4 (adjust, rebuild, re-run) was not needed. `ground-truth.json`, the PDFs, PNGs
and photos are exactly as built.

## Verdict

**Demo-ready, for both the laptop (PDF) and the phone (photo) path.** In every run, the backend read all 16
statement lines with the exact code, amount, date and description. It read every printed financial figure on
both documents exactly, classified every uploaded file correctly, and produced exactly the expected price check
(5 checked, 5 flagged). The duplicate panel and the uncoded supply charge were flagged in every run, and the
balance difference ($1,563.35 against $808.85) in every run that included the EOB. The ER level (99284) comes out
as "doctor's part only" in the live voice reading, and on the review screen as rebuilt from the app's code (the
app itself was not run).

The remaining problems are in the backend's model output and the app's wording, not in the documents (see
[Problems](#problems)). For the live demo, photograph **only pages 1 and 2 of each document**: in the test, 4
photos took 24.9 s with identical results, while 6 photos took 34.0 s. That is close to the backend's 40 s limit
for one Gemini attempt.

## How it was run

- **Backend:** `connect_check/serve_live_schema.py backend 8031 claimpulse_app_test`, as specified (keys read from
  `backend/.env` in memory, never printed), saving into the Tiger Data **test** schema `claimpulse_app_test`.
- **Which model answered:** the response's `model` field always names `GEMINI_MODEL`, even when the fallback
  model answers (`docs/API_CONTRACTS.md`). So the launcher was wrapped by a script in the session's temp folder
  that only adds one log line per outgoing HTTP request: model name and HTTP status, no key (the Gemini SDK sends
  the key in a header). The backend code itself was not touched.
- **Settings in effect:** `GEMINI_MODEL=gemini-3.5-flash`, `GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite`, thinking
  level `low` and the default media resolution (backend defaults), 40 s per Gemini attempt (default
  `GEMINI_ATTEMPT_TIMEOUT_S`), Snowflake price table preloaded at startup (`price_summary.source` was `snowflake` in
  every run).
- **Request:** `POST /api/v1/analyze` with each file as a repeated `files` part in upload order (as the app sends
  them) and `target_language=en-US`. The statement always went first.
- **Timing:** wall clock in the client, from sending the request to receiving the whole response, on the same
  computer (so upload time is negligible). One measurement per run, so expect some variation.
- **Comparison:** each response against `ground-truth.json`: classification per file, the 16 lines (matched one to
  one by code and amount), the 14 `financials` fields plus 4 top-level fields, `documents_match`, every price check,
  and what the summaries and questions mention. The review screen's "Questions worth asking" list was rebuilt
  from each response with the app's own rules (`mobile/src/services/backend-mapping.ts` `reviewFindings`,
  `finding-copy.ts`), using the backend's free `GET /api/v1/benchmarks/{code}` route. The voice text came from
  `POST /api/v1/voice/speak` on the saved analyses.

In addition to the three required runs, three supplementary runs were made:
- **b4:** the 4 photos that carry the story (statement and EOB pages 1 and 2).
- **a-lite and b-lite:** the same uploads as runs a and b, answered by the fallback model. The backend was
  restarted with `GEMINI_MODEL=gemini-3.5-flash-lite` set in its environment, so the run shows what the app gets
  when the main model is rate limited. It was then restarted with the normal settings for b4.

## Results per run

Every Gemini call returned `200 OK` on the first attempt: no 429, no retry, no fallback.

| Run | Sent, in order | Size | Answered by | Time | Files classified | Lines matched | Line fields exact (code, amount, date, description) | Financial fields exact | Top-level fields exact | Price lines as expected | `documents_match` |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---|
| **a** | bill PDF, EOB PDF | 1.39 MiB | gemini-3.5-flash | **15.4 s** | 2/2 | 16/16 | 64/64 | 13/14 | 4/4 | 16/16 | false (expected true) |
| **b** | 6 photos: bill p1-3, EOB p1-3 | 11.95 MiB | gemini-3.5-flash | **34.0 s** | 6/6 | 16/16 | 64/64 | 13/14 | 4/4 | 16/16 | true |
| **c** | bill PDF alone | 0.34 MiB | gemini-3.5-flash | **12.3 s** | 1/1 | 16/16 | 64/64 | 13/14 | 4/4 | 16/16 | null (expected null) |
| b4 | 4 photos: bill p1-2, EOB p1-2 | 7.47 MiB | gemini-3.5-flash | 24.9 s | 4/4 | 16/16 | 64/64 | 13/14 | 4/4 | 16/16 | false |
| a-lite | as run a | 1.39 MiB | gemini-3.5-flash-lite | 11.4 s | 2/2 | 16/16 | 64/64 | 13/14 | 4/4 | 16/16 | false |
| b-lite | as run b | 11.95 MiB | gemini-3.5-flash-lite | 15.5 s | 6/6 | 16/16 | 64/64 | 13/14 | 4/4 | 16/16 | false |

**Totals for the three required runs:**
- files classified: 9/9
- lines matched: 48/48; line fields exact: 192/192
- financial fields: 39/42. All 3 misses are the same derived subtotal (below); **no printed amount was wrong**.
- top-level fields: 12/12
- price checks: 48/48 lines and 3/3 summaries as expected
- `documents_match`: 2/3 as expected

**Including the supplementary runs:** 96/96 lines, 384/384 line fields, 78/84 financial fields (6 misses, all the
derived subtotal), 21/21 files.

The one financial field that is never exact is `after_bill_adjustments`. Gemini returns 3,255.05 (9,149.50 -
5,894.45), which the statement does not print, so the ground truth expects `null`. The value is arithmetically
right, and the app computes the same subtotal itself when the field is missing, so nothing changes on screen.

Source pages:
- PDF runs: every line on page 2 (16/16), except one line in a-lite (bill line 15) on page 5 of the 3-page PDF.
- Photo runs: Gemini reported the printed page number (2) instead of the page within the uploaded file (1, as
  `docs/API_CONTRACTS.md` defines `source_page`). The file index was right (photo 2) in every photo run.

Every analysis was saved (`audit.saved: true`) in the test schema; the voice route loaded runs a and b back from
it:
- a: `4caed0f7-3cf9-4b57-84eb-dcf77253e751`
- b: `f44393ef-7e49-4000-b54f-49927d06a1dc`
- c: `40029e6c-6780-4094-9406-1fa039da7c2d`
- b4: `94616429-d828-4717-992e-776547e15ea0`
- a-lite: `21368c66-30c0-4948-b1fd-bfe9d7a4dc5a`
- b-lite: `71ecad0c-408c-47fc-875e-e66055b13b66`

### Classification

Every file got the right type: the bill PDF and every statement photo were `hospital_bill`, and the EOB PDF and
every EOB photo were `eob`. The overall `document_type` was `hospital_bill` each time (a bill was present).

### Line items (identical in all six runs)

All 16 statement lines came back, in printed order: no EOB lines mixed in, no total rows, no extra lines.

- Both 80053 lines were kept as two separate lines.
- The supply line's code is `null`, as printed.
- Line 13's code is `99284`. The modifier (25) has no field in `LineItem` and is not needed by the price check.

`document_index` was correct in every run: file 1 for the PDFs, file 2 (statement page 2) for the photos.

### Financials

| Field | Expected | Returned (all runs) |
|---|---:|---|
| `statement_billed` | 9,149.50 | exact |
| `bill_adjustments` | 5,894.45 | exact |
| `after_bill_adjustments` | null (not printed) | 3,255.05, derived |
| `statement_insurer_paid` | 1,691.70 | exact |
| `prior_patient_payment` | 0.00 (printed) | exact |
| `statement_balance` | 1,563.35 | exact |
| `eob_billed` | 9,149.50 | exact (run c: null, as expected) |
| `eob_allowed` | 2,500.55 | exact (run c: null) |
| `eob_insurer_paid` | 1,691.70 | exact (run c: null) |
| `eob_patient_responsibility` | 808.85 | exact (run c: null) |
| `deductible` | 320.00 | exact (run c: null) |
| `coinsurance` | 238.85 | exact (run c: null) |
| `copayment` | 250.00 | exact (run c: null) |
| `copay_coinsurance` | null | exact (null) |
| `provider_name` | Linnet Valley Medical Center | exact |
| `total_billed` | 9,149.50 | exact |
| `amount_patient_owes` | 1,563.35 (statement balance) | exact |
| `due_date` | 2026-11-02 | exact |

From the app's code, the review screen then shows Statement balance $1,563.35, EOB responsibility $808.85, Prior
payment $0.00, and Calculated remaining $1,563.35 (from the statement's own adjustments and payments).

### Cross-document check

`documents_match` was false in 4 of the 5 runs with an EOB (a, b4, a-lite, b-lite), and true only in b. The ground
truth says true: the two documents cover the same claim. All five runs, b included, wrote a mismatch reason about
the balance. So Gemini treats the balance difference as a "mismatch", even though the provider, date, account
number (5002611873), the 16 services, the billed total, the payment and the adjustment all agree.

The reasons:
- **a:** the EOB says $808.85 but the bill asks for $1,563.35, because "the hospital billed you for items the
  insurance plan marked as not covered or fully written off". The amounts are written in words.
- **b:** "The bill did not write off $754.50 in non-covered and duplicate charges that your insurance plan marked
  as not owed by you."
- **b4:** "The bill appears to include $754.50 in charges for duplicate testing and medical supplies that the
  insurance company marked as non-payable write-offs."
- **a-lite and b-lite:** only that the two amounts differ, without naming the cause.

## Price check

The result was identical in every run, and exactly `expected_price_summary`: source `snowflake`, 5 checked,
5 flagged, $7,188.00 billed against $484.98 Medicare.

| Bill line | Code | Billed | Medicare rate | Setting | Times | Flag |
|---|---|---:|---:|---|---:|---|
| 2 | 96374 IV push, first drug | 486.00 | 37.74 | non-facility | 12.9 | `far_above_typical` |
| 3 | 96375 IV push, additional drug | 214.00 | 15.70 | non-facility | 13.6 | `far_above_typical` |
| 4 | 96361 IV hydration, additional hour | 158.00 | 13.03 | non-facility | 12.1 | `far_above_typical` |
| 12 | 74177 CT abdomen and pelvis | 4,182.00 | 300.27 | non-facility | 13.9 | `far_above_typical` |
| 13 | 99284 ER level 4 | 2,148.00 | 118.24 | **facility** (doctor's part) | 18.2 | `far_above_typical`, with the note "Medicare's rate here covers only the doctor's fee" |
| 5 | none (supplies) | 486.50 | - | - | - | `no_code` |
| 1, 6-11, 14-16 | J7030, 36415, 80053 (x2), 83690, 85025, 81003, J2405, J2270, Q9967 | - | none | - | - | `no_benchmark` |

### How the app presents it

**Review screen, "Questions worth asking".** Rebuilt from run a with the app's rules. Run c gives the same eight
items; b, b4, a-lite and b-lite give the same items without the line 7 note. The notes are in Gemini's own words,
which differ from run to run:

1. HC IV PUSH SINGLE/INITIAL DRUG is billed at about 13 times Medicare's rate. Question: "Can you explain how the
   charge for code 96374 was priced, and send an itemized statement?"
2. HC IV PUSH EA ADDL SEQ NEW DRUG is billed at about 14 times Medicare's rate (96375, same question).
3. HC IV HYDRATION EA ADDL HOUR is billed at about 12 times Medicare's rate (96361).
4. "Vague fee without a medical code. Insurance listed this as not covered." Question: "Can you explain this line
   on my statement: "2026-09-14 · HC MED/SURG SUPPLIES MISC · $486.50"?"
5. "Possible duplicate charge listed twice on the bill." (line 7, 80053, $268.00)
6. "Possible duplicate charge. Insurance denied this second line as an exact duplicate." (line 8)
7. HC CT ABD & PELVIS W/CONTRAST is billed at about 14 times Medicare's rate (74177).
8. **HC ED FACILITY LEVEL 4: Medicare's reference covers only the doctor's part.** Question: "Can you separate
   the doctor's charge and the hospital's charge for code 99284 on an itemized statement?" This is the "clarify
   the doctor's fee" behavior: no ratio is shown, and the hospital charge is not called high.

**The voice.** `POST /api/v1/voice/speak` worked for runs a and b: 3.4 s and 2.6 s, voice Matilda, MP3 of
1.16 MB and 1.27 MB. After Gemini's spoken summary, the voice says (run a; run b names the IV line in other
words):

> I also compared the charges with Medicare's national rates. CT scan of belly and pelvis with contrast dye was
> billed about 13.9 times Medicare's national rate. Additional IV medicine injection was billed about 13.6 times
> Medicare's national rate. 2 other charges also have a difference worth asking about. Medicare's rates are a
> reference, not proof of an error or a fair hospital price. For 1 charge, Medicare's reference covers only the
> doctor's part. The hospital's part is not included, so this cannot show whether those charges are high. Ask the
> billing office for an itemized explanation. It's worth asking the billing office about them.

## Findings the app produced

Where each teaching point showed up:

| Run | Duplicate 80053 | Supply line, no code, $486.50 | Balance $1,563.35 vs $808.85 |
|---|---|---|---|
| a | notes on lines 7 and 8; a question; both summaries | note on line 5; a question naming CO-97; plain summary | both summaries, a question, the mismatch reason. Cause named ("duplicate and non-covered items"); $754.50 not stated |
| b | note on line 8; a question; both summaries; the reason | note on line 5; plain summary ("bundled supplies") | **$754.50** stated in both summaries, a question and the reason; cause named |
| c | notes on lines 7 and 8; a question | note on line 5; a question | needs the EOB. Its question asks whether the EOB matches the $1,563.35 balance |
| b4 | note on line 8; a question; plain summary; the reason | note on line 5; a question; plain summary; the reason | **$754.50** in the reason; cause named in the summary and questions |
| a-lite | note on line 8; a question | note on line 5 only ("Vague fee without a specific code") | both amounts; cause not named |
| b-lite | note on line 8; a question ("two identical charges") | note on line 5; a question | says the amounts differ; cause not named |

The questions Gemini suggested match `expected_findings` closely. **Run a:**
- "Why does this bill ask for $1,563.35 when my insurance explanation shows I only owe $808.85?"
- "Why was I billed twice for the comprehensive metabolic panel test on September 14, 2026?"
- "Can you remove the $486.50 charge for miscellaneous supplies that my insurance marked as non-covered under code
  CO-97?"

**Run b:**
- "Why does my bill state I owe $1,563.35 when my insurance Explanation of Benefits shows my patient
  responsibility is only $808.85?"
- "Can you please adjust my account balance to credit the $754.50 in non-covered and duplicate charges (codes CO-97
  and OA-18) identified by my insurer?"
- "Why was a duplicate charge for a comprehensive metabolic panel billed twice on my itemized statement?"

**Run c (bill only):**
- Was the 80053 test "actually performed twice, or is one charge a duplicate?"
- "a detailed breakdown for the $486.50 charge"
- "Can you verify if my Explanation of Benefits from Pellridge Health Plan matches the $1,563.35 balance"

Its plain summary also mentions that the emergency physician and radiologist bill separately.

## Problems

None of these comes from the documents. The owner is named in each item.

1. **A "you do not owe" claim, and an unhedged claim of error (backend prompt; medium).**
   - Run b's on-screen summary says the $754.50 is charges "that you do not owe". The app must never claim the
     patient does not owe money.
   - Run b's spoken summary says "The hospital forgot to remove seven hundred fifty-four dollars and fifty cents".
     The voice reads it aloud (see `validation/run-b-photos.speech.json`); it states an error with no hedge.
   - The other runs hedge ("may have billed you ... by mistake", "appears to").

   Gemini is echoing the EOB's own "You do not owe this amount", which is standard EOB wording, so the fix belongs
   in `SYSTEM_PROMPT` (`backend/services/gemini_services/gemini_service.py`) or a check on the output. It was not
   changed here.
2. **"Check that these documents belong together" over matching documents (app wording, plus the model's
   semantics; low to medium).**
   - Every run with an EOB returned a mismatch reason (the balance difference), and the review screen shows any
     reason under that heading. Judges will see it above an explanation of the $754.50 difference.
   - `documents_match` itself is used only for the "Calculated remaining" fallback, which these documents do not
     need, so its false values change nothing else on screen.

   The documents could avoid this only by dropping the balance difference, which is the point of the demo.
3. **Photo timing (live-demo risk; medium).**
   - The 6-photo Gemini call took about 34 s, against a 40 s limit per attempt. A slower answer would be
     cancelled and retried, then handed to the fallback model, which could take about 100 s in all (the app waits
     up to 180 s).
   - The 4 key-page photos took 24.9 s with identical results. Page 3 of each document carries only notices.
   - Raising `GEMINI_ATTEMPT_TIMEOUT_S` would be a configuration choice for the team.
4. **Upload size (low to medium).** The 6 synthetic photos total 11.95 MiB of the 15 MiB combined limit, and the
   app refuses larger uploads before sending. Real phone photos at the camera screen's quality (0.85) can be
   larger than these 2 MB synthetic ones. Four pages leave room.
5. **The fallback model explains less (low, only when the main model is rate limited).**
   - Extraction was identical, but the narrative does not connect the $754.50 to the duplicate and the supplies.
   - Its on-screen summary and questions write amounts in words ("one thousand five hundred sixty-three
     dollars...").
   - One line in a-lite was put on page 5 of a 3-page PDF.
6. **Page numbers for photos (cosmetic).** Each one-page photo is reported as page 2 (the printed page number).
   The right photo still opens, but the evidence label says "page 2".
7. **The raw price note for 99284 (information only).** It still starts "Far above typical; ask for a review or a
   discount", before the doctor's-fee sentence (`snowflake_service._compare`). The review screen and the voice
   replace it with the doctor's-part wording, so users do not see it; another client showing raw notes would.
8. **Gemini quota (information only).** These runs used 4 main-model requests (a, b, c, b4) and 2 fallback
   requests. If the key is still on the free tier (the team saw about 20 main-model requests a day on 2026-10-10),
   plan the live analyses accordingly.

## For the live demo

- **Laptop:** upload `out/itemized-bill.pdf` and `out/eob.pdf` together (15.4 s).
- **Phone:** photograph statement pages 1 and 2, then EOB pages 1 and 2 (24.9 s with the synthetic photos). Print
  at 100% as the README says.
- Be ready to explain the "Check that these documents belong together" box: it is the app noticing that the bill
  asks for $754.50 more than the EOB allows.

## Files

`validation/`, all synthetic:

| File | Contents |
|---|---|
| `run-a-pdfs.json`, `run-b-photos.json`, `run-c-bill-pdf.json` | The raw `/api/v1/analyze` responses of the three required runs |
| `run-b4-photos-key-pages.json`, `run-a-pdfs-flash-lite.json`, `run-b-photos-flash-lite.json` | The supplementary runs |
| `*.meta.json` | Per run: files sent in order with sizes, start time, end-to-end seconds, HTTP status, the Gemini calls seen in the server log, and the model that answered |
| `run-a-pdfs.speech.json`, `run-b-photos.speech.json` | `POST /api/v1/voice/speak` results: the exact spoken text, voice, time and audio size |
| `comparison.json` | Every check above, per run and per line, plus the rebuilt review-screen findings and the benchmark-route answers |

To repeat a run with a backend on port 8031:

```sh
curl -F files=@demo/documents/out/itemized-bill.pdf -F files=@demo/documents/out/eob.pdf \
     -F target_language=en-US http://127.0.0.1:8031/api/v1/analyze
```
