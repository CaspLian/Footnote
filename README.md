# Unfold

A native English/Spanish workspace for understanding a medical statement, checking it against an explanation of benefits (EOB), and preparing a request for clarification. Built with Expo SDK 57, React Native, TypeScript, Expo Router, Zustand and AsyncStorage.

The editable [Figma prototype](https://www.figma.com/design/rZ1cdq02M7Q3CS9S9qQ8kC) passed the focused design gate before implementation. [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md) record the approved scope and visual direction.

## Run locally

From this repository:

```sh
cd mobile
npm ci
npm run ios
```

The iOS command creates/updates the native project and builds a development client. It requires macOS and a working Xcode/iOS toolchain. For an installed development client, start Metro separately:

```sh
npm start
```

Android requires a configured Android SDK, Java toolchain, and an emulator or connected device:

```sh
npm run android
```

Use a **development build**. Expo Go does not include this app's native PDF dependencies (`react-native-pdf` and `react-native-blob-util`). Rebuild the client after changing native dependencies or config plugins. `mobile/eas.json` contains build profiles; no EAS account, cloud project, or deployment is configured by this handoff.

## What is implemented

- Camera, photo and file selection; app-owned document copies; PDF/image preview and document classification.
- Manual verification for imports, with recoverable permission, file, preview and storage failures.
- A paired, visibly synthetic Northline bill/EOB in both languages, with original source excerpts and two supported questions.
- Separate editable billing-correction and insurer-review drafts, clipboard copy, PDF export and the OS share sheet.
- Device text-to-speech with play/stop and interruption on navigation, language change or backgrounding.
- Local case history, user-confirmed submission records, follow-up dates, glossary search and sample reset.

No account or backend is required. Case data is saved as a versioned AsyncStorage snapshot; imports and generated PDFs live in the app's document directory. These are local app storage, not an encrypted document-vault implementation. Clipboard and sharing act only when requested by the user.

## Boundaries

There is **no connected AI, OCR, benchmark database or sponsor service**. Imports start with empty manually entered details and receive no automated findings. The synthetic sample alone supports the seeded document comparison. Its $494 statement balance, $294 EOB responsibility and $50 recorded payment yield a $244 derived remainder; the $250 difference is a question, not guaranteed savings or a determination of what is owed.

The sample contains no insurer denial. Insurer-review text requires the user to supply the actual decision, reasons and plan instructions. Unfold does not send requests, place calls, adjudicate coverage, provide medical advice or manage escrow. Closing a share sheet never records submission; the user must explicitly confirm it.

## Teammate handoff

| Location | Responsibility |
| --- | --- |
| `mobile/src/app`, `mobile/src/screens` | Native routes and screens |
| `mobile/src/domain` | Cents, validation, case/evidence types and synthetic fixtures |
| `mobile/src/services` | Connected Gemini understanding, Medicare review, Tiger Data claim tracking, voice catalog/speech/session adapters; local drafts and Guide |
| `mobile/src/store` | Persistence, revisions and recorded actions |
| `mobile/src/native` | Imports, preview, exports and narration |
| `mobile/src/theme`, `mobile/src/components` | Geist, palette, Phosphor configuration and shared UI |

See [service contracts](docs/service-contracts.md) for the future FastAPI adapter map and [the two-minute demo](docs/demo.md) for a repeatable walkthrough.

## Verification

Run from `mobile/`:

```sh
npm run typecheck
npm run lint
npm test
npm run doctor
npm run bundle:ios
npm run bundle:android
```

These commands describe the verification workflow; this documentation pass does not claim they passed. Build and runtime evidence will be added by the coordinating implementation pass. The current workspace has no Android SDK, so Android device/emulator validation remains pending. JavaScript bundle export alone does not validate native modules, camera permissions, PDF rendering, audio or keyboard behavior.
