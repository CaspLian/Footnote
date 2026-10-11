"""Cached/offline references must never be reported as a fresh Snowflake source."""
import asyncio
import pytest
from services.snowflake_services import snowflake_service as prices

@pytest.fixture(autouse=True)
def isolated_cache(monkeypatch):
    monkeypatch.setattr(prices, '_lookup_cache', {})

def test_explicit_csv_stays_csv_on_repeated_known_and_unknown_codes(monkeypatch):
    monkeypatch.setenv('PRICE_SOURCE', 'csv')
    monkeypatch.setattr(prices, '_query_snowflake', lambda _: pytest.fail('Snowflake must not be called in CSV mode'))
    first = asyncio.run(prices.lookup(['70450', 'ZZZZZ']))
    second = asyncio.run(prices.lookup(['70450', 'ZZZZZ']))
    assert first == second
    assert second[1] == 'local_csv'
    assert 'ZZZZZ' not in second[0]

def test_failed_snowflake_source_and_safe_warning_survive_cache(monkeypatch):
    monkeypatch.setenv('PRICE_SOURCE', 'snowflake')
    calls = []
    def fail(codes):
        calls.append(codes)
        raise RuntimeError('private account details')
    monkeypatch.setattr(prices, '_query_snowflake', fail)
    first = asyncio.run(prices.lookup(['70450']))
    second = asyncio.run(prices.lookup(['70450']))
    assert first == second
    assert len(calls) == 1
    assert second[1] == 'local_csv'
    assert 'private' not in second[2]

def test_live_source_is_cached_without_requery(monkeypatch):
    monkeypatch.setenv('PRICE_SOURCE', 'snowflake')
    calls = []
    def query(codes):
        calls.append(codes)
        return {'70450': {'rate': 106.55, 'description': 'CT head', 'setting': 'facility'}}
    monkeypatch.setattr(prices, '_query_snowflake', query)
    assert asyncio.run(prices.lookup(['70450'])) == asyncio.run(prices.lookup(['70450']))
    assert len(calls) == 1
    assert asyncio.run(prices.lookup(['70450']))[1] == 'snowflake'

def test_no_codes_do_not_claim_a_provider_was_used():
    assert asyncio.run(prices.lookup([])) == ({}, 'unavailable', None)
