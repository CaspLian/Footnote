# API contracts

The HTTP contract the backend exposes today, checked on 2026-10-10 against the code on `Backend-Frontend-Connection-V1`
(the backend from `d1753db`, the null-text fix and the benchmark route) and against the real server (`uvicorn main:app`, every live service) over HTTP.
If the code and this file disagree, the code wins: fix this file in the same change.

**Executable schema.** Run the backend (`cd backend && python dev_console.py`) and open
http://127.0.0.1:8770/docs (interactive) or http://127.0.0.1:8770/openapi.json (OpenAPI 3.1). Both are generated
from the code. The models are defined in `backend/models.py` and `backend/services/audio_service/voice_routes.py`.

## Conventions

- **Base URL:** `http://127.0.0.1:8770` with the developer console. The console serves only this computer: it
  listens on 127.0.0.1 and refuses other host names.
- **From a phone** on the same private Wi-Fi (not yet tried from a phone):
  1. Run `cd backend && uvicorn main:app --host 0.0.0.0 --port 8000`. Without `--host 0.0.0.0`, uvicorn answers
     only the computer it runs on.
  2. In Windows settings, set the Wi-Fi network to **Private**, and allow Python through Windows Defender Firewall
     on **private networks only** (Windows asks the first time). On 2026-10-10 the network was Public, and the
     firewall blocked every incoming connection.
  3. Find the computer's IPv4 address with `ipconfig`, and use `http://<that address>:8000` in the app.

  There is no authentication, so never allow it on a public network.
- **Requests:** form fields. Uploads use `multipart/form-data`; in JavaScript, send a `FormData` and do not set
  `Content-Type` yourself. In React Native, append files as `{uri, name, type}`: a part without a file name is
  ignored, and `type` must be the exact type, such as the picker's `mimeType` (`image/jpg` is refused).
- **Responses:** JSON, except the audio routes.
- **No authentication.** CORS allows every origin (`backend/main.py`).
- **Error bodies come in three shapes:**
  - `{"detail": "text"}` from `main.py`, and from `GET /api/v1/voice/audio/{id}` while the audio is still being
    made
  - `{"detail": {"stage": ..., "message": ..., ...}}` from the voice routes
  - FastAPI's `{"detail": [ ... ]}` list for a missing or malformed field (HTTP 422)

## Routes

| Method and path | Purpose | Code |
|---|---|---|
| `GET /` | Health: `{"message", "mock", "model"}` | `main.py` |
| `GET /api/v1/languages` | The 12 answer languages: `{"en": "English", "es": "Spanish", ...}` | `main.py`, `LANGUAGES` in `gemini_service.py` |
| `POST /api/v1/analyze` | A bill and/or text → analysis, price check, saved record | `main.py` |
| `GET /api/v1/audits/{audit_id}` | A saved analysis, exactly as it was returned | `main.py`, `analysis_store.py` |
| `GET /api/v1/benchmarks/{cpt_code}` | Medicare's national rate for one code, for the app's price comparison | `main.py`, `snowflake_service.py` |
| `POST /api/v1/claims` | Record a confirmed bill as a claim in Tiger Data; its timeline starts | `claim_routes.py`, `tigerdata_service.py` |
| `GET /api/v1/claims/{claim_id}` | A claim with its lines, deadlines, countdowns and timeline | `claim_routes.py` |
| `POST /api/v1/claims/{claim_id}/status`, `/deadlines`, `/resolve`, `/actions` | The claim's next steps (status and deadlines also accept `PATCH`) | `claim_routes.py` |
| `POST /api/v1/analyze-image` | One bill photo -> its dates and lines -> a claim with estimated deadlines (the Tiger Data flow) | `claim_routes.py`, `gemini_services/bill_image.py` |
| `POST /api/v1/voice/analyze` | A recorded question (+ optional bill) → transcript, analysis, spoken reply | `voice_routes.py` |
| `POST /api/v1/voice/speak` | Speak a saved analysis again, without calling Gemini | `voice_routes.py` |
| `GET /api/v1/voice/audio/{audio_id}` | The reply audio (MP3) | `voice_routes.py`, `audio_http.py` |
| `GET /api/v1/voice/voices` | Voices for a picker: `{"default": "matilda", "voices": [{key, name, description, accent, gender}]}` (20) | `voice_routes.py`, `text_to_speech/voices.json` |
| `GET /api/v1/voice/voices/{voice_key}/sample` | A short MP3 sample of one voice | `voice_routes.py` |

### `POST /api/v1/analyze`

| Field | Required | Format |
|---|---|---|
| `file` | no | One JPEG, PNG, WEBP, HEIC, HEIF or PDF; retained for single-file clients |
| `files` | no | Repeat this multipart field for ordered bill pages. At most 10 uploads total across `file` and `files` |
| `text` | one of `file` / `files` / `text` | A question or bill text; may accompany uploaded pages |
| `target_language` | no (`en`) | A code from `/api/v1/languages` (not validated: other text is passed to Gemini as is) |

The backend sends uploaded files to Gemini together in multipart order, so camera photos of a multi-page bill are
read as one document. The combined upload limit is 15 MB. Returns `AnalyzeResponse` (below). Errors, with a text
`detail`:
- 400: nothing sent, more than 10 uploaded pages, or an unsupported file type
- 413: combined uploads over 15 MB
- 422: malformed form
- 502: the Gemini step failed (key, quota, network, unusable output)
- 504: Gemini took longer than 150 s

Saving never causes an error; `audit` reports the outcome:
- **Not saved:** without `TIGER_DATA_POSTGRES_URL`, or when Tiger Data is down, `audit.saved` is false,
  `audit.audit_id` is null and `audit.error` says why.
- **Tiger Data unreachable:** one request waits for the connection to time out (5 s per address). Saving is then
  skipped for 30 s ("could not be reached a moment ago") instead of every request waiting again.
- **Slow save:** a save that takes over 15 s is reported as not saved and rolled back. Rarely, one that is
  already committing still commits: a known issue (`docs/handoffs/backend-follow-ups.md`).

### `GET /api/v1/audits/{audit_id}`

Returns `{"audit_id", "created_at", "source", "transcript", "analysis"}`:
- `created_at`: an ISO 8601 string
- `source`: `"text"`, `"file"` or `"voice"`
- `transcript`: the spoken question, or `null`
- `analysis`: the `AnalyzeResponse` exactly as first returned, with `audit.saved: true`

Errors, with a text `detail`:
- 400: not a UUID
- 404: no such analysis
- 503: Tiger Data not configured, not reachable, or paused for 30 s after a failed connection

### `GET /api/v1/benchmarks/{cpt_code}`

Free: no Gemini call. The app uses it for the codes the user confirmed or corrected. Returns
`{"cpt_code", "medicare_rate", "medicare_description", "setting", "source", "error"}`:
- `cpt_code`: normalised like the price check (the first 5 letters or digits)
- `medicare_rate`: dollars, or `null` when the code has no rate (never 0)
- `setting`: `facility` (only the doctor's part of a hospital service) or `non-facility`
- `source`: `snowflake`, `local_csv` or `unavailable`; after a cached lookup it can wrongly say `snowflake`
- `error`: `null`, or a short note when Snowflake failed and the CSV answered

Errors: 400 when the text holds fewer than 5 letters or digits.

### The claim workflow: `/api/v1/claims`

The Tiger Data claim lifecycle (`backend/claim_routes.py`, over `services/tigerdata_services/tigerdata_service.py`).
JSON bodies:
- `POST /api/v1/claims`:
  - `items` (required, at least one): `[{code, description, amount}]`, all three on every line
  - `provider_name`, `service_date`, `bill_received_date`, `payment_due_date` (all `YYYY-MM-DD`), `total_billed`,
    `analysis_audit_id` (stored as `claim_id`), and `region` (for the team's regional benchmarks): optional
  - Deadlines are estimated from the bill's own dates (`tigerdata_services/timeline.py`). A credit-report warning
    is 180 days after `service_date`, and a collection date 120 days after `bill_received_date`. A missing date gives
    no estimate. `collection_deadline_is_estimate` and `credit_warning_date_is_estimate` say which dates are estimates.

  Returns `{audit_id, claim_id, region, total_billed, overcharge_total, items, recorded}`. `audit_id` is the claim's
  ID in the other routes.
- `POST` or `PATCH` `/{claim_id}/status`: `{status}`, either `audit_complete` or `dispute_in_progress`, plus
  optional `note` and `details`.
- `POST` or `PATCH` `/{claim_id}/deadlines`: `{collection_deadline?, credit_warning_date?}`. At least one is
  required, and dates cannot be cleared. A date set here is the user's, and is no longer an estimate.
- `POST /{claim_id}/actions`: `{action, note?}`, for example `{"action": "Called provider"}`. It is added to the
  timeline (201).
- `POST /{claim_id}/resolve`: `{final_amount}`, in dollars. The status becomes `resolved`, the savings are computed,
  and the countdowns stop.
- `GET /{claim_id}`: the claim, its `items`, `status`, deadlines with days remaining, and `events` (the timeline).

Errors, with a text `detail`:
- 400: not a UUID, or rejected by the service (for example, no deadline)
- 404: no such claim
- 422: malformed body
- 503: Tiger Data not configured or not reachable; the address is never echoed

How the app uses it (`mobile/src/services/claim-tracker.ts`, from the store):

| When the user... | The app sends |
|---|---|
| confirms a case for the first time | `POST /api/v1/claims` (recording marks the audit complete) |
| confirms it again after edits | nothing: the same claim keeps its status (a dispute is never moved back) |
| marks a request submitted | status `dispute_in_progress` |
| sets a notice date | `deadlines` with `collection_deadline` |
| marks the case resolved | `resolve` with the confirmed statement balance |
| sets or removes a follow-up reminder, prepares a request, or removes a notice date | `actions` |

The review sends `service_date` and Gemini's `payment_due_date`, then reads the claim back. The case timeline
shows the estimated deadlines, labeled as estimates. The full analysis does not read a "bill received" date, so
the collection estimate appears only from `POST /api/v1/analyze-image` or a confirmed notice date.

`POST /api/v1/analyze-image` (`file`: a JPEG, PNG or WebP of up to 15 MB) returns `{extracted_bill, audit}`:
- Only lines with a code, a description and an amount are recorded. `extracted_bill` keeps every line.
- Errors: 415 for another type, 413 for an empty or oversized image, 422 when nothing is recordable, 503 when
  Gemini or Tiger Data are unavailable.
- It is not the app's analysis. `POST /api/v1/analyze` stays the full analysis.

Some limits:
- Only lines with a code, a description and an amount are recorded. The total is the confirmed bill total.
- The app has no field for a final settled amount yet, so the resolution sends the statement balance at that
  moment. The service's "savings" figure (billed minus final) is an approximation, and the app does not show it.
- `overcharge_total` uses the team's regional benchmark table and is not shown either: a difference is not proof of
  overcharging.
- Failures never reach the user. The claim is a side record, and the app's own case stays complete.

### `POST /api/v1/voice/analyze`

| Field | Required | Format |
|---|---|---|
| `audio` | yes | The recording. m4a, 3gp, webm, mp3, wav, ogg, flac, aac, aiff or amr, recognised from the bytes (other uploads sent as `audio/*` or `video/*` go to ElevenLabs to decide); at least 1,000 bytes; at most `STT_MAX_AUDIO_MB` (default 10 MB) |
| `file` | no | A bill, as for `/api/v1/analyze` |
| `target_language` | no (`en`) | As above. Phone locales such as `en-US` are accepted; speech-to-text receives `en` |
| `message_id` | no | Your ID for this message; one is generated if missing |
| `speak_reply` | no (`true`) | `false` skips the reply audio |
| `voice` | no | A `key` from `/api/v1/voice/voices`; the default voice if missing |
| `stream_reply` | no (`false`) | Answer at the first reply audio and stream the rest. Faster, but untested on iPhones |

The bill and the recording size are checked before speech-to-text is called, so a refused request costs nothing.

Returns `{"transcript": Transcript, "analysis": AnalyzeResponse, "speech": Speech}`. Show `transcript.text` when
`transcript.needs_confirmation` is true.

Errors carry `{"detail": {"stage", "message", "error_code"?, "retryable"?}}`:

| Status | Stage | When |
|---|---|---|
| 413 | `upload` / `speech_to_text` | Bill over 15 MB, or recording over `STT_MAX_AUDIO_MB` |
| 400 | `gemini` | Unsupported bill type, or other input Gemini refuses |
| 422 | `speech_to_text` | `NO_SPEECH`, `EMPTY_AUDIO`, `UNSUPPORTED_AUDIO` or `INVALID_REQUEST`: ask the user to try again. A missing `audio` field gives FastAPI's list instead |
| 503 | `speech_to_text` | ElevenLabs temporarily unavailable (`retryable: true`) |
| 502 | `speech_to_text` / `gemini` | Key, permission or quota problem, or the Gemini step failed |
| 504 | `gemini` | Gemini took too long |

A failed reply voice never fails the request. In that case `speech.ok` is false and `speech.error_code` says why.
For example, `INVALID_REQUEST` comes back for a language other than English, or for an unknown `voice`, and then
the message lists the valid keys. The voice route saves while it makes the reply audio, so a healthy save adds
nothing to the wait.

### `POST /api/v1/voice/speak`

Form fields:
- `audit_id`: required; `analysis.audit.audit_id` from either analyze route
- `voice`: optional, as above
- `stream_reply`: optional, as above

Returns `Speech`, with HTTP 200 even when the voice failed: check `speech.ok`. Asking early and again later is safe:
an identical request joins the generation under way, and a finished clip comes back from the cache in about 0.25 s.
The app prepares each reading this way (`docs/decisions/2026-10-10-voice-prepared-early.md`). It speaks only saved analyses,
never text sent to it. Each voice is its own paid clip; the same
text in the same voice comes from the cache, free.

Errors carry `detail.stage = "audit"`:
- 400: not a UUID
- 404: no such analysis
- 409: saved in an older format that no longer validates
- 503: Tiger Data unavailable

### Audio delivery: `GET /api/v1/voice/audio/{audio_id}` and `/voices/{key}/sample`

- **Format:** `audio/mpeg`, MP3 at 44.1 kHz and 128 kbps by default (`ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128`).
- **Finished audio:**
  - Supports byte ranges (`206` for a range, `416` for a range that cannot be satisfied, `Accept-Ranges: bytes`),
    which iPhones need.
  - Reply audio is sent with `Cache-Control: private, max-age=31536000, immutable`; samples with `public,
    max-age=86400`.
- **Audio still being made** (`stream_reply=true`): streamed as it arrives, with `Cache-Control: no-store`; ranges
  are ignored.
- **Where audio lives:**
  - Finished reply audio is kept in `backend/services/audio_service/.tts_cache/` by default (`TTS_CACHE_DIR`), so
    its URL keeps working after a restart.
  - Audio still being made exists only in the server process making it, so run one process when streaming.
- **Methods:** `GET` only; `HEAD` gives 405. The OpenAPI schema lists these routes as JSON, but they send audio.
- **Samples:** each voice's sample ("Hi, I'm Bunty. I can read your medical bill explanations out loud.") is made
  once, for about 15 credits (Flash v2.5, the default), then served from the cache.
- **Errors:**
  - Unknown or unsafe IDs give 404.
  - Audio still being made answers in the text shape:
    - 404 `{"detail": "Audio not found."}` if the job ended with no audio
    - 503 `{"detail": "The audio could not be made: ..."}` if it failed before the first audio
    - if it fails part-way, the connection is cut
  - Samples: unknown voice 404; text-to-speech failure 503 (retryable) or 502; broken `voices.json` 500.

## Models

`AnalyzeResponse` (`backend/models.py`):

| Field | Type | Notes |
|---|---|---|
| `target_language` | string | As requested |
| `model` | string | `GEMINI_MODEL` (names the primary model even when the fallback answered) |
| `mock` | bool | `true` when `MOCK=true`: the result is the fixed sample |
| `result` | `GeminiResult` | See below |
| `price_checks` | `PriceCheck[]` | One per line item, in order. Empty when `price_summary.source` is `unavailable` |
| `price_summary` | `PriceSummary` or null | Totals of the price check |
| `audit` | `AuditInfo` or null | Whether the analysis was saved |

`GeminiResult`:
- `document_type`: one of `hospital_bill`, `eob`, `insurance_policy`, `pharmacy_receipt` or `other` (as instructed,
  not enforced)
- `provider_name`, `total_billed`, `amount_patient_owes`, `due_date` (`YYYY-MM-DD`): each `null` when not shown
- `line_items`: a list of `LineItem`
- `plain_summary`: a 3–6 sentence explanation
- `spoken_summary`: under 90 words, written for reading aloud
- `questions_to_ask`: 2–4 questions

All text is in `target_language`.

`LineItem`:
- `cpt_code`: string or null
- `original_description`: text exactly as printed
- `plain_description`
- `billed_amount`: number or null
- `date_of_service`: `YYYY-MM-DD` or null
- `source_page`: 1-based upload page when Gemini can identify it, otherwise null
- `possible_issues`: a list of strings

`PriceCheck`:
- `line_index`: the position in `line_items`
- `cpt_code`, `billed_amount`
- `medicare_rate`, `medicare_description`, `times_medicare` (rounded to 0.1): each null when unknown
- `flag`: one of `typical` (up to 3×), `above_typical` (over 3× and up to 6×), `far_above_typical` (over 6×),
  `no_code`, `no_benchmark` or `no_amount`
- `note`: plain-English text

Missing values are null and flagged, never zero. Placeholder texts that Gemini sometimes writes instead of
null (`"null"`, `"none"`, `"n/a"`, empty) become null in `cpt_code`, `date_of_service`, `provider_name` and
`due_date`.

`PriceSummary`:
- `source`: `snowflake`, `local_csv` or `unavailable`. On repeat lookups it can wrongly say `snowflake`: a known
  bug.
- `items_checked`, `items_flagged`
- `billed_total_checked`, `medicare_total_checked`: in dollars
- `error`: string or null

When `source` is `unavailable`, or `items_checked` is 0, the counts and totals are 0 and mean "not checked",
never "no difference". Show "price check unavailable".

`AuditInfo`:
- `saved`: bool
- `audit_id`: a UUID string, or null when not saved
- `error`: why it was not saved, or null

`Transcript` (`voice_routes.py`):
- `text`
- `language`: the 3-letter code speech-to-text reports, such as `eng`
- `confidence`: 0 to 1, or null
- `needs_confirmation`: bool
- `audio_seconds`

`Speech` (`voice_routes.py`):
- `ok`
- `audio_url`: a relative path; prefix it with the base URL
- `mime_type`
- `voice`: the key of the voice used
- `streaming`
- `text`: exactly what the voice says, for captions; the spoken summary plus the price sentences
- `error_code`, `error_message`

## Database tables behind the responses

`services/analytical_services/analysis_store.py` creates the tables below on first use. When reading back,
`GET /api/v1/audits/{id}` returns the stored JSON copy. The other columns exist for queries.

| Table.column | Comes from |
|---|---|
| `bill_analyses.audit_id` | `audit.audit_id` (UUID, primary key) |
| `bill_analyses.source`, `transcript` | which route saved it; the spoken question |
| `bill_analyses.target_language`, `model`, `mock` | the same response fields |
| `bill_analyses.document_type`, `provider_name`, `total_billed`, `amount_patient_owes` | `result.*` |
| `bill_analyses.price_source`, `items_checked`, `items_flagged` | `price_summary.*` |
| `bill_analyses.analysis` (JSONB) | the whole response without `audit` |
| `bill_analysis_lines.(audit_id, position)` | one row per `result.line_items[position]` |
| `bill_analysis_lines.cpt_code`, `description`, `billed_amount` | the line item (`description` = `original_description`) |
| `bill_analysis_lines.medicare_rate`, `times_medicare`, `flag` | the `price_checks` entry with `line_index = position` (`flag = not_checked` if none) |

How values are stored:
- Money columns are `NUMERIC`. NaN and infinity are stored as NULL, as JSON null.
- NUL characters become U+FFFD.
- Deleting a `bill_analyses` row deletes its lines.

The teammate's tables in `services/tigerdata_services/` (`audit_records`, `audit_line_items`, `cpt_benchmarks`) are
not used by any route.

## Small synthetic examples

```bash
curl -F "text=I was billed 3200 dollars for a head CT, code 70450. Is that normal?" http://127.0.0.1:8770/api/v1/analyze
```

Shortened response from the sample bill (`backend/samples/sample_bill.png`, synthetic):

```json
{
  "target_language": "en", "model": "gemini-3.5-flash", "mock": false,
  "result": {"document_type": "hospital_bill", "provider_name": "METROPOLITAN MEDICAL CENTER", "total_billed": 4850.0,
             "line_items": [{"cpt_code": "70450", "original_description": "CT HEAD/BRAIN W/O CONTRAST", "billed_amount": 3200.0},
                            {"cpt_code": null, "original_description": "FACILITY FEE - MISC", "billed_amount": 450.0}],
             "spoken_summary": "...", "questions_to_ask": ["..."]},
  "price_checks": [{"line_index": 0, "cpt_code": "70450", "medicare_rate": 106.55, "times_medicare": 30.0, "flag": "far_above_typical"},
                   {"line_index": 2, "cpt_code": null, "medicare_rate": null, "times_medicare": null, "flag": "no_code"}],
  "price_summary": {"source": "snowflake", "items_checked": 2, "items_flagged": 2, "error": null},
  "audit": {"saved": true, "audit_id": "00000000-0000-4000-8000-000000000001", "error": null}
}
```

## Proposed changes

Proposed interface changes are decision files in `docs/decisions/` with status `proposed`. Examples: the app key,
one error shape, the price-flag fixes, follow-up questions, and the whiteboard's Hour 1 contract. None is
implemented until this file documents it.
