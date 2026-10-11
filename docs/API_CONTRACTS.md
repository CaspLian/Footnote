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
  `Content-Type` yourself. Expo SDK 57 fetch accepts Blob parts or `{name, type, bytes: () => file.bytes()}`;
  native uploads use this bytes form. Legacy React Native `{uri, name, type}` objects are rejected by Expo fetch.
  A part without a file name is ignored; `type` must match the picker's MIME type (`image/jpg` is refused).
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
| `GET /api/v1/languages` | The 42 locales: `{"en-US": "English (United States)", "es-MX": "Spanish (Mexico)", ...}` (see "Languages") | `main.py`, `backend/locales.py` |
| `POST /api/v1/analyze` | A bill and/or text → analysis, price check, saved record | `main.py` |
| `GET /api/v1/audits/{audit_id}` | A saved analysis, exactly as it was returned | `main.py`, `analysis_store.py` |
| `GET /api/v1/benchmarks/{cpt_code}` | Medicare's national rate for one code, for the app's price comparison | `main.py`, `snowflake_service.py` |
| `POST /api/v1/claims` | Record a confirmed bill as a claim in Tiger Data; its timeline starts | `claim_routes.py`, `tigerdata_service.py` |
| `GET /api/v1/claims/{claim_id}` | A claim with its lines, deadlines, countdowns and timeline | `claim_routes.py` |
| `POST /api/v1/claims/{claim_id}/status`, `/deadlines`, `/resolve`, `/actions` | The claim's next steps (status and deadlines also accept `PATCH`) | `claim_routes.py` |
| `POST /api/v1/analyze-image` | One bill photo -> its dates and lines -> a claim with estimated deadlines (the Tiger Data flow) | `claim_routes.py`, `gemini_services/bill_image.py` |
| `POST /api/v1/voice/analyze` | A recorded question (+ optional bill) → transcript, analysis, spoken reply | `voice_routes.py` |
| `POST /api/v1/voice/speak` | Speak a saved analysis again, without calling Gemini | `voice_routes.py` |
| `POST /api/v1/voice/agent/session` | A short-lived credential for a private live conversation about a saved bill | `voice_routes.py`, `voice_agent/` |
| `GET /api/v1/voice/audio/{audio_id}` | The reply audio (MP3) | `voice_routes.py`, `audio_http.py` |
| `GET /api/v1/voice/voices` | Voices for a picker: `{"default": "matilda", "language_defaults": {"es": "elio", ...}, "voices": [{key, name, description, accent, gender}]}` (20) | `voice_routes.py`, `text_to_speech/voices.json` |
| `GET /api/v1/voice/voices/{voice_key}/sample` | A short MP3 sample of one voice | `voice_routes.py` |

### Connected Footnote app usage

| App action | Backend route |
|---|---|
| Settings connection check | `GET /` |
| Working language validation | `GET /api/v1/languages`; picker codes map to canonical locales (`zh-Hant` → `zh-TW`) |
| Confirm pages, then Understanding | `POST /api/v1/analyze`, ordered repeated `files` plus `target_language` |
| Reopen unchanged saved pages | `GET /api/v1/audits/{id}`; unwrap `analysis`, preserving confirmed local edits on Review |
| Missing service/due dates on an eligible image | `POST /api/v1/analyze-image`, `file` only; at most once per case, including failed attempts, persisted before sending; reuse the returned claim |
| Confirmed code review | `GET /api/v1/benchmarks/{code}`, one parallel lookup per unique code |
| Voice choices and English samples | `GET /api/v1/voice/voices`, `GET /api/v1/voice/voices/{key}/sample` |
| Saved reading | `POST /api/v1/voice/speak`, `audit_id` and chosen `voice`; `GET /api/v1/voice/audio/{id}` |
| Recorded question when live is unavailable | `POST /api/v1/voice/analyze`, `audio`, `target_language`, optional `voice`, `speak_reply=true`; no bill is attached in this fallback |
| First confirmation and Track refresh | `POST /api/v1/claims` once, `GET /api/v1/claims/{id}`; retry missed recording after outages |
| Prepare / submit / reminder / notice / resolve | claim `/actions`, `/status`, `/deadlines`, `/resolve`; unknown resolution balance uses an action with a note instead of `final_amount=0` |

Calm uses exact locale defaults, then language defaults, then the catalog's default; legacy `device` also means
Calm for backend speech. Clear is `alice`, Warm is `george`, with fallback to Calm if a catalog key disappears.
Speech generation is memoized by audit ID and voice; previews use the English sample endpoint. No backend
requests occur with `EXPO_PUBLIC_API_URL` unset. The live agent's separate contract is maintained with its backend
branch; the app session adapter sends only `audit_id`, `target_language`, optional `voice`, and `connection_type=webrtc`.

### Languages

The app offers 42 locales in 34 languages. The first 39 are the 32 languages ElevenLabs Flash v2.5 speaks; `zh-TW`,
`he-IL` and `th-TH` were added on 2026-10-10 for the app's language picker (`mobile/src/domain/languages.ts`). The
list is `backend/locales.py`, served by `GET /api/v1/languages` as `{locale: name}`, in this order:

`en-US`, `en-GB`, `en-AU`, `en-CA`, `ja-JP`, `zh-CN`, `de-DE`, `hi-IN`, `fr-FR`, `fr-CA`, `ko-KR`, `pt-BR`, `pt-PT`,
`it-IT`, `es-ES`, `es-MX`, `id-ID`, `nl-NL`, `tr-TR`, `fil-PH`, `pl-PL`, `sv-SE`, `bg-BG`, `ro-RO`, `ar-SA`, `ar-AE`,
`cs-CZ`, `el-GR`, `fi-FI`, `hr-HR`, `ms-MY`, `sk-SK`, `da-DK`, `ta-IN`, `uk-UA`, `ru-RU`, `hu-HU`, `nb-NO`, `vi-VN`,
`zh-TW` (Chinese, Traditional, Taiwan), `he-IL` (Hebrew), `th-TH` (Thai)

- **What to send.** `target_language` takes one of these locales, case and `_` or `-` as you like (`en_us` works).
  A bare language means its default locale: `en` → `en-US`, `es` → `es-MX`, `pt` → `pt-BR`, `fr` → `fr-FR`,
  `ar` → `ar-SA`, `zh` → `zh-CN`, `he` → `he-IL`, `th` → `th-TH`. Older codes work alone or with the region: `tl`
  means Filipino (`fil-PH`), `no` Norwegian (`nb-NO`) and `iw` Hebrew (`iw-IL` → `he-IL`). The script tags phones
  send for Chinese work too: `zh-Hans` and `zh-Hans-CN` mean `zh-CN`; `zh-Hant`, `zh-Hant-TW` and `zh-TW` mean
  `zh-TW`. Anything else (`es-AR`, `yue`, `ht`, `zh-HK`, `zh-Hant-HK`) is refused with 400 before anything is paid
  for. From the app's language picker, send the choice's `locale` (`es-ES`), not its bare `code` (`es` is `es-MX`).
- **What comes back.** `AnalyzeResponse.target_language` is the resolved locale (`es-MX` when `es` was sent).
  Gemini writes every text field in that language and regional variant (`zh-TW` in Traditional characters), and
  keeps amounts in the document's own currency (U.S. dollars on U.S. bills) in every language.
- **The spoken reply.** Gemini's `spoken_summary` is already in the language. The price findings that follow it are
  written in English, so for other languages Gemini translates them (cached while the server runs; at most 15 s).
  Numbers stay digits and are checked: a translation whose numbers differ from the price check's is asked for
  again and otherwise dropped (seen live: "30 times" became 31 or 3 times in Traditional Chinese). If no correct
  translation comes back, the reply is the summary alone, never English sentences in another language's reply.
- **The voice.** Without a `voice`, each language gets a default whose accent suits it (`language_defaults` in
  `GET /api/v1/voice/voices`): `en-GB` Alice, `en-AU` Charlie, Spanish Elio, Hindi and Tamil Saavi, Filipino
  Rachel, Chinese Andy (both scripts); Matilda for the rest, Hebrew and Thai included. Any voice speaks every
  language its model speaks, with its own accent. Flash is sent the language (`language_code`), which also decides
  how it reads numbers. English requests are unchanged, so English clips made before still play from the cache.
- **Hebrew and Thai are spoken by v4 Turbo** (`eleven_v4_turbo`), because Flash v2.5 does not speak them: the reply
  voice uses the first of `FALLBACK_MODELS` in `text_to_speech/config.py` (v4 Turbo, then v4) that speaks the
  language. Their replies take longer: on 2026-10-10 v4 Turbo made 593 and 766 characters in about 8.5 s, where
  Flash made 253 characters of Traditional Chinese in 1.8 s. `POST /api/v1/voice/speak` took 12-18 s in Hebrew and
  Thai, 5 s in Chinese. v4 is not sent `language_code`, which is not documented for it.
- **Speech-to-text** gets the language alone as a hint (`pt-BR` → `pt`; Norwegian as `no`; Hebrew `he`, Thai `th`,
  Chinese `zh` in either script). Scribe writes Mandarin in Simplified characters, also for `zh-TW` questions:
  it refuses `zh-TW` and `cmn` as hints, and its `transcript_edit` did not change the script (2026-10-10).
- **Checked live on 2026-10-10:** speech round trips in 12 languages and both Chinese scripts, and full analyses
  with spoken replies in `en-US`, `en-GB`, `es-MX`, `es-ES`, `pt-BR`, `ja-JP`, `zh-CN`, `ko-KR`, `hi-IN`, `he-IL`,
  `th-TH` and `zh-TW` (sent as `zh-Hant-TW`). Not checked by a native speaker in any language. In Arabic, the formal
  "two hundred" (ومائتا) was heard back as "one hundred" by speech-to-text; the everyday form was heard right.
- **Historical issue, now guarded: a translated ratio could be wrong.** Gemini's main model was out of quota, so the fallback
  `gemini-3.5-flash-lite` translated the price findings. Into Traditional Chinese it turned "about 30 times" into
  31 times in the spoken reply and into 3 times in 4 of 4 retries (other names for the language did no better);
  Simplified Chinese, Japanese and Hebrew kept 30. The locales merge now validates translated digits against
  the original price text, retries once, and drops an invalid translated price sentence while keeping the summary.

### `POST /api/v1/analyze`

| Field | Required | Format |
|---|---|---|
| `file` | no | One JPEG, PNG, WEBP, HEIC, HEIF or PDF; retained for single-file clients |
| `files` | no | Repeat this multipart field for ordered bill pages. At most 10 uploads total across `file` and `files` |
| `text` | one of `file` / `files` / `text` | A question or bill text; may accompany uploaded pages |
| `target_language` | no (`en-US`) | A locale from `/api/v1/languages`; `es` means `es-MX` (see "Languages"). Anything else is a 400 before any upload is read |

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
| `target_language` | no (`en-US`) | As above. The language the user speaks and is answered in; speech-to-text receives the language alone (`en`) |
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
| 400 | `language` | `target_language` is not one of the locales (checked first, before anything is paid for) |
| 413 | `upload` / `speech_to_text` | Bill over 15 MB, or recording over `STT_MAX_AUDIO_MB` |
| 400 | `gemini` | Unsupported bill type, or other input Gemini refuses |
| 422 | `speech_to_text` | `NO_SPEECH`, `EMPTY_AUDIO`, `UNSUPPORTED_AUDIO` or `INVALID_REQUEST`: ask the user to try again. A missing `audio` field gives FastAPI's list instead |
| 503 | `speech_to_text` | ElevenLabs temporarily unavailable (`retryable: true`) |
| 502 | `speech_to_text` / `gemini` | Key, permission or quota problem, or the Gemini step failed |
| 504 | `gemini` | Gemini took too long |

A failed reply voice never fails the request. In that case `speech.ok` is false and `speech.error_code` says why.
For example, `INVALID_REQUEST` comes back for an unknown `voice`, and then the message lists the valid keys, or for a
saved analysis in a language no longer offered (such as `yue`, offered before 2026-10-10). The voice route saves while it makes the reply audio, so a healthy save adds
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

Spoken price findings describe Medicare rates as references, not proof of an error or a fair hospital price.
Doctor-only references are explained separately, without a ratio or a claim that the hospital charge is high.
This changes the reading text, not the existing `PriceCheck` fields or flags.

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
| `target_language` | string | The resolved locale, e.g. `es-MX` when `es` was sent |
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

The claim routes use the teammate's tables in `services/tigerdata_services/` (`audit_records`, `audit_line_items`,
and lifecycle data). Saved extraction audits remain in `bill_analyses`; a claim's optional `analysis_audit_id`
links the two. Medicare lookups use Snowflake/CSV, not the teammate's regional benchmark table.

## Small synthetic examples

```bash
curl -F "text=I was billed 3200 dollars for a head CT, code 70450. Is that normal?" http://127.0.0.1:8770/api/v1/analyze
```

Shortened response from the sample bill (`backend/samples/sample_bill.png`, synthetic):

```json
{
  "target_language": "en-US", "model": "gemini-3.5-flash", "mock": false,
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
one error shape, the price-flag fixes, follow-up questions, the whiteboard's Hour 1 contract, and the voice agent's
session route is now implemented (`2026-10-10-voice-agent.md`); the other proposals remain unimplemented until
this file documents them.

## Live conversation session: `POST /api/v1/voice/agent/session`

Form fields: required saved-analysis UUID `audit_id`; optional `target_language` (saved locale by default),
catalog `voice`; `connection_type` (`webrtc` default, or `websocket`). No profile, insurer, ZIP or arbitrary bill
text is accepted. The backend loads the saved analysis and builds the conversation context.

Returns JSON with `Cache-Control: no-store`: `connection_type`, `conversation_token` for WebRTC or `signed_url`
for WebSocket, optional `conversation_id`, `start_within_seconds` (600/900), random `user_id`, `locale`,
`language`, `voice`, `audit_id`, `bill_loaded: true`, `dynamic_variables`, `overrides`, `client_tools`, `lines`,
and `privacy_notice`. Never store/log the credential or include it in persistence snapshots.

The eight string variables are `language_name`, `today`, `bill_loaded`, `bill_facts`, `bill_lines`, `price_check`,
`bill_summary`, and `questions_to_ask`. `today` uses the server's local calendar date. SDK overrides are
camelCase: `agent.language`, `agent.firstMessage`, `tts.voiceId`, and `asr.keywords`. Client tools are
`show_line_item` and `show_price_check`, each taking a 1-based integer `line_number` and displaying existing UI.

Each line includes `number`, `name`, nullable `billed_amount`, `medicare_rate`, `times_medicare`, `label`, and
`in_context`. A doctor-only reference has `label: doctor_part_only` and no quantitative rate/ratio. Omitted
lines have `in_context: false` and cannot be requested through a client tool.

Errors use `detail: {stage, message, error_code?, retryable?}`: 400 invalid input/language, 403 refused web origin,
404 missing audit, 409 incompatible saved analysis, 429 local session limit (with `Retry-After`), 502 provider
rejection, 503 missing setup/database/provider outage. Audit errors use `stage: audit`; unsupported live
languages use `stage: language`; agent setup/provider errors use `stage: agent`.

The agent is private and uses Gemini 3.5 Flash. Its English base uses Flash v2 as required by the live Agents
API; other supported presets use Flash v2.5. Regular saved readings keep their existing model behavior.
Hebrew/Thai live conversations are refused; ordinary Hebrew/Thai readings remain supported. Manual cases and
Guide terms without a saved audit cannot start live bill conversations.

Local defaults: one successful credential per client address per 10 seconds, 30 per hour; only loopback web
origins or `ELEVENLABS_AGENT_ALLOWED_ORIGINS`. These are development limits, with no application authentication.
The UI shows the provider's seven-day retention notice before Start and pauses original-analysis voice when
confirmed values change. Setup: from `backend/`, run
`python -m services.audio_service.voice_agent.provision`, set its nonsecret `ELEVENLABS_AGENT_ID` in the ignored
backend settings and restart. Only synthetic bills are used in this development agent.
