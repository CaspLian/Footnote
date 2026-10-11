# audio_service: voice for ClaimPulse AI

Lives at `backend/services/audio_service/`: recorded questions, spoken readings, and private live conversations.
The recorded and reading endpoints connect to the team's Gemini extraction step:

- **text_to_speech**: Gemini's answer → speech the app plays
- **speech_to_text**: the user's recording → text, handed over ready for Gemini
- **voice_routes.py**: `POST /api/v1/voice/analyze`: recording → transcript → `gemini_service.analyze()`
  → price check → saved to Tiger Data → spoken reply (the summary plus what the price check found) in
  the voice the user chose; `POST /api/v1/voice/speak` to hear a saved analysis again without asking
  Gemini again; `GET /api/v1/voice/audio/{id}` to play a reply; and `GET /api/v1/voice/voices`
  (+ `/voices/{key}/sample`) for the app's voice picker. Mounted in `backend/main.py`.
- **20 voices to choose from** (10 female, 9 male, 1 neutral; 11 accents), listed in
  `text_to_speech/voices.json`. Matilda is the default; Bunty and Noor are the fun Indian voices.
- **voice_agent**: `POST /api/v1/voice/agent/session` starts a private ElevenLabs conversation using Gemini
  and a bounded view of a saved bill. Provision the development agent with
  `python -m services.audio_service.voice_agent.provision` from `backend/`, then set `ELEVENLABS_AGENT_ID`
  in the ignored settings file. See [the session contract](../../../docs/API_CONTRACTS.md#live-conversation-session-post-apiv1voiceagentsession)
  and [the implementation handoff](../../../docs/handoffs/backend-voice-agent.md) for limits, privacy and runtime evidence.

```
audio_service/
├── text_to_speech/
│   ├── __init__.py             what the backend imports: TTSRequest, synthesize, get_audio, ...
│   ├── contract.py             TTSRequest / TTSResult / ErrorCode: the agreement with the backend
│   ├── service.py              the pipeline: validate → clean up → cache → ElevenLabs → result
│   ├── text_prep.py            Markdown/links/emoji/symbols → speakable text (no API calls)
│   ├── elevenlabs_provider.py  the only file that talks to ElevenLabs
│   ├── cache.py                reuses audio so the same text is never paid for twice
│   ├── config.py               settings from backend/.env
│   ├── errors.py               internal error type
│   ├── voices.json             the 20 voices users can choose (key → ElevenLabs voice); edit to add more
│   ├── voices.py               reads and checks voices.json
│   ├── pronunciations.json     word → how to say it (e.g. ClaimPulse → Claim Pulse)
│   ├── demo.py                 mock Gemini answer → MP3, no backend needed
│   ├── check_setup.py          checks key, plan, credits and voices without spending credits
│   ├── mock_data/              mock Gemini answers used by the demo and tests
│   ├── tests/                  automated tests; no network or API key needed
│   └── README.md               integration guide for the backend and mobile teammates
├── speech_to_text/
│   ├── __init__.py             what the backend imports: STTRequest, transcribe, to_gemini_handoff, ...
│   ├── contract.py             STTRequest / STTResult / GeminiHandoff / ErrorCode
│   ├── service.py              the pipeline: validate → check audio → cache → ElevenLabs → tidy → result
│   ├── audio_check.py          recognises m4a, webm, mp3, wav, ... from the file's first bytes
│   ├── transcript.py           tidies the transcript and computes the confidence score
│   ├── handoff.py              transcript → GeminiHandoff, the thing the Gemini code receives
│   ├── elevenlabs_provider.py  the only file in speech_to_text that talks to ElevenLabs
│   ├── config.py, errors.py    settings from backend/.env; internal error type
│   ├── demo.py                 transcribe a recording, or a text-to-speech MP3 (round trip)
│   ├── tests/                  automated tests; no network or API key needed
│   └── README.md               integration guide: the voice endpoints, app recording
├── voice_routes.py             the /api/v1/voice endpoints: speech-to-text → Gemini → text-to-speech
├── audio_http.py               serves audio: byte ranges for finished clips, streaming for the rest
├── playground.py, .html        a local page to try the voices: type text, pick a voice, hear it
├── tests/                      tests for voice_routes (a stand-in replaces the Gemini module)
├── __init__.py                 makes this folder a package (see "Git notes")
├── conftest.py                 test setup for both features (never reads the real backend/.env or api.env)
├── .env.example                every audio setting, with explanations
├── .gitignore                  keeps generated audio, caches and stray .env files out of git
├── requirements.txt            this module's runtime dependencies (pinned)
└── requirements-dev.txt        + pytest
```

## Setup (Windows, once)

The whole backend shares one virtual environment, `backend/venv` (the repo's `.gitignore` already
ignores it). In PowerShell, from the repo root:

```powershell
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r services\audio_service\requirements-dev.txt   # enough for this module and its tests
pip install -r requirements.txt                               # the rest of the backend, when you run it
```

If PowerShell refuses to run `Activate.ps1`, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.
In Git Bash, activate with `source venv/Scripts/activate` instead.

Then put your ElevenLabs settings in **`backend/.env`**, the backend's shared settings file. The repo's
`.gitignore` keeps it out of git. Copy the lines you need from `.env.example` in this folder:

```
ELEVENLABS_API_KEY=your-real-key
```

One `NAME=value` per line: no dashes, no quotes, no spaces around `=`. Do not paste the key anywhere else.
The voices users can choose come from `text_to_speech/voices.json`, so no voice setting is needed.
If there is no `backend/.env`, the voice settings are read from `backend/api.env` instead. Only the
voice settings (`ELEVENLABS_*`, `TTS_*`, `STT_*`) are taken from either file: Gemini, Snowflake and
Tiger Data read theirs from `backend/.env` through `main.py`, so placeholders for them in
`api.env` change nothing.

## Verify, step by step

Run these from `backend\services\audio_service` with the venv active:

| Step | Command | Needs key? | Cost |
|---|---|---|---|
| 1. Tests pass | `python -m pytest` | no | free |
| 2. See what would be spoken | `python -m text_to_speech.demo --dry-run` | no | free |
| 3. Check key, plan and voices | `python -m text_to_speech.check_setup` | yes | free |
| 4. Hear it | `python -m text_to_speech.demo --open` | yes | ~96 characters |
| 5. Prove the cache works | run step 4 again | yes | 0 characters |
| 5b. See the voices | `python -m text_to_speech.demo --list-voices` | no | free |
| 5c. Compare the voices | `python -m text_to_speech.demo --voice all --text "Hi! I checked your bill."` | yes | ~35 credits per voice |
| 6. Check a recording | `python -m speech_to_text.demo --file recording.m4a --check` | no | free |
| 7. Transcribe it | `python -m speech_to_text.demo --file recording.m4a` | yes | ~$0.004 per minute |
| 8. Round trip | `python -m speech_to_text.demo --round-trip mock-bill-summary` | yes | ~$0.004 |

Step 3 also checks that every voice in `voices.json` works on your account.
Step 5c saves one file per voice, e.g. `demo_output/custom-text-bunty.mp3`. Step 4 saves `audio_service/demo_output/mock-plain.mp3` and plays it. Each answer is requested twice,
and the second request should print `cached=True characters_sent=0`. Other options:
`--mock mock-numbers`, `--text "your sentence"`, `--all` (all mock answers, about 830 characters).

Step 8 transcribes the MP3 that `python -m text_to_speech.demo --mock mock-bill-summary` made and
compares it with the original Gemini text. On 2026-10-09 it took 4.6 s for 63 s of audio, with
confidence 0.994 and every spoken word back (numbers come back written as words, e.g.
"seven oh five five one").

## Try the voices: the playground

```powershell
cd backend\services\audio_service
python -m playground
```

This opens a page in your browser (http://127.0.0.1:8765). Type anything, pick one of the 20 voices
(or press "Sample" to hear one first), and press Speak or Ctrl+Enter. The text goes to the
playground's text-to-speech receiver (`POST /api/speak`), which uses the same `text_to_speech`
module as the backend, and the audio plays on the page. It shows the cost of each clip and keeps
a replay list for the session. The same text in the same voice again is free.

To compare voices, switch voice and the page speaks the same text in the new one:

- Previous / Next in the bar at the bottom, the arrow keys on the voice list, or `[` and `]`.
  When you step quickly, only the voice you stop on is made, so skipping costs nothing.
- Filter by gender or accent. Previous / Next then step through the voices shown.
- "Play this text in every shown voice" plays them one after another and shows the credit
  estimate first, at the selected model's rate (about 0.22 credits per character per voice on Flash v2.5, 0.44 on
  Multilingual v2). It asks before anything over
  2,000 credits. Stop ends it, and so does choosing a voice or model or pressing any play button.
- The newest click always wins: an answer that arrives after you moved on is not played, but
  it is kept in the replay list.
- The Model buttons switch between Multilingual v2, Flash v2.5 (today's default), v4 Turbo and v4,
  and speak the same text again, so you can compare speed and sound (see "Speed" below).
- The audio is streamed: it starts playing at the "first audio" time shown, while the rest is
  still being made. Use Chrome, Edge or Firefox; Safari may wait for the whole clip.

It only listens on your computer, so nobody else on the network can use it. Stop it with Ctrl+C
in the terminal. It needs `fastapi` and `uvicorn` (`pip install -r requirements-dev.txt`), and
finds the key in `backend/.env` or `backend/api.env`.

## Try the whole backend: the developer console

```powershell
cd backend
python dev_console.py
```

This opens http://127.0.0.1:8770/console, a page that uses the real app from `main.py`, so every
route is the one the mobile app will call:

1. **Analyze a bill** (`POST /api/v1/analyze`): a photo or PDF, a question, or both. It shows the
   line items with their price check, the explanation, and whether the analysis was saved.
2. **Ask by voice** (`POST /api/v1/voice/analyze`): record with the microphone or choose an audio
   file, optionally with a bill. It shows what was heard and plays the reply.
3. **Hear it** (`POST /api/v1/voice/speak`) and **Saved analyses** (`GET /api/v1/audits/{id}`):
   speak or reload a saved analysis.

The chips at the top say what is live. Without keys it still works: Gemini runs in MOCK mode (the
same Spanish sample bill whatever you send), prices come from `data/cpt_benchmarks.csv`, and
nothing is saved unless you give it a database:

```powershell
$env:TIGER_DATA_POSTGRES_URL = "postgresql://user:password@127.0.0.1:5432/test_db"   # a test database
python dev_console.py
```

(`--tiger-url URL` does the same, but the password then shows in the process list and in your shell
history, so keep that for a throwaway local database.)

Voice replies spend ElevenLabs credits like the playground (the same text in the same voice is
free). Like the playground it only listens on your computer, and it refuses requests sent by other
web pages, so no site you visit can use it. Stop it with Ctrl+C.

## Speed (measured 2026-10-09 on the Creator plan)

Almost all of the wait is ElevenLabs making the audio. Our own code takes milliseconds (a cached
clip comes back in 8 ms) and connecting to ElevenLabs takes about 0.1 s, once (the connection is
reused). Speech-to-text is quick too: 63 seconds of audio took 4.6 s, so a short spoken question
should take about a second (estimated, not measured).

A 222-character bill text full of numbers, voice Matilda:

| Model | First audio | All audio | Credits per character | Numbers read right |
|---|---|---|---|---|
| `eleven_multilingual_v2` (the default until 2026-10-10) | 3.6 s | 4.0 s | 0.44 | yes |
| `eleven_flash_v2_5`, number reading on (today's default) | 1.0 s | 1.8 s | 0.22 | yes |
| `eleven_flash_v2_5`, ElevenLabs' default | 0.2 s | 0.9 s | 0.22 | **no**: "$12,345.67" came out as "12,340.67", "E11.9" as "11.9" |
| `eleven_v4_turbo` | 1.0 s | 5.7 s | 0.06 now, ~0.22 after Oct 12 | yes |
| `eleven_v4` | 1.2 s | 6.7 s | 0.12 now, ~0.44 after Oct 12 | yes |

For a short sentence (95 characters) the first audio came after 1.5 s on Multilingual v2, 0.3-0.4 s
on Flash v2.5 with number reading on, 0.4 s on v4 Turbo and 1.7 s on v4. The v4 prices are a launch
offer ("72% off until Oct 12"). Before streaming, users always waited for "All audio".

On 2026-10-10 the app's whole reading of a test bill, in voice Matilda, took:
- 8.49 s on Multilingual v2 and 1.89 s on Flash v2.5 (918 characters)
- 10.19 s on v4 Turbo and 12.20 s on v4 (963 characters)

Flash read every amount, date and ratio right (transcribed back). That is why it became the default
(`docs/decisions/2026-10-09-tts-default-model.md`). v4 starts in about 1-2 s only when streamed or made sentence by
sentence. Streaming is built (`stream_reply=true`, any model), but the app does not send it and it is untested on iPhones; sentence-by-sentence generation is not built.

What this module now does:

1. **Streaming.** `synthesize_streaming()` returns at the first audio, and `open_audio()` passes
   each piece on as ElevenLabs sends it (its `/stream` endpoint), so playback starts at
   "First audio". Identical requests still share one generation, and the finished clip is cached.
   It helps most with long answers and the v4 models; Multilingual v2 sends its first audio late.
   If a clip fails part-way, the connection is cut so the player reports an error (reading the
   stream raises `AudioCutShort`), and nothing is cached.
2. **Model choice per request** (`TTSRequest.model`), used by the playground's Model buttons.
   Flash gets ElevenLabs' number reading turned on automatically (`apply_text_normalization: "on"`),
   because without it Flash misread money and codes in our test. So do the deprecated Turbo v2/v2.5
   models, which ElevenLabs calls functionally equivalent to Flash (not measured).
3. **Byte ranges for finished clips and voice samples** (`Range: bytes=0-1` → `206 Partial
   Content`), which Safari and iPhones ask for before they play anything.

Choices for the team, fastest first:

- **Flash is the default** (since 2026-10-10): about 4.5 times faster on the app's reading, for half the
  credits, with number reading on automatically.
  - ElevenLabs says its quality is slightly lower than Multilingual v2.
  - Voice "sarah" is not tuned for Flash.
  - One ElevenLabs page calls number reading on Flash an Enterprise feature, but it worked on our Creator plan
    (2026-10-09 and 2026-10-10). Recheck it before the demo: the playground, with a text of money and codes.

  To go back: `ELEVENLABS_MODEL_ID=eleven_multilingual_v2` in `backend/.env`.
- **Stream replies to the app**: send `stream_reply=true` to `/api/v1/voice/analyze`. Tested in
  Chrome. Android is expected to play it (its player reads streams of unknown length); iPhones
  (Safari, and AVPlayer under expo-audio) may not. Test on both phones first; the default waits
  for the finished clip, which every phone plays. Streaming also needs the backend to run as one
  process (no `--workers 2`): audio that is still being made exists only in the process making it.
- **Long texts on v4**: they take about 1.7 times as long to finish as on Multilingual v2, so a
  2,500-character text can pass the 60 s `TTS_TIMEOUT_SECONDS`. Raise it to 90 if you use v4 for
  long texts (Gemini's spoken summaries are under 90 words, far below this).
- **Voice Library voices on Multilingual v2**: ElevenLabs' `use_pvc_as_ivc` option made Bunty's
  first audio 0.5-1.2 s faster (no difference on Flash). It uses the voice's "instant clone"
  version, which may sound a little different. Not switched on.

Not done, and why: `optimize_streaming_latency` is deprecated and its strongest level stops number
reading; ElevenLabs' WebSockets are for text that arrives bit by bit, while ours is complete before
we speak it; splitting answers into sentences would need several requests stitched together and
Flash makes it unnecessary; lower-quality audio formats barely matter for speed, per ElevenLabs.

## How the backend uses it

`backend/main.py` (your backend teammate's file) only switches the voice endpoints on (speech → the
team's Gemini step → price check → Tiger Data → speech), at its end:

```python
from services.audio_service.voice_routes import router as voice_router
app.include_router(voice_router)
```

`voice_routes.py` does the rest. It calls this module's async functions:

```python
from services.audio_service.speech_to_text import STTRequest, to_gemini_handoff, transcribe_async
from services.audio_service.text_to_speech import TTSRequest, synthesize_async, synthesize_streaming_async
```

Scripts and demos can use the plain `transcribe()` and `synthesize()` instead.

Every route the app calls, with fields, responses and errors, is in
[`docs/API_CONTRACTS.md`](../../../docs/API_CONTRACTS.md). That is the single source; keep it current when a route
changes. Saving analyses is `services/analytical_services/analysis_store.py`; why it has its own tables is
explained in `docs/decisions/2026-10-10-analysis-storage.md`.

The text-to-speech contract, a FastAPI example and the mobile playback code are in
[text_to_speech/README.md](text_to_speech/README.md). Generated audio is cached in
`audio_service/.tts_cache/`, whichever folder the backend is started from.

## What it costs

- ElevenLabs bills every character sent, including spaces and punctuation, and charges again for
  identical requests (free regenerations exist only on their website). That is why the cache exists.
- Free plan: 10,000 credits a month. At ElevenLabs' prices, Multilingual v2 costs 1 credit per character and
  Flash v2.5, the default, half that. That is roughly 50 answers of 400 characters on Flash, or 25 on
  Multilingual v2.
- Cleanup removes Markdown, links and citations before sending (27% fewer characters for the
  Markdown mock answer). Run `--dry-run` to see the numbers.
- A timeout on our side does **not** cancel the generation at ElevenLabs. It may still be billed,
  so retries are kept to one (`TTS_MAX_RETRIES=1`).
- Set a credit limit on the API key itself (ElevenLabs dashboard) as a safety net.
- Measured on the Creator plan (2026-10-09): 873 characters of speech were billed 384 credits
  (`characters_billed`, from ElevenLabs' own `character-cost` header).
- Speech-to-text is billed per hour of audio: $0.22 per hour with `scribe_v2`, so a 10-second
  question costs about $0.0006. Silence is billed too. The Creator plan includes 100 hours.

## Free-plan pitfalls (checked against the ElevenLabs docs on 2026-10-09)

- **Voices:** Voice Library voices do not work through the API on the free plan (error
  `paid_plan_required` → `PROVIDER_REJECTED`). Default voices such as "George" only work for
  accounts created before March 2026, and they expire on December 31, 2026. `check_setup` tells you
  which case you are in.
- **Shared Wi-Fi:** free accounts can be blocked for "unusual activity" when many people share one
  IP address, as at a hackathon. Test from the venue early.
- **Licence:** the free plan has no commercial licence; credit "elevenlabs.io" if you publish the audio.
- **Concurrency:** on the free plan, 2 requests at a time on Multilingual v2 and 4 on Flash v2.5, the default
  (Creator: 5 and 10). More get queued or return `RATE_LIMITED`.

Paid plans remove the first two problems (Starter is $6/month; ElevenLabs shows the first month at
$1 until October 18).

## Troubleshooting

| You see | Likely cause | Fix |
|---|---|---|
| `NOT_CONFIGURED` | API key missing, or a bad value in `backend/.env` | Read the message; compare with `.env.example` |
| `AUTH_FAILED` | Wrong key, key lacks the *Text to Speech* or *Speech to Text* permission, or a free account was blocked | Re-create the key with the right permissions |
| `NO_SPEECH` / `EMPTY_AUDIO` | The recording was silent or too short | Ask the user to hold the button while speaking |
| `UNSUPPORTED_AUDIO` | The upload was not an audio file | Check the app sends the recording (`recorder.uri`) |
| `PROVIDER_REJECTED` | Voice not usable by this account/plan, unknown voice ID, or format not on your plan | Run `check_setup`; use a voice from its list |
| `QUOTA_EXCEEDED` | Out of credits (account or key limit) | Wait for the reset date shown by `check_setup` |
| `RATE_LIMITED` | More requests at once than the plan allows (free: 4 on Flash, 2 on Multilingual v2) | Usually fine on retry |
| `PROVIDER_TIMEOUT` / `PROVIDER_UNAVAILABLE` | Network or ElevenLabs problem | Retry; check https://status.elevenlabs.io |
| `TEXT_TOO_LONG` | Answer longer than `TTS_MAX_CHARS` after cleanup | Shorter Gemini answers, or raise the limit |
| `ModuleNotFoundError: text_to_speech` | `python -m text_to_speech...` run from the wrong folder | Run it from `backend\services\audio_service` |

## Design decisions (and why)

- **Plain HTTPS with `requests`, not the ElevenLabs SDK.** In the current SDK (2.71), `convert()`
  only sends the request when you read its output, so a normal try/except around the call misses
  errors. It also does not retry `convert()`, and it reads the API key when it is imported. One
  documented POST is easier to control, test and explain. (The `elevenlabs` package in
  `backend/requirements.txt` is not used by this module; it does no harm.)
- **Default model `eleven_flash_v2_5`** (since 2026-10-10; before, `eleven_multilingual_v2`).
  - It made the app's reading 4.5 times faster, for half the credits (see "Speed").
  - It misreads numbers with ElevenLabs' default setting, so the module turns number reading on for it. It then
    read every amount, date and code right (2026-10-09 and 2026-10-10).
  - Multilingual v2 is still the most stable and lifelike, and is tuned for all 20 voices. A request can choose
    it (`TTSRequest.model`).

  Decision: `docs/decisions/2026-10-09-tts-default-model.md`.
- **Streaming shares the generation, not the connection.** Every listener of a clip reads the same
  buffer from its first byte, so a player that reconnects (iPhones do) never pays for a second
  generation. A failed generation is retried only before anyone has heard part of it, because a
  retry starts the clip again from the beginning. Each listener holds one server worker thread
  while its stream plays (the server has 40), which is plenty for a demo.
- **Cleanup never deletes meaning.** Only formatting is removed. Words like "not", "may" and
  "about" always survive, a ❌ is spoken as "No", and "~5 days" becomes "about 5 days". Pauses come
  from punctuation, never from extra spaces. Tests check all of this.
- **Cache key = spoken text + every audio setting** (voice, model, format, speed). Changing any
  setting can never replay old audio. Cached files live in `audio_service/.tts_cache/` and survive
  restarts, so audio generated while rehearsing still plays in the demo even if the Wi-Fi drops.
- **Never raises to the backend.** Every failure is a `TTSResult` with a stable `error_code`, so
  the text answer always shows.

## Tested vs not yet tested

- **Tested here (automated, no network):** text cleanup on every mock answer and on hostile input
  (50,000-character inputs finish in well under a second), the contract and validation, caching
  (memory limit and disk), duplicate-request sharing, retries and their limits, ElevenLabs error
  mapping (using the documented error shapes), the total-time deadline, setup checks, config
  parsing, and rapid switching between answers. For speech-to-text: format detection for 10 audio
  formats, rejection of empty, oversized and non-audio uploads, silence, cache, retries, error
  mapping, confidence and the Gemini handoff.
- **Run by hand:** a 400-call, 16-thread stress test with random failures; the FastAPI examples
  against the team's real `backend/main.py`; a real text-to-speech call (the bill summary, played on
  a laptop) and a real speech-to-text call (that MP3 transcribed back: 100% of spoken words,
  confidence 0.994); and the whole voice path on a copy of the committed backend: the team's
  `main.py` with the two lines above, real ElevenLabs both ways, and the team's `gemini_service`
  in `MOCK=true` mode (a spoken question came back as text, went through the Gemini step, and the
  reply was spoken: `demo_output/e2e-question.mp3` and `e2e-reply.mp3`).
- **Streaming and speed (2026-10-09):** automated tests for streaming with a fake ElevenLabs that
  sends audio piece by piece (first audio, late listeners, shared generations, retries before and
  after a listener heard audio), byte ranges, and model choice. In headless Chrome, the playground
  page started playing a streamed 33-second clip 2.7 s before its last piece arrived. With real
  ElevenLabs: the timings in "Speed", and each model's audio transcribed back to check the numbers.
- **The wiring (2026-10-10):** `backend/tests/test_wiring.py` (every route mounted; typed, file and
  voice analyses through `main.app`, saved after the price check; saved analyses read back exactly
  and spoken again), `test_analysis_store.py` (the real store against a local PostgreSQL 17: NULL
  codes and amounts kept, a failed save leaves nothing behind, text in other alphabets, a held lock,
  dropped tables, an app role without CREATE, a save that runs out of time is rolled back) and
  `test_dev_console.py`. In headless Chrome, the developer console ran every flow above against a
  local PostgreSQL with a stand-in for ElevenLabs, including microphone recording and a streamed
  reply. The audio and backend suites also pass together in one pytest session, in either order.
- **Live (2026-10-10, `d1753db`):** with every key in `backend/.env`, 15 of 15 checks passed: real
  Gemini (`gemini-3.5-flash`), Snowflake, Tiger Data (inside a throwaway schema) and ElevenLabs both
  ways, alone and together through `main.app`, including a spoken question through
  `POST /api/v1/voice/analyze`. Details: `BACKEND_VERIFICATION_REPORT.md`.
- **Not yet tested:** the mobile playback and recording snippets on a phone, streaming on an iPhone,
  and a real human voice recorded on a phone (only synthetic speech so far).

## Git notes

- Commit this folder. Its `.gitignore` keeps `.tts_cache/`, `demo_output/`, `__pycache__/` and any
  stray `.env` out of git. Never commit `backend/.env`.
- This folder replaces the empty `backend/services/audio_service.py` placeholder from the first
  commit. Commit its deletion too. Until then, `__init__.py` in this folder makes sure Python
  imports the folder and not that empty file (without it, `services.audio_service...` imports fail
  with "is not a package").
- `backend/requirements.txt` should also list `requests` (this module uses it directly; today it only
  arrives as a dependency of `elevenlabs`). `python-multipart` is already there. That file belongs
  to the backend owner.
