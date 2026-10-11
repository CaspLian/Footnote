# Footnote: project context

Last checked: 2026-10-10, branch `Backend-Frontend-Connection-V1` (resumed from the published `merged-v1` snapshot). Re-check
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
7. Review confirmed details in the Footnote app, prepare a request, track the case, or talk through a saved bill.

## Architecture (as implemented)

```
Footnote app (Expo, connected when configured)  or  backend/dev_console.py (local test page)
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
  42 locales from `GET /api/v1/languages` (`backend/locales.py`). Retries 429/500/503 once, then tries `GEMINI_FALLBACK_MODEL`.
  `MOCK=true` returns a fixed sample (in Spanish), whatever the input.
- **Price check (`snowflake_services`)**: looks up each code's Medicare rate and flags each line as `typical`,
  `above_typical` (over 3× and up to 6× the rate), `far_above_typical` (over 6×), `no_code`, `no_benchmark` or
  `no_amount`. It never fails a request: if Snowflake fails it uses the CSV and says so in `price_summary`, and if
  even that fails it returns no checks with `source: "unavailable"`.
- **Saving (`analytical_services/analysis_store.py`)**: writes each analysis to the tables `bill_analyses` and
  `bill_analysis_lines` (created on first use). Saving never fails a request; `response.audit` says whether it worked.
- **Tiger Data tables (`tigerdata_services`)**: claim audit/lifecycle routes record confirmed coded lines, status,
  deadlines and actions. Extraction audits remain separate and can be linked by `analysis_audit_id`.
  The regional-benchmark table is separate from the app's national Medicare lookups.
- **Voice (`audio_service`)**: speech-to-text for questions, text-to-speech for replies, audio delivery with byte
  ranges and optional streaming, a voice picker (20 voices), and a local playground. `voice_agent/` issues bounded
  private ElevenLabs sessions using Gemini and saved bill context; the app connects directly over WebRTC.

## Feature status

Labels: **VERIFIED** (executed; live or mocked as stated), **IMPLEMENTED, UNVERIFIED**, **PARTIAL**, **PLANNED**,
**BLOCKED**. Current integration: `7bd92f0` and the final resume checkpoint, 2026-10-10. Older evidence is retained
in `BACKEND_VERIFICATION_REPORT.md`; current evidence is in `docs/handoffs/claude-resume-integration.md`.
Only the person who merges updates this table, at integration checkpoints
(`AGENTS.md`).
Between checkpoints, record status changes in your handoff.

| Feature | Status | Evidence / where |
|---|---|---|
| Bill photo (PNG) or typed question → structured analysis | VERIFIED: live (Gemini `gemini-3.5-flash`) and mocked | `POST /api/v1/analyze`; `gemini_service.py`; the sample bill photo was read correctly in 6–9 s |
| PDF bills and EOB letters | VERIFIED live over HTTP (2026-10-10): the sample ER bill PDF, and the EOB PDF in Spanish | `backend/samples/test_bills/` |
| Plain-language explanation in the chosen language | VERIFIED live over HTTP (2026-10-10) in `en-US`, `en-GB`, `es-MX`, `es-ES`, `pt-BR`, `ja-JP`, `zh-CN`, `ko-KR`, `hi-IN`, `he-IL`, `th-TH`, `zh-TW` (Traditional characters); the other 30 locales IMPLEMENTED, UNVERIFIED. No native speaker has checked any | `backend/locales.py`, `gemini_service.py` |
| Questions to ask the billing office | IMPLEMENTED, UNVERIFIED: returned with every analysis; content never checked | `GeminiResult.questions_to_ask` |
| Price comparison with Medicare rates | PARTIAL: runs live (Snowflake) and offline (CSV), but flags are misleading for doctor-only rates and multi-unit lines | `snowflake_service.py`; report §5; `docs/decisions/2026-10-10-proposal-price-flags.md` |
| Saving and reopening an analysis | VERIFIED: live (Tiger Data, throwaway schema) and offline | `analysis_store.py`; `GET /api/v1/audits/{id}` |
| Voice question → transcript → analysis → spoken reply | VERIFIED live (English) | `POST /api/v1/voice/analyze` |
| Spoken reply includes the price findings | VERIFIED live English in the final integration; earlier live translations in 11 other locales. Changed numbers in translations are now retried/dropped. Doctor-only findings omit ratios and high-price claims | `spoken_reply()`, `_spoken_text()` in `voice_routes.py` |
| Hear a saved analysis again, without re-analyzing | VERIFIED live | `POST /api/v1/voice/speak` |
| Voice picker and previews; streamed replies; byte ranges for iPhones | Android preview: audible playback confirmed by Nimesh after the cancellation compatibility fix. Catalog and API also verified in automated checks. Streaming: VERIFIED live (first audio after 0.43 s, 2026-10-09). Byte ranges: live on 2026-10-10 just before `d1753db`, mocked at `d1753db`. iPhone playback: UNVERIFIED | `GET /api/v1/voice/voices`, `/audio/{id}` |
| Spoken replies in languages other than English | VERIFIED live (2026-10-10): spoken and heard back in 12 languages and both Chinese scripts, full replies in 12 locales. Hebrew and Thai are spoken by v4 Turbo (Flash v2.5 does not speak them), more slowly. In Arabic, speech-to-text heard the formal "two hundred" as "one hundred" | `text_to_speech/config.py`, `voice_routes.py` |
| Developer console (every route in a browser) | VERIFIED mocked (headless Chrome, a stand-in for ElevenLabs, 58 checks). Its API also answered live requests (curl, 2026-10-10) | `backend/dev_console.py` |
| Mobile app connected to the backend | VERIFIED in Expo web: onboarding, import, extraction, confirmation, review, saved reading and persistent reopening; 166 tests, typecheck and lint pass. Android APK built/installed; updated screens loaded with preserved data. Native fresh upload/live voice remain unverified while Nimesh uses the emulator | `mobile/src/services/backend.ts`, `connected-services.ts` |
| Footnote identity and earlier standalone web source-data screens | VERIFIED locally: published identity retained; 26 web tests and production build pass; upload/review/script browser journey checked with a stand-in response at desktop/phone widths. No preloaded cases, fixed charge tables or inferred savings. Older web storage is session-only and narration uses device voice | `docs/handoffs/footnote-rebrand.md`; `web/src/services/analysis-mapping.ts` |
| Follow-up questions about a saved bill | VERIFIED live web conversation: synthetic microphone question, saved amounts, captions, CT card highlight, mute and End. Agent uses Gemini 3.5 Flash; standalone recorded questions remain separate | `voice_agent/`, `mobile/src/components/agent-orb-control.tsx` |
| Authentication, rate limits | PARTIAL: agent session origin checks, issuance limits and provider limits implemented. No application authentication; other routes remain unprotected | `voice_agent/limits.py`; app-key proposal remains open |
| Tiger Data audit / regional benchmark tables | Claim audit/lifecycle tables VERIFIED live over HTTP with isolated schema; regional benchmark table not used by app lookups | `claim_routes.py`, `tigerdata_service.py` |
| Deadline tracking, notifications, credit dashboard | Claim deadlines and actions VERIFIED live HTTP; app tracking implemented and tested offline. Local reminders persist; system notifications and credit dashboard PLANNED | `claim_routes.py`, mobile claim service/store |
| Phone negotiation script, voice agent, outbound calls | Local request/call-script screens implemented; live bill conversation VERIFIED web. Outbound calls PLANNED, no code places calls | `docs/decisions/2026-10-10-voice-agent.md` |
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
- **Saving extraction audits does not establish deadlines or notifications.** Claim routes store explicit
  deadlines and may return labeled estimates; no system notifications or credit-score protection is implemented.
- **Recorded questions are separate answers.** The live agent converses about a saved bill; corrected bills
  cannot use stale context. Nothing places outbound phone calls.
- **A successful Git merge does not prove the parts work together.** Only tests and live runs do.
- **Solana escrow, micro-grants and on-chain receipts** are unconfirmed stretch ideas. Do not repeat claims that
  escrow or blockchain receipts protect credit scores, stop collections or have legal standing.
- **Check current model availability and language support** before relying on it. On 2026-10-10 the code's
  default `gemini-3.8-flash` did not answer for the team's key, `gemini-2.5-flash` was no longer offered to new
  keys. Replies cover the 42 locales in `backend/locales.py`: the 32 languages Flash v2.5 speaks, and Hebrew and
  Thai on v4 Turbo (the whiteboard mentions "30+ languages").

## Frontend: evidence and open choices

- **In the repository:** `mobile/` is an Expo (React Native) app, SDK 57 (`expo 57.0.27`, `react-native 0.86.3`,
  `react 19.2.3`). Before the merge it was the starter screen; the frontend replaced it.
- **The app (from `frontend-aarush`, merged 2026-10-10):** Expo Router in `mobile/src/app/`, TypeScript, React
  Native Web, a development build (`expo start --dev-client`), `expo-image-picker`, `expo-document-picker`,
  `expo-speech` (the phone's own voice) and now `expo-audio` (the ElevenLabs replies). It calls the backend when
  `EXPO_PUBLIC_API_URL` is set.
- **On the whiteboard:** "React Native / Expo or Mobile Web PWA" in the task plan, "React + Tailwind CSS" in the
  tech-stack list, and a diagram of a "React Native/Expo App".
- **Unresolved:** the design uses Expo Router and TypeScript, but no decision is recorded. Also open:
  whether the web build matters.

## Contradictions between plans and code

| Topic | Whiteboard | Code |
|---|---|---|
| Main route | `/api/v1/process-bill` (task plan), `/api/audit-bill` (diagram) | `POST /api/v1/analyze` and `/api/v1/voice/*` |
| Response | `claim_id`, `fair_market_total`, `potential_savings`, `is_overcharge`, `audio_stream_url` | `AnalyzeResponse` with flags and ratios; no savings or overcharge fields, by design; `audit.audit_id`; `speech.audio_url` |
| Benchmarks | regional, ZIP code, fair-market medians | national Medicare rates |
| Tiger Data | time-series hypertables, deadlines, alerts | plain tables for saved analyses and claim lifecycle/deadlines; no system alerts |
| Languages | Gemini "100+", ElevenLabs "30+" | 42 locales (34 languages), in text and voice |
| Models | Gemini 1.5 Flash/Pro; `eleven_multilingual_v2` / `eleven_v3` | `GEMINI_MODEL` setting (default `gemini-3.8-flash`); `eleven_flash_v2_5` (since 2026-10-10) |

Which contract to keep is an open team decision: `docs/decisions/2026-10-10-open-whiteboard-contract.md`.

## Earlier scope proposal

There is a proposal, not a decision: `docs/decisions/2026-10-10-proposal-demo-scope.md`.

## Sources

- This repository at `7bd92f0` and the final resume checkpoint; current handoff and `PROJECT_STATUS.md`.
  Earlier verification at `d1753db` remains in `BACKEND_VERIFICATION_REPORT.md`.
- The team whiteboard `Untitled-2026-10-10-0922.excalidraw`, which is not in the repository. Of its 126
  non-deleted elements, all 89 text elements and all 7 embedded images were read:
  - **Project material, six images:** an ElevenLabs role table, a "Gemini is the brain, ElevenLabs is the voice"
    example, a team architecture diagram, a workflow diagram, and two logos.
  - **Ignored:** a campus map image and three text notes with meeting directions and map links.
  - **Not interpreted:** the freehand drawings, which are hand strokes with no text.

  The whiteboard is planning material, not a specification.
