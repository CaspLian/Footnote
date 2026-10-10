# Backend wiring and voice routes

- Status: done (open follow-ups: `backend-follow-ups.md`)
- Owner: Nimesh        Branch: `Gemini-Tiger-Snow-Integration-V1`        Last updated: 2026-10-10

## Objective and acceptance criteria

Connect the Gemini analysis, the price check, saving and voice into one app that the mobile client can call:
- Every analysis is saved, or reported as not saved, without ever failing the request.
- A saved analysis can be read back (`GET /api/v1/audits/{id}`) and spoken again (`POST /api/v1/voice/speak`).
- The voice routes are mounted in `main.py`, and the spoken reply includes what the price check found.
- A local page tries every route: `backend/dev_console.py`.
- All of it is verified offline and live.

## Files and interfaces affected

- `backend/main.py`: save step, audit route, voice router.
- `backend/models.py`: `AuditInfo`, `AnalyzeResponse.audit`.
- `backend/services/analytical_services/analysis_store.py`: new tables `bill_analyses` and `bill_analysis_lines`.
- `backend/services/audio_service/voice_routes.py`: `/speak` and `Speech.text`.
- The two audio config modules and `audio_service/conftest.py`.
- `backend/dev_console.py` and `.html`, and the tests.
- The services moved into one folder each (`docs/decisions/2026-10-10-service-folders.md`).

## Done (commit `d1753db`)

All the acceptance criteria above. Also:
- The voice code reads only `ELEVENLABS_*`, `TTS_*` and `STT_*` names from settings files.
- Reply audio is `Cache-Control: private`.
- Bills and recordings are checked before speech-to-text is paid for.
- Phone locales such as `en-US` work.
- The console refuses requests from other web pages.

## Remaining

Nothing for this task. Open follow-ups moved to `backend-follow-ups.md`.

## Tests run (actual results)

- **2026-10-10, `d1753db`, mocked:**
  - `cd backend/services/audio_service && python -m pytest -q`: 528 passed.
  - `cd backend && PYTHON_DOTENV_DISABLED=1 TIGER_TEST_DATABASE_URL=<local test db> TIGER_DATA_POSTGRES_URL=<local test db> python -m pytest tests -q`: 59 passed.
  - Both suites in one session, in either order: 587 passed.
- **2026-10-10, `d1753db`:** the developer console in headless Chrome with a stand-in for ElevenLabs, 58 of 58
  checks.
- **2026-10-10, `d1753db`, live:** 15 of 15 checks, with Gemini `gemini-3.5-flash`, Snowflake (read-only),
  Tiger Data (inside a throwaway schema, then dropped) and ElevenLabs in both directions.
- The browser-test and live-test scripts are not in the repository; they lived in a local scratch folder.

## API, dependency or schema changes

The full contract is in `docs/API_CONTRACTS.md`.
- **New fields:** `AnalyzeResponse.audit` and `Speech.text`.
- **New routes:** `GET /api/v1/audits/{id}` and `POST /api/v1/voice/speak`.
- **New tables:** `bill_analyses` and `bill_analysis_lines`.
- **Import paths changed** to `services/<name>_services/`.

## Blockers and assumptions

- `backend/.env` holds every key, with `GEMINI_MODEL=gemini-3.5-flash` (the code's default did not answer).
- Live checks spend small amounts of Gemini, ElevenLabs and Snowflake credits.

## Next steps

See `backend-follow-ups.md`.
