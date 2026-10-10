# All settings in backend/.env; the voice code reads only its own names

- Status: accepted by Nimesh (implemented in `d1753db`; Nimesh's `api.env` renamed to `.env`); not yet
  confirmed by the whole team
- Date: 2026-10-10        Decision owner: Nimesh

## Context

`backend/.env.example` says to copy it to `backend/.env`, and `main.py` loads that file. Some keys lived in
`backend/api.env` instead. On its first voice request, the voice code loaded the whole of `api.env`, including
other services' placeholder values. That changed how Gemini and Snowflake behaved: for example, Snowflake tried
to log in with a placeholder account for up to 15 s per request.

## Decision

- Every key and setting lives in `backend/.env`, which git ignores and each person creates from
  `backend/.env.example`.
- The voice code takes only `ELEVENLABS_*`, `TTS_*` and `STT_*` from a settings file. If there is no
  `backend/.env`, it still falls back to `backend/api.env`, but only for those names.
- `PYTHON_DOTENV_DISABLED=1` turns all settings files off, which is useful in tests.

## Alternatives and tradeoffs

- Making `main.py` also read `api.env`: two files to keep straight, and placeholders there would be used.
- Leaving the voice code as it was: settings would change silently in the middle of a running server.

## Impacted components

- `backend/main.py` (unchanged: reads `.env`)
- `text_to_speech/config.py`, `speech_to_text/config.py`, `audio_service/conftest.py`
- every teammate's local setup
