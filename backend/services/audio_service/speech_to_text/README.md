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
is mounted in `backend/main.py`.

**The HTTP contract** (fields, responses, error codes, audio delivery, the voice picker) is in
[`docs/API_CONTRACTS.md`](../../../../docs/API_CONTRACTS.md), the single source for every route.
What this module adds on top of it:

- **What the reply says.** The reply voice says Gemini's `spoken_summary`, then a sentence or two on what the
  price check found, for example "Head CT was billed about 30 times Medicare's national rate, which is far above
  the usual range. It's worth asking the billing office about it."
  - Gemini writes its summary before the price check runs, so these sentences are added here (`spoken_reply()`).
  - They are English, like the reply voices for now.
  - They compare with Medicare's national rates and never say a charge is wrong.
- **Captions.** `speech.text` is exactly what the voice says: show it as captions.
- **Playback.** Play `speech.audio_url` with the mobile code in `../text_to_speech/README.md`, section 4.

**Tested:**
- `../tests/test_voice_routes.py`, with stand-ins for Gemini, the price check and Tiger Data.
- `backend/tests/test_wiring.py` and `test_analysis_store.py`; the latter runs the real store against a local
  PostgreSQL.
- End-to-end runs on 2026-10-09 with real ElevenLabs in both directions, and Gemini in MOCK mode.
- The developer console in headless Chrome, on 2026-10-10, with a stand-in for ElevenLabs.
- A full live run on 2026-10-10, with real Gemini, Snowflake, Tiger Data and ElevenLabs (see
  `docs/PROJECT_STATUS.md`).

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
