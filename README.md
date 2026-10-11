# Footnote

Footnote helps patients and caregivers understand medical bills and insurance Explanation of Benefits (EOB) letters. It reads the documents, explains them in plain words in the user's language, compares coded charges with Medicare reference prices, reads the explanation aloud, and helps prepare questions for the billing office.

- `mobile/` is the app. It runs on iOS, Android and the web.
- `backend/` is the server. It holds every provider key and talks to Gemini, ElevenLabs, Snowflake and Tiger Data.

## What you can do

- Photograph a bill, or import photos and PDFs. The originals stay available to review.
- Read a plain explanation of the bill and EOB, and confirm the numbers before anything is compared.
- See which coded charges differ from national Medicare reference prices. These are questions to ask, not proof of an error.
- Listen to the explanation in your language, in a voice that speaks it natively.
- Talk with Footnote about your bill, or about a Guide term, in a live voice call. You can also hear an example call with a billing office.
- Prepare a billing request or an insurer appeal, then copy it, export it as a PDF or share it.
- Track the case: actions, deadlines and follow-up dates.

## Quick start

You need Git, Python 3.11 or 3.12, and Node.js 24. Live features also need provider keys (see [Settings](#settings)).

### 1. Get the code

```sh
git clone https://github.com/CaspLian/Footnote.git
cd Footnote
```

### 2. Start the backend

```sh
cd backend
python -m venv venv
# Activate it. Windows: venv\Scripts\activate    macOS/Linux: source venv/bin/activate
pip install -r requirements.txt -r services/audio_service/requirements.txt
cp .env.example .env        # then open .env and fill in your keys
uvicorn main:app --host 0.0.0.0 --port 8000
```

To check it, open http://127.0.0.1:8000/api/v1/languages. You should see the list of languages.

No Gemini key yet? Set `MOCK=true` in `backend/.env` to get sample answers without calling Gemini.

### 3. Start the app in your browser

In a second terminal:

```sh
cd mobile
npm ci
cp .env.example .env        # sets EXPO_PUBLIC_API_URL, the backend's address
npm run web
```

### 4. Use it on a phone

Expo Go cannot run Footnote, because it has native PDF and voice modules. Install Footnote's development build once:
- Android: `npm run android` (needs Android Studio and JDK 17).
- iPhone: `npm run ios -- --device` on a Mac with Xcode.

Then connect the phone to the computer:
1. Put the phone and the computer on the same network, or connect the computer to the phone's hotspot. Guest Wi-Fi often blocks traffic between devices.
2. In `mobile/.env`, set `EXPO_PUBLIC_API_URL=http://<your computer's IP>:8000`. A phone cannot use `127.0.0.1`, which means the phone itself.
3. Run `npm start -- --clear` and scan the QR code with the phone.

Step-by-step guides: [phone and emulator setup](README-LOCAL-TESTING.md), [iPhone](docs/IOS_TESTING.md).

| Problem | What to do |
|---|---|
| "Error loading app" on the phone | The phone cannot reach the computer. Use the same network. On iPhone, allow Footnote under Settings → Privacy & Security → Local Network. Allow node and python through the computer's firewall. |
| The app opens but nothing is read | `EXPO_PUBLIC_API_URL` is missing or wrong. Fix it, then restart with `npm start -- --clear`. |
| A reading is slow or fails | Look at the backend terminal. Gemini retries, then uses its fallback model. |

## Settings

Keys stay on the backend, in `backend/.env`, which git ignores. Never commit it, and never paste keys into chat.

| Setting | What it is for |
|---|---|
| `GEMINI_API_KEY` | Reading and explaining documents |
| `ELEVENLABS_API_KEY` | Voices, listening and live calls |
| `SNOWFLAKE_*` | Medicare reference prices (`PRICE_SOURCE=csv` uses the bundled copy instead) |
| `TIGER_DATA_POSTGRES_URL` | Saving analyses and tracking cases |

Every setting, with its default, is listed in `backend/.env.example` and `backend/services/audio_service/.env.example`.

## Run the tests

```sh
cd mobile && npm test && npm run typecheck && npm run lint
cd backend && PYTHON_DOTENV_DISABLED=1 python -m pytest tests -q
cd backend/services/audio_service && python -m pytest -q
```

Do not run plain `pytest` inside `backend/` (see [AGENTS.md](AGENTS.md)).

## Project layout

| Folder | What is in it |
|---|---|
| `mobile/` | The Footnote app (Expo and TypeScript) for iOS, Android and web |
| `backend/` | The FastAPI server: Gemini, ElevenLabs, Snowflake and Tiger Data |
| `docs/` | The team's shared notes. To build a new client, start with [docs/API_CONTRACTS.md](docs/API_CONTRACTS.md) |
| `demo/documents/` | A synthetic demo bill and EOB |
| `brand/` | Footnote's logo and identity ([showcase](brand/showcase.html)) |

## Good to know

- Amounts without evidence stay unknown. A difference from a Medicare reference is a reason to ask a question, never proof of an error or guaranteed savings.
- Requests are sent by the user. Footnote records a submission only when you mark it as sent.
- Document analysis sends the imported pages to the backend and Gemini, and can save the analysis in Tiger Data. Live conversations send bill context and speech to ElevenLabs, which uses Gemini and keeps conversation data for seven days.
- The biometric app lock controls access to the app. It does not encrypt imported files.
