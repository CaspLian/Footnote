# Backend follow-ups after the wiring

- Status: not started
- Owner: Nimesh        Branch: start a new branch from the integration branch        Last updated: 2026-10-10

## Objective and acceptance criteria

Fix the open issues found by the reviews of the wiring and by the verification. Each fix comes with a test that
fails without it. The audio suite and the backend tests still pass.

## Files and interfaces affected

- `backend/services/analytical_services/analysis_store.py`
- `backend/services/audio_service/voice_routes.py` and its tests
- `backend/services/audio_service/conftest.py`
- the two ElevenLabs providers and `check_setup.py`

No contract change is expected. If one becomes necessary, update `docs/API_CONTRACTS.md`.

## Done

Nothing yet.

## Remaining (not started)

**From the follow-up review of the fixes (2026-10-10):**
- **Medium:** a Tiger Data connection that goes silent after connecting holds a store thread for 15 s.
  - Add TCP keepalives and `idle_in_transaction_session_timeout`.
  - Do not hold `_schema_lock` across database calls (`analysis_store.py`).
- **Low, in the store:**
  - The out-of-time check runs just before COMMIT, so a save reported "not saved" can, rarely, still commit.
  - Every connection failure (including a wrong password) starts the 30 s pause.
  - Jobs queued when an outage starts still try to connect.
  - The 4-thread pool queues more than 4 simultaneous saves.
  - No test checks the real time limits.
- **Low, in the voice routes and tests:**
  - `STT_MAX_AUDIO_MB=nan`, `inf` or a huge value gives a bare 500.
  - The conftest guard does not cover `load_dotenv()` or a `dotenv_values()` call without a path, and it outlives
    a test for late-imported modules.
  - `_base_language` turns malformed codes into automatic language detection.
  - After a voice test, `services.audio_service.voice_routes` still names the test copy.
  - Two fixes have no test that would notice if they were undone.

**From the live HTTP check (2026-10-10; the re-check was stopped early, so these are not re-checked):**
- `HEAD` on the audio and sample routes gives 405.
- The OpenAPI schema describes the audio routes as JSON, and has no schema for `/api/v1/audits/{id}`.
- `transcript.language` is ElevenLabs' 3-letter code (`eng`), not the 2-letter codes used elsewhere.
- `price_summary.source` says `snowflake` even when no line had a code.
- One of two live Spanish answers had no accents (Gemini output varies; consider a prompt line).

**Audio bugs from the verification (`BACKEND_VERIFICATION_REPORT.md` §5):**
- **Medium:** an invalid key (HTTP 400 `invalid_api_key`) is reported as `PROVIDER_REJECTED` instead of
  `AUTH_FAILED`.
- **Low:**
  - HEIC, HEIF and AVIF photos and UTF-16 text pass the audio check.
  - A corrupt recording gives 502.
  - `ELEVENLABS_VOICE_ID` makes "matilda" mean two voices.
  - `text_prep` drops a few symbols.
  - `nan` and `inf` pass the settings checks.
  - `audio_url` ignores an extra mount prefix.
  - Reply audio stays on disk with no expiry.

## Tests run (actual results)

None yet for these fixes. The baseline at `d1753db` is in `docs/PROJECT_STATUS.md`.

## API, dependency or schema changes

None so far.

## Blockers and assumptions

None.

## Next steps

1. Fix the medium store issue and the low ones above, each with a test.
2. Map `invalid_api_key` to `AUTH_FAILED` in both audio providers and in `check_setup`.
3. Consider adding the browser-test harness to the repository so teammates can rerun it.
