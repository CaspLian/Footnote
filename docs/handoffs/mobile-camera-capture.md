# Mobile camera capture and Gemini analysis

- Status: in progress (automated checks pass; physical Android run pending)
- Owner: Codex        Branch: `Camera-capture`        Last updated: 2026-10-10

## Objective and acceptance criteria

Keep the Unfold frontend and camera-to-Gemini analysis on the newer integrated backend base. A user can capture
hospital-bill pages on a phone, send the ordered JPEG pages to Gemini, and verify the returned information.

## Files and interfaces affected

- `mobile/src/screens/camera.tsx`, `mobile/src/services/gemini-api.ts`, `mobile/src/screens/processing.tsx`, and
  related mobile camera/extraction flow.
- `backend/main.py`, `backend/models.py`, `backend/services/gemini_services/gemini_service.py`.
- `POST /api/v1/analyze` accepts legacy `file` plus repeated `files`; up to 10 uploads and 15 MB total.
  `LineItem.source_page` is an optional 1-based page reference.
- `docs/API_CONTRACTS.md` documents the upload contract.

## Done

- Rebased the `Camera-capture` camera integration commit onto `Gemini-Tiger-Snow-ElevenLabs-V2` (base commit
  `24f315b`). Rebase completed without conflicts; current commit `9840e5f`.
- Kept the Aarush Unfold UI, added native camera capture, local JPEG page persistence, ordered multipart uploads,
  Gemini extraction mapping, and editable result verification.
- Added README phone testing instructions and EAS ignore rules for monorepo Python caches and secrets.
- Updated the API contract and mobile assistant notes for the integrated app and multi-page image upload.

## Remaining

- Finish Android Studio's first-run SDK setup, enable USB debugging, and install/run the app on a physical Android.
- Verify camera permission, retake/remove page flow, multi-page capture, upload, Gemini extraction, and retry with
  the phone and backend on the same Wi-Fi.
- EAS cloud archiving still fails on `backend/.pytest_cache` with `EPERM`; local Android build is the current path.

## Tests run (actual results)

- `npm run typecheck` and `npm run lint` in `mobile/` â†’ passed after the rebase.
- Mobile domain/store/native tests â†’ 39 passed. Node 24 on this Windows host errors in `os.userInfo()` under
  plain `npm test`; the suite passed with a temporary process preload that was removed afterward.
- `$env:PYTHON_DOTENV_DISABLED = '1'; uv run --with-requirements requirements.txt --with pytest -- python -m pytest tests/test_wiring.py tests/test_models.py -q`
  from `backend/` â†’ 23 passed, including ordered camera multipart forwarding, upload-size validation, and Gemini
  null normalization. Dotenv was disabled to keep backend/.env out of tests.
- Physical-device runtime â†’ not yet tested; Android Studio's SDK setup is in progress.

## API, dependency or schema changes

- Additive request support: repeatable multipart `files`; legacy single `file` remains accepted.
- Additive response field: `LineItem.source_page`.
- Camera uses JPEGs directly; no PDF conversion.

## Blockers and assumptions

- Real Gemini extraction requires `MOCK=false` and a working `GEMINI_API_KEY` in `backend/.env`; mock mode does
  not confirm Gemini image parsing.
- `mobile/.env.local` must point to the computer's LAN IPv4 address, and phone/computer need the same Wi-Fi.
- EAS archive currently encounters a local permission error scanning `backend/.pytest_cache`, even after the
  ignore rules; it has not produced a phone-installable build.

## Next steps

1. Complete Android Studio setup and connect the phone with USB debugging enabled.
2. From `mobile/`, run `npx expo run:android --device` to build/install locally and start Metro.
3. Test a synthetic bill photo first; verify the returned result and the mock/live indicator. Then test a real
   bill only if the user is comfortable sending it to the configured Gemini service.
