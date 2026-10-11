# Footnote identity and Android audio integration

- Status: published snapshot preserved on `merged-v1`; source-data cleanup completed locally on the integration branch; remaining native checks below
- Owner: Nimesh with Codex
- Branch: `Backend-Frontend-Connection-V1` (resumed from `merged-v1` at `bb76fbb` by fast-forward)
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
- Continued on the previous integration branch at Nimesh's request, carrying forward both published commits without changing the `merged-v1` pointer.
- Removed the unused preloaded cases and fixed charge/duplicate/EOB/payment tables from the older web app. Verification, review, dashboard and call scripts now use uploaded document details and generated questions. Missing totals, balances, charges, payments, references and savings stay unknown; billed totals do not substitute for patient balances. Unknown line amounts do not enter confirmed claim payloads, while documented zero values remain valid.
- Removed invented deadlines, guaranteed credit protection, legal protection and collection holds from those views. Physician-only references become scope questions without hospital price ratios. Draft edits remain in the current browser session and switching bills resets screen-local state. The older web narration is correctly labelled device voice; the shared mobile app retains connected ElevenLabs playback.

## Android voice preview finding and fix

Nimesh reported silence in Settings → Preview voice, followed by `undefined is not a function`. Read-only checks showed that Android requested the preview and the backend returned HTTP 200; emulator media audio was unmuted. The installed React Native runtime imports `abort-controller`, which does not implement `AbortSignal.throwIfAborted()`. TypeScript and Node's newer implementation had concealed the incompatibility.

Connected services now check cancellation through a compatible helper. The preview downloads before playing, explicitly enables speaker playback, waits for native loading/start confirmation, supports cancelling a pending request, and exposes native playback errors. The helper is tested against React Native's actual abort-controller package.

**Nimesh retried Preview voice after the fix and confirmed: “I can hear the voice.”** This establishes audible Android preview playback. It does not establish Android saved-bill narration, live orb conversations, fresh document uploads or physical-camera behavior.

## Verification executed

- Mobile typecheck and lint: passed without warnings.
- Mobile automated tests: **166 passed**, including four saved-data migration checks, four audio-readiness checks and two cross-runtime cancellation checks.
- Backend tests in a separate local verification database, with dotenv disabled: **165 passed, 2 skipped**.
- Audio tests: **649 passed**, including guarded in-place agent renaming.
- Earlier web app after the continuation: production build/typecheck passed; **26 tests passed, 3 live tests skipped**. Targeted tests cover source-backed English/Spanish rendering, unknown versus zero amounts, claim payload exclusion, empty startup and physician-only references.
- Final Expo web export and iOS JavaScript export: passed, including the cancellation helper update.
- Generated Android resources show `app_name = Footnote` while retaining the installed application ID. The additional APK rebuild was stopped when Nimesh requested pushing the current checkpoint for iOS testing; no reinstall or UI automation interrupted his emulator use.
- After returning to the integration branch, the Android x86_64 debug APK build completed: **BUILD SUCCESSFUL**, 637 tasks (25 executed, 612 up-to-date), in 3m 38s. The APK is in the ignored `mobile/android/app/build/outputs/apk/debug/app-debug.apk`; it has not been reinstalled over Nimesh's current emulator activity. Build log: external `footnote-rebrand-checks/continued-native-build.log`.

## Remaining checks

- Welcome, Intake and Settings passed an isolated browser review with no console errors; current screenshots replace older branded exports.
- Older web upload, verification, review, evidence modal, billing request, dashboard and phone script passed an isolated browser check using a stand-in analysis response: $729.11 billed, $141.09 statement balance, absent EOB/payments. Desktop and 390-pixel phone views had no console errors or page overflow; generated Spanish script copy also loaded. Edited request text persisted through navigation within the session. This check made no provider requests and does not establish a live backend/device result. Screenshots/logs are in the external `footnote-rebrand-checks/web-continuation/` folder.
- Local directory names remain compatible with the running development servers and IDE. The installed app identifiers and database names remain unchanged by explicit identity/persistence decisions. The shared `mobile/` app is the iOS testing target; the earlier standalone web app still lacks durable case storage and uses device narration.
- Android live conversation, saved-bill reading and fresh imported-document flow remain unverified; iOS and physical-camera checks remain separate.
- No application authentication or system follow-up notifications have been added. Existing physician-only benchmark flag limitations remain documented.
- Nimesh explicitly requested publishing the current work on a new `merged-v1` branch. No deployment, outbound call or message was performed. Physical iPhone setup is documented in `docs/IOS_TESTING.md`.
- The continuation has not been pushed. No changes were made to backend routes, response models or database tables in this continuation.
