# Project status: integration checkpoint

| | |
|---|---|
| Checked on | 2026-10-10 |
| Branch | `Frontend-Integration-V2`: start frontend work here. It is `Gemini-Tiger-Snow-Integration-V1` (`d1753db`) plus these docs and one fix. `main` is older, at `8c1a321` |
| Code | `d1753db` plus the null-text fix in `backend/models.py`; the results below apply to this code |
| Last updated by | Nimesh, with Claude Code. Update this file only at integration checkpoints (see `docs/TEAM_WORKFLOW.md`) |

## What is integrated

- **Merged into `f86e22f`:** `nimesh/audio-service`, `backend-gemini` and `Tiger-data`.
- **The wiring, in `d1753db`:**
  - Every analysis is saved.
  - Saved analyses can be read back and spoken again.
  - The voice routes are mounted in the app.
  - Each service has its own folder under `backend/services/`.
  - A developer console tries every route.
- **After `d1753db`:** Gemini sometimes writes a missing value as the text "null". Such placeholder texts ("null",
  "none", "n/a", empty) now become real nulls (`backend/models.py`; tests in `backend/tests/test_models.py`).
- **Not integrated:**
  - **The mobile app.** On this branch it is still the Expo starter screen. A frontend prototype is on
    `frontend-aarush` (Aarush Kumar, 2026-10-10): Expo Router and TypeScript in `mobile/src/app/`, with local
    sample data. It does not call the backend yet.
  - **`Tiger-data` commit `67c4c3a`** (claim audit lifecycle tracking, 2026-10-10). It is still at the old path,
    `services/tigerdata_service.py`.
  - **The teammate's Tiger Data audit tables** (`tigerdata_service.py`): no route calls them.

## What has been verified (2026-10-10)

- **The real server over HTTP, live.** `uvicorn main:app` ran with the team's keys, saving into a throwaway Tiger
  Data schema. Every route the app calls worked, with requests built like React Native's `FormData`. Times on
  this computer, before any phone network delay:
  - bill photo 13.1 s, PDF bill 7.6 s, EOB PDF 6.1 s (the first live PDFs), typed question 7.6 s
  - saved analyses read back identical (0.24 s)
  - speaking a saved analysis 6.5 s, or 0.25 s from the cache
  - voice question 6.6 s; with a photo and streaming, 7.4 s to the answer

  Byte ranges, streaming, CORS (Expo web and any origin) and every free error path behaved as documented.
- **A teammate's fresh setup.** A fresh clone installed and passed 528 audio and 59 backend tests on Python 3.11,
  3.12 and 3.14. `uvicorn main:app` served the routes, also with `--reload`. Python 3.9 cannot install the
  requirements, so use 3.10 or newer.
- **Offline, with the fix:** 528 audio tests and 69 backend tests pass, against a local PostgreSQL 17.
- **Earlier the same day, at `d1753db`:** the full live test (15 of 15), the developer console in headless Chrome
  (58 of 58), and both suites in one session (587). Details: `BACKEND_VERIFICATION_REPORT.md`.
- **Not verified:**
  - Anything on a phone: reaching the backend over Wi-Fi, recording, playback, streaming on an iPhone.
  - Live answers in the 10 languages other than English and Spanish.
  - Spoken replies in other languages, which aren't implemented.
  - More than a few requests at a time.

## Known integration failures and defects

- **High:** price flags for doctor-only ("facility") Medicare rates are misleading. Ordinary ER charges show
  "far above typical" (all 7 compared ER lines in the live check). See `snowflake_service.py`; the proposed fix is
  in `docs/decisions/2026-10-10-proposal-price-flags.md`.
- **Setup:** by default a phone cannot reach the backend. On 2026-10-10 the Wi-Fi was set to Public and the
  firewall blocked incoming connections. The steps are in `docs/API_CONTRACTS.md`, "From a phone".
- **Medium:**
  - Multi-unit lines are compared with a one-unit rate, and `price_summary.source` can wrongly say `snowflake`.
  - The code's default `gemini-3.8-flash` did not answer for the team's key. Set `GEMINI_MODEL=gemini-3.5-flash`
    (see `docs/decisions/2026-10-10-gemini-model-setting.md`).
  - Gemini retries only 429/500/503; 502, 504, 404 and network errors fail at once.
  - An invalid ElevenLabs key is reported as `PROVIDER_REJECTED` instead of `AUTH_FAILED`.
  - A Tiger Data connection that goes silent part-way through a save can hold the store for 15 s.
- **Tests:**
  - Plain `python -m pytest` in `backend/` fails at collection.
  - With a real `backend/.env`, the teammate's Tiger Data tests use the team database unless
    `PYTHON_DOTENV_DISABLED=1` (see the commands in `AGENTS.md`).
- **Low:** see `BACKEND_VERIFICATION_REPORT.md` §5 and `docs/handoffs/backend-follow-ups.md`.

## Shared blockers

- **No connected mobile client:** the prototype on `frontend-aarush` uses sample data only.
- **No authentication:** keep the backend on a private network. Anyone who can reach it can spend the team's
  Gemini and ElevenLabs credits and read a saved analysis by its ID.
- **Branches:**
  - `main` (the default branch) does not contain the integrated code.
  - `nimesh/audio-service` points at `60d279b`, where the backend cannot start.

## Next three integration priorities

1. **Connect the frontend.** Merge the frontend branch into `Frontend-Integration-V2`. Then replace its local
   sample services with the routes in `docs/API_CONTRACTS.md`:
   - photo or file → `POST /api/v1/analyze`
   - `POST /api/v1/voice/speak` with `audit.audit_id`
   - play `speech.audio_url`

   Test on a real phone.
2. **Fix the doctor-only-rate flags and the price-source label**, because the app shows them and the voice reads
   them aloud.
3. **Agree which branch is the shared base**, and retire the stale ones. Bring in `Tiger-data`'s new commit,
   moved into `services/tigerdata_services/`.
