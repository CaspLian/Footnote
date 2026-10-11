# Footnote identity and Android audio integration

- Status: checkpoint prepared for the requested `merged-v1` push; broader cleanup remains open as listed below
- Owner: Nimesh with Codex
- Branch: `merged-v1`
- Last updated: 2026-10-10, America/New_York

## Objective

Use Footnote consistently in the mobile app, earlier web app, backend, voice helper, brand assets and project documentation. Remove public prototype and preloaded-data journeys. Preserve existing bills and the installed app identity, as explicitly requested by Nimesh.

## Implemented

- Renamed display text, accessibility labels, service messages, TypeScript store/loader identifiers, package names, Expo name/slug/scheme and brand documentation. Permission prompts name Footnote.
- Used the supplied five-arm asterisk for the header and app/icon/splash assets, retaining the existing Geist typography and palette.
- Removed preset-bill entry points from Welcome, Home, Intake, Onboarding and Settings. The earlier web app starts empty and its upload modal calls the existing document-analysis service instead of returning a preset case.
- Earlier fixture cases remain in storage, with their classification intact. They are excluded from visible bill lists and case routes. Test fixtures and financial safeguards remain available to internal tests.
- Migrated validated saved metadata from the earlier key to `footnote-local-v1`, preserving profiles, amounts, drafts, actions and original document URIs. Failed migration writes preserve recovered data and can be retried; explicit empty-data recovery clears both keys. Native file deletion and web IndexedDB readers recognize earlier document locations. Existing app-lock settings remain readable.
- Renamed the configured private ElevenLabs agent in place to **Footnote Bill Helper**, with provider read-back verification. Gemini model, private authentication, disabled voice recording, seven-day retention and bounded client tools remain configured. Greetings and speech pronunciation use Footnote.
- Snowflake database selection now uses the configured database instead of assuming that the physical database has the new product name. Existing private connection settings and database contents were preserved.

## Android voice preview finding and fix

Nimesh reported silence in Settings → Preview voice, followed by `undefined is not a function`. Read-only checks showed that Android requested the preview and the backend returned HTTP 200; emulator media audio was unmuted. The installed React Native runtime imports `abort-controller`, which does not implement `AbortSignal.throwIfAborted()`. TypeScript and Node's newer implementation had concealed the incompatibility.

Connected services now check cancellation through a compatible helper. The preview downloads before playing, explicitly enables speaker playback, waits for native loading/start confirmation, supports cancelling a pending request, and exposes native playback errors. The helper is tested against React Native's actual abort-controller package.

**Nimesh retried Preview voice after the fix and confirmed: “I can hear the voice.”** This establishes audible Android preview playback. It does not establish Android saved-bill narration, live orb conversations, fresh document uploads or physical-camera behavior.

## Verification executed

- Mobile typecheck and lint: passed without warnings.
- Mobile automated tests: **166 passed**, including four saved-data migration checks, four audio-readiness checks and two cross-runtime cancellation checks.
- Backend tests in a separate local verification database, with dotenv disabled: **165 passed, 2 skipped**.
- Audio tests: **649 passed**, including guarded in-place agent renaming.
- Earlier web app: production build passed; **19 tests passed, 3 live tests skipped**.
- Final Expo web export and iOS JavaScript export: passed, including the cancellation helper update.
- Generated Android resources show `app_name = Footnote` while retaining the installed application ID. The additional APK rebuild was stopped when Nimesh requested pushing the current checkpoint for iOS testing; no reinstall or UI automation interrupted his emulator use.

## Remaining checks

- Welcome, Intake and Settings passed an isolated browser review with no console errors; current screenshots replace older branded exports.
- Complete local folder renaming and removal of hardcoded charges from the earlier standalone web app. These were deferred when Nimesh requested pushing the work so far. The shared `mobile/` app is the iOS testing target.
- Android live conversation, saved-bill reading and fresh imported-document flow remain unverified; iOS and physical-camera checks remain separate.
- No application authentication or system follow-up notifications have been added. Existing physician-only benchmark flag limitations remain documented.
- Nimesh explicitly requested publishing the current work on a new `merged-v1` branch. No deployment, outbound call or message was performed. Physical iPhone setup is documented in `docs/IOS_TESTING.md`.
