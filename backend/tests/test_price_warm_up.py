"""The whole benchmark table is read once at startup, so no bill waits for Snowflake to wake up."""
import asyncio

import pytest

from services.snowflake_services import snowflake_service as prices

TABLE = {"99284": {"description": "Emergency visit", "rate": 118.82, "setting": "facility"}}


@pytest.fixture(autouse=True)
def isolated(monkeypatch):
    monkeypatch.setattr(prices, "_lookup_cache", {})
    monkeypatch.setattr(prices, "_table", None)
    monkeypatch.setenv("PRICE_SOURCE", "snowflake")


def test_a_warm_table_answers_every_lookup_without_querying(monkeypatch):
    monkeypatch.setattr(prices, "_query_table", lambda: TABLE)
    monkeypatch.setattr(prices, "_query_snowflake", lambda codes: pytest.fail("the table is already in memory"))
    assert asyncio.run(prices.warm_up()) is True
    found, source, error = asyncio.run(prices.lookup(["99284", "ZZZZZ"]))
    assert found == {"99284": TABLE["99284"]} and source == "snowflake" and error is None  # ZZZZZ has no rate


def test_a_failed_warm_up_leaves_lookups_as_they_were(monkeypatch):
    def unreachable():
        raise RuntimeError("private account details")

    monkeypatch.setattr(prices, "_query_table", unreachable)
    monkeypatch.setattr(prices, "_query_snowflake", lambda codes: {"99284": TABLE["99284"]})
    assert asyncio.run(prices.warm_up()) is False
    assert asyncio.run(prices.lookup(["99284"]))[1] == "snowflake"


def test_csv_mode_never_warms_up_snowflake(monkeypatch):
    monkeypatch.setenv("PRICE_SOURCE", "csv")
    monkeypatch.setattr(prices, "_query_table", lambda: pytest.fail("CSV mode must not reach Snowflake"))
    assert asyncio.run(prices.warm_up()) is False
