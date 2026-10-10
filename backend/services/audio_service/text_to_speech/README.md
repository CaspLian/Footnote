# text_to_speech: integration guide

For the backend and mobile teammates. Turns a Gemini answer into audio with ElevenLabs.
Your code never talks to ElevenLabs directly, and the ElevenLabs API key never goes into the app.

```
Gemini answer ──► backend ──► synthesize() ──► (cleanup → cache → ElevenLabs) ──► TTSResult ──► backend ──► mobile app
```

## 1. Calling it

From `backend/main.py` (the backend runs from the `backend` folder):

```python
from services.audio_service.text_to_speech import TTSRequest, synthesize

result = synthesize(TTSRequest(request_id=message_id, text=gemini_answer_text, voice="bunty"))

if result.ok:
    result.audio       # MP3 bytes
    result.mime_type   # "audio/mpeg"
    result.audio_id    # stable ID for this audio: serve it from an audio endpoint (below)
    result.voice       # the voice used, e.g. "bunty"
else:
    result.error_code  # e.g. "PROVIDER_TIMEOUT"; still show the text answer
    result.retryable   # True = worth trying again later
```

- `synthesize()` **never raises** for expected problems (empty text, ElevenLabs down, bad key).
  Failures come back as `ok=False`, so a voice problem can never break the text answer.
- It blocks while ElevenLabs works (typically a few seconds). In an `async def` route, use
  `await synthesize_async(request)` instead, so the server keeps handling other requests.
- Calling it twice with the same text is free the second time (`cached=True`), and
  identical requests that arrive at the same time share one ElevenLabs generation.
  Each server process keeps its own memory cache (50 MB); the disk cache in
  `audio_service/.tts_cache/` is shared by all processes and survives restarts.
- Settings come from `backend/.env`; every setting is explained in `audio_service/.env.example`.

### Faster: start playing before the clip is finished

```python
from services.audio_service.text_to_speech import open_audio, synthesize_streaming_async

result = await synthesize_streaming_async(TTSRequest(request_id=message_id, text=answer))
# Returns at the first audio (result.elapsed_ms). If result.streaming is True, result.audio is
# None: give the app f"/api/v1/voice/audio/{result.audio_id}", which serves open_audio(audio_id).
```

`open_audio(audio_id)` gives an `AudioStream`: finished audio in one piece (`complete=True`), or
audio still being made, piece by piece as it arrives (`complete=False`; reading it raises
`AudioCutShort` if the clip fails part-way). `audio_http.audio_response()` turns it into the right
HTTP response: byte ranges for finished clips, a stream for the rest, and a broken-off connection
(so the player shows an error) if a stream fails. Streaming was tested in Chrome; Android is
expected to work and iPhones may not, so test on phones first (see "Speed" in
[the main README](../README.md)).

## 2. The contract

### `TTSRequest` (backend → TTS)

| Field | Type | Meaning |
|---|---|---|
| `request_id` | `str`, required | Your ID for this answer (e.g. the chat message ID). Echoed back. |
| `text` | `str`, required | Gemini's **complete** answer as displayed. Markdown is fine; it is cleaned up for speech. |
| `speech_text` | `str` or `None` | Optional speech-ready version of the answer. Used instead of `text` when given (see section 6). |
| `language` | `str`, default `"en"` | Only English for now. |
| `voice` | `str` or `None` | The user's voice choice, a key from `voices.json` (see "Voices" below). `None` = the default voice. |
| `model` | `str` or `None` | Optional ElevenLabs model for this request: `eleven_multilingual_v2`, `eleven_flash_v2_5`, `eleven_v4_turbo` or `eleven_v4` (`config.MODELS`). `None` = `ELEVENLABS_MODEL_ID` (default `eleven_flash_v2_5`). |

Pass the answer **text**, not Gemini's response object. A non-string `text` returns `INVALID_REQUEST`.
Streaming (partial) Gemini output is not supported yet: send the finished answer.

### `TTSResult` (TTS → backend)

| Field | Meaning |
|---|---|
| `request_id` | Same as in the request |
| `ok` | `True` if the audio exists (or, when `streaming`, has started) |
| `audio`, `mime_type` | The audio bytes and their type (`audio/mpeg`). `audio` is `None` while `streaming`. |
| `audio_id` | Content-based ID: same text + same voice + same settings → same ID. Use it in audio URLs. |
| `voice`, `model` | Key of the voice used, e.g. `"matilda"`, and the ElevenLabs model |
| `streaming` | `True` from `synthesize_streaming()` when the rest of the audio is still being made |
| `spoken_text` | Exactly what was sent to ElevenLabs after cleanup (captions, debugging) |
| `cached` | `True` = no new ElevenLabs generation was needed (no cost) |
| `characters_sent` | Characters this call sent to ElevenLabs (0 when cached) |
| `characters_billed` | ElevenLabs' own `character-cost` header, when it sends one |
| `attempts`, `elapsed_ms` | ElevenLabs attempts made, and time taken (to the first audio when `streaming`) |
| `provider_request_id` | ElevenLabs' request ID, useful for their support |
| `error_code`, `error_message`, `retryable` | Set when `ok` is `False` |

`result.metadata()` returns every field except the audio bytes, ready for JSON or logs.

### Voices users can choose

The choices live in [`voices.json`](voices.json). To add or swap a voice, edit that file and
restart the server; no code changes are needed. The 20 voices (each one generated real audio on the
team's account on 2026-10-09): 10 female, 9 male, 1 neutral, 11 accents.

| `voice` | Name | Style | Accent, gender | Source |
|---|---|---|---|---|
| `matilda` (default) | Matilda | Knowledgeable and professional | American, female | default |
| `sarah` | Sarah | Mature, reassuring and confident | American, female | default |
| `george` | George | Warm, captivating storyteller | British, male | default |
| `charlie` | Charlie | Deep, confident and energetic | Australian, male | default |
| `bunty` | Bunty | Energetic, expressive and fun | Indian, male | library |
| `alice` | Alice | Clear, engaging educator | British, female | default |
| `jessica` | Jessica | Playful, bright and warm | American, female | default |
| `noor` | Noor | Expressive, sassy and funny | Indian, female | library |
| `saavi` | Saavi | Warm, reassuring financial advisor | Indian, female | library |
| `ololade` | Ololade | Calm, natural and reassuring | Nigerian, female | library |
| `harris` | Ms. Harris | Caring Southern mom | Southern American, female | library |
| `rachel` | Rachel | Inviting, warm and friendly | Filipino, female | library |
| `claire` | Claire | Neutral, even and polished | South African, female | library |
| `river` | River | Relaxed, neutral and informative | American, neutral | default |
| `brian` | Brian | Deep, resonant and comforting | American, male | default |
| `bill` | Bill | Wise, mature and balanced | American, male | default |
| `patrick` | Patrick | Engaging, warm and trustworthy | Irish, male | library |
| `dayo` | Dayo | Clear, direct and natural | Nigerian, male | library |
| `elio` | Elio | Youthful, warm and hopeful | Spanish, male | library |
| `andy` | Andy | Gentle and friendly | Chinese, male | library |

- `list_voices()` returns `{"default": "matilda", "voices": [{key, name, description, accent, gender}, ...]}`
  for the app's voice picker, in the order above. ElevenLabs voice IDs stay on the server.
- An unknown `voice` returns `INVALID_REQUEST`, and the message lists the valid keys.
- The same text in two voices is two separate audios, each cached on its own.
- "default" voices are ElevenLabs default voices, which ElevenLabs says expire on December 31, 2026.
  "library" voices come from the Voice Library and work through the API on paid plans only. All
  of them cost the standard rate and have no live moderation, and their owners must give 730
  days' notice before withdrawing them (Patrick: 90 days). Using them took none of the account's
  30 voice slots. `python -m text_to_speech.check_setup` checks every voice against the account.
- The first audio from a library voice took 5-7 s (default voices about 1 s); after that they
  answer as quickly as the others.
- To find more voices: `GET https://api.elevenlabs.io/v1/shared-voices?accent=indian&language=en`
  (filters include `accent`, `gender`, `age`, `use_cases`; each voice has a free `preview_url`).
  Add `include_custom_rates=false` to skip voices that cost extra credits.

### Error codes

| `error_code` | Retry? | What it means / what to do |
|---|---|---|
| `INVALID_REQUEST` | no | Our integration bug: wrong types, empty `request_id`, non-English. Read `error_message`. |
| `EMPTY_TEXT` | no | Nothing speakable after cleanup (e.g. only formatting). Hide the play button. |
| `TEXT_TOO_LONG` | no | Over `TTS_MAX_CHARS` after cleanup. Ask Gemini for shorter answers, or raise the limit. |
| `NOT_CONFIGURED` | no | `ELEVENLABS_API_KEY` missing, or a bad value in `backend/.env`. |
| `AUTH_FAILED` | no | Key rejected, missing the *Text to Speech* permission, or a free account blocked for unusual activity. |
| `QUOTA_EXCEEDED` | no | Out of ElevenLabs credits (or the key's credit limit). |
| `PROVIDER_REJECTED` | no | ElevenLabs refused the request: unknown voice, voice not allowed on the plan, bad model or format. |
| `RATE_LIMITED` | yes | Too many requests at once (free plan: 4 at a time on Flash v2.5, 2 on Multilingual v2). Try again in a few seconds. |
| `PROVIDER_TIMEOUT` | yes | ElevenLabs did not answer within `TTS_TIMEOUT_SECONDS`. |
| `PROVIDER_UNAVAILABLE` | yes | Network problem or ElevenLabs server error. |
| `INTERNAL_ERROR` | no | Bug in this module. Details are in the server log. |

Temporary failures are already retried once inside the module (`TTS_MAX_RETRIES`), so
`retryable=True` means "try again later", not "loop now".

## 3. Backend example (FastAPI)

This was run against the team's real `backend/main.py` with a fake ElevenLabs on 2026-10-09.
Add it to `backend/main.py`, below `app = FastAPI(...)`, and adapt the names:

```python
from fastapi import APIRouter, HTTPException, Request

from services.audio_service.audio_http import audio_response
from services.audio_service.text_to_speech import TTSRequest, open_audio, synthesize_async

tts_router = APIRouter(prefix="/api/tts", tags=["audio"])


def load_answer_text(message_id: str) -> str | None:
    """Replace with the backend's own lookup of the stored Gemini answer."""
    raise NotImplementedError


@tts_router.post("/{message_id}")
async def speak(message_id: str):
    # Look the text up on the server. Never speak text sent by the app:
    # anyone could then generate speech on our ElevenLabs bill.
    text = load_answer_text(message_id)
    if text is None:
        raise HTTPException(status_code=404)
    result = await synthesize_async(TTSRequest(request_id=message_id, text=text))
    if not result.ok:
        return {"ok": False, "error_code": result.error_code, "retryable": result.retryable}
    return {"ok": True, "audio_url": f"/api/tts/audio/{result.audio_id}", "cached": result.cached}


@tts_router.get("/audio/{audio_id}")
def audio(audio_id: str, request: Request):
    stream = open_audio(audio_id)  # validates the ID, so "../secret" style paths are refused
    if stream is None:
        raise HTTPException(status_code=404)
    # Byte ranges for iPhones; the same audio_id always means the same audio, so finished clips may
    # be cached for good (audio still being made, from synthesize_streaming, is never cached).
    # "private": a reply explains someone's bill, so only their own device may keep it.
    return audio_response(
        stream, request.headers.get("range"), finished_headers={"Cache-Control": "private, max-age=31536000, immutable"}
    )


app.include_router(tts_router)
```

Why two endpoints: the JSON call reports errors clearly, and the audio URL lets the player
handle loading and replay by itself. Replaying the same URL costs nothing.

So the phone can reach the laptop, start the backend from the `backend` folder with
`uvicorn main:app --host 0.0.0.0 --port 8000`, with both devices on the same Wi-Fi.

`get_stats()` returns counters (requests, cache hits, characters sent, failures by code).
Exposing it on an admin-only route is handy for showing judges the cost savings.

## 4. Mobile playback (Expo; reference, not yet run on a phone)

Use **`expo-audio`** (`npx expo install expo-audio`). The app currently lists `expo-av`, but Expo's
docs say `expo-av` "is not receiving patches and will be removed in SDK 55", and this app is on SDK 57.

One shared player means a new answer always stops the old one, so answers never overlap:

```js
import { createAudioPlayer } from 'expo-audio';

const BACKEND_URL = 'http://192.168.1.23:8000';   // the laptop's Wi-Fi address, not localhost
let player = null;
let currentMessageId = null;

export async function speak(messageId) {
  currentMessageId = messageId;
  player?.pause();
  const response = await fetch(`${BACKEND_URL}/api/tts/${encodeURIComponent(messageId)}`, { method: 'POST' });
  const result = await response.json();
  if (messageId !== currentMessageId) return;          // the user moved on while this was loading
  if (!result.ok) return showAudioUnavailable(messageId, result.error_code);
  const source = { uri: BACKEND_URL + result.audio_url };
  if (player) player.replace(source);
  else player = createAudioPlayer(source);
  player.play();
}

export const pause = () => player?.pause();
export const resume = () => player?.play();
export const stop = () => { player?.pause(); player?.seekTo(0); };
export const replay = () => { player?.seekTo(0); player?.play(); };   // no new ElevenLabs request
```

A player made with `createAudioPlayer` is not released automatically: free it with
`player.remove()` when the screen closes. On a phone, `localhost` means the phone itself, so
`BACKEND_URL` must be the laptop's address. Stopping playback does not cancel or refund the
ElevenLabs generation; the cache just makes replays free.

## 5. Where responsibilities sit

| Part | Owner |
|---|---|
| Calling Gemini, storing answers, deciding when to speak | Backend |
| Endpoints, auth, serving audio bytes | Backend |
| Cleanup for speech, length limits, cache, retries, ElevenLabs calls, error codes | This module |
| Voice quality, pronunciation by the model, billing | ElevenLabs |
| Play, pause, stop, replay, no overlap, "audio unavailable" message | Mobile app |

## 6. Optional: let Gemini write the spoken version

ElevenLabs recommends having the LLM write numbers, dates and symbols as words before
text-to-speech. If pronunciation of numbers becomes a problem, ask Gemini, **in the same call**,
for two fields and pass both:

```python
TTSRequest(request_id=message_id, text=answer["display_text"], speech_text=answer["speech_text"])
```

Suggested instruction, adapted from ElevenLabs' best-practices guide:

> Also return `speech_text`: the same answer rewritten for text-to-speech. Expand numbers,
> symbols and abbreviations into words as they should be read aloud. No Markdown, links or
> emoji. Keep every fact, number, negation and caveat exactly as in the displayed answer.

Trade-off: better pronunciation with no extra Gemini call, but more Gemini output tokens,
a little more latency, and a risk that the two versions differ. Start without it; the module's
own cleanup handles Markdown, links, citations, emoji and symbols.
