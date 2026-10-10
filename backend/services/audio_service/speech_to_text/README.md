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
the team's Gemini step (`services.gemini_services.gemini_service.analyze`, called the same way `/api/v1/analyze`
calls it) and the price check, saves the analysis to Tiger Data, and speaks the answer. The router
is mounted in `backend/main.py` (`app.include_router(voice_router)`), so these routes are part of
the app.

The reply voice says Gemini's `spoken_summary`, then a sentence or two on what the price check
found (for example "Head CT was billed about 30 times Medicare's national rate, which is far above
the usual range. It's worth asking the billing office about it."). Gemini writes its summary before
the price check runs, so this is added here. These sentences are English, like the reply voices for
now; they compare with Medicare's national rates and never say a charge is wrong.

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
  "analysis":   {"target_language": "en", "model": "gemini-3.8-flash", "mock": true, "result": {"...": "..."},
                 "price_checks": ["..."], "price_summary": {"...": "..."},
                 "audit": {"saved": true, "audit_id": "6ddb0e91-707f-4a1e-90b8-26aa751f0307", "error": null}},
  "speech":     {"ok": true, "audio_url": "/api/v1/voice/audio/eb271c6235a68884ff2a308e63c5f7a5",
                 "mime_type": "audio/mpeg", "voice": "matilda", "streaming": false,
                 "text": "Your MRI was billed at three thousand two hundred dollars. I also compared ...",
                 "error_code": null, "error_message": null}
}
```

`analysis` is exactly what `/api/v1/analyze` returns, so the app can show both the same way.
Play `speech.audio_url` (`GET /api/v1/voice/audio/{audio_id}`, an MP3) with the playback code in
`../text_to_speech/README.md`; `speech.text` is what the voice says, for captions. Show
`transcript.text` when `needs_confirmation` is true.
`analysis.audit` says whether the analysis was saved to Tiger Data (with the question's transcript).
Saving never fails the request: without `TIGER_DATA_POSTGRES_URL`, or if Tiger Data is down,
`audit.saved` is false, `audit.audit_id` is null and `audit.error` says why. When `saved` is true,
keep `audit.audit_id`: it loads the analysis again (`GET /api/v1/audits/{audit_id}`) and speaks it
again (`POST /api/v1/voice/speak`, below). The voice route saves while it makes the reply audio, so a
healthy save adds nothing to the wait. If Tiger Data cannot be reached, one request waits for the
connection to time out (5 s per address), and saving is then skipped for 30 s ("could not be
reached a moment ago") instead of every request waiting again. A save that takes over 15 s is
rolled back, so "not saved" is always true.
`speech.streaming` is `true` only with `stream_reply=true`: the audio URL then plays while the rest
of the reply is still being made. Finished audio supports byte ranges, which iPhones need.

Errors come back as `{"detail": {"stage": ..., ...}}` so the app knows which step failed:

| Status | Stage | When |
|---|---|---|
| 422 | `speech_to_text` | Silent, empty or non-audio recording (`detail.error_code`: `NO_SPEECH`, `EMPTY_AUDIO`, `UNSUPPORTED_AUDIO`). Ask the user to try again. |
| 413 | `speech_to_text` / `upload` | Recording over `STT_MAX_AUDIO_MB`, or bill over 15 MB (checked before the recording is sent, so it costs nothing) |
| 503 | `speech_to_text` | ElevenLabs temporarily unavailable (`detail.retryable` is true) |
| 502 | `speech_to_text` / `gemini` | Key, permission or quota problem, or Gemini failed |
| 400 / 504 | `gemini` | Gemini rejected the input / took too long (same as `/api/v1/analyze`) |

A failed reply voice never fails the request: `speech.ok` is false and the text answer is still
there. That includes an unknown `voice` (`INVALID_REQUEST`, and the message lists the valid keys).
The reply voice is English-only for now: other languages get the text answer, with
`speech.error_code` set to `INVALID_REQUEST`.

### `POST /api/v1/voice/speak` (multipart form): hear a saved analysis again

| Field | Required | Meaning |
|---|---|---|
| `audit_id` | yes | `analysis.audit.audit_id` from `/api/v1/analyze` or `/api/v1/voice/analyze` |
| `voice` | no (default voice) | As for `/analyze` |
| `stream_reply` | no (`false`) | As for `/analyze` |

It answers with the `speech` object above, made from the saved analysis without calling Gemini
again (the same text in the same voice comes from the cache, free; each other voice is a new, paid
clip). Only saved analyses can be spoken: the server never reads out text sent to it directly.
Errors: 400 (`audit_id` is not a UUID), 404 (no saved analysis with this ID), 409 (saved in an older
format that no longer fits `models.py`), 503 (Tiger Data not configured or not reachable), all with
`detail.stage` = `audit`.

`GET /api/v1/audits/{audit_id}` (in `main.py`) returns the saved analysis itself:
`{"audit_id", "created_at", "source": "text" | "file" | "voice", "transcript", "analysis"}`, where
`analysis` is exactly what was returned the first time.

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

**Tested:** `../tests/test_voice_routes.py` (with stand-ins for Gemini, the price check and Tiger
Data), `backend/tests/test_wiring.py` and `test_analysis_store.py` (the real store against a local
PostgreSQL), end-to-end runs on 2026-10-09 (the team's `main.py` with the voice router, real
ElevenLabs speech-to-text and text-to-speech, and the team's `gemini_service` in `MOCK=true` mode;
the second run, after merging `backend-gemini` and `Tiger-data`, also checked that a spoken question
gets the same price check as a typed one), and a headless-Chrome run of the developer console
(`backend/dev_console.py`) on 2026-10-10 with a stand-in for ElevenLabs and a local PostgreSQL.

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
| `main.py`, which mounts the voice router (`app.include_router(voice_router)`) | Backend teammate |
| Saving analyses (`services/analytical_services/analysis_store.py`) and the database itself | Backend / Tiger Data teammate |
| What Gemini does with the question: prompt, model, `GeminiResult` | Gemini teammate (`services/gemini_services/gemini_service.py`) |
| The voice endpoints, checking the audio, transcription, retries, cache, the handoff, the spoken reply | This module |
| Recognition accuracy, billing | ElevenLabs |

## 7. Cost, privacy and options

- **Cost:** `scribe_v2` is $0.22 per hour of audio, so a 10-second question costs about $0.0006.
  The Creator plan includes 100 hours. Silence is billed too.
- **Privacy:** people will talk about their medical bills, sometimes with their names. This module
  logs only lengths and error codes, never what was said, and its own cache keeps transcripts in
  memory only. But when `TIGER_DATA_POSTGRES_URL` is set, every voice analysis is saved to Tiger Data
  with its transcript (`bill_analyses.transcript`), until the row is deleted
  (`DELETE FROM bill_analyses WHERE audit_id = '...'` also deletes its lines). There is no automatic
  expiry and no delete route yet. Reply audio is kept in `audio_service/.tts_cache/` (set
  `TTS_CACHE_DIR=` for memory only). ElevenLabs keeps request history by default (its zero-retention
  mode is enterprise-only). Use test data for demos.
- **`scribe_v2_medical`** (`ELEVENLABS_STT_MODEL_ID=scribe_v2_medical`): same price and API, tuned
  for clinical audio. Worth comparing with `python -m speech_to_text.demo --model scribe_v2_medical`.
- **Not built yet:** keyterm prompting (bias towards words like "ClaimPulse" or "CPT"; +$0.05 per
  hour) and live transcription while the user speaks (`scribe_v2_realtime` over a WebSocket,
  $0.39 per hour).
