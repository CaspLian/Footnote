# Bill image and timeline API (frontend integration contract)

The mobile frontend can call these routes when it is ready to connect. All routes
are under `/api/v1`; they return JSON. For a phone, configure the API base URL to
the development computer's LAN address, not `localhost`.

## Analyze a camera capture

`POST /api/v1/analyze-image` (alias: `POST /api/v1/analyze`) accepts multipart form data with the field name
`file` and a JPEG, PNG, or WebP image. The backend sends the image to Gemini,
validates extracted dates, writes the audit and timeline event to Tiger Data, and
returns:

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

Date values not visible in the bill stay `null`; no upload date is substituted.
The 120-day and 180-day estimates are calculated only from extracted source dates.
Payment due date is optional and comes from the bill. A user correction to an
estimate marks the corresponding estimate flag `false`.

## Read and update an audit

- `GET /api/v1/audits/{audit_id}` returns the current audit, countdowns, estimates,
  status, and ordered timeline events.
- `PATCH /api/v1/audits/{audit_id}/status` accepts `{"status":"dispute_in_progress"}`;
  an optional `note` is also accepted. Status updates are timeline events.
- `PATCH /api/v1/audits/{audit_id}/deadlines` accepts either or both ISO dates as
  `collection_deadline` and `credit_warning_date`. These corrections are timeline
  events.
- `POST /api/v1/audits/{audit_id}/actions` accepts `{"action":"Called provider",
  "note":"Asked for itemized statement"}` and appends a user action to the timeline.

The collection and credit dates are estimates, not legal determinations. The app
should show the estimate labels and advise users to check dates against their
notices. This API stores the due date, but does not send push notifications; a
client can schedule local reminders using the returned dates.
