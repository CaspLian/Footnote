This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## This project today (checked 2026-10-10)

The guidance below is Expo's generated template.

- The app is the Footnote frontend (from `frontend-aarush`, merged 2026-10-10): Expo Router in `src/app/`, TypeScript,
  React Native Web, and a development build (`expo start --dev-client`). Follow its structure. `README.md` explains
  how to run it.
- Reading documents (from `Camera-capture`, merged 2026-10-10): "Take a photo" uses `expo-camera` to keep ordered JPEG
  pages. Photos and PDFs go together to `POST /api/v1/analyze` (`src/services/gemini-api.ts`), and
  `src/domain/extraction.ts` turns the answer into entries the user verifies. Physical Android capture still needs
  device testing.
- The root layout installs `src/native/backend-adapters.ts` when `EXPO_PUBLIC_API_URL` is set. Understanding runs
  `createGeminiUnderstanding`, reopens saved audits, and can try image-only missing-date recovery once per case.
  Settings reads health; Languages checks supported locales. Everything else goes through `src/services/backend.ts`
  (`.env.example`). That covers the review's Medicare comparisons and Gemini's notes (`src/services/connected-services.ts`
  and `backend-mapping.ts`, with tests), the voice catalog/samples and chosen-voice ElevenLabs reading, and claim
  lifecycle/deadline refresh. Live voice uses the server session adapter and LiveKit/WebRTC SDK; the orb offers a
  separate bounded recorded-question fallback on unavailable/error. Unset, the app stays fully local.
- Adding a native module means rebuilding the development build.
- The backend contract the app calls, including multi-file uploads and how a phone reaches the backend, is in
  `docs/API_CONTRACTS.md`.
  Shared rules are in the repository's root `AGENTS.md`.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
