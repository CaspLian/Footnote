# ClaimPulse AI: project context

Last checked: 2026-10-10, branch `Frontend-Integration-V2` (`d1753db` plus the null-text fix). Re-check
anything here against the code after merges: the code wins over this document.

## Product

**Purpose.** Help people understand medical bills and insurance Explanation of Benefits (EOB) letters in plain
words and in their own language, point out charges worth asking about, and prepare questions for the hospital
billing office.

**Intended users.** Patients and caregivers, especially people with limited English, low literacy or low vision,
elderly patients, and anyone overwhelmed by medical paperwork.

**MVP journey.**
1. Upload a bill or EOB (photo or PDF), type a question, or ask by voice.
2. Gemini extracts the document into structured fields and explains it at a 5th-grade reading level.
3. Each line with a billing code is compared with a Medicare reference rate.
4. The explanation is shown in the chosen language, with the price comparison and questions to ask.
5. The answer is spoken aloud (ElevenLabs).
6. The analysis is saved (Tiger Data / PostgreSQL), so it can be reopened and heard again.
7. All of this from an accessible mobile app (not built yet; see "Frontend").

## Architecture (as implemented)

```
mobile app (Expo, not wired yet)  or  backend/dev_console.py (local test page)
        │  HTTP (multipart form, JSON)
        ▼
backend/main.py (FastAPI) ── POST /api/v1/analyze ── GET /api/v1/audits/{id} ── /api/v1/voice/* (voice_routes.py)
        │
        ├─ services/gemini_services/gemini_service.py      Gemini: document or text → GeminiResult (+ MOCK mode)
        ├─ services/snowflake_services/snowflake_service.py price check: line items → PriceCheck list
        │      Snowflake table CPT_BENCHMARKS, or backend/data/cpt_benchmarks.csv when Snowflake is unavailable
        ├─ services/analytical_services/analysis_store.py  Tiger Data: save / load each analysis
        └─ services/audio_service/                          ElevenLabs speech-to-text and text-to-speech
```

Service responsibilities:
- **Gemini (`gemini_services`)**: reads the image, PDF or text; returns `GeminiResult` (document type, provider,
  totals, line items with codes and amounts, `plain_summary`, `spoken_summary`, `questions_to_ask`) in one of the
  12 languages from `GET /api/v1/languages`. Retries 429/500/503 once, then tries `GEMINI_FALLBACK_MODEL`.
  `MOCK=true` returns a fixed sample (in Spanish), whatever the input.
- **Price check (`snowflake_services`)**: looks up each code's Medicare rate and flags each line as `typical`,
  `above_typical` (over 3× and up to 6× the rate), `far_above_typical` (over 6×), `no_code`, `no_benchmark` or
  `no_amount`. It never fails a request: if Snowflake fails it uses the CSV and says so in `price_summary`, and if
  even that fails it returns no checks with `source: "unavailable"`.
- **Saving (`analytical_services/analysis_store.py`)**: writes each analysis to the tables `bill_analyses` and
  `bill_analysis_lines` (created on first use). Saving never fails a request; `response.audit` says whether it worked.
- **Tiger Data tables (`tigerdata_services`)**: the teammate's audit and regional-benchmark tables. Implemented and
  tested, but no route calls them (they require a code and an amount on every line).
- **Voice (`audio_service`)**: speech-to-text for questions, text-to-speech for replies, audio delivery with byte
  ranges and optional streaming, a voice picker (20 voices), and a local playground.

## Feature status

Labels: **VERIFIED** (executed; live or mocked as stated), **IMPLEMENTED, UNVERIFIED**, **PARTIAL**, **PLANNED**,
**BLOCKED**. Evidence: 2026-10-10 at commit `d1753db`, unless dated otherwise. Details and commands:
`BACKEND_VERIFICATION_REPORT.md`. Only the person who merges updates this table, at integration checkpoints
(`AGENTS.md`).
Between checkpoints, record status changes in your handoff.

| Feature | Status | Evidence / where |
|---|---|---|
| Bill photo (PNG) or typed question → structured analysis | VERIFIED: live (Gemini `gemini-3.5-flash`) and mocked | `POST /api/v1/analyze`; `gemini_service.py`; the sample bill photo was read correctly in 6–9 s |
| PDF bills and EOB letters | VERIFIED live over HTTP (2026-10-10): the sample ER bill PDF, and the EOB PDF in Spanish | `backend/samples/test_bills/` |
| Plain-language explanation in the chosen language | VERIFIED live for English and Spanish; the other 10 languages IMPLEMENTED, UNVERIFIED | `LANGUAGES` in `gemini_service.py` |
| Questions to ask the billing office | IMPLEMENTED, UNVERIFIED: returned with every analysis; content never checked | `GeminiResult.questions_to_ask` |
| Price comparison with Medicare rates | PARTIAL: runs live (Snowflake) and offline (CSV), but flags are misleading for doctor-only rates and multi-unit lines | `snowflake_service.py`; report §5; `docs/decisions/2026-10-10-proposal-price-flags.md` |
| Saving and reopening an analysis | VERIFIED: live (Tiger Data, throwaway schema) and offline | `analysis_store.py`; `GET /api/v1/audits/{id}` |
| Voice question → transcript → analysis → spoken reply | VERIFIED live (English) | `POST /api/v1/voice/analyze` |
| Spoken reply includes the price findings | VERIFIED live (English only) | `spoken_reply()` in `voice_routes.py` |
| Hear a saved analysis again, without re-analyzing | VERIFIED live | `POST /api/v1/voice/speak` |
| Voice picker and samples; streamed replies; byte ranges for iPhones | Picker and samples: VERIFIED mocked. Streaming: VERIFIED live (first audio after 0.43 s, 2026-10-09). Byte ranges: live on 2026-10-10 just before `d1753db`, mocked at `d1753db`. iPhone playback: UNVERIFIED | `GET /api/v1/voice/voices`, `/audio/{id}` |
| Spoken replies in languages other than English | PLANNED: text-to-speech accepts English only | `text_to_speech/service.py` |
| Developer console (every route in a browser) | VERIFIED mocked (headless Chrome, a stand-in for ElevenLabs, 58 checks). Its API also answered live requests (curl, 2026-10-10) | `backend/dev_console.py` |
| Mobile app | PARTIAL, not merged: a prototype on `frontend-aarush` with local sample data and no backend calls. On this branch: the Expo starter | `mobile/` |
| Follow-up questions about a saved bill | PLANNED: no route takes an `audit_id` plus a question | `docs/decisions/2026-10-10-proposal-followup-questions.md` |
| Authentication, rate limits | PLANNED: none; anyone who can reach the server can spend credits | `main.py` (CORS `*`); `docs/decisions/2026-10-10-proposal-app-key.md` |
| Tiger Data audit / regional benchmark tables | VERIFIED live by its own 4 tests only (throwaway schema); not connected to any route | `tigerdata_service.py` |
| Deadline tracking, notifications, credit dashboard | PLANNED (whiteboard only) | — |
| Phone negotiation script, voice agent, outbound calls | PLANNED (whiteboard only) | — |
| Solana escrow, micro-grants, on-chain receipts | PLANNED: unconfirmed stretch idea, no code, no accepted decision | — |

## External services and settings

All settings live in `backend/.env` (git-ignored). Variable names only; never commit values.

| Service | Variables |
|---|---|
| Gemini | `GEMINI_API_KEY`, `GEMINI_MODEL` (code default `gemini-3.8-flash`), `GEMINI_FALLBACK_MODEL`, `GEMINI_ATTEMPT_TIMEOUT_S`, `MOCK` |
| Snowflake | `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USER`, `SNOWFLAKE_PASSWORD`, `SNOWFLAKE_WAREHOUSE`, `SNOWFLAKE_DATABASE`, `SNOWFLAKE_SCHEMA`, `PRICE_SOURCE` (`csv` = skip Snowflake) |
| Tiger Data | `TIGER_DATA_POSTGRES_URL`; tests: `TIGER_TEST_DATABASE_URL` |
| ElevenLabs | `ELEVENLABS_API_KEY`, `ELEVENLABS_MODEL_ID`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_OUTPUT_FORMAT`, `ELEVENLABS_SPEED`, `ELEVENLABS_TEXT_NORMALIZATION`, `ELEVENLABS_STT_MODEL_ID`, `ELEVENLABS_BASE_URL`, `TTS_MAX_CHARS`, `TTS_TIMEOUT_SECONDS`, `TTS_MAX_RETRIES`, `TTS_CACHE_DIR`, `STT_MAX_AUDIO_MB`, `STT_TIMEOUT_SECONDS`, `STT_MAX_RETRIES` |
| Any | `PYTHON_DOTENV_DISABLED=1` stops every settings file from loading (useful in tests) |

Explanations of each audio variable: `backend/services/audio_service/.env.example`. Python dependencies:
`backend/requirements.txt` (unpinned) and `backend/services/audio_service/requirements.txt` (pinned).

## Benchmark data: what it really is

`backend/data/cpt_benchmarks.csv` (and the Snowflake table loaded from it by `load_benchmarks.py`) holds 7,745
rows, all from the **CMS 2026 Physician Fee Schedule (RVU26D, October release), national rates**.
- National, not regional or by ZIP code; not "fair-market" medians.
- 4,043 rows are the *facility* rate, which pays only the doctor's part of a hospital service.
- It is what Medicare pays, not what a private insurer negotiated or what a hospital must charge.

## Assumptions to avoid

- An **EOB** is a statement of how one claim was processed; it is not the insurance policy itself.
- A **benchmark difference** is a reason to ask questions. It is not a proven billing error, proof of
  overcharging, or guaranteed savings. The app's notes and spoken replies are written that way; keep it so.
- Verify a benchmark's **source, year, geography and meaning** before calling it regional or fair-market data.
  Today's data is national Medicare rates (above).
- **Missing values and missing benchmarks are not zero differences.** They are flagged `no_code`,
  `no_benchmark` or `no_amount`, and their ratio is `null`.
- Do not infer **deductible or out-of-pocket balances** without supporting evidence in the document. The
  whiteboard's sample sentence ("your out-of-pocket maximum was already reached… you shouldn't owe this")
  is not something the app can know from a bill alone.
- **Saving to a database does not mean deadline tracking or notifications.** Neither exists.
- **Speech-to-text and text-to-speech do not mean a conversation or phone calls.** Each voice question is
  answered on its own; nothing places calls.
- **A successful Git merge does not prove the parts work together.** Only tests and live runs do.
- **Solana escrow, micro-grants and on-chain receipts** are unconfirmed stretch ideas. Do not repeat claims that
  escrow or blockchain receipts protect credit scores, stop collections or have legal standing.
- **Check current model availability and language support** before relying on it. On 2026-10-10 the code's
  default `gemini-3.8-flash` did not answer for the team's key, `gemini-2.5-flash` was no longer offered to new
  keys, and ElevenLabs replies are English-only in this code (the whiteboard mentions "30+ languages").

## Frontend: evidence and open choices

- **In the repository:** `mobile/` is an Expo (React Native) app, SDK 57 (`expo ~57.0.27`, `react-native 0.86.3`,
  `react 19.2.3`). `App.js` is the starter screen; `expo-camera`, `expo-document-picker` and `expo-av` are
  installed but unused. The `web` script exists, but React Native Web is not installed, so there is no web build.
- **On the branch `frontend-aarush`** (Aarush Kumar, 2026-10-10; not merged): Expo Router in `mobile/src/app/`,
  TypeScript, React Native Web, a development build (`expo start --dev-client`), `expo-image-picker`,
  `expo-document-picker` and `expo-speech` (the phone's own voice). It uses local sample data, calls no backend
  route, and has no player for the backend's MP3 replies.
- **On the whiteboard:** "React Native / Expo or Mobile Web PWA" in the task plan, "React + Tailwind CSS" in the
  tech-stack list, and a diagram of a "React Native/Expo App".
- **Unresolved:** the prototype uses Expo Router and TypeScript, but no decision is recorded. Also open: the
  player for the backend's replies (`expo-audio` is recommended in the audio docs), and whether the web build
  matters.

## Contradictions between plans and code

| Topic | Whiteboard | Code |
|---|---|---|
| Main route | `/api/v1/process-bill` (task plan), `/api/audit-bill` (diagram) | `POST /api/v1/analyze` and `/api/v1/voice/*` |
| Response | `claim_id`, `fair_market_total`, `potential_savings`, `is_overcharge`, `audio_stream_url` | `AnalyzeResponse` with flags and ratios; no savings or overcharge fields, by design; `audit.audit_id`; `speech.audio_url` |
| Benchmarks | regional, ZIP code, fair-market medians | national Medicare rates |
| Tiger Data | time-series hypertables, deadlines, alerts | plain tables for saved analyses |
| Languages | Gemini "100+", ElevenLabs "30+" | 12 text languages; English voice replies |
| Models | Gemini 1.5 Flash/Pro; `eleven_multilingual_v2` / `eleven_v3` | `GEMINI_MODEL` setting (default `gemini-3.8-flash`); `eleven_multilingual_v2` |

Which contract to keep is an open team decision: `docs/decisions/2026-10-10-open-whiteboard-contract.md`.

## Scope reductions for a reliable demo

There is a proposal, not a decision: `docs/decisions/2026-10-10-proposal-demo-scope.md`.

## Sources

- This repository at `d1753db`, and `BACKEND_VERIFICATION_REPORT.md`.
- The team whiteboard `Untitled-2026-10-10-0922.excalidraw`, which is not in the repository. Of its 126
  non-deleted elements, all 89 text elements and all 7 embedded images were read:
  - **Project material, six images:** an ElevenLabs role table, a "Gemini is the brain, ElevenLabs is the voice"
    example, a team architecture diagram, a workflow diagram, and two logos.
  - **Ignored:** a campus map image and three text notes with meeting directions and map links.
  - **Not interpreted:** the freehand drawings, which are hand strokes with no text.

  The whiteboard is planning material, not a specification.
