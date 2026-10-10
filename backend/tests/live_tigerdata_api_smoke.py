"""Run an end-to-end Tiger Data smoke test and retain its synthetic audit."""

from datetime import datetime, timezone

from fastapi.testclient import TestClient

from main import app


def main() -> None:
    provider_name = (
        "ClaimPulse live Tiger Data API test "
        + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    )
    client = TestClient(app)
    created_response = client.post(
        "/api/v1/audits/manual",
        json={
            "provider_name": provider_name,
            "service_date": "2026-09-15",
            "bill_received_date": "2026-10-01",
            "payment_due_date": "2026-11-01",
        },
    )
    assert created_response.status_code == 201, created_response.text
    audit = created_response.json()
    audit_id = audit["audit_id"]
    print(f"Created retained synthetic Tiger Data audit: {audit_id}")

    deadline_response = client.patch(
        f"/api/v1/audits/{audit_id}/deadlines",
        json={"collection_deadline": "2027-02-10"},
    )
    assert deadline_response.status_code == 200, deadline_response.text

    status_response = client.patch(
        f"/api/v1/audits/{audit_id}/status",
        json={"status": "dispute_in_progress"},
    )
    assert status_response.status_code == 200, status_response.text

    for action in ("Overcharge flagged", "Dispute letter generated"):
        action_response = client.post(
            f"/api/v1/audits/{audit_id}/actions",
            json={"action": action, "note": "Synthetic live API verification."},
        )
        assert action_response.status_code == 201, action_response.text

    fetched_response = client.get(f"/api/v1/audits/{audit_id}")
    assert fetched_response.status_code == 200, fetched_response.text
    saved = fetched_response.json()
    assert saved["provider"]["name"] == provider_name
    assert saved["status"] == "dispute_in_progress"
    assert saved["payment_due_date"] == "2026-11-01"
    assert saved["collection_deadline"] == "2027-02-10"
    assert saved["collection_days_remaining"] is not None
    assert saved["credit_warning_days_remaining"] is not None
    assert [event["event_type"] for event in saved["events"]] == [
        "manual_case_created",
        "deadlines_set",
        "dispute_in_progress",
        "overcharge_flagged",
        "dispute_letter_generated",
    ]

    print(f"Provider marker: {provider_name}")
    print(f"Verified status: {saved['status']}")
    print(f"Verified timeline events: {len(saved['events'])}")
    print("Record retained in Tiger Data for SQL inspection.")


if __name__ == "__main__":
    main()
