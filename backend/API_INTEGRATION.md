# Bill image and timeline API (frontend integration contract)

The Tiger Data claim and deadline routes. All routes are under `/api/v1` and return JSON. For a phone, set the API
base URL to the development computer's LAN address, not `localhost`. The full contract for every route is in
`docs/API_CONTRACTS.md`.

**Merged on 2026-10-10 into the integrated backend.** The routes below moved from `/api/v1/audits/...` to
`/api/v1/claims/...`, because `GET /api/v1/audits/{audit_id}` already returns a saved analysis (the record behind the
app's analysis and voice reading). `POST /api/v1/analyze` stays the app's full analysis (every page, the price
check, the saved record, the voice); the bill-photo flow is `POST /api/v1/analyze-image` only.

## Analyze a camera capture

`POST /api/v1/analyze-image` accepts multipart form data with the field name `file` and a JPEG, PNG, or WebP image.
The backend sends the image to Gemini (`services/gemini_services/bill_image.py`), validates the extracted dates,
writes the claim and its timeline event to Tiger Data, and returns:

```json
{
  "extracted_bill": {
    "service_date": "2026-01-10",
    "bill_received_date": "2026-02-01",
    "payment_due_date": "2026-03-01",
    "items": []
  },
  "audit": {
    "audit_id": "...",
    "collection_deadline": "2026-06-01",
    "collection_deadline_is_estimate": true,
    "credit_warning_date": "2026-07-09",
    "credit_warning_date_is_estimate": true,
    "events": []
  }
}
```

Date values not visible on the bill stay `null`; no upload date is substituted. The 120-day and 180-day estimates
are calculated only from extracted source dates. Payment due date is optional and comes from the bill.

Only lines with a billing code, a description and an amount are recorded in the claim; `extracted_bill` keeps
every line Gemini read, and the total stays the bill's.

## Record, read and update a claim

- `POST /api/v1/claims` records a bill the user confirmed: `items` (`[{code, description, amount}]`), plus optional
  `provider_name`, `service_date`, `bill_received_date`, `payment_due_date`, `total_billed` and
  `analysis_audit_id`. Deadlines are estimated from the dates given. The Footnote app calls this when a case is
  first confirmed.
- `GET /api/v1/claims/{audit_id}` returns the claim, its countdowns, estimates, status, and ordered timeline events.
- `PATCH` (or `POST`) `/api/v1/claims/{audit_id}/status` accepts `{"status":"dispute_in_progress"}`; an optional
  `note` is also accepted. Status updates are timeline events.
- `PATCH` (or `POST`) `/api/v1/claims/{audit_id}/deadlines` accepts either or both ISO dates as
  `collection_deadline` and `credit_warning_date`. These corrections are timeline events, and a corrected date is no
  longer marked as an estimate.
- `POST /api/v1/claims/{audit_id}/actions` accepts `{"action":"Called provider", "note":"Asked for itemized
  statement"}` and appends a user action to the timeline (201).
- `POST /api/v1/claims/{audit_id}/resolve` accepts `{"final_amount": 100.0}`.

The collection and credit dates are estimates, not legal determinations. The app shows the estimate labels and
advises users to check dates against their notices. This API stores the due date, but does not send push
notifications; a client can schedule local reminders using the returned dates.
