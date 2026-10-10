# Unfold frontend

Shared Expo SDK 57 / React Native / TypeScript app for iOS, Android, and responsive web. This branch contains the Unfold frontend and connects imported bill documents to the ClaimPulse analysis API.

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
- Simple/detailed explanations, source-linked questions, device narration, editable billing-correction and insurer-review drafts, clipboard copy, PDF export, and explicit submission records.
- Follow-up reminders, separately confirmed notice dates, recorded actions, glossary, and resettable sample.
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

   Replace the example IP with the computer's address. The phone must be able to reach that address on port 8000. Keep `GEMINI_API_KEY` in `backend/.env` and set `MOCK=false` there to test real extraction; `MOCK=true` returns sample data instead.

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

6. In Unfold, finish setup, start a bill, choose **Take a photo**, allow camera access, capture a page, and tap **Keep page**. Capture another page if needed, then tap **Use photos**. Confirm that the app reaches the analysis screen, then the editable verification form, with the captured source available to preview.

7. Test retake, removing a captured page, denying camera permission, losing the backend connection, and retrying analysis. Confirm that a failed upload leaves the locally saved photos available.

If the phone cannot reach the API, check the LAN IP, firewall, Wi-Fi network, and `EXPO_PUBLIC_API_URL`. `127.0.0.1` on a phone points to the phone itself, not the development computer.

## Integration boundary

Document processing, benchmark lookup, draft preparation, and narration have asynchronous interfaces in `src/domain/types.ts`. Imported documents are sent to the configured ClaimPulse backend for Gemini extraction and the response is shown for user verification. Backend price checks are included as questions when flagged; local benchmarks, Tiger Data persistence, and ElevenLabs narration are not connected to the mobile app.

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

TypeScript, lint, 39 focused tests, and web/Android/iOS bundle exports pass. The development client built and ran on an iPhone 18 Pro simulator with onboarding, source PDF preview, review, narration, draft copy, restart recovery, and unenrolled Face ID recovery exercised. Android runtime, physical-device camera capture, enrolled biometric authentication, and a full large-text/screen-reader device audit remain to be validated.
