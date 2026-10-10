"""GET /api/v1/benchmarks/{cpt_code}: the app's lookup for one code (the CSV here; no network, no Gemini)."""
import pytest
from fastapi.testclient import TestClient

import main
from services.snowflake_services import snowflake_service


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("PRICE_SOURCE", "csv")
    snowflake_service._lookup_cache.clear()
    with TestClient(main.app) as test_client:
        yield test_client
    snowflake_service._lookup_cache.clear()


def test_a_known_code_returns_its_medicare_rate(client):
    expected = snowflake_service._query_csv(["70450"])["70450"]
    body = client.get("/api/v1/benchmarks/70450").json()
    assert body["cpt_code"] == "70450"
    assert body["medicare_rate"] == expected["rate"]
    assert body["medicare_description"] == expected["description"]
    assert body["setting"] == expected["setting"]
    assert body["source"] == "local_csv"
    assert body["error"] is None


def test_the_code_is_normalised_like_the_price_check(client):
    assert client.get("/api/v1/benchmarks/ 70450-").json()["cpt_code"] == "70450"


def test_an_unknown_code_has_a_null_rate_not_zero(client):
    body = client.get("/api/v1/benchmarks/ZZZZZ").json()
    assert body["medicare_rate"] is None
    assert body["medicare_description"] is None


def test_text_that_is_not_a_code_is_refused(client):
    response = client.get("/api/v1/benchmarks/12")
    assert response.status_code == 400
