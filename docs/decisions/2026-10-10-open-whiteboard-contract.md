# The whiteboard's "Hour 1" JSON contract: adopt, adapt or drop?

- Status: proposed (an open team decision)
- Date: 2026-10-10        Raised by: Nimesh

## Context

The team whiteboard describes a contract "agreed upon in Hour 1 so all 4 members can develop independently":
- a single endpoint, `/api/v1/process-bill`, or `/api/audit-bill` in the diagram
- a response with `claim_id`, `fair_market_total`, `potential_savings`, `is_overcharge`, `translated_summary` and
  `audio_stream_url`

The code implements different routes, documented in `docs/API_CONTRACTS.md`: `/api/v1/analyze`, `/api/v1/voice/*`
and `/api/v1/audits/{id}`. Some teammates' files use the claim shape: `mock_bill.json` and the Tiger Data tables.

## Options

1. **Adopt the code's routes** as the contract, and retire the whiteboard sketch. The mobile app builds against
   `docs/API_CONTRACTS.md`.
2. **Adapt:** add a thin `/api/v1/process-bill` that combines analyze with speak, for the app's convenience. Keep
   the honest fields: flags and ratios, not "savings" or "overcharge".
3. **Implement the whiteboard contract as written.**

## Tradeoffs

- "Potential savings" and "is overcharge" claim more than national Medicare rates can show (see
  `docs/PROJECT_CONTEXT.md`, "Assumptions to avoid").
- Changing the code's routes now would break the voice routes and the console.

## Impacted components

The mobile app, `backend/main.py`, `voice_routes.py`, `tigerdata_service.py`, and `mock_bill.json`.
