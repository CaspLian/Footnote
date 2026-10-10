"""Step 3 of the pipeline: save each analysis to Tiger Data, and load it back.

    audit = await save_analysis(response, source="file")   # never raises: AuditInfo(saved, audit_id, error)
    saved = await load_analysis(audit_id)                  # a dict, or None if there is no such analysis

It uses Tiger Data's database (TIGER_DATA_POSTGRES_URL, as services/tigerdata_services/tigerdata_service.py does) and two tables of its
own. Gemini can return a line without a CPT code or an amount: those are stored as NULL, never dropped or filled in.
The whole response is also kept as JSON, so GET /api/v1/audits/{id} returns exactly what /api/v1/analyze returned.
tigerdata_service's own tables (for the claim format in mock_bill.json) are not touched.

Saving must never hold up an answer for long, so:
  - database work runs on a few threads of its own, and every statement has a time limit;
  - an answer is true: a save that runs out of time is rolled back, never committed later;
  - after Tiger Data could not be reached, saving pauses for UNREACHABLE_PAUSE_S instead of making every request
    wait for the connection to time out again.
"""
import asyncio
import concurrent.futures
import logging
import math
import os
import threading
import time
import uuid
from typing import Optional

import psycopg2
import psycopg2.errors
from psycopg2.extensions import parse_dsn
from psycopg2.extras import Json, execute_values

from models import AnalyzeResponse, AuditInfo

logger = logging.getLogger(__name__)

CONNECT_TIMEOUT_S = 5  # per address the host name resolves to
STATEMENT_TIMEOUT_MS = 5000  # no statement may hold a connection longer (an overloaded server)
LOCK_TIMEOUT_MS = 3000  # nor wait longer for a lock (a teammate's open transaction, a migration)
SAVE_TIMEOUT_S = 15  # the most a request waits for a save or a load
UNREACHABLE_PAUSE_S = 30  # after a failed connection, how long saving and loading are skipped
SOURCES = ("text", "file", "voice")
_SCHEMA_LOCK_KEY = 7310452901  # pg_advisory_xact_lock key held while creating the tables (any fixed number)
_TIME_LIMITS = f"SET LOCAL statement_timeout = {STATEMENT_TIMEOUT_MS}; SET LOCAL lock_timeout = {LOCK_TIMEOUT_MS};"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS bill_analyses (
    audit_id UUID PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source TEXT NOT NULL,
    target_language TEXT NOT NULL,
    model TEXT NOT NULL,
    mock BOOLEAN NOT NULL,
    document_type TEXT,
    provider_name TEXT,
    total_billed NUMERIC,
    amount_patient_owes NUMERIC,
    price_source TEXT,
    items_checked INTEGER NOT NULL DEFAULT 0,
    items_flagged INTEGER NOT NULL DEFAULT 0,
    transcript TEXT,
    analysis JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS bill_analysis_lines (
    audit_id UUID NOT NULL REFERENCES bill_analyses (audit_id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    cpt_code TEXT,
    description TEXT NOT NULL,
    billed_amount NUMERIC,
    medicare_rate NUMERIC,
    times_medicare NUMERIC,
    flag TEXT NOT NULL,
    PRIMARY KEY (audit_id, position)
);
"""

# Its own threads: a stalled database must not take the threads speech-to-text and text-to-speech run on.
_executor = concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="tiger-data")
_schema_ready = False
_schema_lock = threading.Lock()
_unreachable_until: dict[str, float] = {}  # TIGER_DATA_POSTGRES_URL -> time.monotonic() until which it is skipped


class StoreUnavailable(Exception):
    """Tiger Data is not configured, or could not be reached."""


class _OutOfTime(Exception):
    """The request stopped waiting: roll the save back rather than commit it unannounced."""


def database_host() -> Optional[str]:
    """The host (or hosts) in TIGER_DATA_POSTGRES_URL, or None if it is unset, unusable, or the .env.example placeholder.
    libpq decides, exactly as it will when connecting; it accepts URLs and "host=... dbname=..." strings."""
    url = os.getenv("TIGER_DATA_POSTGRES_URL", "")
    if not url.strip():
        return None
    try:
        params = parse_dsn(url)
    except psycopg2.ProgrammingError:  # its message contains the URL, password included: never show it
        return None
    host = params.get("host", "")
    if not host or host == "host" or params.get("port") == "port":
        return None
    return host


def is_configured() -> bool:
    """True when TIGER_DATA_POSTGRES_URL holds a usable database address, not the .env.example placeholder."""
    return database_host() is not None


async def save_analysis(response: AnalyzeResponse, *, source: str, transcript: Optional[str] = None) -> AuditInfo:
    """Save one analysis. Never raises for Tiger Data problems: they are reported in the AuditInfo,
    and the analysis is still returned to the user."""
    if source not in SOURCES:
        raise ValueError(f"source must be one of {SOURCES}, got {source!r}")
    if not is_configured():
        return AuditInfo(saved=False, error="Not saved: Tiger Data is not configured (TIGER_DATA_POSTGRES_URL).")
    if _paused():
        return AuditInfo(saved=False, error="Not saved: Tiger Data could not be reached a moment ago.")
    audit_id = str(uuid.uuid4())
    out_of_time = threading.Event()
    job = _executor.submit(_save, response, source, transcript, audit_id, out_of_time)
    try:
        await asyncio.wait_for(asyncio.wrap_future(job), SAVE_TIMEOUT_S)
    except asyncio.TimeoutError:
        out_of_time.set()
        logger.warning("Saving analysis %s took over %s s: rolling it back", audit_id, SAVE_TIMEOUT_S)
        job.add_done_callback(lambda done: _log_late(audit_id, done))
        return AuditInfo(saved=False, error=f"Not saved: Tiger Data did not answer within {SAVE_TIMEOUT_S} s.")
    except Exception as exc:  # unreachable, bad credentials, a refused value...
        logger.warning("Could not save analysis %s to Tiger Data: %s", audit_id, _describe(exc))
        return AuditInfo(saved=False, error=f"Not saved: Tiger Data error ({type(exc).__name__}).")
    return AuditInfo(saved=True, audit_id=audit_id)


async def load_analysis(audit_id: str) -> Optional[dict]:
    """The saved analysis, or None if there is none with this ID.
    Raises ValueError for a malformed ID, StoreUnavailable if Tiger Data is not configured or not reachable."""
    try:
        parsed = str(uuid.UUID(str(audit_id)))
    except ValueError:
        raise ValueError("audit_id must be a valid UUID.") from None
    if not is_configured():
        raise StoreUnavailable("Tiger Data is not configured (TIGER_DATA_POSTGRES_URL).")
    if _paused():
        raise StoreUnavailable("Tiger Data could not be reached a moment ago.")
    try:
        return await asyncio.wait_for(asyncio.wrap_future(_executor.submit(_load, parsed)), SAVE_TIMEOUT_S)
    except Exception as exc:
        logger.warning("Could not load analysis %s from Tiger Data: %s", parsed, _describe(exc))
        raise StoreUnavailable(f"Could not read from Tiger Data ({type(exc).__name__}).") from None


def line_rows(response: AnalyzeResponse, audit_id: str) -> list[tuple]:
    """One row per line item, with its price check. Missing codes and amounts stay None."""
    checks = {check.line_index: check for check in response.price_checks}
    rows = []
    for position, item in enumerate(response.result.line_items):
        check = checks.get(position)
        rows.append((
            audit_id,
            position,
            _text(item.cpt_code),
            _text(item.original_description),
            _number(item.billed_amount),
            _number(check.medicare_rate) if check else None,
            _number(check.times_medicare) if check else None,
            check.flag if check else "not_checked",
        ))
    return rows


def _save(response: AnalyzeResponse, source: str, transcript: Optional[str], audit_id: str, out_of_time: threading.Event) -> None:
    result, summary = response.result, response.price_summary

    def write(cursor):
        cursor.execute(
            _TIME_LIMITS + """
            INSERT INTO bill_analyses (
                audit_id, source, target_language, model, mock, document_type, provider_name, total_billed,
                amount_patient_owes, price_source, items_checked, items_flagged, transcript, analysis
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                audit_id, source, _text(response.target_language), _text(response.model), response.mock,
                _text(result.document_type), _text(result.provider_name), _number(result.total_billed),
                _number(result.amount_patient_owes),
                _text(summary.source) if summary else None,
                summary.items_checked if summary else 0,
                summary.items_flagged if summary else 0,
                _text(transcript),
                Json(_clean(response.model_dump(mode="json", exclude={"audit"}))),
            ),
        )
        rows = line_rows(response, audit_id)
        if rows:
            execute_values(
                cursor,
                """
                INSERT INTO bill_analysis_lines (
                    audit_id, position, cpt_code, description, billed_amount, medicare_rate, times_medicare, flag
                ) VALUES %s
                """,
                rows,
            )
        if out_of_time.is_set():
            raise _OutOfTime()  # the request was already answered "not saved": keep that true

    _in_transaction(write)


def _load(audit_id: str) -> Optional[dict]:
    def read(cursor):
        cursor.execute(
            _TIME_LIMITS + "SELECT created_at, source, transcript, analysis FROM bill_analyses WHERE audit_id = %s",
            (audit_id,),
        )
        return cursor.fetchone()

    row = _in_transaction(read)
    if row is None:
        return None
    created_at, source, transcript, analysis = row
    analysis["audit"] = {"saved": True, "audit_id": audit_id, "error": None}
    return {
        "audit_id": audit_id,
        "created_at": created_at.isoformat(),
        "source": source,
        "transcript": transcript,
        "analysis": analysis,
    }


def _in_transaction(work):
    """work(cursor) in one transaction on a new connection (all of it happens, or none of it), after making the
    tables if this process has not yet. If they were dropped since (or the database replaced), make them again
    and try once more."""
    global _schema_ready
    for attempt in (1, 2):
        conn = _connect()
        try:
            _ensure_schema(conn)
            with conn, conn.cursor() as cursor:
                return work(cursor)
        except psycopg2.errors.UndefinedTable:
            if attempt == 2:
                raise
            _schema_ready = False
        finally:
            conn.close()


def _connect():
    """A new connection. When Tiger Data cannot be reached, saving and loading pause for a while (UNREACHABLE_PAUSE_S),
    so the next requests do not each wait for the connection to time out again."""
    url = os.environ["TIGER_DATA_POSTGRES_URL"]
    try:
        # UTF8 whatever the server's default: bills come in every language the app offers (Tiger Data's are UTF8)
        return psycopg2.connect(url, connect_timeout=CONNECT_TIMEOUT_S, client_encoding="UTF8")
    except psycopg2.OperationalError:
        _unreachable_until[url] = time.monotonic() + UNREACHABLE_PAUSE_S
        raise


def _paused() -> bool:
    return time.monotonic() < _unreachable_until.get(os.getenv("TIGER_DATA_POSTGRES_URL", ""), 0.0)


def _ensure_schema(conn) -> None:
    """Create the two tables if they are missing, once per process. Only when one is missing, so an app role without
    CREATE on the schema can use tables their owner made; and under an advisory lock, so two processes starting at
    once do not clash. In its own transaction, so a failed save cannot undo it."""
    global _schema_ready
    if _schema_ready:
        return
    with _schema_lock:
        if _schema_ready:
            return
        with conn, conn.cursor() as cursor:
            cursor.execute(
                _TIME_LIMITS
                + "SELECT to_regclass('bill_analyses') IS NOT NULL AND to_regclass('bill_analysis_lines') IS NOT NULL"
            )
            if not cursor.fetchone()[0]:
                cursor.execute("SELECT pg_advisory_xact_lock(%s)", (_SCHEMA_LOCK_KEY,))
                cursor.execute(_SCHEMA)
        _schema_ready = True


def _text(value):
    """PostgreSQL text cannot hold NUL characters: they become U+FFFD instead of losing the whole analysis."""
    return value.replace("\x00", "\ufffd") if isinstance(value, str) else value


def _number(value):
    """NaN and infinity are stored as NULL (the JSON copy has null for them too, as the app received)."""
    return None if isinstance(value, float) and not math.isfinite(value) else value


def _clean(value):
    """The response as JSON PostgreSQL accepts: NaN and infinity become null, NUL becomes U+FFFD."""
    if isinstance(value, dict):
        return {_text(key): _clean(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_clean(item) for item in value]
    return _number(_text(value))


def _describe(exc: BaseException) -> str:
    """The error's type and PostgreSQL code only. psycopg2's message can quote the failing statement with the
    bill's values filled in, or (for a malformed URL) the connection string, password included."""
    code = getattr(exc, "pgcode", None)
    return f"{type(exc).__name__}" + (f" (SQLSTATE {code})" if code else "")


def _log_late(audit_id: str, job: concurrent.futures.Future) -> None:
    """What finally happened to a save the request stopped waiting for."""
    if job.cancelled():
        logger.warning("Analysis %s was not saved: it never started (Tiger Data was busy)", audit_id)
    elif isinstance(job.exception(), _OutOfTime):
        logger.warning("Analysis %s was rolled back after the request stopped waiting", audit_id)
    elif job.exception() is not None:
        logger.warning("Analysis %s was not saved: %s", audit_id, _describe(job.exception()))
    else:
        logger.warning("Analysis %s was saved after the request had answered 'not saved'", audit_id)
