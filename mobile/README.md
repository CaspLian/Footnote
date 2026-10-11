# Footnote frontend

Shared Expo SDK 57 / React Native / TypeScript app for iOS, Android, and responsive web. This branch contains the Footnote frontend and connects imported bill documents to the Footnote analysis API.

## Run

Physical iPhone setup, API connectivity and device checks: [merged-v1 iOS testing guide](../docs/IOS_TESTING.md).

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
- Imported bill and EOB pages are read by Gemini when connected, then confirmed before Medicare comparisons; offline imports use manual entry.
- Simple/detailed explanations, source-linked questions, contextual live-agent controls with captions, editable billing-correction and insurer-review drafts, clipboard copy, PDF export, and explicit submission records.
- Follow-up reminders, separately confirmed notice dates, recorded actions, glossary.
- Native biometric app-lock options with device-passcode fallback and setup/cancellation recovery.
- Proportional Geist typography, Phosphor icons, restrained gradients, paper shadows, progressive detail, and a folding-paper loader with reduced-motion support.

The native workspace uses AsyncStorage and app-local files. The web workspace uses localStorage and IndexedDB. Family profiles are local, with no account, cloud sync, or shared family access. App lock gates access and does not encrypt imported files. Browser PDF export opens print/save-as-PDF; native export uses the OS share sheet. Sharing never marks a request submitted.

## Test the camera on a phone

Camera capture requires a physical device. The in-app camera saves each page as a JPEG, lets you retake or add pages, then uploads the selected pages together to `POST /api/v1/analyze`. The app keeps the original JPEG pages and opens an editable verification form after Gemini responds.

1. Connect the phone and development computer to the same Wi-Fi network.
2. Start the backend from `backend` so it listens on the network:

   ```sh
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

3. Find the computer's LAN IP and create `mobile/.env.local` with the backend address. This value is public app configuration; do not put API keys here.

   ```sh
   EXPO_PUBLIC_API_URL=http://192.168.1.25:8000
   ```

   Replace the example IP with the computer's address. The phone must be able to reach that address on port 8000. Keep `GEMINI_API_KEY` in `backend/.env` and set `MOCK=false` there to test real extraction.

4. Build and install the Android development client (camera is a native module; Expo Go is not the project run target):

   ```sh
   cd mobile
   npx eas-cli@latest build --profile development --platform android
   ```

   Install the build on the phone using the EAS install link. On Windows, this is the shortest device path. For iOS, register the iPhone with EAS and make a development build for that device.

5. Start the Expo server from `mobile` and open the installed development client:

   ```sh
   npm start
   ```

6. In Footnote, finish setup, start a bill, choose **Take a photo**, allow camera access, capture a page, and tap **Keep page**. Capture another page if needed, then tap **Use photos**. The app opens **Your documents**. Confirm the pages, choose **Use these documents**, wait for **Understanding**, then **Check the details** to verify the extraction.

7. Test retake, removing a captured page, denying camera permission, losing the backend connection, and retrying analysis. Confirm that a failed upload leaves the locally saved photos available.

If the phone cannot reach the API, check the LAN IP, firewall, Wi-Fi network, and `EXPO_PUBLIC_API_URL`. `127.0.0.1` on a phone points to the phone itself, not the development computer.

## Integration boundary

Document processing, benchmark lookup, draft preparation, and narration have asynchronous interfaces in `src/domain/types.ts`. With `EXPO_PUBLIC_API_URL` set (copy `.env.example` to `.env`), the app uses the Footnote backend. The routes are in `docs/API_CONTRACTS.md`.

- **Reading documents:** after document confirmation, ordered camera pages, photos and PDFs go together to `POST /api/v1/analyze` through the Understanding adapter. Provider, dates, amounts and line items fill Verify, with source evidence, for the user to check. Saved readings reopen through `GET /api/v1/audits/{id}`. Adding or removing a file clears the old reading. If service or due dates are missing, one eligible image may use `/api/v1/analyze-image` once per case; this optional route's claim is reused rather than recorded twice.
- **Prices:** the review compares each confirmed code with Medicare's national rate (`GET /api/v1/benchmarks/{code}`, from Snowflake) and adds Gemini's notes. Findings are questions, never proof of an error.
- **Claims:** each confirmed case records one claim in Tiger Data; requests, submission, follow-up, notice dates and resolution mirror the local trail. Track refreshes missed recordings and deadlines. Unknown balances are logged as a resolution action instead of a fabricated zero-dollar outcome. Local progress stays usable when Tiger Data is down.
- **Voices:** Calm follows the selected language's backend default; Clear uses Alice and Warm uses George. Catalog and English previews use `/voice/voices` and `/voice/voices/{key}/sample`. Listen uses `/voice/speak` and `/voice/audio/{id}`; each audit and voice pair has its own prepared clip. Changing voice can therefore generate another paid clip.
- **Conversation:** the orb's session adapter requests a short-lived WebRTC credential from `/voice/agent/session` for a saved bill. The SDK and microphone remain on the app; API keys stay on the server. Guide/manual cases show an explicit unavailable message. When live conversation is unavailable, a separate 30-second recorded question calls `/voice/analyze`; its caption explains that the bill is not included.
- **Connection:** Settings checks `GET /`; Languages checks `/api/v1/languages`. All 31 picker choices map to one of the backend's 42 locales.

Without the variable, manual entry, drafts and curated Guide remain local, and no backend requests are sent. Live conversations and voice previews show the original unavailable state. Rebuild the development client after native dependency/config changes; this integration includes LiveKit/WebRTC microphone modules, keyboard control, and Expo UI/glass modules.

Money is stored in integer cents. Billed charges, allowed amounts, insurer payments, prior patient payments, and remaining responsibility stay separate. Findings are clarification questions, not guaranteed savings or a determination of what is owed.

## Review a bill

Finish personal setup, import your bill or EOB, check the extracted details, and open the review. Inspect a finding and prepare a request. Mark it submitted only after taking that action yourself. Save a follow-up in the timeline.

Editable design: [Footnote mobile and web design](https://www.figma.com/design/rZ1cdq02M7Q3CS9S9qQ8kC?node-id=51-934).

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

The connected integration passes TypeScript, lint and 153 focused tests, including the original 82. Expo web and Android Hermes exports pass; the separate web app passes 19 tests (3 live tests skipped) and its production build. Final runtime evidence and remaining device gaps are recorded in [the integration handoff](../docs/handoffs/frontend-ui-v3.md). Existing iPhone simulator results from Aarush's earlier build do not validate the new live voice modules.

The recovered code lives on `frontend-aarush`. Start Metro with `npm start`, then open the installed Footnote development client. Use `npm run ios` when native dependencies need rebuilding.

## Tiger Data deadline design (from `Tiger-data`, 2026-10-10)

`local-timeline.js` was written for the old starter `App.js`: an encrypted local timeline (`expo-sqlite` with
SQLCipher) and deadline reminders (`expo-notifications`). The Footnote app does not use it yet, and those packages are
not installed. Its backend side is connected: the claim routes estimate a credit-report warning date (180 days after
the service date) and a collection date (120 days after the bill was received). Both are shown as estimates on the
case timeline. See `docs/API_CONTRACTS.md`, "The claim workflow".
