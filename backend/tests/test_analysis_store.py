"""Tests for services.analytical_services.analysis_store (saving each analysis to Tiger Data and loading it back).

The first group needs nothing. The database group runs only when TIGER_TEST_DATABASE_URL points at a database you
may write to, such as a local PostgreSQL, never the team's real one. It deletes the rows it creates, and the tests
that need a superuser (to drop tables or create a role) skip without one.
"""
import asyncio
import logging
import os
import threading
import time
import uuid

import psycopg2
import pytest

import services.analytical_services.analysis_store as store
from models import AnalyzeResponse, GeminiResult, LineItem, PriceCheck, PriceSummary

TEST_DATABASE_URL = os.getenv("TIGER_TEST_DATABASE_URL", "").strip()
needs_database = pytest.mark.skipif(not TEST_DATABASE_URL, reason="set TIGER_TEST_DATABASE_URL to a test database")
UNREACHABLE = "postgresql://someone:secret-password@127.0.0.1:9/none"  # nothing listens on port 9


@pytest.fixture(autouse=True)
def fresh_store(monkeypatch):
    monkeypatch.setattr(store, "_unreachable_until", {})  # no pause carried over from another test


def analysis(description_of_last_line="FACILITY FEE - MISC"):
    result = GeminiResult(
        document_type="hospital_bill",
        provider_name="Synthetic General Hospital",
        total_billed=4400.0,
        line_items=[
            LineItem(cpt_code="70450", original_description="CT HEAD", plain_description="Head CT", billed_amount=3200.0),
            LineItem(cpt_code="71046", original_description="CHEST X-RAY", plain_description="Chest X-ray", billed_amount=None),
            LineItem(cpt_code=None, original_description=description_of_last_line, plain_description="Facility fee", billed_amount=1200.0),
        ],
        plain_summary="Summary.",
        spoken_summary="Spoken summary.",
    )
    checks = [
        PriceCheck(line_index=0, cpt_code="70450", billed_amount=3200.0, medicare_rate=106.55, times_medicare=30.0,
                   flag="far_above_typical", note="n"),
        PriceCheck(line_index=1, cpt_code="71046", billed_amount=None, medicare_rate=31.4, flag="no_amount", note="n"),
        PriceCheck(line_index=2, cpt_code=None, billed_amount=1200.0, flag="no_code", note="n"),
    ]
    summary = PriceSummary(source="local_csv", items_checked=1, items_flagged=1, billed_total_checked=3200.0,
                           medicare_total_checked=106.55)
    return AnalyzeResponse(target_language="en", model="test-model", mock=True, result=result, price_checks=checks,
                           price_summary=summary)


# --- No database needed ----------------------------------------------------------------------------


@pytest.mark.parametrize(
    "url, configured",
    [
        ("", False),
        ("postgresql://user:password@host:port/dbname?sslmode=require", False),  # the .env.example placeholder
        ("mysql://someone:secret@db.example.com:3306/claims", False),
        ("postgresql+psycopg2://someone:secret@db.example.com:5432/claims", False),  # SQLAlchemy style: libpq refuses it
        ("POSTGRESQL://someone:secret@db.example.com/claims", False),
        (" postgresql://someone:secret@db.example.com/claims", False),  # a leading space: libpq refuses it too
        ("postgresql://someone:secret@db.example.com:5432/claims?sslmode=require", True),
        ("postgres://someone:secret@db.example.com/claims", True),
        ("host=db.example.com dbname=claims user=someone password=secret", True),  # libpq's key=value form
        ("postgresql://someone:secret@db1.example.com:5432,db2.example.com:5432/claims", True),  # two hosts
        ("postgresql://someone:secret@[::1]:5432/claims", True),
    ],
)
def test_only_a_usable_postgres_address_counts_as_configured(monkeypatch, url, configured):
    monkeypatch.setenv("TIGER_DATA_POSTGRES_URL", url)
    assert store.is_configured() is configured


def test_line_rows_keep_missing_codes_and_amounts_as_none():
    rows = store.line_rows(analysis(), "audit-1")
    assert rows == [
        ("audit-1", 0, "70450", "CT HEAD", 3200.0, 106.55, 30.0, "far_above_typical"),
        ("audit-1", 1, "71046", "CHEST X-RAY", None, 31.4, None, "no_amount"),
        ("audit-1", 2, None, "FACILITY FEE - MISC", 1200.0, None, None, "no_code"),
    ]


def test_a_line_the_price_check_did_not_see_is_marked_not_checked():
    response = analysis()
    response.price_checks = response.price_checks[:1]
    assert [row[-1] for row in store.line_rows(response, "a")] == ["far_above_typical", "not_checked", "not_checked"]


def test_without_a_database_nothing_is_attempted(monkeypatch):
    monkeypatch.setenv("TIGER_DATA_POSTGRES_URL", "")
    audit = asyncio.run(store.save_analysis(analysis(), source="text"))
    assert audit.saved is False and audit.audit_id is None and "TIGER_DATA_POSTGRES_URL" in audit.error
    with pytest.raises(store.StoreUnavailable):
        asyncio.run(store.load_analysis(str(uuid.uuid4())))


def test_an_unreachable_database_is_reported_not_raised(monkeypatch, caplog):
    monkeypatch.setenv("TIGER_DATA_POSTGRES_URL", UNREACHABLE)
    audit = asyncio.run(store.save_analysis(analysis(), source="voice", transcript="Hi"))
    assert audit.saved is False and audit.error == "Not saved: Tiger Data error (OperationalError)."
    assert "secret-password" not in audit.error
    # The log says what failed, never the message: psycopg2's can hold the URL or the bill's values.
    assert "OperationalError" in caplog.text and "secret-password" not in caplog.text and "127.0.0.1" not in caplog.text


def test_after_an_unreachable_database_requests_do_not_wait_for_it_again(monkeypatch):
    monkeypatch.setenv("TIGER_DATA_POSTGRES_URL", UNREACHABLE)
    assert asyncio.run(store.save_analysis(analysis(), source="text")).error == "Not saved: Tiger Data error (OperationalError)."
    started = time.monotonic()
    paused = asyncio.run(store.save_analysis(analysis(), source="text"))
    assert paused.saved is False and paused.error == "Not saved: Tiger Data could not be reached a moment ago."
    with pytest.raises(store.StoreUnavailable, match="a moment ago"):
        asyncio.run(store.load_analysis(str(uuid.uuid4())))
    assert time.monotonic() - started < 0.5  # no connection was attempted
    store._unreachable_until[UNREACHABLE] = time.monotonic() - 1  # the pause is over: it tries again
    assert asyncio.run(store.save_analysis(analysis(), source="text")).error == "Not saved: Tiger Data error (OperationalError)."


def test_bad_input_is_a_programming_error():
    with pytest.raises(ValueError, match="source"):
        asyncio.run(store.save_analysis(analysis(), source="fax"))
    with pytest.raises(ValueError, match="valid UUID"):
        asyncio.run(store.load_analysis("not-a-uuid"))


def test_values_postgresql_cannot_store_are_made_storable():
    assert store._text("a\x00b") == "a\ufffdb" and store._text(None) is None
    assert store._number(float("nan")) is None and store._number(float("inf")) is None and store._number(1e15) == 1e15
    assert store._clean({"a\x00": [1.5, float("nan"), "x\x00", None, True]}) == {"a\ufffd": [1.5, None, "x\ufffd", None, True]}


# --- With a test database ----------------------------------------------------------------------------


@pytest.fixture
def database(monkeypatch):
    monkeypatch.setenv("TIGER_DATA_POSTGRES_URL", TEST_DATABASE_URL)
    monkeypatch.setattr(store, "_schema_ready", False)
    created = []
    yield created
    if created:
        rows("DELETE FROM bill_analyses WHERE audit_id = ANY(%s::uuid[])", (created,), fetch=False)


def rows(query, params=(), fetch=True, url=None):
    conn = psycopg2.connect(url or TEST_DATABASE_URL)
    try:
        with conn, conn.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchall() if fetch else None
    finally:
        conn.close()


def counts():
    if not rows("SELECT to_regclass('bill_analyses') IS NOT NULL")[0][0]:
        return (0, 0)
    return rows("SELECT (SELECT count(*) FROM bill_analyses), (SELECT count(*) FROM bill_analysis_lines)")[0]


def superuser() -> bool:
    return rows("SELECT rolsuper FROM pg_roles WHERE rolname = current_user")[0][0]


@needs_database
def test_a_saved_analysis_reads_back_exactly(database):
    response = analysis()
    audit = asyncio.run(store.save_analysis(response, source="voice", transcript="Why so expensive?"))
    assert audit.saved is True
    database.append(audit.audit_id)
    saved = asyncio.run(store.load_analysis(audit.audit_id))
    assert saved["source"] == "voice" and saved["transcript"] == "Why so expensive?"
    expected = response.model_dump(mode="json")
    expected["audit"] = {"saved": True, "audit_id": audit.audit_id, "error": None}
    assert saved["analysis"] == expected


@needs_database
def test_missing_codes_and_amounts_are_stored_as_null(database):
    audit = asyncio.run(store.save_analysis(analysis(), source="file"))
    database.append(audit.audit_id)
    stored = rows(
        "SELECT position, cpt_code, billed_amount, medicare_rate, times_medicare, flag FROM bill_analysis_lines "
        "WHERE audit_id = %s ORDER BY position", (audit.audit_id,),
    )
    assert [(p, c, None if a is None else float(a), f) for p, c, a, _, _, f in stored] == [
        (0, "70450", 3200.0, "far_above_typical"), (1, "71046", None, "no_amount"), (2, None, 1200.0, "no_code"),
    ]
    header = rows("SELECT total_billed, items_checked, items_flagged, price_source FROM bill_analyses WHERE audit_id = %s",
                  (audit.audit_id,))
    assert [(float(t), c, f, s) for t, c, f, s in header] == [(4400.0, 1, 1, "local_csv")]


@needs_database
def test_a_failed_save_leaves_nothing_behind(database, monkeypatch):
    database.append(asyncio.run(store.save_analysis(analysis(), source="text")).audit_id)  # the tables exist
    before = counts()

    def lines_fail(*args, **kwargs):
        raise RuntimeError("the line items could not be written")

    monkeypatch.setattr(store, "execute_values", lambda *args, **kwargs: lines_fail())  # after the header INSERT
    audit = asyncio.run(store.save_analysis(analysis(), source="text"))
    assert audit.saved is False and audit.audit_id is None and audit.error == "Not saved: Tiger Data error (RuntimeError)."
    assert counts() == before  # neither the header nor any line


def utf8() -> bool:
    return rows("SHOW server_encoding")[0][0] == "UTF8"


@needs_database
def test_text_in_every_language_the_app_offers_is_kept(database):
    if not utf8():
        pytest.skip("needs a UTF8 database, as Tiger Data's are")
    response = analysis(description_of_last_line="门诊费 / رسوم المنشأة / সুবিধা ফি")
    response.target_language = "zh"
    audit = asyncio.run(store.save_analysis(response, source="voice", transcript="为什么这么贵？"))
    assert audit.saved is True, audit.error
    database.append(audit.audit_id)
    saved = asyncio.run(store.load_analysis(audit.audit_id))
    assert saved["transcript"] == "为什么这么贵？"
    assert saved["analysis"]["result"]["line_items"][2]["original_description"] == "门诊费 / رسوم المنشأة / সুবিধা ফি"


@needs_database
def test_values_the_tables_would_refuse_do_not_lose_the_analysis(database):
    if not utf8():
        pytest.skip("needs a UTF8 database, as Tiger Data's are (U+FFFD replaces NUL)")
    response = analysis(description_of_last_line="FACILITY\x00FEE")
    response.result.total_billed = float("nan")
    response.result.line_items[0].billed_amount = 1e15  # an account number read as an amount
    audit = asyncio.run(store.save_analysis(response, source="voice", transcript="my\x00question"))
    assert audit.saved is True, audit.error
    database.append(audit.audit_id)
    saved = asyncio.run(store.load_analysis(audit.audit_id))
    assert saved["transcript"] == "my\ufffdquestion"
    assert saved["analysis"]["result"]["total_billed"] is None  # as the app received it: JSON has no NaN
    assert saved["analysis"]["result"]["line_items"][2]["original_description"] == "FACILITY\ufffdFEE"
    assert rows("SELECT total_billed FROM bill_analyses WHERE audit_id = %s", (audit.audit_id,)) == [(None,)]
    assert float(rows("SELECT billed_amount FROM bill_analysis_lines WHERE audit_id = %s AND position = 0",
                      (audit.audit_id,))[0][0]) == 1e15


@needs_database
def test_tables_dropped_while_running_are_made_again(database):
    if not superuser():
        pytest.skip("needs a superuser to drop the tables")
    first = asyncio.run(store.save_analysis(analysis(), source="text"))
    assert first.saved is True
    rows("DROP TABLE bill_analysis_lines, bill_analyses", fetch=False)  # e.g. the database was reset
    second = asyncio.run(store.save_analysis(analysis(), source="text"))  # the store still thinks they exist
    assert second.saved is True, second.error
    database.append(second.audit_id)
    assert asyncio.run(store.load_analysis(second.audit_id))["source"] == "text"


@needs_database
def test_an_app_role_without_create_permission_can_save_and_load(database, monkeypatch):
    if not superuser():
        pytest.skip("needs a superuser to create a role")
    database.append(asyncio.run(store.save_analysis(analysis(), source="text")).audit_id)  # the owner makes the tables
    role, password = f"app_{uuid.uuid4().hex[:8]}", "local-test-only"
    database_name = rows("SELECT current_database()")[0][0]
    rows(f"CREATE ROLE {role} LOGIN PASSWORD %s", (password,), fetch=False)
    try:
        schema = rows("SELECT current_schema()")[0][0]  # public, or the schema the test URL's search_path names
        rows(f"GRANT CONNECT ON DATABASE {database_name} TO {role}; GRANT USAGE ON SCHEMA {schema} TO {role}; "
             f"GRANT SELECT, INSERT ON bill_analyses, bill_analysis_lines TO {role}", fetch=False)
        if rows("SELECT has_schema_privilege(%s, %s, 'CREATE')", (role, schema))[0][0]:
            pytest.skip("every role may CREATE in this schema on this server (PostgreSQL 14 or older)")
        limited = psycopg2.extensions.make_dsn(TEST_DATABASE_URL, user=role, password=password)  # same host and options
        monkeypatch.setenv("TIGER_DATA_POSTGRES_URL", limited)
        monkeypatch.setattr(store, "_schema_ready", False)  # a new process for this role
        audit = asyncio.run(store.save_analysis(analysis(), source="file"))
        assert audit.saved is True, audit.error
        database.append(audit.audit_id)
        assert asyncio.run(store.load_analysis(audit.audit_id))["source"] == "file"
    finally:
        rows(f"DROP OWNED BY {role}; DROP ROLE {role}", fetch=False)


@needs_database
def test_a_held_lock_fails_the_save_quickly_instead_of_holding_a_thread(database, monkeypatch):
    database.append(asyncio.run(store.save_analysis(analysis(), source="text")).audit_id)  # the tables exist
    before = counts()
    monkeypatch.setattr(store, "_TIME_LIMITS", "SET LOCAL statement_timeout = 2000; SET LOCAL lock_timeout = 300;")
    holder = psycopg2.connect(TEST_DATABASE_URL)
    try:
        with holder.cursor() as cursor:
            cursor.execute("LOCK TABLE bill_analyses IN ACCESS EXCLUSIVE MODE")  # e.g. a teammate's migration
            started = time.monotonic()
            audit = asyncio.run(store.save_analysis(analysis(), source="text"))
            elapsed = time.monotonic() - started
    finally:
        holder.rollback()
        holder.close()
    assert audit.saved is False and audit.error == "Not saved: Tiger Data error (LockNotAvailable)."
    assert elapsed < 2 and counts() == before


@needs_database
def test_a_save_that_runs_out_of_time_is_rolled_back_not_committed_later(database, monkeypatch, caplog):
    database.append(asyncio.run(store.save_analysis(analysis(), source="text")).audit_id)  # the tables exist
    before = counts()
    monkeypatch.setattr(store, "SAVE_TIMEOUT_S", 0.5)
    holder = psycopg2.connect(TEST_DATABASE_URL)
    with holder.cursor() as cursor:
        cursor.execute("LOCK TABLE bill_analyses IN ACCESS EXCLUSIVE MODE")  # held 1.5 s, under the 3 s lock limit
    release = threading.Timer(1.5, lambda: (holder.rollback(), holder.close()))
    release.start()
    with caplog.at_level(logging.WARNING):
        audit = asyncio.run(store.save_analysis(analysis(), source="text"))
        assert audit.saved is False and audit.audit_id is None
        assert audit.error == "Not saved: Tiger Data did not answer within 0.5 s."
        release.join()
        deadline = time.monotonic() + 5
        while "rolled back" not in caplog.text and time.monotonic() < deadline:
            time.sleep(0.05)  # the save finishes in the background, once the lock is released
    assert "rolled back after the request stopped waiting" in caplog.text
    assert counts() == before  # the answer "not saved" stayed true


@needs_database
def test_an_unknown_audit_is_none(database):
    assert asyncio.run(store.load_analysis(str(uuid.uuid4()))) is None
