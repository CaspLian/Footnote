# ClaimPulse AI backend: verification report

Date: 2026-10-10. Verified: branch `Gemini-Tiger-Snow-Integration-V1` at `f86e22f`, the merge of
`nimesh/audio-service`, `backend-gemini` and `Tiger-data`. After verification, the parts were wired together
(section 2). That wiring is **not committed yet**: it is in the working tree of the local clone, on the same branch.

**New layout (after the verification, at the team's request):** each service now has its own folder under
`backend/services/`. Folder names use underscores, because Python cannot import a folder whose name has a space.

| Folder | Files |
|---|---|
| `gemini_services/` | `gemini_service.py`, `mock_gemini_response.json` |
| `snowflake_services/` | `snowflake_service.py` |
| `tigerdata_services/` | `tigerdata_service.py` |
| `analytical_services/` | `analysis_store.py` |

Imports changed accordingly, for example `from services.gemini_services.gemini_service import analyze`. Locations
like `snowflake_service.py:91` below refer to these files; their line numbers did not change.

## Verdict

- **The app has everything it needs to start building against.** Every route the mobile app needs exists, is
  mounted in `main.py`, is documented and passes its tests. That covers typed or photo analysis, voice questions
  with a spoken reply, saving, and hearing a saved analysis again. A full live run with every real service
  (Gemini, Snowflake, Tiger Data and ElevenLabs) passed 15 of 15 checks on 2026-10-10.
- **Before real users see results:**
  1. The price check labels ordinary hospital charges "far above typical" (high, `snowflake_service.py`), and the
     voice now reads these labels aloud.
  2. Gemini passes live only with `GEMINI_MODEL=gemini-3.5-flash` (now in `backend/.env`): the code's default
     model did not answer.
  3. The API has no authentication.
  4. `mobile/App.js` has no client code yet.

Status labels: **PASS — offline/mocked** (fakes at the provider boundary, network blocked), **PASS — live** (real
provider), **FAIL**, **BLOCKED** (missing configuration or access), **NOT IMPLEMENTED**. A mocked pass does not prove
the live provider works.

How it was checked:
- **Offline first.** Four verifiers, one per area, ran tests with real SDKs on mocked transports, fake providers and
  a socket guard that recorded zero network calls.
- **Every failure re-checked.** For each FAIL, an independent re-checker tried to disprove it with its own
  reproduction: 150 items were re-checked and 1 was refuted.
- **Live where possible.** First ElevenLabs. Then, once keys were set up on 2026-10-10, Gemini, Snowflake and
  Tiger Data too. Tiger Data writes went only into a throwaway schema, which was dropped afterwards.
- **Persistence on a throwaway database.** It ran on a local PostgreSQL 17, never the team's database.
- **The wiring reviewed.** Four reviewers checked it, then a follow-up review checked the fixes.
- **Data and secrets.** Synthetic bills and audio only; no key or connection string was printed.

## 1. What the merged code did not do (before the wiring)

| Gap at `f86e22f` | Status then |
|---|---|
| The voice router was never mounted: every `/api/v1/voice/*` URL answered 404 | FAIL |
| Nothing was saved: `tigerdata_service` was not called by any route | NOT CONNECTED |
| No route to read a saved analysis back | NOT IMPLEMENTED |
| No way to hear an analyzed bill again without re-analyzing it (workflow 3) | NOT IMPLEMENTED |
| The spoken reply ignored the price check (Gemini writes its summary before the check runs) | FAIL |
| The voice code loaded *all* of `backend/api.env` on the first voice request, including other services' placeholders. Snowflake then tried to log in with a placeholder account (up to 15 s per request) | FAIL |
| The voice route paid for speech-to-text before refusing an oversized or unsupported bill | FAIL |
| Reply audio of someone's bill was marked cacheable by shared caches for a year (`public`) | FAIL |
| `tigerdata_service.record_bill_audit` cannot store a Gemini analysis: codes and amounts are required, and Gemini's are nullable | FAIL |

## 2. Fixes made (the wiring) and files changed

New:
- **`backend/services/analytical_services/analysis_store.py`**: saves every analysis to Tiger Data (`TIGER_DATA_POSTGRES_URL`) in two
  tables of its own, `bill_analyses` and `bill_analysis_lines`.
  - Missing codes and amounts are stored as NULL, never dropped or invented.
  - The full response is kept as JSON, so it reads back exactly as it was returned.
  - Saving never fails a request. Database work runs on its own threads with a time limit on every statement.
  - If Tiger Data cannot be reached, saving pauses for 30 s instead of every request waiting 10 s or more.
  - A save that runs out of time is rolled back, so "not saved" is always true.
  - Tables are created only when missing, under an advisory lock, so an app role without CREATE permission
    still works.
  - Logs show only the error type, never bill data or the URL.
- **`backend/dev_console.py`** and **`dev_console.html`**: a local test page that runs the real app.
  - Run `cd backend; python dev_console.py`, then open http://127.0.0.1:8770/console.
  - It falls back to MOCK Gemini and CSV prices when there are no keys.
  - It refuses requests from other web sites.
- **Tests:** `backend/tests/test_wiring.py`, `test_analysis_store.py` and `test_dev_console.py`.

Changed:
- **`backend/main.py`**: after the price check, `/api/v1/analyze` saves the analysis (`response.audit`).
  It also gains `GET /api/v1/audits/{audit_id}` and mounts the voice router.
- **The services moved into their folders** (see the layout above). Every import, test and README was updated.
  Two file-relative paths now go one level further up: `CSV_PATH` in `snowflake_service.py` (still
  `backend/data/cpt_benchmarks.csv`) and the `backend/.env` path in `tigerdata_service.py`. No other line in those
  files changed.
- **`backend/models.py`**: `AuditInfo` and `AnalyzeResponse.audit` (`saved`, `audit_id`, `error`). Both are additive.
- **`backend/services/audio_service/voice_routes.py`**:
  - Saves voice analyses, with their transcript, while the reply audio is being made.
  - New `POST /api/v1/voice/speak` speaks a saved analysis without calling Gemini again (workflow 3).
  - The spoken reply adds what the price check found, worst charge first, English only for now. `speech.text`
    carries exactly what was spoken, for captions.
  - The bill (size and type) and the recording (size) are checked before speech-to-text is paid for, and uploads
    are read only up to their limits.
  - Phone locales such as `en-US` are accepted.
  - Reply audio is `Cache-Control: private`.
  - An old-format saved analysis gets 409, not 500.
- **`text_to_speech/config.py`** and **`speech_to_text/config.py`**: read only `ELEVENLABS_*`, `TTS_*` and
  `STT_*` from `.env` or `api.env`, and honour `PYTHON_DOTENV_DISABLED`.
- **`audio_service/conftest.py`**: tests can no longer read a developer's real `backend/.env` or `api.env`. The old
  guard let a real key leak into tests, which was proven with a probe.
- **Docs:** `audio_service/README.md` (how the routes fit together, the developer console) and
  `speech_to_text/README.md` (`/speak`, `audit`, `speech.text`, privacy). The audio tests and
  `text_to_speech/README.md` were updated to match.

Otherwise unchanged: the Gemini, Snowflake and Tiger Data code (`gemini_service.py`, `snowflake_service.py`,
`tigerdata_service.py`), apart from the move and the two path lines above. Their bugs are listed in section 5 with
fixes, for their owners.

## 3. Feature checklist

"Then" is the merged code at `f86e22f`; "Now" includes the wiring.

### A. Gemini bill analysis: `main.py`, `services/gemini_services/gemini_service.py`, `models.py`

| Check | Where | Then | Now |
|---|---|---|---|
| `POST /api/v1/analyze` registered; multipart file and/or text, `target_language` | main.py:39 | PASS — offline/mocked | same |
| JPG/PNG/WEBP/HEIC/HEIF/PDF reach Gemini byte for byte; bad type 400; over 15 MB 413; nothing sent 400 | main.py:47, gemini_service.py:26,75 | PASS — offline/mocked | same |
| Synthetic 8-line bill in es/zh/ar → valid structured result, with the real SDK on a mock transport | gemini_service.py | PASS — offline/mocked | same |
| Missing values stay `null` | models.py | PASS — offline/mocked | same |
| Malformed output is retried, then 502; 400/401/403 not retried; the key never leaks | gemini_service.py:104-129 | PASS — offline/mocked | same |
| 429/500/503 retried once, then the fallback model | gemini_service.py:40 | PASS — offline/mocked | same |
| 502, 504, 408, unknown model (404) and network errors retried, or sent to the fallback | gemini_service.py:40 | **FAIL** (medium) | same |
| The outer time limit covers the retry plan | main.py:16 | **FAIL** (low): 150 s vs a 164 s worst case | same |
| Real implementation, not a placeholder | gemini_service.py | PASS | same |
| Live Gemini call | — | **BLOCKED**: no key | **PASS — live** with `gemini-3.5-flash` (fallback `gemini-3.5-flash-lite`): a typed question in 10 s, the sample bill photo in 9 s (all 3 lines, codes and amounts right), Spanish in 6 s. The code's default `gemini-3.8-flash` gave no answer in 91 s; `gemini-2.5-flash` is no longer offered to new keys; `gemini-3.5-flash` sometimes answers 503 "high demand", which the fallback covers |

### B. Price comparisons: `services/snowflake_services/snowflake_service.py`, `data/cpt_benchmarks.csv`

| Check | Where | Then | Now |
|---|---|---|---|
| Line items reach the lookup (sorted, unique, normalized codes) | snowflake_service.py:87 | PASS — offline/mocked | same |
| Snowflake rows mapped to the right codes (fake connector) | snowflake_service.py | PASS — offline/mocked | same |
| CSV fallback when Snowflake fails; a price-check error never fails the request | snowflake_service.py:93-104 | PASS — offline/mocked | same |
| No code, no amount and no benchmark stay distinct from "no difference" (flags `no_code`, `no_amount`, `no_benchmark`; ratio `null`) | snowflake_service.py:107-135 | PASS — offline/mocked | same |
| Ratio arithmetic on fixtures | snowflake_service.py:120 | PASS — offline/mocked | same |
| Notes never call Medicare amounts negotiated prices or proof of illegal overcharging | snowflake_service.py:112-134 | PASS — offline/mocked | same |
| Doctor-only ("facility setting") Medicare rates judged with bands meant for whole hospital charges | snowflake_service.py:124-135 | **FAIL** (high) | same |
| Multi-unit lines compared per unit | models.py:11, snowflake_service.py:123 | **FAIL** (medium) | same |
| `price_summary.source` says where the data came from | snowflake_service.py:91 | **FAIL** (medium): cached lookups say "snowflake" | same |
| The explanation and the spoken summary reflect the price check | main.py, voice_routes.py | **FAIL** | spoken reply: **PASS — live** (English). `plain_summary` text: not yet |
| Live Snowflake | — | **BLOCKED**: placeholder credentials | **PASS — live**, read-only: the lookup takes 6-8 s with the login, and the rates (70450 $106.55, 99284 $118.24) equal the CSV |

### C. Speech-to-text: `services/audio_service/speech_to_text/`

| Check | Where | Then | Now |
|---|---|---|---|
| A recording is transcribed | service.py | **PASS — live** ("Hi. Why was my MRI billed $3,200? Is that normal?", confidence 0.997) | same |
| The transcript goes into the analysis as the user's text | voice_routes.py | PASS — live (router mounted by hand) | **PASS — live** |
| Empty, too-short, non-audio (PNG/JPEG) and oversized uploads refused before ElevenLabs | service.py:140-152 | PASS — offline/mocked | same |
| HEIC/HEIF/AVIF photos and UTF-16 text pass the audio check, are uploaded, and come back as 502 | audio_check.py:30,46 | **FAIL** (low) | same |
| Corrupt recording with a valid header | elevenlabs_provider.py:144 | **FAIL** (low): 502 instead of "record again" | same |
| Provider errors are useful and never leak the key | elevenlabs_provider.py | PASS — offline/mocked. An invalid key is reported as PROVIDER_REJECTED instead of AUTH_FAILED: **FAIL** (medium, seen live) | same |
| Temporary files | service.py | PASS — offline/mocked (in memory only) | same |
| Phone locales (`en-US`) on the voice route | voice_routes.py | **FAIL** (422) | **PASS — offline/mocked** |

### D. Text-to-speech and audio delivery: `text_to_speech/`, `audio_http.py`, `voice_routes.py`

| Check | Where | Then | Now |
|---|---|---|---|
| Playable MP3 | service.py | **PASS — live** (72 KB in 1.4 s) | **PASS — live** (306 KB reply) |
| Voice choice, text preparation, settings | service.py, text_prep.py, config.py | PASS — offline/mocked. Edge cases: low FAILs (section 5) | same |
| Content type `audio/mpeg`; the audio URL can be fetched; byte ranges (206) for iPhones | audio_http.py | PASS — live | **PASS — live** |
| Cache never returns another voice's or another request's audio | service.py:365 | PASS — live (byte-identical repeat; other voice = other clip) | same |
| Streaming (first audio while the rest is being made) | service.py | **PASS — live** (first audio 0.43 s) | same |
| Empty text, unknown voice, missing key, timeouts, provider failures | service.py | PASS — offline/mocked | same |
| Spoken replies in languages other than English | service.py:611 | NOT IMPLEMENTED | same |
| The playground works with the merged backend | playground.py | PASS — offline (headless Chrome) | same |
| Reply audio not stored by shared caches | voice_routes.py | **FAIL** (`public`) | **PASS** (`private`) |

### E. Voice routes: `services/audio_service/voice_routes.py`

| Check | Then | Now |
|---|---|---|
| Router mounted in the app | **FAIL**: all 404 | **PASS — live** |
| Voice analysis runs the full pipeline, price check included | PASS — offline (mounted by hand) | **PASS — live** |
| The same question typed and spoken gives the same result (deterministic fakes) | PASS — offline/mocked (identical `price_checks`; the source label differs, from the bug in B) | same |
| Speak an analyzed bill without analyzing it again (workflow 3) | NOT IMPLEMENTED | **PASS — live** (`POST /api/v1/voice/speak`) |
| Follow-up questions that use a saved bill (workflow 4) | NOT IMPLEMENTED | NOT IMPLEMENTED |

### F. Tiger Data / PostgreSQL: `services/tigerdata_services/tigerdata_service.py`, `services/analytical_services/analysis_store.py`

| Check | Then | Now |
|---|---|---|
| Connection and schema on an isolated database | PASS — local PostgreSQL 17 | same (both modules) |
| `tigerdata_service`: benchmark upsert, audit, line items, retrieval | PASS — local PostgreSQL (the teammate's 4 tests; 28 of 28 extra checks) | same |
| The app saves during its workflows | NOT CONNECTED | **PASS** (local PostgreSQL; offline in tests) |
| Gemini's `line_items` adapted to the database; null codes and amounts neither lost nor invented | **FAIL**: `record_bill_audit` rejects them (the mock's FACILITY FEE line has no code) | **PASS**: `analysis_store` stores Gemini's shape, with NULLs |
| What is stored reads back identically | PASS (`tigerdata_service`) | **PASS** (`GET /api/v1/audits/{id}` returns exactly what `/analyze` returned) |
| A failure part-way leaves nothing behind | PASS (one transaction) | **PASS** (tested by failing the line insert) |
| Database outage | n/a | **PASS — offline/mocked**: the answer still comes back with `audit.saved: false`, and saving pauses for 30 s |
| Live Tiger Data | **BLOCKED**: placeholder URL | **PASS — live** (PostgreSQL 18.6 on Tiger Cloud, UTF8, SSL): an analysis was saved and read back exactly. The teammate's tests (4 passed) and `analysis_store`'s (26 passed; 2 skipped, which need a superuser) passed in a throwaway schema, which was then dropped; the team's 5 tables were unchanged |

### Integrated workflows

| Workflow | Then | Now |
|---|---|---|
| 1. Bill → Gemini → price check → explanation → saved → read back | Saving and reading back NOT IMPLEMENTED | **PASS — live**: real Gemini, Snowflake and Tiger Data (throwaway schema); 6 s for the sample bill photo |
| 2. Recording → speech-to-text → analysis → price check → spoken summary → audio fetched | PASS — live (router mounted by hand) | **PASS — live**. The reply audio, transcribed back, says "Head CT scan was billed about 30 times Medicare's national rate, which is far above the usual range" |
| 3. Analyzed bill → audio explanation | NOT IMPLEMENTED | **PASS — live** |
| 4. Question about an existing bill → contextual answer → speech | NOT IMPLEMENTED | NOT IMPLEMENTED: no route takes an `audit_id` with a question, and `gemini_service.analyze()` has no context parameter. `load_analysis()` can supply the saved analysis |

## 4. Commands run and totals

Python 3.14, FastAPI 0.141, in a scratch virtual environment. The test database is a throwaway local PostgreSQL 17,
`TIGER_TEST_DATABASE_URL=postgresql://verify:...@127.0.0.1:54329/<test db>`.

| Command (folder) | Then (`f86e22f`) | Now |
|---|---|---|
| `python -m pytest -q -p no:cacheprovider` (backend/services/audio_service) | 505 passed | **528 passed** |
| `python -m pytest tests -q -p no:cacheprovider` (backend), no database | 2 passed, 2 errors | 47 passed, 10 skipped, 2 errors |
| The same, with `TIGER_TEST_DATABASE_URL` and `TIGER_DATA_POSTGRES_URL` set to the test database | 4 passed | **59 passed** |
| Audio and backend suites in one session (`-c services/audio_service/pytest.ini services/audio_service tests`, and the reverse order) | n/a | **587 passed** both orders |
| `python -m pytest -q` (backend), what a teammate would type | stops at collection, 2 errors | unchanged |
| Tiger Data checks (`tiger_checks.py`, local PostgreSQL) | 28 passed | n/a |
| Developer console in headless Chrome (fake ElevenLabs, local PostgreSQL) | n/a | **58 passed** |
| Live smoke test, real ElevenLabs (`wired_workflows.py`) | earlier live run: all passed except the invalid-key mapping | **13 passed** |
| Full live test, every real service (`full_live.py`, 2026-10-10) | n/a | **15 passed** (an earlier run, with the Tiger Data URL incomplete: 14 of 15) |

Notes on these totals:
- **The 2 errors without a database** are the teammate's `test_tigerdata_service.py`. Its setup needs
  `TIGER_DATA_POSTGRES_URL`.
- **The collection errors from plain `python -m pytest -q`** come from two files:
  - `test_snowflake.py` logs in to Snowflake when it is imported.
  - The audio conftest only works from its own folder.

The area verifiers ran 158 checks: Gemini 36, prices 43, audio 43, how the parts fit together 36. Their scripts and
logs are in the session's scratch folder, not in the repo.

## 5. Bugs still open, with the smallest fix

### Price check (`services/snowflake_services/snowflake_service.py`)

| Severity | What happens | Smallest fix |
|---|---|---|
| **high** | 4,043 of the 7,745 CSV rates are the Medicare *facility* amount, which pays only the doctor. They are judged with the same 3× and 6× bands as whole charges. So ordinary ER visits come out "far above typical": the mock's 99284 at $1,200 is 10.1×, and the sample ER bill's 99285 at $2,450 is 14.3×. On the sample ER bill all 7 priced lines are flagged, and even an EOB's insurer-allowed amounts come out "above typical". | Give facility-setting rates their own flag (e.g. `doctor_fee_only`). Keep it out of `items_flagged`, and say the rate does not cover the hospital's own charge. Later, compare hospital lines with OPPS rates, and EOB lines with their allowed amounts. |
| medium | A line with several units is compared with Medicare's price for one unit: 4 × $80 shows 11.0×, while $80 is 2.8× | Add `units` to `LineItem` and divide by it |
| medium | When every code is already cached, `price_summary.source` says "snowflake" even for CSV data, and it hides an earlier failure. It is also wrong in the saved `price_source` column. | Cache the source with each row and report it |
| low | The cache never expires and keeps CSV-fallback rows after Snowflake recovers. Codes are cut to their first 5 characters ("CPT 99284" is not found). The raw exception text is shown in `price_summary.error`. Every request retries a Snowflake that is down, for up to 15 s, and dropped connections are not closed. Non-finite amounts are flagged. The `no_benchmark` note is wrong for codes on other fee schedules. `load_benchmarks.py` replaces the table non-atomically. | See the re-check notes; each fix is a few lines |

### Gemini (`services/gemini_services/gemini_service.py`, `main.py`)

| Severity | What happens | Smallest fix |
|---|---|---|
| medium | The default model `gemini-3.8-flash` gave no answer at all for the team's key (none in 91 s), so every analysis failed with 502 after about 80 s. | Set `GEMINI_MODEL=gemini-3.5-flash` and `GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite` (now in `backend/.env`); consider making these the code's defaults |
| medium | Only 429/500/503 are retried. 502, 504, 408, an unknown model id (404) and network errors fail at once and never reach `GEMINI_FALLBACK_MODEL`. | `RETRYABLE_CODES = {408, 429, 500, 502, 503, 504}`; catch httpx transport errors; on 404 try the next model |
| low | The 150 s outer limit is under the plan's 164 s worst case (main.py:16 and voice_routes.py:51) | Derive it from the plan (about 170 s), or pass a deadline to each attempt |
| low | The cached Gemini client belongs to the event loop it first ran on: calls from a second loop fail with "Event loop is closed". The app (uvicorn) has one loop, so only scripts and tests hit this. | Create the client per event loop, or reset it when the loop changes |
| low | Any `ValueError` becomes 400, for example a blank `GEMINI_MODEL` or a non-JSON reply | Raise a dedicated input error for the two real input checks |
| low | Other issues:<br>• `model` names the primary model even when the fallback answered<br>• the missing-key message says `api/.env` (it should say `backend/.env`)<br>• unusable output is reported as "Gemini is unavailable"<br>• `target_language` is free text placed in the system prompt (validate it against `LANGUAGES`)<br>• the exact-match MIME check reports "Unsupported file type None"<br>• the whole upload is read into memory before the 15 MB check<br>• `document_type` is not constrained to its five values<br>• a fractional `GEMINI_ATTEMPT_TIMEOUT_S` stops the server from starting<br>• retries carry on after the phone gives up<br>• MOCK mode always answers in Spanish | One line each |

### Tiger Data (`services/tigerdata_services/tigerdata_service.py`)

The app now saves through `analysis_store`, so these no longer block it. They matter if the team wants to use
`tigerdata_service`'s own tables:
- `record_bill_audit` needs a code and an amount on every line, and the field names differ from Gemini's.
- Recording the same bill twice makes two audits.
- `total_billed` is not checked against the lines.
- The `overcharge` columns flag $0.01 above a benchmark.
- Every write runs `CREATE TABLE IF NOT EXISTS`. That fails for a role without CREATE, and 3 of 8 simultaneous
  first calls failed on an empty database.
- `connect_tiger_data()` loads the whole `backend/.env` again on every call.

### Audio (`services/audio_service/`), not changed in this pass

| Severity | What happens | Smallest fix |
|---|---|---|
| medium | ElevenLabs answers an invalid key with HTTP 400 `invalid_api_key`. TTS, TTS streaming, STT and `check_setup` all report PROVIDER_REJECTED instead of AUTH_FAILED (seen live). | Treat the `invalid_api_key` code as AUTH_FAILED in both `_error_from_response` functions and in `check_setup` |
| low | HEIC/HEIF/AVIF photos and UTF-16 text pass the audio check (`audio_check.py:30,46`) | Return None for image brands and UTF-16 byte order marks |
| low | Other issues:<br>• a corrupt recording gives 502 instead of 422<br>• `ELEVENLABS_VOICE_ID` makes "matilda" mean two voices<br>• `text_prep` drops a few symbols (👎, ⛔, ≠, strikethrough)<br>• `nan` and `inf` pass the settings checks<br>• `audio_url` ignores an extra mount prefix<br>• reply audio stays in `.tts_cache/` with no expiry (privacy; set `TTS_CACHE_DIR=` for memory only on a server) | Small, local fixes |

### Repository and test setup

- **`pytest` from `backend/` stops at collection.** Until that is fixed, run the commands in section 4. Fix: a
  `backend/pytest.ini` (testpaths and pythonpath), and make `test_snowflake.py` skip unless Snowflake is configured.
- **`nimesh/audio-service` (and its remote) point at `60d279b`.** There `import main` fails, because of the moved
  Gemini file. The integrated code is on `Gemini-Tiger-Snow-Integration-V1`. Point the branch there, or retire it.
- **`backend/requirements.txt`** does not list `requests`, which the audio code uses directly. It lists the unused
  `elevenlabs` SDK.
- **The routes return three different error shapes:** a string, `{stage, message}`, and FastAPI's validation list.
  One shape would make the app's error handling simpler.
- **The Gemini files were moved again on 2026-10-10 at 09:21.** In the working tree they went into
  `backend/services/gemini services/`, from outside this session. Python cannot import a folder whose name has a
  space, so the backend could not start. They were moved back with the owner's OK. The services now have their
  own folders with underscore names (see the layout at the top), which keeps the grouping and still imports.

## 6. In the code but not connected to the app

- `tigerdata_service`: `initialize_tiger_data`, `upsert_cpt_benchmark`, `record_bill_audit`, `get_bill_audit`, and
  its `cpt_benchmarks` table of regional averages. Only its own tests call them.
- `mock_bill.json`, in both `backend/` and `mobile/`: used only by the Tiger Data tests.
- `speech_to_text.VOICE_INPUT_NOTE`: meant to tell Gemini the question was spoken. It is exported but never passed
  to Gemini.
- `get_stats()` in both audio modules (cost and usage counters), `text_to_speech.get_audio()`, and `voices.list_voices()`.
- The SOURCE, YEAR and CATEGORY benchmark columns: loaded into Snowflake, never read.
- `mobile/App.js`: the Expo template; it calls no backend route yet.

## 7. Missing features (as opposed to broken ones)

- Follow-up questions about a saved bill (workflow 4).
- Spoken replies in the 11 languages other than English. The text answer already supports all 12.
- Authentication or an app key, and rate limits. Today anyone who can reach the server can spend the Gemini and
  ElevenLabs credits, and can read a saved analysis if they have its ID. Also, uvicorn's access log shows those IDs.
- Units on line items; hospital (OPPS) benchmarks; checking EOBs against allowed amounts.
- Retention and deletion for saved analyses, transcripts and reply audio.
- Tests for `gemini_service` and `snowflake_service` themselves.
- The mobile client.

## 8. Remaining blockers and how to clear them

1. **Gemini live: done**, with `GEMINI_MODEL=gemini-3.5-flash` and `GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite` in
   `backend/.env`. Try `gemini-3.8-flash` again later; it is the model Google now recommends.
2. **Snowflake live: done.** The `CPT_BENCHMARKS` table is loaded and matches the CSV.
3. **Tiger Data live: done** (the complete connection string is in `backend/.env`). For testing, the developer
   console saves to a schema of its own, `claimpulse_console`, so test data stays apart from the team's tables.
   `DROP SCHEMA claimpulse_console CASCADE;` removes it all. Plain `python dev_console.py`, like the app, saves to
   the `public` schema, and creates the tables `bill_analyses` and `bill_analysis_lines` there on the first save.

   All keys now live in `backend/.env`. It was renamed from `api.env` on 2026-10-10, so `main.py` reads them; git
   ignores it.
4. **Before the backend is reachable from the internet:** an app key on the routes that spend credits or read
   bills, CORS limited to the app, `--no-access-log` or masked IDs, and HTTPS.

## 9. Ready for frontend integration?

**Yes, for building and demoing with test data.** The evidence:
- **Contract:** the app's contract is in `services/audio_service/speech_to_text/README.md` (section 3) and
  `services/audio_service/README.md` ("How the backend uses it"). Every route the app needs is mounted.
- **Offline tests:** 587 tests pass across the audio and backend suites.
- **Browser test:** the developer console passes 58 checks in headless Chrome.
- **Live:** a full live run with every real service passed 15 of 15. Real Gemini read the bill photo, Snowflake
  priced it, Tiger Data saved it and read it back exactly, and ElevenLabs spoke it. A spoken question went through
  every step and was answered out loud.

**Not yet for real users:**
- the high-severity price flags
- no authentication

## Summary

- **Works:**
  - typed or photo analysis with a price check
  - voice questions with a spoken reply that includes the price findings
  - saving every analysis
  - reading a saved analysis back and hearing it again
  - streaming and byte ranges for phones
  - a local console to try it all
  - every service live (Gemini, Snowflake, Tiger Data, ElevenLabs both ways), together through the app
- **Broken:**
  - price flags for doctor-only rates (high)
  - multi-unit lines and the price-source label (medium)
  - Gemini's retry list (medium)
  - the invalid-key error code (medium)
  - a set of low-severity edge cases (section 5)
- **Unverified:** the app on a real phone.

**Next three priorities**
1. **Fix the price flags** for doctor-only rates, and the source label, in `snowflake_service.py`. The app shows
   them, and the voice now says them out loud.
2. **Connect the app.** The backend is fully live, so connect `mobile/App.js` to `/api/v1/analyze` and
   `/api/v1/voice/*`, using the contract in `speech_to_text/README.md` section 3.
3. **Secure it before it goes public.** Before the backend is public, add an app key on the paid and data routes,
   limit CORS, and decide how long saved bills, transcripts and audio are kept.
