import unittest
from uuid import UUID

from fastapi.testclient import TestClient

from main import app
from services.tigerdata_service import connect_tiger_data


class ManualCaseApiIntegrationTests(unittest.TestCase):
    def test_manual_case_deadlines_and_audit_events_use_tiger_data(self) -> None:
        client = TestClient(app)
        audit_id = None
        try:
            response = client.post(
                "/api/v1/audits/manual",
                json={
                    "provider_name": "Example Hospital",
                    "service_date": "2026-09-15",
                    "bill_received_date": "2026-10-01",
                    "payment_due_date": "2026-11-01",
                },
            )
            self.assertEqual(response.status_code, 201, response.text)
            created = response.json()
            audit_id = UUID(created["audit_id"])
            self.assertEqual(created["case_type"], "manual_case")
            self.assertEqual(created["collection_deadline"], "2027-01-29")
            self.assertEqual(created["credit_warning_date"], "2027-03-14")
            self.assertEqual(created["payment_due_date"], "2026-11-01")
            self.assertEqual(
                created["events"][0]["event_type"], "manual_case_created"
            )

            deadline_update = client.patch(
                f"/api/v1/audits/{audit_id}/deadlines",
                json={
                    "collection_deadline": "2027-02-10",
                    "payment_due_date": None,
                },
            )
            self.assertEqual(deadline_update.status_code, 200, deadline_update.text)

            status_update = client.patch(
                f"/api/v1/audits/{audit_id}/status",
                json={"status": "dispute_in_progress"},
            )
            self.assertEqual(status_update.status_code, 200, status_update.text)
            action = client.post(
                f"/api/v1/audits/{audit_id}/actions",
                json={
                    "action": "Dispute letter generated",
                    "note": "Logged from the app",
                },
            )
            self.assertEqual(action.status_code, 201, action.text)

            fetched = client.get(f"/api/v1/audits/{audit_id}")
            self.assertEqual(fetched.status_code, 200, fetched.text)
            audit = fetched.json()
            self.assertEqual(audit["audit_id"], str(audit_id))
            self.assertEqual(audit["provider"]["name"], "Example Hospital")
            self.assertEqual(audit["collection_deadline"], "2027-02-10")
            self.assertIsNone(audit["payment_due_date"])
            self.assertEqual(audit["status"], "dispute_in_progress")
            self.assertEqual(
                [event["event_type"] for event in audit["events"]],
                [
                    "manual_case_created",
                    "deadlines_set",
                    "dispute_in_progress",
                    "dispute_letter_generated",
                ],
            )
            self.assertIsNotNone(audit["collection_days_remaining"])
            self.assertIsNotNone(audit["credit_warning_days_remaining"])

            resolved = client.patch(
                f"/api/v1/audits/{audit_id}/status",
                json={"status": "resolved"},
            )
            self.assertEqual(resolved.status_code, 200, resolved.text)
            final_audit = client.get(f"/api/v1/audits/{audit_id}").json()
            self.assertEqual(final_audit["status"], "resolved")
            self.assertIsNone(final_audit["collection_days_remaining"])
            self.assertIsNone(final_audit["credit_warning_days_remaining"])
            self.assertEqual(final_audit["events"][-1]["event_type"], "resolved")
        finally:
            if audit_id is not None:
                conn = connect_tiger_data()
                try:
                    with conn:
                        with conn.cursor() as cursor:
                            cursor.execute(
                                "DELETE FROM audit_records WHERE audit_id = %s",
                                (str(audit_id),),
                            )
                finally:
                    conn.close()
