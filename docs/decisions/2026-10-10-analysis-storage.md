# Save analyses in their own tables (analysis_store), not in tigerdata_service's audit tables

- Status: accepted by Nimesh (implemented in `d1753db`); not yet confirmed by the Tiger Data owner
- Date: 2026-10-10        Decision owner: Nimesh

## Context

- **The app saved nothing.** At `f86e22f`, no route called `tigerdata_service`.
- **Its audit format doesn't fit.** `record_bill_audit` expects a claim with a code, a description and an amount
  on every line, all stored `NOT NULL`. Gemini's line items may have no code or no amount; the sample bill's
  "FACILITY FEE" line has no code, and was rejected.

## Decision

`services/analytical_services/analysis_store.py` saves each analysis to Tiger Data (`TIGER_DATA_POSTGRES_URL`) in
two tables of its own, created on first use:
- `bill_analyses`: one row per analysis, with key facts and the whole response as JSON.
- `bill_analysis_lines`: one row per line item, with its price check. Missing codes and amounts are stored as
  NULL, never dropped or invented.

Saving never fails a request, and `response.audit` reports the outcome. The teammate's tables are left unchanged.

## Alternatives and tradeoffs

- **An adapter into `record_bill_audit`:** it would have to drop uncoded lines or invent values, and change their
  `NOT NULL` schema.
- **Changing `tigerdata_service`'s schema:** that is the teammate's area, and its "overcharge" columns imply more
  than the data supports.
- **The cost of this choice:** two sets of tables in the same database. A later decision could merge them or
  retire one.

## Impacted components

`backend/main.py`, `voice_routes.py`, `models.py` (`AuditInfo`), the Tiger Data database, and
`docs/API_CONTRACTS.md` ("Database tables behind the responses").
