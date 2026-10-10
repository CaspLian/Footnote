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

## 3. Connected to Gemini: the voice endpoints

[`../voice_routes.py`](../voice_routes.py) receives the recording, transcribes it, passes the text to
the team's Gemini step (`services.gemini_service.analyze`, called the same way `/api/v1/analyze`
calls it), and turns Gemini's `spoken_summary` into audio. To switch it on, add two lines to
`backend/main.py`, after `app = FastAPI(...)`:

```python
from services.audio_service.voice_routes import router as voice_router
app.include_router(voice_router)
```

### `POST /api/v1/voice/analyze` (multipart form)

| Field | Required | Meaning |
|---|---|---|
| `audio` | yes | The recording: `.m4a` from the app, webm, mp3, wav, ... |
| `file` | no | Photo or PDF of the bill, sent to Gemini together with the question |
| `target_language` | no (`en`) | The language the user speaks and wants the answer in; speech-to-text uses it too |
| `message_id` | no | Your ID for this message; one is made if missing |
| `speak_reply` | no (`true`) | Also turn `spoken_summary` into audio |
| `voice` | no (default voice) | The reply voice the user chose: a key from `GET /api/v1/voice/voices`, e.g. `bunty` |
| `stream_reply` | no (`false`) | `true`: answer as soon as the first reply audio exists, and stream the rest. Faster. Tested in Chrome; expected to work on Android, may not on iPhones, so test on both phones first. Needs the backend to run as one process |

A successful answer (from the end-to-end run on 2026-10-09, shortened):

```json
{
  "transcript": {"text": "Hi. Why was my MRI billed $3,200? Is that normal?", "language": "eng",
                 "confidence": 0.991, "needs_confirmation": false, "audio_seconds": 5.43},
  "analysis":   {"target_language": "en", "model": "gemini-3.8-flash", "mock": true, "result": {"...": "..."}},
  "speech":     {"ok": true, "audio_url": "/api/v1/voice/audio/eb271c6235a68884ff2a308e63c5f7a5",
                 "mime_type": "audio/mpeg", "voice": "matilda", "streaming": false,
                 "error_code": null, "error_message": null}
}
```

`analysis` is exactly what `/api/v1/analyze` returns, so the app can show both the same way.
Play `speech.audio_url` (`GET /api/v1/voice/audio/{audio_id}`, an MP3) with the playback code in
`../text_to_speech/README.md`. Show `transcript.text` when `needs_confirmation` is true.
`speech.streaming` is `true` only with `stream_reply=true`: the audio URL then plays while the rest
of the reply is still being made. Finished audio supports byte ranges, which iPhones need.

Errors come back as `{"detail": {"stage": ..., ...}}` so the app knows which step failed:

| Status | Stage | When |
|---|---|---|
| 422 | `speech_to_text` | Silent, empty or non-audio recording (`detail.error_code`: `NO_SPEECH`, `EMPTY_AUDIO`, `UNSUPPORTED_AUDIO`). Ask the user to try again. |
| 413 | `speech_to_text` / `upload` | Recording over `STT_MAX_AUDIO_MB`, or bill over 15 MB |
| 503 | `speech_to_text` | ElevenLabs temporarily unavailable (`detail.retryable` is true) |
| 502 | `speech_to_text` / `gemini` | Key, permission or quota problem, or Gemini failed |
| 400 / 504 | `gemini` | Gemini rejected the input / took too long (same as `/api/v1/analyze`) |

A failed reply voice never fails the request: `speech.ok` is false and the text answer is still
there. That includes an unknown `voice` (`INVALID_REQUEST`, and the message lists the valid keys).
The reply voice is English-only for now: other languages get the text answer, with
`speech.error_code` set to `INVALID_REQUEST`.

### Voice picker: `GET /api/v1/voice/voices` and `GET /api/v1/voice/voices/{key}/sample`

`/voices` returns the voices users can choose, for a picker in the app:

```json
{"default": "matilda",
 "voices": [{"key": "matilda", "name": "Matilda", "description": "Knowledgeable and professional", "accent": "American", "gender": "female"},
            {"key": "bunty", "name": "Bunty", "description": "Energetic, expressive and fun", "accent": "Indian", "gender": "male"},
            "..."]}
```

`/voices/{key}/sample` returns a short MP3 of that voice saying "Hi, I'm Bunty. I can read your
medical bill explanations out loud.", so users can hear a voice before choosing it. Each sample
is made once (about 30 credits) and then served from the cache. Send the chosen `key` as `voice`
with `/analyze`.

**Tested:** `../tests/test_voice_routes.py` (with stand-ins for Gemini and the price check), and
end-to-end runs on 2026-10-09: the team's `main.py` plus the two lines above, real ElevenLabs
speech-to-text and text-to-speech, and the team's `gemini_service` in `MOCK=true` mode. The second
run, after merging `backend-gemini` and `Tiger-data`, also checked that a spoken question gets the
same Snowflake price check (from the local CSV) as a typed one.

## 4. Using speech-to-text on its own

Section 1 shows the direct call. Use it when the backend needs a transcript without Gemini.

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

async function stopAndAsk(messageId, language = 'en', voice = 'matilda') {   // voice: from GET /api/v1/voice/voices
  await recorder.stop();
  const form = new FormData();
  form.append('audio', { uri: recorder.uri, name: 'question.m4a', type: 'audio/m4a' });
  form.append('target_language', language);
  form.append('voice', voice);
  form.append('message_id', messageId);
  const response = await fetch(`${BACKEND_URL}/api/v1/voice/analyze`, { method: 'POST', body: form });
  const body = await response.json();
  if (!response.ok) return showVoiceError(body.detail);   // detail.stage says which step failed
  showAnswer(body.transcript.text, body.analysis.result);  // same result shape as /api/v1/analyze
  if (body.speech.ok) playReply(BACKEND_URL + body.speech.audio_url);
}
```

Do not set the `Content-Type` header yourself; `fetch` adds the right one for `FormData`.

## 6. Where responsibilities sit

| Part | Owner |
|---|---|
| Recording, microphone permission, upload, showing and playing the answer | Mobile app |
| Mounting the voice router in `main.py` (two lines) | Backend teammate |
| What Gemini does with the question: prompt, model, `GeminiResult` | Gemini teammate (`services/gemini_service.py`) |
| The voice endpoints, checking the audio, transcription, retries, cache, the handoff, the spoken reply | This module |
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
