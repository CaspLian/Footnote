# Use gemini-3.5-flash (fallback gemini-3.5-flash-lite) until gemini-3.8-flash answers

- Status: accepted by Nimesh as a local setting on 2026-10-10. The code default and `.env.example` still say
  `gemini-3.8-flash`, and changing them is the Gemini owner's call.
- Date: 2026-10-10        Decision owner: Nimesh (setting); the Gemini owner (code default)

## Context

On 2026-10-10, for the team's key:

| Model | Result |
|---|---|
| `gemini-3.8-flash` (the code's default) | Listed as available, but no reply in 91 s, even to a one-word prompt |
| `gemini-2.5-flash` | HTTP 404: "no longer available to new users" |
| `gemini-3.5-flash` | Answers in 2–3 s, with occasional "503: high demand" errors |
| `gemini-3.5-flash-lite` | About 1 s |

With the default, every analysis waited out two 40 s attempts and then failed, or reached the fallback.

## Decision

Set `GEMINI_MODEL=gemini-3.5-flash` and `GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite` in `backend/.env`. The full
live test then passed (15 of 15).

## Alternatives and tradeoffs

- **Keeping `gemini-3.8-flash`:** Google's recommended model, but unusable for this key that day. Retry it later.
- **`gemini-3.5-flash-lite` as the primary:** faster, but likely weaker extraction; not compared on bills.

## Impacted components

`backend/.env` on each machine. The code default in `services/gemini_services/gemini_service.py` and
`backend/.env.example` are unchanged.
