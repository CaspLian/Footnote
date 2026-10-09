# audio_service: voice for ClaimPulse AI

Lives at `backend/services/audio_service/`. Two features, both tested with real ElevenLabs calls:

- **text_to_speech**: Gemini's answer → speech the app plays
- **speech_to_text**: the user's recording → text, handed over ready for Gemini

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
│   └── README.md               integration guide: receiving endpoint, voice loop, app recording
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
ELEVENLABS_VOICE_ID=a-voice-id-from-check_setup
```

One `NAME=value` per line: no dashes, no quotes, no spaces around `=`. Do not paste the key anywhere else.

## Verify, step by step

Run these from `backend\services\audio_service` with the venv active:

| Step | Command | Needs key? | Cost |
|---|---|---|---|
| 1. Tests pass | `python -m pytest` | no | free |
| 2. See what would be spoken | `python -m text_to_speech.demo --dry-run` | no | free |
| 3. Check key, plan and voices | `python -m text_to_speech.check_setup` | yes | free |
| 4. Hear it | `python -m text_to_speech.demo --open` | yes | ~96 characters |
| 5. Prove the cache works | run step 4 again | yes | 0 characters |
| 6. Check a recording | `python -m speech_to_text.demo --file recording.m4a --check` | no | free |
| 7. Transcribe it | `python -m speech_to_text.demo --file recording.m4a` | yes | ~$0.004 per minute |
| 8. Round trip | `python -m speech_to_text.demo --round-trip mock-bill-summary` | yes | ~$0.004 |

Step 3 lists the voice IDs your key can use. Copy one into `ELEVENLABS_VOICE_ID` in `backend/.env`.
Step 4 saves `audio_service/demo_output/mock-plain.mp3` and plays it. Each answer is requested twice,
and the second request should print `cached=True characters_sent=0`. Other options:
`--mock mock-numbers`, `--text "your sentence"`, `--all` (all mock answers, about 830 characters).

Step 8 transcribes the MP3 that `python -m text_to_speech.demo --mock mock-bill-summary` made and
compares it with the original Gemini text. On 2026-10-09 it took 4.6 s for 63 s of audio, with
confidence 0.994 and every spoken word back (numbers come back written as words, e.g.
"seven oh five five one").

## How the backend uses it

In `backend/main.py` (your backend teammate's file):

```python
from services.audio_service.text_to_speech import TTSRequest, synthesize
from services.audio_service.speech_to_text import STTRequest, to_gemini_handoff, transcribe
```

The speech-to-text contract, the receiving endpoint, the full voice loop (speech → Gemini →
speech) and the mobile recording code are in [speech_to_text/README.md](speech_to_text/README.md).
File uploads in FastAPI need `python-multipart` in `backend/requirements.txt`.

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
| `NOT_CONFIGURED` | Key or voice ID missing, or a bad value in `backend/.env` | Read the message; compare with `.env.example` |
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
  speed setting. `eleven_v4` is newer and worth comparing by ear (`ELEVENLABS_MODEL_ID=eleven_v4`).
  `eleven_flash_v2_5` is half price, but the docs show it reading "$1,000,000" as "one thousand
  thousand dollars".
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
- **Run by hand:** a 400-call, 16-thread stress test with random failures; the FastAPI examples in
  both READMEs (receiving endpoint and full voice loop) against the team's real `backend/main.py`;
  a real text-to-speech call (the bill summary, played on a laptop) and a real speech-to-text call
  (that MP3 transcribed back: 100% of spoken words, confidence 0.994).
- **Not yet tested:** the mobile playback and recording snippets on a phone, a real human voice
  recorded on a phone (only synthetic speech so far), and the real Gemini service (a stand-in was used).

## Git notes

- Commit this folder. Its `.gitignore` keeps `.tts_cache/`, `demo_output/`, `__pycache__/` and any
  stray `.env` out of git. Never commit `backend/.env`.
- This folder replaces the empty `backend/services/audio_service.py` placeholder from the first
  commit; Git shows that file as deleted. Mention it to the team when you commit.
- `backend/requirements.txt` should also list `requests` (this module uses it directly; today it only
  arrives as a dependency of `elevenlabs`) and `python-multipart` (FastAPI needs it to receive the
  recording upload). That file belongs to the backend owner.
