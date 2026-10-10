# Bill, case, and timeline API

The mobile app calls these routes to submit a bill image, create a tracking case,
and manage the backend audit. All routes are under `/api/v1`; they return JSON.
For a phone, configure `EXPO_PUBLIC_API_URL` to the development computer's LAN
address, not `localhost`.

## Analyze a bill image

`POST /api/v1/analyze-image` (alias: `POST /api/v1/analyze`) accepts multipart
form data with the field name `file` and one JPEG, PNG, or WebP image. The backend sends the image to Gemini,
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

## Create a manual tracking case

`POST /api/v1/audits/manual` accepts JSON with a provider and source dates:

```json
{
  "provider_name": "Example Hospital",
  "service_date": "2026-01-10",
  "bill_received_date": "2026-02-01",
  "payment_due_date": "2026-03-01"
}
```

It writes a tracking record and `manual_case_created` event to Tiger Data,
calculating the same 120-day and 180-day date estimates from the supplied dates.
Manual cases have no invented billed amount or line items, and are not analyzed
for charges.

## Read and update a case

- `GET /api/v1/audits/{audit_id}` returns the current audit, countdowns, estimates,
  status, and ordered timeline events.
- `PATCH /api/v1/audits/{audit_id}/status` accepts `open`, `audit_complete`,
  `dispute_in_progress`, or `resolved`; an optional `note` is also accepted.
  Status updates are timeline events.
- `PATCH /api/v1/audits/{audit_id}/deadlines` accepts any of `payment_due_date`,
  `collection_deadline`, and `credit_warning_date` as ISO dates. Sending
  `"payment_due_date": null` clears that optional date. Changes are timeline
  events.
- `POST /api/v1/audits/{audit_id}/actions` accepts `{"action":"Called provider",
  "note":"Asked for itemized statement"}` and appends a user action to the timeline.
  Known actions are recorded with dedicated event types such as
  `overcharge_flagged`, `dispute_letter_generated`, and `provider_call_logged`.

The collection and credit dates are estimates, not legal determinations. The app
should show the estimate labels and advise users to check dates against their
notices. This API stores deadline values and timeline events in Tiger Data; it
does not send push notifications. The mobile app schedules local reminders from
the dates returned by the backend.

The mobile app stores only audit IDs locally for rediscovery; scanned audit data,
manual cases, deadline edits, status changes, and action events are stored in
Tiger Data by the backend. The timeline table in this repository is named
`audit_events` (not `dispute_timeline`). The backend appends timeline events;
the API provides no event-edit operation. Countdown days are calculated from
Tiger Data's `CURRENT_DATE` and the saved deadline columns. This implementation
uses PostgreSQL tables and does not create a Timescale hypertable. The mobile
client reads through the backend API, not directly from the database.

**Prototype only:** these routes do not authenticate users or scope audit access
to an account. Do not use real patient bills or expose the backend publicly
until authentication and per-user authorization are implemented.

## Run a live Tiger Data smoke test

From `backend/`, run `python -m tests.live_tigerdata_api_smoke` with the backend
environment configured. This calls the manual-case, deadline, status, action,
and audit-read API routes against the configured Tiger Data PostgreSQL database.
It creates one synthetic record and intentionally leaves it for inspection.

Find the retained test and its timeline in the Tiger Data SQL console:

```sql
SELECT a.audit_id, a.provider_name, a.status, a.payment_due_date,
       a.collection_deadline, a.credit_warning_date,
       e.event_type, e.details, e.occurred_at
FROM audit_records AS a
LEFT JOIN audit_events AS e ON e.audit_id = a.audit_id
WHERE a.provider_name LIKE 'ClaimPulse live Tiger Data API test %'
ORDER BY a.created_at DESC, e.event_id;
```

To remove only those synthetic smoke-test rows after inspection:

```sql
DELETE FROM audit_records
WHERE provider_name LIKE 'ClaimPulse live Tiger Data API test %';
```

This integration does not currently perform the full Snowflake comparison flow.
The audit service has an optional regional `cpt_benchmarks` table in Tiger Data,
but this image endpoint does not provide a region and there is no Snowflake
lookup in the current request path. Multi-page PDF/image upload, Gemini dispute
letter generation, and ElevenLabs audio routes are also not connected in this
branch.
