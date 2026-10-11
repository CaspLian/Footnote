# Document evidence, captions and microphone corrections

- Status: implementation complete; Aarush confirmed physical live microphone works
- Owner: Aarush frontend / Codex. Branch: frontend-aarush. Updated: 2026-10-11.
- Base: af49b5f. All task changes remain uncommitted and unpushed, as requested.

## Changes

- Gemini's additive result contract now separates provider-statement amounts, EOB amounts, prior patient payments, discounts and combined copay/coinsurance. Each uploaded file receives its own classification and line evidence uses file index independently from page number. The previous contract had no slots for most of these amounts and treated independent uploads as one document's pages.
- Auto adopts the returned classification per attachment. Imported-document verification, review and request preparation are blocked until document reading succeeds. The saved extraction records the exact processed attachment IDs; changing the file set invalidates it. Legacy successful analyses remain supported. Error/offline document reading offers recovery rather than an entry form.
- Review displays sourced amounts, retains separate insurer payments, and calculates a statement balance only from its own adjustments and payments. Unrelated EOB and bill amounts are not combined. Missing amounts are omitted rather than presented as Unknown/Not shown or invented.
- Document removal deletes the app-owned local file/IndexedDB blob before updating the case. Failure preserves the attachment; successful removal invalidates dependent evidence and unedited extracted amounts. Manage documents is available from verification.
- Chinese/Japanese Guide placeholders are corrected. Camera/intake/confirmation phrases have explicit bundled translations for all 30 non-English choices. New copy was generated entirely offline with the pinned local NLLB model; curated document/common-control/Spanish overrides were reapplied afterward. No UI text or user data was sent to an online translation service.
- Captions have a themed surface, border and shadow. Text wraps without a line limit in both orb states. Long replies remain accessible through a bounded, scrollable panel following the orb's movement. Smaller Footnote logo/name sit in the central lock-screen content where the lock illustration was. Caption width and height follow the text rather than reserving a large rectangle.
- Native live voice uses LiveKit's static recording/playout policy to retain playAndRecord/voiceChat during agent playback. Duplex settings are restored after connection and unmuting. SDK microphone-control failures end the call and show recovery rather than silently showing Listening. SDK teardown owns AudioSession start/stop; no additional unbalanced activation calls were added.

## Actual verification, uncommitted tree

- Mobile: `npm test` -> 191 passed; TypeScript and lint passed. Tests cover document-set gating, review/draft rejection before processing, per-file classification, payment separation, combined cost-share amounts, local deletion failure recovery, locale copy, post-connection/unmute activation and SDK microphone-control failure cleanup.
- Backend: 54 focused tests passed, 10 database-dependent tests skipped with dotenv disabled and no production database configured for tests.
- Live integration used only the two synthetic Northline/Liberty images supplied by Aarush. Final analysis ID: `de99605b-b19c-49d8-91d1-2aff60884e74`. Gemini returned statement billed 2670, adjustments 1440, post-adjustment 1230, insurer paid 686, prior patient payment 50, balance 494; EOB billed 8450, allowed 6550, insurer paid 2840, responsibility 3710 and combined copay/coinsurance 710. Separate copayment/coinsurance remained null. Snowflake source confirmed; Tiger audit saved and reopened with identical financials.
- The earlier synthetic test ID `7d874017-fc8d-4327-81c9-53a08cd3d8f6` predates the combined copay/coinsurance correction; it remains historical evidence and was not rewritten or removed.
- Both documents share patient/provider/date but differ in services and scope (EOB includes MRI). Gemini reports documents_match=false. The bill calculation is 1230 - 686 - 50 = 494. Do not subtract this bill's 50 payment from the unrelated EOB responsibility.
- iPhone Release build succeeded with JS bundling. Final build log: `/private/tmp/footnote-final-microphone-build.log`. Installed and launched on iPhone `00008130-000435A82178001C`, bundle `org.hackknights.unfold`, without uninstalling or clearing saved cases. The approved LAN API is listening and reachable.

## Interfaces and next use

- Backend changes are additive JSON fields in the existing analysis payload; no database migration. See docs/API_CONTRACTS.md.
- Comprehensive read-only queries: docs/sql/view-tiger-audits.sql. Extraction tables bill_analyses/bill_analysis_lines and claim tables audit_records/audit_line_items/audit_events have separate audit IDs.
- Existing cases must use Review documents again or Manage documents -> Use these documents to populate the newly supported amounts. No silent reupload occurs just from opening an old review.
- Approved LAN backend remains necessary for the installed phone. Credentials remain in the ignored backend environment, not bundled in the app.
- Aarush confirmed the installed agent hears and answers spoken input. Rendered captions/deletion still require a phone check. Unit tests and successful installation do not establish actual AVAudioSession routing. Native speakers have not reviewed every offline translation. Android runtime was not exercised in this task.

## Follow-up layout correction

Aarush confirmed the microphone works, then requested smaller centered lock branding and a caption background limited to the actual text. Both adjustments are implemented. The caption viewport explicitly follows content height, while native text measurement provides a snug width; long text remains scrollable without line truncation. Final iPhone build: `/private/tmp/footnote-caption-layout-build.log`. TypeScript and lint passed. Release build succeeded and was installed and launched on the same iPhone, preserving saved cases. Visual phone confirmation for this small follow-up is pending. No commit or push.

## Final UI/UX and Camera Refinements (2026-10-11)

- **Lock Screen**: Removed workspace locked badge, dotted connector line and lock icon; centered larger Footnote logo/wordmark.
- **Double-Tap End Conversation**: Double-tap on the orb ends conversation with haptic feedback. Fixed worklet call in `particle-orb.tsx` using `runOnJS`.
- **Camera & Confirmation**:
  - Combined Retake and Add Another onto one row. Added Photo Library import button.
  - Replaced bulky thumbnail stack with single-row horizontal scroll strip with delete button badges and haptics on removal.
  - Viewfinder height set to full 440px with 24px corner radius preserving natural tall aspect ratio for documents.
  - Header renamed to "Photograph bill" with standard `<Txt variant="title">` and body typography.
  - Intake screen no longer prompts for document type before importing; all imports default to `'auto'`.
  - Once processed into bill, eob, or policy, documents cannot change type and the "Auto" option is omitted.
- **Search Behavior**:
  - iOS search bar is static (`hideNavigationBar={false}`) and does not slide up to hide the navigation bar.
  - Display headings (`Your bills`, `Insurance terms`) and bottom disclaimer descriptions are hidden during active search to give full space to search results.
  - Removed Reanimated `LinearTransition` layout shifters that caused vertical bouncing.
- **Language Selection**:
  - Added haptics on selecting/changing languages in both the onboarding grid and the settings language screen.
  - Removed the top-right corner checkmark icon from selected language pills in `LanguageGrid`.
- **Identifier**: Updated app identifier to `footnote.compare` in `app.json`.
- **Verification**: 191 mobile unit tests pass (`npm test`), TypeScript typecheck 0 errors, bundled and verified live on Aarush's iPhone.
