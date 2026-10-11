# Prepare the ElevenLabs reading before the user presses Listen

- Status: accepted by Nimesh (audio), 2026-10-10: "Listen" must play right away
- Date: 2026-10-10        Decision owner: Nimesh

## Context

Pressing "Listen with the ElevenLabs voice" made the backend generate the whole clip first: 8.5 s for a synthetic
imaging bill (measured 2026-10-10, `eleven_multilingual_v2`). A clip that already exists comes back in 0.24 s.

## Decision

The app asks for the reading as soon as the Understanding adapter receives document lines and a saved audit ID
(`mobile/src/services/gemini-understanding.ts`), and again when the review opens. The chosen voice is resolved from
the backend catalog; identical audit-and-voice pairs share one request. It loads the MP3 into the player in advance (`mobile/src/services/backend-speech.ts`,
`mobile/src/native/backend-voice.tsx`). Measured: pressing Listen then plays at once (0.24 s after an app restart).
If it is pressed before the clip is ready, it waits for the generation already under way. Identical requests share
one generation, so a clip is never paid for twice.

## Tradeoffs

- **Cost:** one ElevenLabs clip per analyzed document and chosen voice, even if nobody presses Listen. Selecting another voice may generate another clip. That is about 650 KB of audio
  and a few hundred credits for a typical summary.
- **Pressed very early:** the user waits for the rest of the clip. Since Flash v2.5 became the default
  (2026-10-10), that is about 2 s (1.9 s measured for a 918-character reading) instead of 8.5 s (`docs/decisions/2026-10-09-tts-default-model.md`).

## Impacted components

The mobile app's intake and review screens; ElevenLabs credit use.
