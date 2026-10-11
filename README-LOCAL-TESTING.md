# Footnote: run the app on your own computer and device

This is the local setup used for the demo and Android emulator. Clone the project,
run its backend on your computer, and open Footnote on your phone or emulator.
A physical phone must connect to the same reachable Wi-Fi network as that computer.
The computer must stay on, with the backend and Expo development server running.
Internet access is still needed for Gemini, ElevenLabs, Snowflake and a hosted Tiger Data database.

```text
Phone on your Wi-Fi / Android emulator
                 |
                 v
Your computer: Footnote API + Expo development server
                 |
                 v
Gemini / ElevenLabs / Snowflake / your test database
```

You do not need a public backend deployment for this setup. Provider keys and
database credentials stay in `backend/.env` on the computer; the app receives only
the backend address. Cloning the repository does not include credentials or grant
access to the team's accounts.

Checked October 11, 2026. These instructions document the current setup; physical
phone behavior and services using your own credentials still need the checks below.

## 1. Install the tools and clone the integrated app

- Git, Python 3.11 or 3.12, and Node.js 24.3 or newer within the Node 24 release series.
- For a local Android build: Android Studio, Android SDK/platform tools, and JDK 17.
  Configure `JAVA_HOME` and `ANDROID_HOME` for your installation.
- For a local iPhone build: a Mac with Xcode and a signing identity.
- Your own service credentials, or test access supplied privately by the project owner.
  Use a separate test database for your uploads and claim records.

Clone the published testing branch:

```sh
git clone --branch merged-v1 https://github.com/CaspLian/Footnote.git Footnote
cd Footnote
```

`merged-v1` is the shared integrated testing branch. The published `main` branch
was older when this guide was written. Local, uncommitted work on another
developer's computer is not included in a clone.

## 2. Install and configure the backend

Open a terminal in the cloned repository.

**Windows PowerShell:**

```powershell
cd backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt -r services/audio_service/requirements.txt
if (-not (Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }
```

**macOS/Linux:**

```sh
cd backend
python3 -m venv venv
source venv/bin/activate
python -m pip install -r requirements.txt -r services/audio_service/requirements.txt
test -f .env || cp .env.example .env
```

Edit `backend/.env` privately. The settings for the complete connected experience are:

| Feature | Backend settings |
|---|---|
| Document extraction and explanations | `GEMINI_API_KEY`, an available `GEMINI_MODEL`, `MOCK=false` |
| Voice previews, saved readings and recorded questions | `ELEVENLABS_API_KEY` with the relevant voice and transcription permissions |
| Live bill conversation | `ELEVENLABS_AGENT_ID` for a provisioned Footnote agent, plus the ElevenLabs key |
| Snowflake reference rates | `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USER`, `SNOWFLAKE_PASSWORD`, `SNOWFLAKE_WAREHOUSE`, `SNOWFLAKE_DATABASE`, `SNOWFLAKE_SCHEMA`, `PRICE_SOURCE=snowflake` |
| Saved analyses and claim actions | `TIGER_DATA_POSTGRES_URL` pointing to your test PostgreSQL/Tiger Data database |

The team's recorded live demo used the following model settings; confirm those
models are available to your account. The copied example may name a different model.
See [the recorded model decision](docs/decisions/2026-10-10-gemini-model-setting.md).

```dotenv
GEMINI_MODEL=gemini-3.5-flash
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite
MOCK=false
```

Additional voice settings and key permissions are explained in
[the voice environment example](backend/services/audio_service/.env.example).
Do not place provider keys or database URLs in `mobile/.env.local`.

**Snowflake setup:** your selected database/schema must contain `CPT_BENCHMARKS`.
If it is not already provisioned, the backend owner can run `load_benchmarks.py`
from `backend/` using the virtual environment's Python. This script **replaces
that table**, so run it only in the intended test schema. `PRICE_SOURCE=csv`
uses the bundled reference file instead; that is not a live Snowflake test.

**Database setup:** use an existing, reachable test database. The backend creates
its analysis and claim tables when needed, so its database user needs the
appropriate schema/table permissions.

**Live conversation setup:** if you are the owner of the ElevenLabs test account,
provision the app's agent from `backend/` using the virtual environment's Python:

```sh
python -m services.audio_service.voice_agent.provision --env-file .env
```

On Windows, replace `python` in that command with `.\venv\Scripts\python.exe`.
This creates or updates the agent/tools in that account. Put the returned agent ID
in `ELEVENLABS_AGENT_ID` in `backend/.env`; restart the backend after changing it.
A voice preview can work without a configured live agent.

## 3. Start the API and find the address your device will use

Keep this terminal running in `backend/`.

**Windows PowerShell:**

```powershell
.\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
```

**macOS/Linux, with the virtual environment active:**

```sh
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Open `http://127.0.0.1:8000/` on the computer. Expect health JSON with
`"message": "Footnote API is running"` and `"mock": false` for live extraction.
Health confirms the API is running; it does not prove every provider is connected.

Choose the app address for your device:

| Where Footnote runs | `EXPO_PUBLIC_API_URL` |
|---|---|
| Physical Android phone or iPhone on the same Wi-Fi | `http://YOUR-COMPUTERS-LAN-IP:8000` |
| Standard Android Studio emulator on the backend computer | `http://10.0.2.2:8000` |
| iOS simulator on the backend Mac | `http://127.0.0.1:8000` |
| Browser on the backend computer | `http://127.0.0.1:8000` |

For a physical phone, find the computer's active Wi-Fi IPv4 address with `ipconfig`
on Windows, or Network settings on macOS/Linux. For example, if it is
`192.168.1.25`, open `http://192.168.1.25:8000/` in the phone's browser first.
It must return the health JSON before you continue.

On Windows, allow the backend Python process and Expo/Node through the firewall
on your trusted private network. The device needs API port `8000` and Metro port
`8081`. Guest Wi-Fi/client isolation can prevent devices reaching each other even
on the same network. See [the network notes](docs/API_CONTRACTS.md#conventions).

`0.0.0.0` is a server listening setting, not the app address. On a physical phone,
`127.0.0.1` points to the phone. `10.0.2.2` is for the standard Android emulator.
The API currently has no application authentication; keep this setup on a trusted
test network and use fictional documents.

## 4. Configure and start the app

Open a second terminal in the repository root:

```sh
cd mobile
npm ci
```

Create `mobile/.env.local` and put your chosen address in it. A phone example is:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.25:8000
```

Replace the example IP with your computer's address; use `10.0.2.2` for the emulator.
If another `.env` file or shell variable sets the same name, remove that conflicting
local setting or make it match. These environment files remain local to your clone.

Start Metro from `mobile/` and keep this terminal running:

```sh
npx expo start --dev-client --lan --port 8081
```

The URL is included in the JavaScript bundle. After changing it, fully reload the
app; restarting Metro with `--clear` also helps if an old value persists. Settings
checks connectivity but does not offer an editable backend-address field.

## 5. Install a native development build

**Expo Go cannot run the complete app.** Footnote includes PDF and live voice
native modules, so use its development build.

**Android emulator:** create and start an Android Virtual Device in Android Studio.
In a third terminal, from `mobile/`, build and install:

```sh
npx expo run:android --device --no-bundler
```

Choose the running emulator. Metro is already running from step 4. If the app does
not open automatically, open Footnote and connect to that development server.

**Physical Android:** enable Developer options and USB debugging, connect the phone
by USB, and accept its debugging prompt. Keep it on the computer's Wi-Fi and use
the computer's LAN IP in `.env.local`. Run the same command above and select the
phone. Once installed, the development build can reconnect over Wi-Fi by scanning
Metro's QR code.

**Physical iPhone, on a Mac:** connect and trust the device, configure signing, and
enable Developer Mode when requested. With Metro running, use:

```sh
npx expo run:ios --device --no-bundler
```

Follow [the iPhone testing guide](docs/IOS_TESTING.md) for signing details. Windows
cannot make a local iOS build; use a suitably signed development build supplied by
the team or an [EAS development build](https://docs.expo.dev/build/setup/).
Cloud builds require access to the configured Expo project and the appropriate
platform signing setup.

If a compatible Footnote development build is already installed, skip compilation:
start Metro, open Footnote and scan the displayed QR code. Rebuild when the clone's
native dependencies or native configuration differ from the installed build.

## 6. Check the complete demo journey

Use the fictional documents included in the published testing branch:
[bill PDF](backend/samples/test_bills/1_er_itemized_bill.pdf),
[EOB PDF](backend/samples/test_bills/2_insurance_eob.pdf),
[receipt photo](backend/samples/test_bills/3_urgent_care_receipt_photo.jpg), and
[imaging bill](backend/samples/test_bills/4_imaging_center_bill.png).
Move a file onto the phone for its file picker, or photograph a printed page.

1. Complete onboarding. Open Settings and check the Connection status.
2. Open the voice chooser from Settings, preview a voice, and confirm audible playback.
3. Import a bill/photo/PDF, confirm the selected documents, and read the extracted
   details. Compare the numbers with the original before confirming them.
4. Open the review and inspect a coded line's reference and explanation.
5. Use Listen on the saved bill, then Stop. Try a short live conversation on that
   saved bill, mute and end it; check microphone permission if necessary.
6. Prepare a request, try its export/share flow, and record a fictional follow-up
   action. Relaunch the app and reopen the case.

These live actions use the configured provider accounts and may consume credits.
To verify the individual integrations rather than only the interface:

| Integration | What confirms it |
|---|---|
| Gemini | Health has `mock: false`, and your uploaded document produces its own extracted values |
| Snowflake | Open `/api/v1/benchmarks/70450` on your API; `source` should be `snowflake`. `local_csv` means the fallback was used |
| Tiger Data | The analysis response has `audit.saved: true`; its returned audit ID reopens through `/api/v1/audits/{id}`. Check claim/event records in your test database for workflow persistence |
| ElevenLabs narration | Voice preview and saved-bill Listen produce audible sound, and Stop stops it |
| ElevenLabs live agent | A saved-bill conversation connects, hears a question, responds, and ends cleanly |

Inspect API responses through `http://YOUR-API-ADDRESS:8000/docs` if needed. Local
case history alone does not prove database saving. A working voice preview alone
does not prove the live agent is configured.

## Troubleshooting

| Symptom | Check |
|---|---|
| Phone browser cannot open API health | Correct Wi-Fi IPv4 address, `--host 0.0.0.0`, port 8000, firewall, and guest/client isolation |
| API works in browser, app cannot connect | `.env.local`, conflicting shell/env values, full app reload, and correct device address |
| Installed app opens a launcher or cannot load | Metro must remain running; scan its development-client QR code, and allow port 8081 |
| Connection says document reading unavailable | Set `MOCK=false` in the backend environment and restart the API |
| Extraction fails or takes too long | Available Gemini model, API key/quota, server error, file readability; uploads are limited to 10 files and 15 MB combined |
| Reference lookup says `local_csv` | Snowflake credentials, warehouse, database/schema/table; fallback is useful but does not verify Snowflake |
| Analysis opens but audit is not saved | Test database URL, reachability, schema permissions and the analysis response's audit error |
| Preview is silent or errors | Media volume/output, ElevenLabs key permissions/quota and the displayed error |
| Reading works, live conversation does not | Footnote agent ID/provisioning, provider access/quota, a saved analysis, microphone permission and network |
| Android build fails before installation | JDK/SDK paths, Android SDK packages, compatible Node version and connected device |

## Sharing an APK or preview link

This guide uses a development build and the tester's own Metro/backend computer,
like our emulator setup. A compatible development APK can be distributed, but the
tester still needs the repository, local settings and running servers.

A standalone preview APK embeds a particular backend URL. The current app cannot
switch that URL in Settings, so an APK built for one computer's LAN IP will not
automatically connect to every tester's computer. It needs a build for the chosen
address or a future runtime-address feature. Android release HTTP restrictions
also need verification; the inspected debug manifest allows local HTTP.

GitHub Releases can host an APK, but they do not run the backend. An APK is Android
only, and a generic Expo Go link cannot supply Footnote's custom native modules.
No new APK or release was published as part of writing this guide.

## References

- [Expo development builds](https://docs.expo.dev/develop/development-builds/use-development-builds/)
- [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)
- [Expo CLI and local builds](https://docs.expo.dev/more/expo-cli/)
- [Android emulator networking](https://developer.android.com/studio/run/emulator-networking)
- [Android network security configuration](https://developer.android.com/privacy-and-security/security-config)
- [Project API contracts](docs/API_CONTRACTS.md)
