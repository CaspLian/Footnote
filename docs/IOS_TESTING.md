# Test merged-v1 on an iPhone

This branch contains the integrated Footnote app and API plus the confirmed Android voice-preview fix. The shared Expo app in `mobile/` is the testing target. It requires a development build; Expo Go does not include the PDF and LiveKit/WebRTC modules.

## Get the branch

From your existing clone:

```sh
git fetch origin
git switch merged-v1
cd mobile
npm ci
```

If the branch is not yet local, `git switch --track origin/merged-v1` creates it. The repository includes dependency lockfiles, native configuration and app assets. Native `ios/` and `android/` folders are generated and excluded from Git.

## Connect the API

The iPhone and the computer running the API must be able to reach each other, usually on the same Wi-Fi. Obtain the backend settings privately; provider keys and database credentials are intentionally absent from this branch.

On the computer running the API, from `backend/`:

```sh
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt -r services/audio_service/requirements.txt
cp -n .env.example .env
# Fill in your own provider settings and a separate verification database before starting.
uvicorn main:app --host 0.0.0.0 --port 8000
```

Use a configured live Gemini model, `MOCK=false`, and an isolated verification database for test analyses. Voice previews require `ELEVENLABS_API_KEY`; live bill conversations also require the privately configured `ELEVENLABS_AGENT_ID`. The backend owner can provision their agent with `python -m services.audio_service.voice_agent.provision --env-file .env`. Never put these keys in the app.

Copy `mobile/.env.example` to `mobile/.env` and replace its URL with the API computer's LAN address:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.10:8000
```

The address above is an example. On a physical iPhone, `127.0.0.1` points to the phone. Check the actual API URL in Safari on the phone first: the root should return its health JSON. The API has no application authentication, so use a trusted testing network and verification documents. Full network notes are in [API contracts](API_CONTRACTS.md).

## Install the native development build

On a Mac with Xcode and iOS signing configured, connect and unlock the iPhone, trust the Mac, and enable Developer Mode when requested:

```sh
cd mobile
npx expo run:ios --device
```

Choose the physical iPhone when prompted. Expo generates the iOS project, builds, signs and installs it. If signing needs setup, open the generated `ios/Footnote.xcworkspace` in Xcode and select the team's development signing identity. If the preserved bundle identifier is unavailable to your account, obtain team access or choose a unique identifier locally for your own test installation; keep that local override out of the shared branch. For an existing installation, run `npm start` and reconnect the Footnote development client. Restart Metro after changing the API URL.

References: [Expo local iOS builds and signing](https://docs.expo.dev/more/expo-cli/#ios-development-signing), [iOS Developer Mode](https://docs.expo.dev/guides/ios-developer-mode/).

## Checks on the phone

1. Complete setup, reopen the app and confirm profile/preferences persist.
2. In Settings → Agent voice, preview a voice, stop it, switch voices and preview again.
3. Import a verification photo/PDF, confirm its pages, read the document and compare the extracted details with the original. Correct uncertain values before reviewing.
4. Open the review, play the saved ElevenLabs explanation, stop/replay it and reopen the saved bill.
5. Start a live conversation about a saved bill; check microphone access, audible answers, captions, mute and end. Change language and check supported-language behavior.
6. Check PDF preview, camera/photo permissions, keyboard clearance, drafts, sharing and a follow-up date.

## Verified and still open

- Automated checks: 166 mobile tests, 165 backend tests and 649 audio tests passed. Typecheck/lint and the shared web export passed. Backend database tests used separate verification data.
- Android voice previews are audibly confirmed by Nimesh; he also confirmed saved-bill narration plays and stops correctly in his current emulator installation. Live web conversations, imported-document extraction, saved reviews and audio were verified in the earlier integration checkpoint. These Android results do not establish iPhone playback.
- Native iOS compilation, signing, permissions, playback, microphone and physical-camera behavior require the tester's device. An iOS JavaScript export is not proof of native device behavior.
- Use `mobile/` for the complete shared app. The published `merged-v1` snapshot retains the earlier standalone `web/` views; source-data cleanup for those views continued locally on `Backend-Frontend-Connection-V1`. That older app still has session-only case storage and device narration.

Current evidence: [project status](PROJECT_STATUS.md) and [Footnote/audio handoff](handoffs/footnote-rebrand.md).
