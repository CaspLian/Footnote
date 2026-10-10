"""The claim workflow routes (claim_routes.py) against a throwaway PostgreSQL, and their errors without one.

The lifecycle tests need TIGER_TEST_DATABASE_URL; they never use the team's database.
"""
import os

import pytest
from fastapi.testclient import TestClient

import main

TEST_DB = os.getenv("TIGER_TEST_DATABASE_URL")
needs_db = pytest.mark.skipif(not TEST_DB, reason="set TIGER_TEST_DATABASE_URL to a throwaway PostgreSQL")
UNKNOWN = "00000000-0000-4000-8000-00000000abcd"

CLAIM = {
    "provider_name": "Metropolitan Medical Center", "service_date": "2026-09-14", "total_billed": 3650.0,
    "analysis_audit_id": "00000000-0000-4000-8000-000000000001",
    "items": [
        {"code": "99285", "description": "Emergency room visit", "amount": 2450.0},
        {"code": "70450", "description": "Head CT scan", "amount": 300.0},
    ],
}


@pytest.fixture
def client(monkeypatch):
    # An unreachable local address when there is no test database, so nothing can reach the team's.
    monkeypatch.setenv("TIGER_DATA_POSTGRES_URL", TEST_DB or "postgresql://nobody@127.0.0.1:9/none")
    with TestClient(main.app) as test_client:
        yield test_client


@needs_db
def test_a_claim_goes_through_its_whole_lifecycle(client):
    created = client.post("/api/v1/claims", json=CLAIM)
    assert created.status_code == 200, created.text
    body = created.json()
    claim_id = body["audit_id"]
    assert body["recorded"] is True and body["claim_id"] == CLAIM["analysis_audit_id"]

    for status in ("audit_complete", "dispute_in_progress"):
        changed = client.post(f"/api/v1/claims/{claim_id}/status", json={"status": status})
        assert changed.status_code == 200 and changed.json()["status"] == status
    assert client.post(f"/api/v1/claims/{claim_id}/deadlines", json={"collection_deadline": "2026-12-01"}).status_code == 200
    resolved = client.post(f"/api/v1/claims/{claim_id}/resolve", json={"final_amount": 900})
    assert resolved.status_code == 200 and resolved.json()["status"] == "resolved"

    claim = client.get(f"/api/v1/claims/{claim_id}").json()
    assert claim["status"] == "resolved"
    assert claim["collection_deadline"] == "2026-12-01"
    assert claim["provider"]["name"] == "Metropolitan Medical Center" and claim["service_date"] == "2026-09-14"
    assert [item["code"] for item in claim["items"]] == ["99285", "70450"]
    assert float(claim["total_billed"]) == 3650.0
    assert len(claim["events"]) >= 5  # recorded, two status changes, the deadline, the resolution


@needs_db
def test_unknown_claims_are_404(client):
    assert client.get(f"/api/v1/claims/{UNKNOWN}").status_code == 404
    assert client.post(f"/api/v1/claims/{UNKNOWN}/status", json={"status": "audit_complete"}).status_code == 404
    assert client.post(f"/api/v1/claims/{UNKNOWN}/resolve", json={"final_amount": 1}).status_code == 404


def test_bad_input_is_refused_before_the_database(client):
    assert client.post("/api/v1/claims", json={**CLAIM, "items": []}).status_code == 422
    negative = {**CLAIM, "items": [{"code": "99285", "description": "ER visit", "amount": -1}]}
    assert client.post("/api/v1/claims", json=negative).status_code == 422
    assert client.post(f"/api/v1/claims/{UNKNOWN}/status", json={"status": "closed"}).status_code == 422
    assert client.post("/api/v1/claims/not-a-uuid/status", json={"status": "audit_complete"}).status_code == 400
    assert client.post(f"/api/v1/claims/{UNKNOWN}/deadlines", json={}).status_code == 400  # at least one date
    assert client.post(f"/api/v1/claims/{UNKNOWN}/resolve", json={"final_amount": -5}).status_code == 422


def test_without_tiger_data_the_routes_answer_503_without_the_address(monkeypatch):
    monkeypatch.setenv("TIGER_DATA_POSTGRES_URL", "postgresql://nobody@127.0.0.1:9/none")
    with TestClient(main.app) as test_client:
        response = test_client.post("/api/v1/claims", json=CLAIM)
    assert response.status_code == 503
    assert "127.0.0.1" not in response.text and "nobody" not in response.text
