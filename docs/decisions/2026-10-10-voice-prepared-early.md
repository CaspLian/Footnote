# Prepare the ElevenLabs reading before the user presses Listen

- Status: accepted by Nimesh (audio), 2026-10-10: "Listen" must play right away
- Date: 2026-10-10        Decision owner: Nimesh

## Context

Pressing "Listen with the ElevenLabs voice" made the backend generate the whole clip first: 8.5 s for a synthetic
imaging bill (measured 2026-10-10, `eleven_multilingual_v2`). A clip that already exists comes back in 0.24 s.

## Decision

The app asks for the reading as soon as the backend has read the document (`mobile/src/screens/intake.tsx`), and
again when the review opens. It loads the MP3 into the player in advance (`mobile/src/services/backend-speech.ts`,
`mobile/src/native/backend-voice.tsx`). Measured: pressing Listen then plays at once (0.24 s after an app restart).
If it is pressed before the clip is ready, it waits for the generation already under way. Identical requests share
one generation, so a clip is never paid for twice.

## Tradeoffs

- **Cost:** one ElevenLabs clip per analyzed document, even if nobody presses Listen. That is about 650 KB of audio
  and a few hundred credits for a typical summary.
- **Still slow if pressed very early:** within about 8 s of the document being read. The next options:
  - `ELEVENLABS_MODEL_ID=eleven_flash_v2_5`: generates 2 to 4 times faster, for half the credits. Listen to it
    first (`docs/decisions/2026-10-09-tts-default-model.md`).
  - `stream_reply=true`: plays from the first audio, about 1 to 3.6 s, but it is untested on iPhones.

## Impacted components

The mobile app's intake and review screens; ElevenLabs credit use.
