"""Price check: compare each billed line item to Medicare's national rate stored in Snowflake.

    checks, summary = await check_prices(result.line_items)

Lookups go to the CPT_BENCHMARKS table in Snowflake (loaded by load_benchmarks.py).
If Snowflake can't be reached, it falls back to data/cpt_benchmarks.csv so a demo
never breaks; price_summary.source says which one was used.
"""
import asyncio
import csv
import os
import re
from pathlib import Path
from typing import Optional

from models import LineItem, PriceCheck, PriceSummary

CSV_PATH = Path(__file__).resolve().parents[2] / "data" / "cpt_benchmarks.csv"  # backend/data
SNOWFLAKE_TIMEOUT_S = 15

# Hospitals list prices well above Medicare as a matter of course, so the bands are generous.
TYPICAL_MAX = 3.0   # up to 3x Medicare: common for hospital list prices
ABOVE_MAX = 6.0     # 3x to 6x: worth asking about; above 6x: far above typical

_conn = None
_csv_cache: Optional[dict] = None
_lookup_cache: dict[str, Optional[dict]] = {}


def _normalize(code: Optional[str]) -> Optional[str]:
    if not code:
        return None
    code = re.sub(r"[^A-Za-z0-9]", "", code).upper()
    return code[:5] if len(code) >= 5 else None


def _connect():
    import snowflake.connector

    return snowflake.connector.connect(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        password=os.environ["SNOWFLAKE_PASSWORD"],
        warehouse=os.getenv("SNOWFLAKE_WAREHOUSE", "COMPUTE_WH"),
        database=os.environ["SNOWFLAKE_DATABASE"],
        schema=os.getenv("SNOWFLAKE_SCHEMA", "PUBLIC"),
        client_session_keep_alive=True,
        login_timeout=10,
    )


def _query_snowflake(codes: list[str]) -> dict[str, dict]:
    """Blocking Snowflake lookup. Runs in a thread so it doesn't freeze the server."""
    global _conn
    sql = (
        "SELECT CPT_CODE, DESCRIPTION, MEDICARE_RATE, SETTING FROM CPT_BENCHMARKS "
        f"WHERE CPT_CODE IN ({', '.join(['%s'] * len(codes))})"
    )
    for attempt in range(2):  # reconnect once if the cached connection went stale
        try:
            if _conn is None or _conn.is_closed():
                _conn = _connect()
            cur = _conn.cursor()
            cur.execute(sql, codes)
            return {
                row[0]: {"description": row[1], "rate": float(row[2]), "setting": row[3]}
                for row in cur.fetchall()
            }
        except Exception:
            _conn = None
            if attempt == 1:
                raise
    return {}


def _query_csv(codes: list[str]) -> dict[str, dict]:
    global _csv_cache
    if _csv_cache is None:
        with open(CSV_PATH, newline="", encoding="utf-8") as f:
            _csv_cache = {
                r["CPT_CODE"]: {"description": r["DESCRIPTION"], "rate": float(r["MEDICARE_RATE"]), "setting": r["SETTING"]}
                for r in csv.DictReader(f)
            }
    return {c: _csv_cache[c] for c in codes if c in _csv_cache}


async def lookup(codes: list[str]) -> tuple[dict[str, dict], str, Optional[str]]:
    """Returns (benchmarks by code, source used, error message if Snowflake failed)."""
    wanted = sorted({c for c in codes if c})
    missing = [c for c in wanted if c not in _lookup_cache]
    source, error = "snowflake", None

    if missing:
        if os.getenv("PRICE_SOURCE", "snowflake").lower() == "csv":
            found, source = _query_csv(missing), "local_csv"
        else:
            try:
                found = await asyncio.wait_for(asyncio.to_thread(_query_snowflake, missing), SNOWFLAKE_TIMEOUT_S)
            except Exception as e:  # unreachable, bad credentials, timeout...
                found, source, error = _query_csv(missing), "local_csv", f"Snowflake lookup failed, used local copy: {e}"
        for c in missing:
            _lookup_cache[c] = found.get(c)

    return {c: _lookup_cache[c] for c in wanted if _lookup_cache.get(c)}, source, error


def _compare(i: int, item: LineItem, bench: Optional[dict]) -> PriceCheck:
    code, billed = _normalize(item.cpt_code), item.billed_amount
    base = dict(line_index=i, cpt_code=code, billed_amount=billed)

    if not code:
        return PriceCheck(**base, flag="no_code",
                          note="No billing code on this line. Ask for an itemized bill that lists the code.")
    if not bench:
        return PriceCheck(**base, flag="no_benchmark",
                          note="No Medicare reference price for this code (common for lab tests and supplies).")

    rate = bench["rate"]
    base.update(medicare_rate=rate, medicare_description=bench["description"])
    if billed is None or billed <= 0 or rate <= 0:
        return PriceCheck(**base, flag="no_amount", note=f"Medicare's national rate for this service is ${rate:,.2f}.")

    ratio = round(billed / rate, 1)
    facility_note = (
        " Medicare's rate here covers only the doctor's fee; hospitals also bill a separate facility fee, "
        "so some difference is expected."
        if bench.get("setting") == "facility" else ""
    )
    if ratio <= TYPICAL_MAX:
        flag, msg = "typical", f"Billed ${billed:,.2f}, about {ratio}x Medicare's ${rate:,.2f}. Within the usual range for hospital prices."
    elif ratio <= ABOVE_MAX:
        flag, msg = "above_typical", f"Billed ${billed:,.2f}, about {ratio}x Medicare's ${rate:,.2f}. Higher than usual; worth asking about."
    else:
        flag, msg = "far_above_typical", f"Billed ${billed:,.2f}, about {ratio}x Medicare's ${rate:,.2f}. Far above typical; ask for a review or a discount."
    return PriceCheck(**base, times_medicare=ratio, flag=flag, note=msg + facility_note)


async def check_prices(line_items: list[LineItem]) -> tuple[list[PriceCheck], PriceSummary]:
    codes = [_normalize(li.cpt_code) for li in line_items]
    try:
        benchmarks, source, error = await lookup([c for c in codes if c])
    except Exception as e:
        return [], PriceSummary(source="unavailable", error=str(e))

    checks = [_compare(i, li, benchmarks.get(codes[i]) if codes[i] else None) for i, li in enumerate(line_items)]
    compared = [c for c in checks if c.times_medicare is not None]
    summary = PriceSummary(
        source=source,
        items_checked=len(compared),
        items_flagged=sum(c.flag in ("above_typical", "far_above_typical") for c in compared),
        billed_total_checked=round(sum(c.billed_amount for c in compared), 2),
        medicare_total_checked=round(sum(c.medicare_rate for c in compared), 2),
        error=error,
    )
    return checks, summary
