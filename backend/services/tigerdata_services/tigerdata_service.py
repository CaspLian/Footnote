import os
from collections.abc import Mapping, Sequence
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import execute_values
from psycopg2.extensions import connection


_SCHEMA = """
CREATE TABLE IF NOT EXISTS cpt_benchmarks (
    code TEXT NOT NULL,
    region TEXT NOT NULL,
    average_amount NUMERIC(12, 2) NOT NULL CHECK (average_amount >= 0),
    source TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (code, region)
);

CREATE TABLE IF NOT EXISTS audit_records (
    audit_id UUID PRIMARY KEY,
    claim_id TEXT,
    provider_name TEXT,
    provider_npi TEXT,
    service_date DATE,
    total_billed NUMERIC(12, 2) NOT NULL,
    currency TEXT NOT NULL,
    region TEXT,
    overcharge_total NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
"""


def connect_tiger_data() -> connection:
    """Open and return a PostgreSQL connection to Tiger Data."""
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")  # backend/.env

    database_url = os.getenv("TIGER_DATA_POSTGRES_URL")
    if not database_url:
        raise RuntimeError("TIGER_DATA_POSTGRES_URL is not set.")

    return psycopg2.connect(database_url, connect_timeout=10)


def initialize_tiger_data() -> None:
    """Create the audit and benchmark tables if they do not exist."""
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
    """Benchmark and persist an extracted bill, returning its audit results."""
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
    service_date = claim.get("service_date")
    if service_date is not None:
        try:
            service_date = date.fromisoformat(str(service_date))
        except ValueError as exc:
            raise ValueError("claim.service_date must be an ISO date.") from exc

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
                        total_billed, currency, region, overcharge_total
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        audit_id,
                        claim.get("claim_id"),
                        provider.get("name"),
                        provider.get("npi"),
                        service_date,
                        total_billed,
                        claim.get("currency", "USD"),
                        normalized_region,
                        overcharge_total,
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


def get_bill_audit(audit_id: str | UUID) -> dict[str, Any] | None:
    """Fetch a persisted audit and its line-item results by audit ID."""
    try:
        parsed_audit_id = UUID(str(audit_id))
    except ValueError as exc:
        raise ValueError("audit_id must be a valid UUID.") from exc

    conn = connect_tiger_data()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT claim_id, provider_name, provider_npi, service_date,
                       total_billed, currency, region, overcharge_total, created_at
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
            "claim_id": record[0],
            "provider": {"name": record[1], "npi": record[2]},
            "service_date": record[3].isoformat() if record[3] else None,
            "total_billed": record[4],
            "currency": record[5],
            "region": record[6],
            "overcharge_total": record[7],
            "created_at": record[8].isoformat(),
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
