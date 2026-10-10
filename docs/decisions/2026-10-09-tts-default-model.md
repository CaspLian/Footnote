# Switch the text-to-speech default to eleven_flash_v2_5?

- Status: proposed (not decided)
- Date: 2026-10-09        Decision owner: Nimesh (audio)

## Context

The default model, `eleven_multilingual_v2`, is the most stable and reads numbers well, but it is the slowest:
873 characters took 13.9 s on 2026-10-09. `eleven_flash_v2_5` was measured at 2–4 times faster, for about half
the credits. Its number reading had to be switched on (`apply_text_normalization`). The audio module now does
that automatically, and with it every amount, date and code in a test answer was read correctly. Measurements:
`backend/services/audio_service/README.md`, "Speed".

## Proposal

Set `ELEVENLABS_MODEL_ID=eleven_flash_v2_5` after listening to both in the playground (`python -m playground`,
the Model buttons). Recheck number reading on Flash before a demo. A request can already choose a model, so
this changes only the default.

## Alternatives and tradeoffs

- **Keep `eleven_multilingual_v2`:** slower replies, but the safest number reading. Streaming
  (`stream_reply=true`) hides much of the wait, though it is untested on iPhones.
- **The v4 models** (`eleven_v4_turbo`, `eleven_v4`), measured on 2026-10-09: first audio after about 1 s,
  but 5.7–6.7 s for all of a 222-character text, against 4.0 s on Multilingual v2. Numbers were read right.
  With streaming, playback starts sooner than on Multilingual v2; without it, the wait is longer. Their cheaper
  credits are a launch offer until October 12, and they have no speed setting (`supports_speed()` in
  `text_to_speech/config.py`).

## Impacted components

The `ELEVENLABS_MODEL_ID` setting; reply speed and cost for every spoken answer.
