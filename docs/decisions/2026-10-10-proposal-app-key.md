# Require an app key on routes that spend credits or read bills

- Status: proposed (not implemented)
- Date: 2026-10-10        Proposed by: Nimesh (from the verification, `BACKEND_VERIFICATION_REPORT.md` §7)

## Context

The API has no authentication, and CORS allows every origin (`backend/main.py`). Anyone who can reach the server
can do two things:
- Spend the team's Gemini and ElevenLabs credits, through `/api/v1/analyze`, `/api/v1/voice/analyze` and
  `/api/v1/voice/speak`.
- Read a saved analysis if they have its ID (`GET /api/v1/audits/{id}`). uvicorn's access log shows those IDs.

## Proposal

An optional `APP_KEY` setting:
- When it is set, the routes above require an `X-App-Key` header, compared with `hmac.compare_digest`.
- `GET /api/v1/voice/audio/{id}` stays open, so audio players work.

Alongside it:
- Limit CORS to the app.
- Run uvicorn with `--no-access-log`, or mask the IDs.
- Serve over HTTPS.

## Alternatives and tradeoffs

- **Keep the server on a private network for the demo:** zero work, but nothing protects it if it is exposed.
- **Per-user accounts:** proper ownership of each saved bill, but far more work than a hackathon allows.

## Impacted components

`backend/main.py`, `voice_routes.py`, the mobile app (it must send the header), and `docs/API_CONTRACTS.md`.
