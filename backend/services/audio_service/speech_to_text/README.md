# speech_to_text: integration guide

For the backend and mobile teammates. Turns the user's spoken question into text, and hands
that text over in a form ready for Gemini.

```
app records ──► backend receives the file ──► transcribe() ──► STTResult ──► to_gemini_handoff() ──► Gemini code
                                              (check → cache → ElevenLabs → tidy)                    (your teammate)
```

This package shares no code with `text_to_speech`, so a change in one cannot break the other.

## 1. Calling it

From `backend/main.py` (the backend runs from the `backend` folder):

```python
from services.audio_service.speech_to_text import STTRequest, to_gemini_handoff, transcribe

result = transcribe(STTRequest(request_id=message_id, audio=uploaded_bytes, mime_type=content_type))
handoff = to_gemini_handoff(result)

if handoff:
    handoff.text                # the user's question: send this to Gemini
    handoff.needs_confirmation  # True when the transcript may be misheard
else:
    result.error_code           # e.g. "NO_SPEECH": ask the user to try again
```

- `transcribe()` **never raises** for expected problems (silence, a non-audio upload, ElevenLabs
  down, bad key). Failures come back as `ok=False` with a stable `error_code`.
- It blocks while ElevenLabs works (about a second for a short question). In an `async def`
  route, use `await transcribe_async(request)`.
- The exact same recording sent twice is transcribed once (`cached=True` the second time), so an
  app that retries an upload is not billed twice. Transcripts are cached in memory only.
- Settings come from `backend/.env`. It uses the same `ELEVENLABS_API_KEY` as text-to-speech, and
  the key needs the **Speech to Text** permission.

## 2. The contract

### `STTRequest` (backend → STT)

| Field | Type | Meaning |
|---|---|---|
| `request_id` | `str`, required | Your ID for this voice message. Echoed back. |
| `audio` | `bytes`, required | The uploaded file, unchanged: `.m4a` from a phone, `.webm` from a browser, mp3, wav, ... |
| `mime_type` | `str` or `None` | The upload's content type. Only used when the format cannot be read from the bytes. |
| `language` | `str`, default `"en"` | Spoken language. `""` lets ElevenLabs detect it. |

### `STTResult` (STT → backend)

| Field | Meaning |
|---|---|
| `request_id`, `ok` | Same ID as the request; `True` if `text` is present |
| `text` | What the user said. Spacing is tidied and sound tags such as "(laughter)" removed; words are never removed |
| `language` | Language ElevenLabs used or detected (e.g. `"eng"`) |
| `confidence` | 0 to 1, average word probability; low means it may be misheard |
| `audio_seconds` | Length of the recording; speech-to-text is billed per hour of audio |
| `audio_format` | Detected from the file, e.g. `"m4a"` |
| `cached`, `attempts`, `elapsed_ms`, `provider_request_id` | Cost and performance evidence |
| `error_code`, `error_message`, `retryable` | Set when `ok` is `False` |

### `GeminiHandoff` (STT → Gemini code), from `to_gemini_handoff(result)`

| Field | Meaning |
|---|---|
| `text` | The user's question. Send it to Gemini as the user's message. |
| `needs_confirmation` | `True` when `confidence` is below 0.5: consider asking "Did you mean ...?" |
| `request_id`, `language`, `confidence` | Copied from the result |
| `input_mode` | Always `"voice"` |

`to_gemini_handoff` returns `None` when there is nothing to send. `handoff.to_dict()` gives JSON.
`VOICE_INPUT_NOTE` is an optional sentence for Gemini's system prompt telling it the message came
from speech recognition and may contain misheard words.

### Error codes

| `error_code` | Retry? | What it means / what to do |
|---|---|---|
| `INVALID_REQUEST` | no | Integration bug: e.g. `audio` is not bytes. Read `error_message`. |
| `EMPTY_AUDIO` | no | No audio or far too short. Ask the user to hold the button while speaking. |
| `AUDIO_TOO_LARGE` | no | Over `STT_MAX_AUDIO_MB` (10 MB, about 10 minutes from the app). |
| `UNSUPPORTED_AUDIO` | no | The upload is not audio (wrong file sent). |
| `NO_SPEECH` | no | Transcribed, but nobody spoke. Ask the user to try again. |
| `NOT_CONFIGURED` | no | `ELEVENLABS_API_KEY` missing, or a bad value in `backend/.env`. |
| `AUTH_FAILED` | no | Key rejected, or missing the **Speech to Text** permission. |
| `QUOTA_EXCEEDED` | no | Out of ElevenLabs credits. |
| `PROVIDER_REJECTED` | no | ElevenLabs refused it, e.g. unreadable audio or an unknown model. |
| `RATE_LIMITED`, `PROVIDER_TIMEOUT`, `PROVIDER_UNAVAILABLE` | yes | Temporary; already retried once inside the module. |
| `INTERNAL_ERROR` | no | Bug in this module. Details are in the server log. |

## 3. The receiving end (FastAPI)

This was run against the team's real `backend/main.py` with a fake ElevenLabs on 2026-10-09.
Add it to `backend/main.py`, below `app = FastAPI(...)`. File uploads in FastAPI need the
**`python-multipart`** package, so add it to `backend/requirements.txt`.

```python
from fastapi import APIRouter, File, Form, UploadFile

from services.audio_service.speech_to_text import STTRequest, to_gemini_handoff, transcribe_async

stt_router = APIRouter(prefix="/api/stt", tags=["audio"])


@stt_router.post("")
async def receive_speech(audio: UploadFile = File(...), message_id: str = Form(...)):
    result = await transcribe_async(
        STTRequest(request_id=message_id, audio=await audio.read(), mime_type=audio.content_type)
    )
    handoff = to_gemini_handoff(result)
    if handoff is None:
        # Nothing to send to Gemini: the app should ask the user to try again.
        return {"ok": False, "error_code": result.error_code, "retryable": result.retryable}
    return {"ok": True, "gemini_handoff": handoff.to_dict()}


app.include_router(stt_router)
```

## 4. The whole voice loop: speech → Gemini → speech

How the teammate connects everything in one endpoint, also run against the real `main.py`.
`ask_gemini` stands for the Gemini service's function:

```python
import asyncio

from fastapi import APIRouter, File, Form, UploadFile

from services.audio_service.speech_to_text import STTRequest, to_gemini_handoff, transcribe_async
from services.audio_service.text_to_speech import TTSRequest, synthesize_async

voice_router = APIRouter(prefix="/api/voice", tags=["audio"])


def ask_gemini(question: str) -> str:
    """Replace with the Gemini service's function: question in, answer text out."""
    raise NotImplementedError


@voice_router.post("/ask")
async def ask_by_voice(audio: UploadFile = File(...), message_id: str = Form(...)):
    heard = await transcribe_async(
        STTRequest(request_id=message_id, audio=await audio.read(), mime_type=audio.content_type)
    )
    handoff = to_gemini_handoff(heard)
    if handoff is None:
        return {"ok": False, "stage": "speech_to_text", "error_code": heard.error_code}
    answer = await asyncio.to_thread(ask_gemini, handoff.text)
    spoken = await synthesize_async(TTSRequest(request_id=message_id, text=answer))
    return {
        "ok": True,
        "question": handoff.text,
        "needs_confirmation": handoff.needs_confirmation,
        "answer": answer,  # always show the text, even if the audio failed
        "audio_url": f"/api/tts/audio/{spoken.audio_id}" if spoken.ok else None,
    }


app.include_router(voice_router)
```

`audio_url` is served by the `/api/tts/audio/{audio_id}` route in `../text_to_speech/README.md`.

## 5. Recording in the mobile app (Expo; reference, not yet run on a phone)

Use `expo-audio` (`npx expo install expo-audio`). Its `HIGH_QUALITY` preset records `.m4a` (AAC)
on iPhone and Android, which this module accepts. Upload it as a form field named `audio`:

```js
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';

// Inside your component:
const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

async function startRecording() {
  const { granted } = await AudioModule.requestRecordingPermissionsAsync();
  if (!granted) return showMicrophoneBlocked();
  await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
  await recorder.prepareToRecordAsync();
  recorder.record();
}

async function stopAndSend(messageId) {
  await recorder.stop();
  const form = new FormData();
  form.append('audio', { uri: recorder.uri, name: 'question.m4a', type: 'audio/m4a' });
  form.append('message_id', messageId);
  const response = await fetch(`${BACKEND_URL}/api/stt`, { method: 'POST', body: form });
  return response.json();   // { ok: true, gemini_handoff: {...} } or { ok: false, error_code }
}
```

Do not set the `Content-Type` header yourself; `fetch` adds the right one for `FormData`.

## 6. Where responsibilities sit

| Part | Owner |
|---|---|
| Recording, microphone permission, upload | Mobile app |
| The upload endpoint, calling Gemini with `handoff.text`, storing the conversation | Backend / Gemini teammates |
| Checking the audio, transcription, retries, cache, tidying, error codes, the handoff | This module |
| Recognition accuracy, billing | ElevenLabs |

## 7. Cost, privacy and options

- **Cost:** `scribe_v2` is $0.22 per hour of audio, so a 10-second question costs about $0.0006.
  The Creator plan includes 100 hours. Silence is billed too.
- **Privacy:** people will talk about their medical bills. This module logs only lengths and
  error codes, never what was said, and keeps transcripts in memory only. ElevenLabs keeps request
  history by default (its zero-retention mode is enterprise-only), so use test data for demos.
- **`scribe_v2_medical`** (`ELEVENLABS_STT_MODEL_ID=scribe_v2_medical`): same price and API, tuned
  for clinical audio. Worth comparing with `python -m speech_to_text.demo --model scribe_v2_medical`.
- **Not built yet:** keyterm prompting (bias towards words like "ClaimPulse" or "CPT"; +$0.05 per
  hour) and live transcription while the user speaks (`scribe_v2_realtime` over a WebSocket,
  $0.39 per hour).
