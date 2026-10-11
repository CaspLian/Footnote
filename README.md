# Footnote

Footnote helps patients and caregivers understand medical bills and insurance explanations of benefits, check the details, and prepare questions for billing. The Expo app supports iOS, Android and web, with Geist typography and the printers’ asterisk identity.

## Run locally

For a physical iPhone, follow [the merged-v1 iOS testing guide](docs/IOS_TESTING.md).
The supplied brand masters and presentation are included in [brand/](brand/showcase.html).

Set up the API from `backend/.env.example` and the app from `mobile/.env.example`. Keep provider keys on the server. Run these commands from the indicated folders:

```sh
# backend/
python -m venv venv
pip install -r requirements.txt -r services/audio_service/requirements.txt
uvicorn main:app --reload

# mobile/
npm ci
npm start
```

Use an installed development build. To create one, run `npm run android` with the Android SDK and Java configured, or `npm run ios` on macOS with Xcode. Expo Go does not include the app’s native PDF and voice modules. See [mobile setup](mobile/README.md) for device connection details.

## What Footnote does

- Imports camera pages, photos and PDFs, keeping the original documents available for review.
- Uses Gemini to extract and explain documents, with confirmation before comparing coded charges to national Medicare references.
- Reopens saved analysis with Tiger Data and tracks explicit case actions, deadlines and follow-up dates.
- Reads saved explanations with ElevenLabs and supports live conversations about a saved bill.
- Prepares editable billing requests and insurer appeals, with clipboard, PDF export and the system share sheet.
- Saves household profiles, preferences, original documents, drafts and case history locally. Offline imports support manual entry.

Amounts without evidence remain unknown. A difference from a Medicare reference is a reason to ask a question, never proof of an error or guaranteed savings. Requests are sent by the user; Footnote records submission only when explicitly marked.

Document analysis sends the imported pages to the configured API and Gemini, and can save their analysis with Tiger Data. Live conversations send bill context and spoken content to ElevenLabs, which uses Gemini and retains conversation data for seven days. Biometric app lock controls access; it does not encrypt imported files.

## Verification and shared context

```sh
# mobile/
npm run typecheck
npm run lint
npm test
npm run bundle:web
npm run bundle:android
```

Current integration evidence and remaining device checks are in [project status](docs/PROJECT_STATUS.md). Route definitions are in [API contracts](docs/API_CONTRACTS.md), and the rename is recorded in [the Footnote handoff](docs/handoffs/footnote-rebrand.md).
