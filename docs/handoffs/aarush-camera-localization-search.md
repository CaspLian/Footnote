# Aarush: camera recovery, localization and voice controls

- Status: implemented locally; signed Release build installed and launched on the iPhone
- Branch: frontend-aarush
- Updated: 2026-10-11
- Starting commit: aad80d9
- Delivery constraint: keep all changes local. The user's latest instruction explicitly forbids pushing to GitHub.

## Implemented

- Quick camera uses the in-app Expo Camera route. The prior ImagePicker camera and fullscreen progress-modal handoff could race native presentation; no physical crash log isolated the original cause. Preparation now renders an in-place screen overlay. Capture is full width with a camera icon. Preview actions are stacked, use singular/plural photo labels, and permit up to ten confirmed photos before reading begins.
- Choose photos uses the same in-place preparation overlay. Native picker results wait through a 450 ms iOS dismissal window and one render frame before preparation or recovery, rather than presenting a second controller as UIKit closes the picker. Photos explicitly request the current asset representation, allowing Expo's original-file copy path. Ordered multi-selection and confirmation are retained. The device crash-log directory returned no Footnote reports on 2026-10-11; the reported black screen has not been physically reproduced or verified fixed.
- Empty prose-only, unknown-amount and non-medical extraction results fail with `no_details`. A dedicated recovery screen offers retry, document replacement and explicit manual entry. Provider/date/summary text alone never produces a successful verification step. Zero-valued EOB financial evidence remains valid.
- App labels and help text use bundled offline translation catalogs for the 31 working languages. Dates, native search labels and RTL layout follow the working locale. The UI message catalog now includes app-authored comparison and synthetic finding text. Financial values, service codes and original excerpts remain unchanged. Saved dynamic Gemini prose retains its original analysis language.
- Bills and Guide let native UISearchController own the iOS header transition, keep the native title stable, and animate content reflow. Search and non-search states soften below the search edge; Bills also softens above Add documents. Native keyboard avoidance remains in keyboard-controller.
- Voice choices use provider-verified language metadata, actual provider names, explicit saved provider keys, recoverable loading/empty states and a stationary header/confirm button. Working-language selection was removed from the voice chooser.
- Orb controls are a compact stack of icon actions, a locally saved captions switch enabled by default, and optional typed questions. Captions sit above the orb, follow its drag and use one line when minimized. The orb's circular background-color radial softening persists when minimized. It sits closer to the workflow CTA. The explicit 30 fps projection throttle was removed; three paths update on the UI frame driver, which pauses offscreen/backgrounded and for reduced motion.
- Typed questions call ElevenLabs `sendUserMessage`; typing calls `sendUserActivity` where available. The existing provider client tools highlight source-linked findings. No new provider tool configuration or automatic financial action was added.
- App lock shows the Footnote mark and name centered at the top and centers its explanatory content and unlock action.
- Simplified screen headings and helper copy. No new online translation service or native dependency was added.

## Design artifacts

- Editable 3:2 project media: https://www.figma.com/design/rZ1cdq02M7Q3CS9S9qQ8kC?node-id=138-26
- Editable Open Graph media, 1200 × 630: https://www.figma.com/design/rZ1cdq02M7Q3CS9S9qQ8kC?node-id=147-25
- Extraction recovery frame: https://www.figma.com/design/rZ1cdq02M7Q3CS9S9qQ8kC?node-id=139-739
- Store badges are media design placeholders; no store listing was published.

## Verification boundary

Before the user's latest request to stop testing: 176 mobile tests passed, 62 focused backend voice/language tests passed with dotenv disabled, TypeScript/lint passed, and Expo Doctor passed 21/21. Native prebuild and CocoaPods completed. Compact browser review covered the earlier Bills/search states and Figma media was visually reviewed.

The user explicitly requested no tests after the latest camera/lock/voice/captions/translation edits. No test suite, typecheck, lint or runtime test was rerun for those edits. Offline generation finished for all 30 non-English catalogs, followed by curated common controls and the existing Spanish glossary. The signed iOS Release build succeeded with JavaScript bundling, and was installed and launched on device `00008130-000435A82178001C` without uninstalling its saved workspace. Build log: `/private/tmp/footnote-camera-language-build.log`. These delivery steps do not verify the camera/photo handoff, frame rate, haptics or typed live-agent behavior. Physical Android remains unverified. Native speakers have not reviewed all generated language prose.

## Interfaces

`GET /api/v1/voice/voices` has additive public `verified_languages` metadata. No database or route changes. Local preferences add `voiceCaptions: true`, with normalization for existing installs. Build-only translation scripts use a local pinned NLLB model and preserve interpolation parameters/financial numbers; no model is bundled.

The approved phone backend still runs on the Mac's LAN address and requires network reachability. Private credentials remain in the ignored backend environment. The installed app bundles its JavaScript and does not require Metro.
