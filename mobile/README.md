# Unfold frontend

Shared Expo SDK 57 / React Native / TypeScript app for iOS, Android, and responsive web. This branch replaces the Expo starter with the current Unfold frontend; it does not connect or change the backend.

## Run

```sh
cd mobile
npm ci
npm run web
```

For an iPhone simulator, install Xcode and run:

```sh
npm run ios
```

Once the development client is installed, restart its development server with `npm start`. Press `i` to open the simulator. Use the default server host; the previously tested `--localhost` configuration bound only IPv6 while the simulator requested IPv4.

Android needs the Android SDK, Java, and an emulator or connected device:

```sh
npm run android
```

Use a development build, not Expo Go: PDF preview uses `react-native-pdf` and `react-native-blob-util`. Native projects are generated from `app.json`; they are intentionally excluded from Git. Rebuild after changing native dependencies or config plugins. iOS scene support is enabled for Xcode 27.

## Current iteration

- English-first onboarding collects a nickname, optional ZIP, coverage context, explanation preference, and starting goal.
- Local self, child, partner, and dependent profiles; bills are associated with the selected profile.
- Camera/photo/PDF selection, document classification, original preview, and editable verification.
- A synthetic paired bill/EOB supports the complete review demonstration; arbitrary imports require manual entry and receive no invented extraction or findings.
- Simple/detailed explanations, source-linked questions, contextual live-agent controls with captions, editable billing-correction and insurer-review drafts, clipboard copy, PDF export, and explicit submission records.
- Follow-up reminders, separately confirmed notice dates, recorded actions, glossary, and resettable sample.
- Native biometric app-lock options with device-passcode fallback and setup/cancellation recovery.
- Proportional Geist typography, Phosphor icons, restrained gradients, paper shadows, progressive detail, and a folding-paper loader with reduced-motion support.

The native workspace uses AsyncStorage and app-local files. The web workspace uses localStorage and IndexedDB. Family profiles are local, with no account, cloud sync, or shared family access. App lock gates access and does not encrypt imported files. Browser PDF export opens print/save-as-PDF; native export uses the OS share sheet. Sharing never marks a request submitted.

## Integration boundary

Document processing, benchmark lookup, draft preparation, and narration have asynchronous interfaces in `src/domain/types.ts`, with local implementations in `src/services` and `src/native`. The proposed Gemini, Snowflake, Tiger Data, and ElevenLabs pipeline is not connected. The ClaimPulse repository's main branch at `8c1a321` contains backend scaffolding; this app makes no live backend requests.

Money is stored in integer cents. Billed charges, allowed amounts, insurer payments, prior patient payments, and remaining responsibility stay separate. Findings are clarification questions, not guaranteed savings or a determination of what is owed.

## Demo

On a fresh install, finish personal setup, then choose **Explore the sample** on Home. Preview a source PDF, confirm the sample values, open the review, inspect a finding, and prepare a request. Only mark the fictional request submitted when demonstrating that explicit action. Save a reminder in the timeline. **Settings → Reset the sample** resets its progress while preserving family profiles and imported cases.

Editable design: [Unfold mobile and web prototype](https://www.figma.com/design/rZ1cdq02M7Q3CS9S9qQ8kC?node-id=51-934).

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run doctor
npm run bundle:ios
npm run bundle:android
npm run bundle:web
```

TypeScript, lint, 66 focused tests, Expo Doctor (21/21), and iOS/Android/web exports pass for the restored version. The native development client was rebuilt, installed and launched on an iPhone 18 Pro / iOS 27 simulator. The available simulator tooling captures UI but does not expose tap/swipe automation, so a fresh native keyboard/gesture, camera-permission, biometric and screen-reader walkthrough remains a runtime validation gap. Android runtime and a real ElevenLabs conversation are also pending.

The recovered code lives on `frontend-aarush`. Start Metro with `npm start`, then open the installed Unfold development client. Use `npm run ios` when native dependencies need rebuilding.
