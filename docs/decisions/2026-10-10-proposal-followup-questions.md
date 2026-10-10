# Follow-up questions about a saved bill

- Status: proposed (not implemented)
- Date: 2026-10-10        Proposed by: Nimesh (workflow 4 of the verification)

## Context

Each question is answered on its own today. No route accepts an `audit_id` together with a question, and
`gemini_service.analyze()` has no parameter for earlier context. `load_analysis()` can already return the saved
analysis.

## Proposal

A route such as `POST /api/v1/audits/{audit_id}/questions`, typed or by voice:
- It loads the saved analysis.
- It passes the analysis to Gemini as context, together with the new question.
- It answers with text and optional audio.

## Alternatives and tradeoffs

- **Have the app resend the bill with every question:** no backend change, but it costs more and is slower.
- **The cost of the proposal:** a new parameter in `gemini_service` (the Gemini owner's file) and a new route.

## Impacted components

`backend/main.py` or `voice_routes.py`, `services/gemini_services/gemini_service.py`, `analysis_store.py`, and
the mobile app.
