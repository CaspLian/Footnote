# One error shape for every route

- Status: proposed (not implemented)
- Date: 2026-10-10        Proposed by: Nimesh (from the verification, `BACKEND_VERIFICATION_REPORT.md` §5)

## Context

The app has to handle three shapes today (see `docs/API_CONTRACTS.md`, "Conventions"):
- `{"detail": "text"}` from `main.py`, and from the reply-audio route while it streams
- `{"detail": {"stage", "message", ...}}` from the voice routes
- FastAPI's `{"detail": [...]}` list for a malformed field

## Proposal

Use `{"detail": {"stage", "message"}}` everywhere:
- in `main.py`'s `HTTPException`s
- in a `RequestValidationError` handler, with `stage: "request"` and the field errors
- in the audio route

## Alternatives and tradeoffs

- **Keep three shapes:** no work, but every client needs three parsers.
- **The cost:** a breaking change for any client that already reads the text `detail`, so agree on it with the
  mobile owner first.

## Impacted components

`backend/main.py`, `voice_routes.py`, `audio_http.py`, the mobile app, and `docs/API_CONTRACTS.md`.
