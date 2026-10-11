# Demo-day work: language-verified voices, Guide calls, faster reading, example call, demo documents

- Status: done. The cleanup below is the last commit made for the push before the Devpost deadline
- Owner: Nimesh, with Claude Code        Branch: `Backend-Frontend-Connection-V1`        Last updated: 2026-10-11

## Objective and acceptance criteria

The 2026-10-11 list started by ChatGPT (Codex) and finished here:
- Start from `merged-v1`.
- Voices: only voices for the selected language, with that language's accent.
- The orb works on Guide terms.
- Faster Gemini, still accurate on photos and files.
- A realistic EOB and itemized bill for the demo.
- A Devpost entry and demo plan.
- More ElevenLabs features.

Each item has a test or a live check, listed below.

## Done

| Item | Commits | What changed |
|---|---|---|
| merged-v1 | `3ad973c`, `8cfc48c`, `7dead79` | Merged `origin/merged-v1` (989ecf5); each conflict resolution is in the merge message. The app ID is `footnote.compare`. The orb's ref-during-render lint errors are fixed |
| Language-verified voices | `2e92a11` | A voice speaks a language only if ElevenLabs verified it for that language (`VoiceCatalog.choose`, app `resolveVoiceKey`). All 42 locales have a verified default. 18 Voice Library voices were added. Previews speak the listener's language (`GET /voices/{key}/sample?language=`). Decision: `docs/decisions/2026-10-11-native-voices-and-guide-conversations.md` |
| Guide-term calls | `2e92a11`, `14e0c71` | `POST /voice/agent/session` takes `term_*` fields instead of `audit_id`. The agent gets `guide_topic`. The app sends `opening_message` once the agent has started (`onConversationMetadata`) |
| Faster reading | `d1aa47a`, `802f2a1`, `deeffff` | Gemini 3 thinks "low" (`GEMINI_THINKING_LEVEL`). The Snowflake table loads at startup (`PRICE_WARM_UP`). The attempt limit is 60 s. Decision: `docs/decisions/2026-10-11-gemini-low-thinking.md` |
| Recorded-question privacy | `d1aa47a` | Scribe v2 entity redaction (identifiers only) and English insurance keyterms (`STT_REDACT_ENTITIES`, `STT_KEYTERMS`). The `/voice/analyze` response lists `transcript.redacted` |
| Example call | `802f2a1` | `POST /voice/example-call`: Gemini writes a short call from the saved bill (`write_example_call`, numbers checked, no names, no promises). Text to Dialogue on Eleven v4 performs it. It is the call-script screen's "Hear an example call" card |
| Demo documents | `deeffff` | `demo/documents/`: the Linnet Valley Medical Center statement and the Pellridge Health Plan EOB. Validated through the backend (`VALIDATION.md`) |
| Owe and claim-of-error fix | `deeffff` | The prompt forbids "you do not owe" and claims of error. Same-claim documents stay `documents_match=true`. The review heading is "How the bill and the EOB differ" unless the documents do not match |
| Devpost and demo plan | `4674719`, `817e1ed` | `docs/devpost/`, also published as a private demo-kit page |

## Cleanup and connection check (2026-10-11, 08:20-11:10)

Nimesh asked to remove unnecessary files, organize the folders, keep the shared context and confirm every
backend-frontend connection, because new UIs will be added.
- Removed with Nimesh's approval:
  - the standalone `web/` Vite prototype (Expo web in `mobile/` replaced it; it stays in git history up to `deeffff`);
  - the Figma context dumps `design/context-*.txt`;
  - Expo's template `mobile/LICENSE`;
  - the unused `mobile/local-timeline.js` (it imported packages that are not installed).
- Removed because nothing used them (the typecheck and tests pass without them):
  - `mobile/mock_bill.json` and `brand/.naming-output.md` (exact copies of `backend/mock_bill.json` and
    `brand/naming/footnote-identity-2026-10-10.md`);
  - `mobile/src/i18n/index.ts` and `mobile/src/components/listening-control.tsx` (dead code);
  - `mobile/assets/android-icon-background.png` (an Expo template image).
- `backend/test_snowflake.py` is now `backend/check_snowflake.py`, so pytest never collects it; it logs in to Snowflake.
- `backend/requirements.txt`: the unused `elevenlabs` SDK is replaced by `requests`, which the audio service imports.
- The app accepts recorded questions up to 10 MB, the backend's `STT_MAX_AUDIO_MB` default (it allowed 20 MB).
- `.gitignore` ignores `.env` files anywhere (the `.env.example` templates stay tracked).
- AGENTS.md's repository map lists every folder and says how a new UI connects: build it against
  `docs/API_CONTRACTS.md` and keep provider keys on the backend.
- Connection audit (at `deeffff`; the cleanup changed no route): the backend has 21 method and path pairs. Every
  app call matches a route and its fields, and every route answered a live request (synthetic data, Tiger Data
  test schema). After the cleanup every test suite passes again. A live rerun at 11:00 could not connect to Tiger
  Data from the venue network (connection timeouts), so it was not repeated.

Left for later (not wrong, only stale): test counts and dates in `docs/PROJECT_CONTEXT.md`'s feature table,
`docs/IOS_TESTING.md` (written for `merged-v1`), and the route lists in the audio READMEs (20 voices, English
previews).

## Remaining

- The Devpost deadline is 12:00 PM EDT on 2026-10-11, and code pushed after it is disqualified: later work stays
  local until the organizers allow pushes again.
- Nothing from today is checked on a phone:
  - The iPhone release build needs a rebuild from this branch, and its backend (the Mac) needs this code for Guide
    calls.
  - Android: `npx expo prebuild --clean` (new app ID), then a build.
- The app's "Spanish" is Spain Spanish (`es-ES`). The backend and a Mexican voice (Ana María) support `es-MX` if the
  team adds that choice.
- Hebrew and Thai: ElevenLabs Agents refuse those language presets, so live calls stay unavailable. Readings and
  previews work through v4 Turbo.
- More than six phone photos at the camera's 0.85 quality can pass the 15 MB upload limit. Photograph pages 1-2 of
  each document.

## Tests run (actual results)

- `cd mobile && npm test`: 197 passed. `npx tsc --noEmit` and `npx eslint src`: clean (2 warnings in Aarush's
  files). Rerun after the cleanup.
- `cd backend && TIGER_TEST_DATABASE_URL=<local test db> python -m pytest tests -q`: 198 passed, 2 skipped. Rerun
  after the cleanup.
- `cd backend/services/audio_service && python -m pytest -q`: 675 passed. Rerun after the cleanup.
- Live, all with synthetic data and the Tiger Data test schema:
  - 235 voice clips transcribed back in their languages.
  - Guide-term calls in 6 languages (1.3-1.8 s to the first answer).
  - Example calls in English and Mexican Spanish.
  - Redaction of a synthetic SSN, member ID and phone number.
  - Gemini benchmark (demo photos 16.1 s instead of 80.8 s, all fields exact).
  - Demo-document validation and 4 reruns after the prompt fix.
- Web app (headless Chrome, Spanish): onboarding; voices and previews; a Guide-term call; import, review and
  request of the demo documents; the example call played.

## API, dependency or schema changes

All additive: no route or field was removed. They are documented in `docs/API_CONTRACTS.md`.
- `GET /api/v1/voice/voices/{key}/sample?language=` (new optional query)
- `POST /api/v1/voice/agent/session` (new optional `term_*` fields; new response fields `opening_message` and
  `term_id`)
- `POST /api/v1/voice/example-call` (new route)
- `transcript.redacted` (new response field)
- `voices.json` (18 new voices, a `source` field on each voice)

New settings, all optional:
- `GEMINI_THINKING_LEVEL`
- `GEMINI_MEDIA_RESOLUTION`
- `GEMINI_ATTEMPT_TIMEOUT_S` (default now 60)
- `PRICE_WARM_UP`
- `STT_REDACT_ENTITIES`
- `STT_KEYTERMS`

The dev agent "Footnote Bill Helper" was re-provisioned: its prompt uses `guide_topic`, a session without it still
starts (checked live), and it stays private with voice recording off and 7-day retention.

## Next steps

1. Rebuild the phones from this branch (Android: `npx expo prebuild --clean -p android` first, for the new app ID).
2. Check today's features on both phones: voices, previews, a Guide-term call, the example call.
