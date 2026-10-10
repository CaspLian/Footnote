# audio_service: voice for ClaimPulse AI

Lives at `backend/services/audio_service/`. Two features, both tested with real ElevenLabs calls,
and the endpoints that connect them to the team's Gemini step:

- **text_to_speech**: Gemini's answer → speech the app plays
- **speech_to_text**: the user's recording → text, handed over ready for Gemini
- **voice_routes.py**: `POST /api/v1/voice/analyze`: recording → transcript → `gemini_service.analyze()`
  → spoken reply in the voice the user chose, `GET /api/v1/voice/audio/{id}` to play the reply, and
  `GET /api/v1/voice/voices` (+ `/voices/{key}/sample`) for the app's voice picker
- **20 voices to choose from** (10 female, 9 male, 1 neutral; 11 accents), listed in
  `text_to_speech/voices.json`. Matilda is the default; Bunty and Noor are the fun Indian voices.

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
├── conftest.py                 test setup for both features (never reads the real backend/.env)
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
  estimate first (about 0.44 credits per character per voice). It asks before anything over
  2,000 credits. Stop ends it, and so does choosing a voice or model or pressing any play button.
- The newest click always wins: an answer that arrives after you moved on is not played, but
  it is kept in the replay list.
- The Model buttons switch between Multilingual v2 (today's default), Flash v2.5, v4 Turbo and v4,
  and speak the same text again, so you can compare speed and sound (see "Speed" below).
- The audio is streamed: it starts playing at the "first audio" time shown, while the rest is
  still being made. Use Chrome, Edge or Firefox; Safari may wait for the whole clip.

It only listens on your computer, so nobody else on the network can use it. Stop it with Ctrl+C
in the terminal. It needs `fastapi` and `uvicorn` (`pip install -r requirements-dev.txt`), and
finds the key in `backend/.env` or `backend/api.env`.

## Speed (measured 2026-10-09 on the Creator plan)

Almost all of the wait is ElevenLabs making the audio. Our own code takes milliseconds (a cached
clip comes back in 8 ms) and connecting to ElevenLabs takes about 0.1 s, once (the connection is
reused). Speech-to-text is quick too: 63 seconds of audio took 4.6 s, so a short spoken question
should take about a second (estimated, not measured).

A 222-character bill text full of numbers, voice Matilda:

| Model | First audio | All audio | Credits per character | Numbers read right |
|---|---|---|---|---|
| `eleven_multilingual_v2` (today's default) | 3.6 s | 4.0 s | 0.44 | yes |
| `eleven_flash_v2_5`, number reading on | 1.0 s | 1.8 s | 0.22 | yes |
| `eleven_flash_v2_5`, ElevenLabs' default | 0.2 s | 0.9 s | 0.22 | **no**: "$12,345.67" came out as "12,340.67", "E11.9" as "11.9" |
| `eleven_v4_turbo` | 1.0 s | 5.7 s | 0.06 now, ~0.22 after Oct 12 | yes |
| `eleven_v4` | 1.2 s | 6.7 s | 0.12 now, ~0.44 after Oct 12 | yes |

For a short sentence (95 characters) the first audio came after 1.5 s on Multilingual v2, 0.3-0.4 s
on Flash v2.5 with number reading on, 0.4 s on v4 Turbo and 1.7 s on v4. The v4 prices are a launch
offer ("72% off until Oct 12"). Before streaming, users always waited for "All audio".

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

- **Switch to Flash**: `ELEVENLABS_MODEL_ID=eleven_flash_v2_5` in `backend/.env`. 2-4 times faster
  and half the credits, with number reading on automatically. Listen in the playground first:
  ElevenLabs says its quality is slightly lower than Multilingual v2. One ElevenLabs page still
  calls number reading on Flash an Enterprise feature; it worked on our Creator plan, so recheck it
  before the demo (playground, Flash v2.5, a text with money and codes).
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

In `backend/main.py` (your backend teammate's file):

```python
from services.audio_service.text_to_speech import TTSRequest, synthesize
from services.audio_service.speech_to_text import STTRequest, to_gemini_handoff, transcribe
```

To switch on the voice endpoints (speech → the team's Gemini step → speech), add two lines to
`backend/main.py`, after `app = FastAPI(...)`:

```python
from services.audio_service.voice_routes import router as voice_router
app.include_router(voice_router)
```

Fields, response shape and error codes are in section 3 of
[speech_to_text/README.md](speech_to_text/README.md), along with the mobile recording code.

The text-to-speech contract, a FastAPI example and the mobile playback code are in
[text_to_speech/README.md](text_to_speech/README.md). Generated audio is cached in
`audio_service/.tts_cache/`, whichever folder the backend is started from.

## What it costs

- ElevenLabs bills every character sent, including spaces and punctuation, and charges again for
  identical requests (free regenerations exist only on their website). That is why the cache exists.
- Free plan: 10,000 credits a month. With `eleven_multilingual_v2`, 1 character = 1 credit, so that
  is roughly 25 answers of 400 characters.
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
- **Concurrency:** 2 requests at a time on the free plan. More get queued or return `RATE_LIMITED`.

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
| `RATE_LIMITED` | More than 2 requests at once on free | Usually fine on retry |
| `PROVIDER_TIMEOUT` / `PROVIDER_UNAVAILABLE` | Network or ElevenLabs problem | Retry; check https://status.elevenlabs.io |
| `TEXT_TOO_LONG` | Answer longer than `TTS_MAX_CHARS` after cleanup | Shorter Gemini answers, or raise the limit |
| `ModuleNotFoundError: text_to_speech` | `python -m text_to_speech...` run from the wrong folder | Run it from `backend\services\audio_service` |

## Design decisions (and why)

- **Plain HTTPS with `requests`, not the ElevenLabs SDK.** In the current SDK (2.71), `convert()`
  only sends the request when you read its output, so a normal try/except around the call misses
  errors. It also does not retry `convert()`, and it reads the API key when it is imported. One
  documented POST is easier to control, test and explain. (The `elevenlabs` package in
  `backend/requirements.txt` is not used by this module; it does no harm.)
- **Default model `eleven_multilingual_v2`.** It is the API default, documented as the most
  stable, recommended by ElevenLabs where numbers must be read correctly, and it supports the
  speed setting. It is also the slowest (see "Speed"). `eleven_flash_v2_5` misreads numbers with
  ElevenLabs' default setting, so the module turns number reading on for it; in our test it then
  read every amount, date and code right. Switching is the team's call after listening.
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
- **Not yet tested:** the mobile playback and recording snippets on a phone, streaming on an iPhone,
  a real human voice recorded on a phone (only synthetic speech so far), and Gemini with a real key
  (only its mock mode).

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
