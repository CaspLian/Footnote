import os
from collections.abc import Mapping, Sequence
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import execute_values
from psycopg2.extensions import connection

from services.timeline import estimate_deadlines


_SCHEMA = """
-- Regional reference prices are optional; audits keep an explicit no-benchmark result.
CREATE TABLE IF NOT EXISTS cpt_benchmarks (
    code TEXT NOT NULL,
    region TEXT NOT NULL,
    average_amount NUMERIC(12, 2) NOT NULL CHECK (average_amount >= 0),
    source TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (code, region)
);

-- Each claim stores its current workflow state, operational deadlines, and settlement.
CREATE TABLE IF NOT EXISTS audit_records (
    audit_id UUID PRIMARY KEY,
    claim_id TEXT,
    provider_name TEXT,
    provider_npi TEXT,
    service_date DATE,
    bill_received_date DATE,
    payment_due_date DATE,
    total_billed NUMERIC(12, 2) NOT NULL,
    currency TEXT NOT NULL,
    region TEXT,
    overcharge_total NUMERIC(12, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'scanned',
    collection_deadline DATE,
    credit_warning_date DATE,
    collection_deadline_is_estimate BOOLEAN NOT NULL DEFAULT FALSE,
    credit_warning_date_is_estimate BOOLEAN NOT NULL DEFAULT FALSE,
    final_settled_amount NUMERIC(12, 2),
    savings_amount NUMERIC(12, 2),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Append-only workflow events provide an auditable chronological claim timeline.
CREATE TABLE IF NOT EXISTS audit_events (
    event_id BIGSERIAL PRIMARY KEY,
    audit_id UUID NOT NULL REFERENCES audit_records (audit_id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS audit_events_audit_time_idx
    ON audit_events (audit_id, occurred_at, event_id);

-- Preserve each billed line and the benchmark result used during its audit.
CREATE TABLE IF NOT EXISTS audit_line_items (
    line_item_id BIGSERIAL PRIMARY KEY,
    audit_id UUID NOT NULL REFERENCES audit_records (audit_id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    benchmark_amount NUMERIC(12, 2),
    overcharge NUMERIC(12, 2) NOT NULL,
    benchmark_found BOOLEAN NOT NULL,
    flagged BOOLEAN NOT NULL,
    UNIQUE (audit_id, position)
);

ALTER TABLE audit_records
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'scanned',
    ADD COLUMN IF NOT EXISTS collection_deadline DATE,
    ADD COLUMN IF NOT EXISTS credit_warning_date DATE,
    ADD COLUMN IF NOT EXISTS collection_deadline_is_estimate BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS credit_warning_date_is_estimate BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS bill_received_date DATE,
    ADD COLUMN IF NOT EXISTS payment_due_date DATE,
    ADD COLUMN IF NOT EXISTS final_settled_amount NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS savings_amount NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Upgrade older completed audits with one migration marker, not invented past events.
INSERT INTO audit_events (
    audit_id, event_type, previous_status, new_status, details
)
SELECT a.audit_id, 'legacy_audit_migrated', 'scanned', 'audit_complete',
       '{"note":"Detailed timeline predates this schema version."}'::jsonb
FROM audit_records AS a
WHERE a.status = 'scanned'
  AND EXISTS (
      SELECT 1 FROM audit_line_items AS li WHERE li.audit_id = a.audit_id
  )
  AND NOT EXISTS (
      SELECT 1 FROM audit_events AS e WHERE e.audit_id = a.audit_id
  );

UPDATE audit_records AS a
SET status = 'audit_complete'
WHERE a.status = 'scanned'
  AND EXISTS (
      SELECT 1
      FROM audit_events AS e
      WHERE e.audit_id = a.audit_id
        AND e.event_type = 'legacy_audit_migrated'
  );
"""


def connect_tiger_data() -> connection:
    """Open and return a PostgreSQL connection to Tiger Data."""
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")

    database_url = os.getenv("TIGER_DATA_POSTGRES_URL")
    if not database_url:
        raise RuntimeError("TIGER_DATA_POSTGRES_URL is not set.")

    return psycopg2.connect(database_url, connect_timeout=10)


def initialize_tiger_data() -> None:
    """Create audit, line-item, benchmark, and timeline tables if missing."""
    conn = connect_tiger_data()
    try:
        with conn:
            with conn.cursor() as cursor:
                cursor.execute(_SCHEMA)
    finally:
        conn.close()


def upsert_cpt_benchmark(
    code: str,
    region: str,
    average_amount: int | float | str | Decimal,
    source: str,
) -> None:
    """Insert or update a regional average CPT price."""
    normalized_code = _required_text(code, "code").upper()
    normalized_region = _required_text(region, "region").upper()
    normalized_source = _required_text(source, "source")
    average = _money(average_amount, "average_amount")

    conn = connect_tiger_data()
    try:
        with conn:
            with conn.cursor() as cursor:
                cursor.execute(_SCHEMA)
                cursor.execute(
                    """
                    INSERT INTO cpt_benchmarks (code, region, average_amount, source)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (code, region) DO UPDATE SET
                        average_amount = EXCLUDED.average_amount,
                        source = EXCLUDED.source,
                        updated_at = CURRENT_TIMESTAMP
                    """,
                    (normalized_code, normalized_region, average, normalized_source),
                )
    finally:
        conn.close()


def record_bill_audit(
    claim: Mapping[str, Any], region: str | None = None
) -> dict[str, Any]:
    """Persist an extracted bill, benchmark available rates, and start its timeline."""
    items = claim.get("items")
    if not isinstance(items, Sequence) or isinstance(items, (str, bytes)) or not items:
        raise ValueError("claim.items must be a non-empty list.")

    normalized_items = [
        _normalize_line_item(item, index) for index, item in enumerate(items)
    ]
    normalized_region = _required_text(region, "region").upper() if region else None
    provider = claim.get("provider") or {}
    if not isinstance(provider, Mapping):
        raise ValueError("claim.provider must be an object.")

    amounts = [item["amount"] for item in normalized_items]
    total_billed = _money(claim.get("total_billed", sum(amounts)), "total_billed")
    service_date = _optional_date(claim.get("service_date"), "service_date")
    received_date = _optional_date(
        claim.get("bill_received_date"), "bill_received_date"
    )
    payment_due_date = _optional_date(
        claim.get("payment_due_date"), "payment_due_date"
    )
    collection_deadline, credit_warning_date = estimate_deadlines(
        received_date, service_date
    )

    audit_id = str(uuid4())
    conn = connect_tiger_data()
    try:
        with conn:
            with conn.cursor() as cursor:
                cursor.execute(_SCHEMA)
                benchmarks: dict[str, Decimal] = {}
                if normalized_region:
                    cursor.execute(
                        """
                        SELECT code, average_amount
                        FROM cpt_benchmarks
                        WHERE region = %s AND code = ANY(%s)
                        """,
                        (
                            normalized_region,
                            [item["code"] for item in normalized_items],
                        ),
                    )
                    benchmarks = dict(cursor.fetchall())

                results = []
                for item in normalized_items:
                    benchmark = benchmarks.get(item["code"])
                    overcharge = (
                        max(item["amount"] - benchmark, Decimal("0.00"))
                        if benchmark is not None
                        else Decimal("0.00")
                    )
                    results.append(
                        {
                            **item,
                            "benchmark_amount": benchmark,
                            "overcharge": overcharge,
                            "benchmark_found": benchmark is not None,
                            "flagged": benchmark is not None and overcharge > 0,
                        }
                    )

                overcharge_total = sum(
                    (item["overcharge"] for item in results), Decimal("0.00")
                )
                cursor.execute(
                    """
                    INSERT INTO audit_records (
                        audit_id, claim_id, provider_name, provider_npi, service_date,
                        bill_received_date, payment_due_date, total_billed, currency,
                        region, overcharge_total, status, collection_deadline,
                        credit_warning_date, collection_deadline_is_estimate,
                        credit_warning_date_is_estimate
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'scanned', %s, %s, %s, %s)
                    """,
                    (
                        audit_id,
                        claim.get("claim_id"),
                        provider.get("name"),
                        provider.get("npi"),
                        service_date,
                        received_date,
                        payment_due_date,
                        total_billed,
                        claim.get("currency", "USD"),
                        normalized_region,
                        overcharge_total,
                        collection_deadline,
                        credit_warning_date,
                        collection_deadline is not None,
                        credit_warning_date is not None,
                    ),
                )
                cursor.execute(
                    """
                    INSERT INTO audit_events (
                        audit_id, event_type, previous_status, new_status, details
                    ) VALUES (%s, 'bill_scanned', NULL, 'scanned', %s)
                    """,
                    (
                        audit_id,
                        psycopg2.extras.Json(
                            {
                                "claim_id": claim.get("claim_id"),
                                "line_item_count": len(results),
                            }
                        ),
                    ),
                )
                cursor.execute(
                    """
                    INSERT INTO audit_events (audit_id, event_type, details)
                    VALUES (%s, 'bill_dates_extracted', %s)
                    """,
                    (
                        audit_id,
                        psycopg2.extras.Json(
                            {
                                "service_date": service_date.isoformat() if service_date else None,
                                "bill_received_date": received_date.isoformat() if received_date else None,
                                "payment_due_date": payment_due_date.isoformat() if payment_due_date else None,
                                "collection_deadline_estimate": collection_deadline.isoformat() if collection_deadline else None,
                                "credit_warning_date_estimate": credit_warning_date.isoformat() if credit_warning_date else None,
                            }
                        ),
                    ),
                )
                execute_values(
                    cursor,
                    """
                    INSERT INTO audit_line_items (
                        audit_id, position, code, description, amount,
                        benchmark_amount, overcharge, benchmark_found, flagged
                    ) VALUES %s
                    """,
                    [
                        (
                            audit_id,
                            index,
                            item["code"],
                            item["description"],
                            item["amount"],
                            item["benchmark_amount"],
                            item["overcharge"],
                            item["benchmark_found"],
                            item["flagged"],
                        )
                        for index, item in enumerate(results)
                    ],
                )
                cursor.execute(
                    """
                    UPDATE audit_records
                    SET status = 'audit_complete'
                    WHERE audit_id = %s
                    """,
                    (audit_id,),
                )
                cursor.execute(
                    """
                    INSERT INTO audit_events (
                        audit_id, event_type, previous_status, new_status, details
                    ) VALUES (%s, 'audit_completed', 'scanned', 'audit_complete', %s)
                    """,
                    (
                        audit_id,
                        psycopg2.extras.Json(
                            {
                                "benchmark_found_count": sum(
                                    item["benchmark_found"] for item in results
                                ),
                                "unbenchmarked_count": sum(
                                    not item["benchmark_found"] for item in results
                                ),
                                "overcharge_total": str(overcharge_total),
                            }
                        ),
                    ),
                )

        return {
            "audit_id": audit_id,
            "claim_id": claim.get("claim_id"),
            "region": normalized_region,
            "total_billed": total_billed,
            "overcharge_total": overcharge_total,
            "items": results,
            "recorded": True,
        }
    finally:
        conn.close()


def create_manual_case(
    provider_name: str,
    service_date: date | str,
    bill_received_date: date | str,
    payment_due_date: date | str | None = None,
) -> dict[str, str]:
    """Persist a manually entered tracking case without inventing bill charges."""
    normalized_provider = _required_text(provider_name, "provider_name")
    service = _optional_date(service_date, "service_date")
    received = _optional_date(bill_received_date, "bill_received_date")
    payment_due = _optional_date(payment_due_date, "payment_due_date")
    if service is None or received is None:
        raise ValueError("service_date and bill_received_date are required.")

    collection_deadline, credit_warning_date = estimate_deadlines(received, service)
    audit_id = str(uuid4())
    conn = connect_tiger_data()
    try:
        with conn:
            with conn.cursor() as cursor:
                cursor.execute(_SCHEMA)
                cursor.execute(
                    """
                    INSERT INTO audit_records (
                        audit_id, provider_name, service_date,
                        bill_received_date, payment_due_date, total_billed,
                        currency, overcharge_total, status, collection_deadline,
                        credit_warning_date, collection_deadline_is_estimate,
                        credit_warning_date_is_estimate
                    ) VALUES (
                        %s, %s, %s, %s, %s, 0, 'USD', 0,
                        'open', %s, %s, TRUE, TRUE
                    )
                    """,
                    (
                        audit_id,
                        normalized_provider,
                        service,
                        received,
                        payment_due,
                        collection_deadline,
                        credit_warning_date,
                    ),
                )
                cursor.execute(
                    """
                    INSERT INTO audit_events (
                        audit_id, event_type, previous_status, new_status, details
                    ) VALUES (%s, 'manual_case_created', NULL, 'open', %s)
                    """,
                    (
                        audit_id,
                        psycopg2.extras.Json(
                            {
                                "service_date": service.isoformat(),
                                "bill_received_date": received.isoformat(),
                                "payment_due_date": (
                                    payment_due.isoformat() if payment_due else None
                                ),
                                "collection_deadline_estimate": (
                                    collection_deadline.isoformat()
                                    if collection_deadline
                                    else None
                                ),
                                "credit_warning_date_estimate": (
                                    credit_warning_date.isoformat()
                                    if credit_warning_date
                                    else None
                                ),
                            }
                        ),
                    ),
                )
        return {"audit_id": audit_id, "case_type": "manual_case"}
    finally:
        conn.close()


def get_bill_audit(audit_id: str | UUID) -> dict[str, Any] | None:
    """Fetch a persisted audit and its line-item results by audit ID."""
    parsed_audit_id = _parse_audit_id(audit_id)

    conn = connect_tiger_data()
    try:
        with conn.cursor() as cursor:
            # The database clock is authoritative for countdowns, and resolved claims
            # return no active countdown while retaining their original deadline dates.
            cursor.execute(
                """
                SELECT claim_id, provider_name, provider_npi, service_date,
                       bill_received_date, payment_due_date,
                       total_billed, currency, region, overcharge_total, created_at,
                       status, collection_deadline, credit_warning_date,
                       collection_deadline_is_estimate,
                       credit_warning_date_is_estimate,
                       final_settled_amount, savings_amount, resolved_at,
                       CASE
                           WHEN status = 'resolved' OR collection_deadline IS NULL
                               THEN NULL
                           ELSE collection_deadline - CURRENT_DATE
                       END,
                       CASE
                           WHEN status = 'resolved' OR credit_warning_date IS NULL
                               THEN NULL
                           ELSE credit_warning_date - CURRENT_DATE
                       END
                FROM audit_records
                WHERE audit_id = %s
                """,
                (str(parsed_audit_id),),
            )
            record = cursor.fetchone()
            if record is None:
                return None

            cursor.execute(
                """
                SELECT code, description, amount, benchmark_amount, overcharge,
                       benchmark_found, flagged
                FROM audit_line_items
                WHERE audit_id = %s
                ORDER BY position
                """,
                (str(parsed_audit_id),),
            )
            items = cursor.fetchall()

        return {
            "audit_id": str(parsed_audit_id),
            "case_type": "manual_case" if not items else "bill_audit",
            "claim_id": record[0],
            "provider": {"name": record[1], "npi": record[2]},
            "service_date": record[3].isoformat() if record[3] else None,
            "bill_received_date": record[4].isoformat() if record[4] else None,
            "payment_due_date": record[5].isoformat() if record[5] else None,
            "total_billed": record[6],
            "currency": record[7],
            "region": record[8],
            "overcharge_total": record[9],
            "created_at": record[10].isoformat(),
            "status": record[11],
            "collection_deadline": (
                record[12].isoformat() if record[12] else None
            ),
            "credit_warning_date": record[13].isoformat() if record[13] else None,
            "collection_deadline_is_estimate": record[14],
            "credit_warning_date_is_estimate": record[15],
            "final_settled_amount": record[16],
            "savings_amount": record[17],
            "resolved_at": record[18].isoformat() if record[18] else None,
            "collection_days_remaining": record[19],
            "credit_warning_days_remaining": record[20],
            "events": _event_records(conn, str(parsed_audit_id)),
            "items": [
                {
                    "code": item[0],
                    "description": item[1],
                    "amount": item[2],
                    "benchmark_amount": item[3],
                    "overcharge": item[4],
                    "benchmark_found": item[5],
                    "flagged": item[6],
                }
                for item in items
            ],
        }
    finally:
        conn.close()


def update_claim_status(
    audit_id: str | UUID,
    new_status: str,
    details: Mapping[str, Any] | None = None,
) -> dict[str, str]:
    """Change an audit's workflow status and append a timestamped timeline event."""
    parsed_audit_id = _parse_audit_id(audit_id)
    normalized_status = _required_text(new_status, "new_status").lower()
    if normalized_status not in {
        "open",
        "audit_complete",
        "dispute_in_progress",
        "resolved",
    }:
        raise ValueError(
            "new_status must be 'open', 'audit_complete', "
            "'dispute_in_progress', or 'resolved'."
        )
    if details is not None and not isinstance(details, Mapping):
        raise ValueError("details must be an object.")

    conn = connect_tiger_data()
    try:
        with conn:
            with conn.cursor() as cursor:
                # Lock the claim so concurrent updates cannot create a false event order.
                cursor.execute(
                    """
                    SELECT status
                    FROM audit_records
                    WHERE audit_id = %s
                    FOR UPDATE
                    """,
                    (str(parsed_audit_id),),
                )
                row = cursor.fetchone()
                if row is None:
                    raise LookupError(f"No audit found for audit_id {parsed_audit_id}.")
                previous_status = row[0]
                if previous_status == "resolved":
                    raise ValueError("A resolved claim cannot change status.")

                cursor.execute(
                    """
                    UPDATE audit_records
                    SET status = %s,
                        resolved_at = CASE WHEN %s = 'resolved'
                            THEN CURRENT_TIMESTAMP ELSE resolved_at END
                    WHERE audit_id = %s
                    """,
                    (normalized_status, normalized_status, str(parsed_audit_id)),
                )
                cursor.execute(
                    """
                    INSERT INTO audit_events (
                        audit_id, event_type, previous_status, new_status, details
                    ) VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        str(parsed_audit_id),
                        normalized_status,
                        previous_status,
                        normalized_status,
                        psycopg2.extras.Json(dict(details or {})),
                    ),
                )
        return {
            "audit_id": str(parsed_audit_id),
            "previous_status": previous_status,
            "status": normalized_status,
        }
    finally:
        conn.close()


def record_claim_action(
    audit_id: str | UUID, action: str, details: Mapping[str, Any] | None = None
) -> dict[str, str]:
    """Append a user-entered action to the audit trail without changing status."""
    parsed_audit_id = _parse_audit_id(audit_id)
    normalized_action = _required_text(action, "action")
    if len(normalized_action) > 200:
        raise ValueError("action must be 200 characters or fewer.")
    if details is not None and not isinstance(details, Mapping):
        raise ValueError("details must be an object.")
    event_type = {
        "overcharge flagged": "overcharge_flagged",
        "dispute letter generated": "dispute_letter_generated",
        "called provider": "provider_call_logged",
    }.get(normalized_action.casefold(), "user_action")

    conn = connect_tiger_data()
    try:
        with conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT status FROM audit_records WHERE audit_id = %s",
                    (str(parsed_audit_id),),
                )
                row = cursor.fetchone()
                if row is None:
                    raise LookupError(f"No audit found for audit_id {parsed_audit_id}.")
                cursor.execute(
                    """
                    INSERT INTO audit_events (audit_id, event_type, details)
                    VALUES (%s, %s, %s)
                    """,
                    (
                        str(parsed_audit_id),
                        event_type,
                        psycopg2.extras.Json({"action": normalized_action, **dict(details or {})}),
                    ),
                )
        return {"audit_id": str(parsed_audit_id), "action": normalized_action}
    finally:
        conn.close()


def set_claim_deadlines(
    audit_id: str | UUID,
    collection_deadline: date | str | None = None,
    credit_warning_date: date | str | None = None,
    payment_due_date: date | str | None = None,
    clear_payment_due_date: bool = False,
) -> dict[str, str | None]:
    """Store the supplied deadline dates and append their change to the timeline."""
    parsed_audit_id = _parse_audit_id(audit_id)
    collection_date = _optional_date(collection_deadline, "collection_deadline")
    credit_date = _optional_date(credit_warning_date, "credit_warning_date")
    payment_date = _optional_date(payment_due_date, "payment_due_date")
    if (
        collection_date is None
        and credit_date is None
        and payment_date is None
        and not clear_payment_due_date
    ):
        raise ValueError("At least one deadline date must be provided.")

    conn = connect_tiger_data()
    try:
        with conn:
            with conn.cursor() as cursor:
                # Lock the record so the timeline records the exact old and new dates.
                cursor.execute(
                    """
                    SELECT collection_deadline, credit_warning_date, payment_due_date
                    FROM audit_records
                    WHERE audit_id = %s
                    FOR UPDATE
                    """,
                    (str(parsed_audit_id),),
                )
                previous_dates = cursor.fetchone()
                if previous_dates is None:
                    raise LookupError(f"No audit found for audit_id {parsed_audit_id}.")

                stored_collection = (
                    collection_date
                    if collection_date is not None
                    else previous_dates[0]
                )
                stored_credit = (
                    credit_date if credit_date is not None else previous_dates[1]
                )
                stored_payment = (
                    None
                    if clear_payment_due_date
                    else payment_date
                    if payment_date is not None
                    else previous_dates[2]
                )
                cursor.execute(
                    """
                    UPDATE audit_records
                    SET collection_deadline = %s, credit_warning_date = %s,
                        payment_due_date = %s,
                        collection_deadline_is_estimate = CASE WHEN %s
                            THEN collection_deadline_is_estimate ELSE FALSE END,
                        credit_warning_date_is_estimate = CASE WHEN %s
                            THEN credit_warning_date_is_estimate ELSE FALSE END
                    WHERE audit_id = %s
                    """,
                    (
                        stored_collection,
                        stored_credit,
                        stored_payment,
                        collection_date is None,
                        credit_date is None,
                        str(parsed_audit_id),
                    ),
                )
                cursor.execute(
                    """
                    INSERT INTO audit_events (
                        audit_id, event_type, details
                    ) VALUES (%s, 'deadlines_set', %s)
                    """,
                    (
                        str(parsed_audit_id),
                        psycopg2.extras.Json(
                            {
                                "previous_collection_deadline": (
                                    previous_dates[0].isoformat()
                                    if previous_dates[0]
                                    else None
                                ),
                                "collection_deadline": (
                                    stored_collection.isoformat()
                                    if stored_collection
                                    else None
                                ),
                                "previous_credit_warning_date": (
                                    previous_dates[1].isoformat()
                                    if previous_dates[1]
                                    else None
                                ),
                                "credit_warning_date": (
                                    stored_credit.isoformat()
                                    if stored_credit
                                    else None
                                ),
                                "previous_payment_due_date": (
                                    previous_dates[2].isoformat()
                                    if previous_dates[2]
                                    else None
                                ),
                                "payment_due_date": (
                                    stored_payment.isoformat()
                                    if stored_payment
                                    else None
                                ),
                            }
                        ),
                    ),
                )

        return {
            "audit_id": str(parsed_audit_id),
            "collection_deadline": (
                stored_collection.isoformat() if stored_collection else None
            ),
            "credit_warning_date": (
                stored_credit.isoformat() if stored_credit else None
            ),
            "payment_due_date": (
                stored_payment.isoformat() if stored_payment else None
            ),
        }
    finally:
        conn.close()


def resolve_claim(
    audit_id: str | UUID, final_amount: int | float | str | Decimal
) -> dict[str, Any]:
    """Save the final settlement, compute net savings, and stop active countdowns."""
    parsed_audit_id = _parse_audit_id(audit_id)
    settled_amount = _money(final_amount, "final_amount")

    conn = connect_tiger_data()
    try:
        with conn:
            with conn.cursor() as cursor:
                # Lock the audit so duplicate/concurrent resolutions cannot overwrite each other.
                cursor.execute(
                    """
                    SELECT status, total_billed
                    FROM audit_records
                    WHERE audit_id = %s
                    FOR UPDATE
                    """,
                    (str(parsed_audit_id),),
                )
                row = cursor.fetchone()
                if row is None:
                    raise LookupError(f"No audit found for audit_id {parsed_audit_id}.")
                previous_status, original_amount = row
                if previous_status == "resolved":
                    raise ValueError("Claim is already resolved.")
                if previous_status not in {"audit_complete", "dispute_in_progress"}:
                    raise ValueError(
                        "Only completed audits can be resolved."
                    )
                # Savings are the original billed total minus the patient's final amount.
                savings_amount = original_amount - settled_amount

                cursor.execute(
                    """
                    UPDATE audit_records
                    SET status = 'resolved',
                        final_settled_amount = %s,
                        savings_amount = %s,
                        resolved_at = CURRENT_TIMESTAMP
                    WHERE audit_id = %s
                    RETURNING resolved_at
                    """,
                    (
                        settled_amount,
                        savings_amount,
                        str(parsed_audit_id),
                    ),
                )
                resolved_at = cursor.fetchone()[0]
                cursor.execute(
                    """
                    INSERT INTO audit_events (
                        audit_id, event_type, previous_status, new_status, details
                    ) VALUES (%s, 'resolved', %s, 'resolved', %s)
                    """,
                    (
                        str(parsed_audit_id),
                        previous_status,
                        psycopg2.extras.Json(
                            {
                                "original_amount": str(original_amount),
                                "final_settled_amount": str(settled_amount),
                                "savings_amount": str(savings_amount),
                            }
                        ),
                    ),
                )

        return {
            "audit_id": str(parsed_audit_id),
            "status": "resolved",
            "original_amount": original_amount,
            "final_settled_amount": settled_amount,
            "savings_amount": savings_amount,
            "resolved_at": resolved_at.isoformat(),
        }
    finally:
        conn.close()


def get_database_snapshot(limit: int = 20) -> dict[str, Any]:
    """Return a bounded, read-only view of Tiger Data tables for a dashboard."""
    if not isinstance(limit, int) or isinstance(limit, bool) or limit < 1:
        raise ValueError("limit must be a positive integer.")

    conn = connect_tiger_data()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT current_schema()")
            schema_name = cursor.fetchone()[0]
            cursor.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = current_schema()
                  AND table_name IN (
                      'audit_records', 'audit_line_items', 'audit_events',
                      'cpt_benchmarks'
                  )
                ORDER BY table_name
                """
            )
            tables = [row[0] for row in cursor.fetchall()]
            required_tables = {
                "audit_records",
                "audit_line_items",
                "audit_events",
                "cpt_benchmarks",
            }
            missing_tables = sorted(required_tables.difference(tables))
            if missing_tables:
                raise RuntimeError(
                    "Tiger Data schema is not initialized; missing tables: "
                    + ", ".join(missing_tables)
                )

            # Return the latest audits and their child rows without modifying data.
            cursor.execute(
                """
                SELECT audit_id, claim_id, provider_name, provider_npi,
                       service_date, total_billed, currency, region,
                       overcharge_total, status, collection_deadline,
                       credit_warning_date, final_settled_amount, savings_amount,
                       resolved_at, created_at,
                       -- Calculate countdowns against Tiger Data's date to avoid
                       -- application-server timezone or clock differences.
                       CASE
                           WHEN status = 'resolved' OR collection_deadline IS NULL
                               THEN NULL
                           ELSE collection_deadline - CURRENT_DATE
                       END,
                       CASE
                           WHEN status = 'resolved' OR credit_warning_date IS NULL
                               THEN NULL
                           ELSE credit_warning_date - CURRENT_DATE
                       END
                FROM audit_records
                ORDER BY created_at DESC, audit_id DESC
                LIMIT %s
                """,
                (limit,),
            )
            audit_rows = cursor.fetchall()
            audits = [
                {
                    "audit_id": str(row[0]),
                    "claim_id": row[1],
                    "provider_name": row[2],
                    "provider_npi": row[3],
                    "service_date": row[4].isoformat() if row[4] else None,
                    "total_billed": row[5],
                    "currency": row[6],
                    "region": row[7],
                    "overcharge_total": row[8],
                    "status": row[9],
                    "collection_deadline": row[10].isoformat() if row[10] else None,
                    "credit_warning_date": (
                        row[11].isoformat() if row[11] else None
                    ),
                    "final_settled_amount": row[12],
                    "savings_amount": row[13],
                    "resolved_at": row[14].isoformat() if row[14] else None,
                    "created_at": row[15].isoformat(),
                    "collection_days_remaining": row[16],
                    "credit_warning_days_remaining": row[17],
                }
                for row in audit_rows
            ]
            audit_ids = [str(row[0]) for row in audit_rows]

            cursor.execute(
                """
                SELECT audit_id, position, code, description, amount,
                       benchmark_amount, overcharge, benchmark_found, flagged
                FROM audit_line_items
                WHERE audit_id = ANY(%s::uuid[])
                ORDER BY audit_id, position
                LIMIT %s
                """,
                (audit_ids, limit),
            )
            line_items = [
                {
                    "audit_id": str(row[0]),
                    "position": row[1],
                    "code": row[2],
                    "description": row[3],
                    "amount": row[4],
                    "benchmark_amount": row[5],
                    "overcharge": row[6],
                    "benchmark_found": row[7],
                    "flagged": row[8],
                }
                for row in cursor.fetchall()
            ]

            cursor.execute(
                """
                SELECT audit_id, event_type, previous_status, new_status,
                       details, occurred_at
                FROM audit_events
                WHERE audit_id = ANY(%s::uuid[])
                ORDER BY occurred_at, event_id
                LIMIT %s
                """,
                (audit_ids, limit),
            )
            events = [
                {
                    "audit_id": str(row[0]),
                    "event_type": row[1],
                    "previous_status": row[2],
                    "new_status": row[3],
                    "details": row[4],
                    "occurred_at": row[5].isoformat(),
                }
                for row in cursor.fetchall()
            ]

            cursor.execute(
                """
                SELECT code, region, average_amount, source, updated_at
                FROM cpt_benchmarks
                ORDER BY region, code
                LIMIT %s
                """,
                (limit,),
            )
            benchmarks = [
                {
                    "code": row[0],
                    "region": row[1],
                    "average_amount": row[2],
                    "source": row[3],
                    "updated_at": row[4].isoformat(),
                }
                for row in cursor.fetchall()
            ]

        return {
            "database": conn.info.dbname,
            "schema": schema_name,
            "tables": tables,
            "audit_records": audits,
            "audit_line_items": line_items,
            "audit_events": events,
            "cpt_benchmarks": benchmarks,
        }
    finally:
        conn.close()


def _event_records(conn: connection, audit_id: str) -> list[dict[str, Any]]:
    """Load the chronological timeline for an audit using the open connection."""
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT event_type, previous_status, new_status, details, occurred_at
            FROM audit_events
            WHERE audit_id = %s
            ORDER BY occurred_at, event_id
            """,
            (audit_id,),
        )
        return [
            {
                "event_type": row[0],
                "previous_status": row[1],
                "new_status": row[2],
                "details": row[3],
                "occurred_at": row[4].isoformat(),
            }
            for row in cursor.fetchall()
        ]


def _parse_audit_id(audit_id: str | UUID) -> UUID:
    try:
        return UUID(str(audit_id))
    except ValueError as exc:
        raise ValueError("audit_id must be a valid UUID.") from exc


def _optional_date(value: date | str | None, field_name: str) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        raise ValueError(f"{field_name} must be a date, not a datetime.")
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field_name} must be an ISO date.") from exc


def _normalize_line_item(item: Any, index: int) -> dict[str, Any]:
    if not isinstance(item, Mapping):
        raise ValueError(f"claim.items[{index}] must be an object.")

    return {
        "code": _required_text(item.get("code"), f"claim.items[{index}].code").upper(),
        "description": _required_text(
            item.get("description"), f"claim.items[{index}].description"
        ),
        "amount": _money(item.get("amount"), f"claim.items[{index}].amount"),
    }


def _required_text(value: Any, field_name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field_name} must be a non-empty string.")
    return value.strip()


def _money(value: Any, field_name: str) -> Decimal:
    try:
        amount = Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"{field_name} must be a valid monetary amount.") from exc
    if not amount.is_finite() or amount < 0:
        raise ValueError(f"{field_name} must be a non-negative monetary amount.")
    return amount
