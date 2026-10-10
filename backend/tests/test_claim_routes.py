"""The claim workflow routes (claim_routes.py) against a throwaway PostgreSQL, and their errors without one.

The lifecycle tests need TIGER_TEST_DATABASE_URL; they never use the team's database.
"""
import os
from datetime import date, timedelta
from urllib.parse import quote

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


SCHEMA = "claim_route_tests"  # its own schema: the Tiger Data tests' snapshot of public stays theirs


def _schema_url(url):
    import psycopg2

    conn = psycopg2.connect(url, connect_timeout=10)
    conn.autocommit = True
    with conn.cursor() as cursor:
        cursor.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")
    conn.close()
    return url + ("&" if "?" in url else "?") + "options=" + quote(f"-c search_path={SCHEMA}")


@pytest.fixture
def client(monkeypatch):
    # An unreachable local address when there is no test database, so nothing can reach the team's.
    monkeypatch.setenv("TIGER_DATA_POSTGRES_URL", _schema_url(TEST_DB) if TEST_DB else "postgresql://nobody@127.0.0.1:9/none")
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


@needs_db
def test_deadlines_are_estimated_from_the_bills_dates_and_a_correction_replaces_them(client):
    created = client.post("/api/v1/claims", json={**CLAIM, "service_date": "2026-09-14", "bill_received_date": "2026-10-01",
                                                  "payment_due_date": "2026-11-01"})
    assert created.status_code == 200, created.text
    claim_id = created.json()["audit_id"]
    claim = client.get(f"/api/v1/claims/{claim_id}").json()
    assert claim["credit_warning_date"] == (date(2026, 9, 14) + timedelta(days=180)).isoformat()
    assert claim["collection_deadline"] == (date(2026, 10, 1) + timedelta(days=120)).isoformat()
    assert claim["credit_warning_date_is_estimate"] is True and claim["collection_deadline_is_estimate"] is True
    assert claim["payment_due_date"] == "2026-11-01"

    # PATCH, as in the Tiger Data notes: the user's own date from a notice replaces the estimate.
    assert client.patch(f"/api/v1/claims/{claim_id}/deadlines", json={"collection_deadline": "2026-12-15"}).status_code == 200
    claim = client.get(f"/api/v1/claims/{claim_id}").json()
    assert claim["collection_deadline"] == "2026-12-15" and claim["collection_deadline_is_estimate"] is False
    assert claim["credit_warning_date_is_estimate"] is True


@needs_db
def test_a_missing_date_is_never_invented(client):
    claim_id = client.post("/api/v1/claims", json={k: v for k, v in CLAIM.items() if k != "service_date"}).json()["audit_id"]
    claim = client.get(f"/api/v1/claims/{claim_id}").json()
    assert claim["collection_deadline"] is None and claim["credit_warning_date"] is None


@needs_db
def test_user_actions_and_status_notes_join_the_timeline(client):
    claim_id = client.post("/api/v1/claims", json=CLAIM).json()["audit_id"]
    action = client.post(f"/api/v1/claims/{claim_id}/actions", json={"action": "Called provider", "note": "Asked for an itemized bill"})
    assert action.status_code == 201 and action.json()["action"] == "Called provider"
    assert client.patch(f"/api/v1/claims/{claim_id}/status", json={"status": "dispute_in_progress", "note": "Sent a letter"}).status_code == 200
    kinds = [event.get("event_type") or event.get("type") for event in client.get(f"/api/v1/claims/{claim_id}").json()["events"]]
    assert "user_action" in kinds and "dispute_in_progress" in kinds
    assert client.post(f"/api/v1/claims/{claim_id}/actions", json={"action": ""}).status_code == 422


@needs_db
def test_a_bill_photo_records_only_complete_lines_and_keeps_every_line_read(client, monkeypatch):
    from services.gemini_services import bill_image

    extracted = {"claim_id": None, "provider": {"name": "Riverside Clinic", "npi": None}, "service_date": "2026-09-14",
                 "bill_received_date": "2026-10-01", "payment_due_date": None, "total_billed": 500.0, "currency": "USD",
                 "items": [{"description": "Office visit", "code": "99213", "amount": 300.0},
                           {"description": "Facility fee", "code": None, "amount": 150.0},
                           {"description": "Supplies", "code": "UNKNOWN", "amount": 50.0}]}
    monkeypatch.setattr(bill_image, "analyze_bill_image", lambda image, mime: extracted)  # no Gemini call
    response = client.post("/api/v1/analyze-image", files={"file": ("bill.jpg", b"\xff\xd8\xff" + b"0" * 100, "image/jpeg")})
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body["extracted_bill"]["items"]) == 3  # every line Gemini read
    assert [item["code"] for item in body["audit"]["items"]] == ["99213"]  # only the complete one is recorded
    assert float(body["audit"]["total_billed"]) == 500.0  # the bill's real total
    assert body["audit"]["credit_warning_date"] == (date(2026, 9, 14) + timedelta(days=180)).isoformat()


def test_the_bill_photo_route_refuses_what_is_not_an_image(client):
    assert client.post("/api/v1/analyze-image", files={"file": ("bill.txt", b"hello", "text/plain")}).status_code == 415
    assert client.post("/api/v1/analyze-image", files={"file": ("empty.jpg", b"", "image/jpeg")}).status_code == 413


class _QuotaError(Exception):
    code = 429  # like google.genai.errors.ClientError for RESOURCE_EXHAUSTED


@needs_db
def test_a_used_up_quota_falls_back_to_the_fallback_model(client, monkeypatch):
    from services.gemini_services import bill_image

    extracted = {"provider": {}, "service_date": "2026-09-14", "bill_received_date": None, "payment_due_date": None,
                 "total_billed": 300.0, "currency": "USD", "items": [{"description": "Office visit", "code": "99213", "amount": 300.0}]}
    models = []

    def fake(image, mime, model=None):
        models.append(model)
        if model is None:
            raise _QuotaError("429 RESOURCE_EXHAUSTED")
        return extracted

    monkeypatch.setattr(bill_image, "analyze_bill_image", fake)
    monkeypatch.setenv("GEMINI_FALLBACK_MODEL", "gemini-fallback")
    response = client.post("/api/v1/analyze-image", files={"file": ("bill.jpg", b"\xff\xd8\xff" + b"0" * 100, "image/jpeg")})
    assert response.status_code == 200, response.text
    assert models == [None, "gemini-fallback"]


def test_when_every_model_is_out_of_quota_the_message_says_so(client, monkeypatch):
    from services.gemini_services import bill_image

    def fake(image, mime, model=None):
        raise _QuotaError("429 RESOURCE_EXHAUSTED")

    monkeypatch.setattr(bill_image, "analyze_bill_image", fake)
    monkeypatch.setenv("GEMINI_FALLBACK_MODEL", "gemini-fallback")
    response = client.post("/api/v1/analyze-image", files={"file": ("bill.jpg", b"\xff\xd8\xff" + b"0" * 100, "image/jpeg")})
    assert response.status_code == 503 and "quota" in response.json()["detail"]
