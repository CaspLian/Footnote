import json
import unittest
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from services.tigerdata_services.tigerdata_service import (
    connect_tiger_data,
    get_database_snapshot,
    get_bill_audit,
    initialize_tiger_data,
    record_bill_audit,
    resolve_claim,
    set_claim_deadlines,
    update_claim_status,
)


BACKEND_DIR = Path(__file__).resolve().parents[1]


class TigerDataAuditIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        initialize_tiger_data()
        with (BACKEND_DIR / "mock_bill.json").open(encoding="utf-8") as bill_file:
            cls.mock_bill = json.load(bill_file)

    def test_mock_bill_is_persisted_without_benchmark_data(self) -> None:
        region = f"TEST-{uuid4().hex}"
        audit_id = None

        try:
            result = record_bill_audit(self.mock_bill, region=region)
            audit_id = result["audit_id"]

            self.assertTrue(result["recorded"])
            self.assertEqual(result["claim_id"], "CLM-2026-0001")
            self.assertEqual(result["region"], region.upper())
            self.assertEqual(result["total_billed"], Decimal("425.00"))
            self.assertEqual(result["overcharge_total"], Decimal("0.00"))
            self.assertEqual(len(result["items"]), 2)
            self.assertEqual(
                [item["code"] for item in result["items"]], ["99213", "80053"]
            )

            for item in result["items"]:
                self.assertIsNone(item["benchmark_amount"])
                self.assertFalse(item["benchmark_found"])
                self.assertFalse(item["flagged"])
                self.assertEqual(item["overcharge"], Decimal("0.00"))

            saved = get_bill_audit(audit_id)
            self.assertIsNotNone(saved)
            assert saved is not None
            self.assertEqual(saved["audit_id"], audit_id)
            self.assertEqual(saved["claim_id"], self.mock_bill["claim_id"])
            self.assertEqual(
                saved["provider"],
                {"name": "Example Medical Center", "npi": "1234567890"},
            )
            self.assertEqual(saved["service_date"], "2026-09-15")
            self.assertEqual(saved["currency"], "USD")
            self.assertEqual(saved["total_billed"], Decimal("425.00"))
            self.assertEqual(saved["overcharge_total"], Decimal("0.00"))
            self.assertEqual(saved["status"], "audit_complete")
            self.assertEqual(
                [event["event_type"] for event in saved["events"]],
                ["bill_scanned", "audit_completed"],
            )
            self.assertEqual(
                [item["description"] for item in saved["items"]],
                ["Office visit", "Laboratory services"],
            )
            for item in saved["items"]:
                self.assertIsNone(item["benchmark_amount"])
                self.assertFalse(item["benchmark_found"])
                self.assertFalse(item["flagged"])
        finally:
            if audit_id is not None:
                conn = connect_tiger_data()
                try:
                    with conn:
                        with conn.cursor() as cursor:
                            cursor.execute(
                                "DELETE FROM audit_records WHERE audit_id = %s",
                                (audit_id,),
                            )
                finally:
                    conn.close()

    def test_missing_audit_returns_none(self) -> None:
        self.assertIsNone(get_bill_audit(uuid4()))

    def test_status_update_is_saved_with_timeline_event(self) -> None:
        result = record_bill_audit(self.mock_bill)
        audit_id = result["audit_id"]

        try:
            update_claim_status(
                audit_id,
                "dispute_in_progress",
                {"action": "dispute letter sent"},
            )
            saved = get_bill_audit(audit_id)

            self.assertIsNotNone(saved)
            assert saved is not None
            self.assertEqual(saved["status"], "dispute_in_progress")
            self.assertEqual(
                [event["event_type"] for event in saved["events"]],
                ["bill_scanned", "audit_completed", "dispute_in_progress"],
            )
            self.assertEqual(
                saved["events"][-1]["previous_status"], "audit_complete"
            )
            self.assertEqual(
                saved["events"][-1]["details"],
                {"action": "dispute letter sent"},
            )
        finally:
            conn = connect_tiger_data()
            try:
                with conn:
                    with conn.cursor() as cursor:
                        cursor.execute(
                            "DELETE FROM audit_records WHERE audit_id = %s",
                            (audit_id,),
                        )
            finally:
                conn.close()

    def test_deadlines_are_stored_and_return_database_countdowns(self) -> None:
        result = record_bill_audit(self.mock_bill)
        audit_id = result["audit_id"]
        conn = connect_tiger_data()
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT CURRENT_DATE")
                database_today = cursor.fetchone()[0]
        finally:
            conn.close()

        collection_deadline = database_today + timedelta(days=45)
        credit_warning_date = database_today + timedelta(days=180)
        try:
            set_claim_deadlines(
                audit_id,
                collection_deadline=collection_deadline,
                credit_warning_date=credit_warning_date,
            )
            saved = get_bill_audit(audit_id)

            self.assertIsNotNone(saved)
            assert saved is not None
            self.assertEqual(
                saved["collection_deadline"], collection_deadline.isoformat()
            )
            self.assertEqual(
                saved["credit_warning_date"], credit_warning_date.isoformat()
            )
            self.assertEqual(saved["collection_days_remaining"], 45)
            self.assertEqual(saved["credit_warning_days_remaining"], 180)
            self.assertEqual(saved["events"][-1]["event_type"], "deadlines_set")
        finally:
            conn = connect_tiger_data()
            try:
                with conn:
                    with conn.cursor() as cursor:
                        cursor.execute(
                            "DELETE FROM audit_records WHERE audit_id = %s",
                            (audit_id,),
                        )
            finally:
                conn.close()

    def test_resolution_records_final_amount_savings_and_stops_countdowns(self) -> None:
        result = record_bill_audit(self.mock_bill)
        audit_id = result["audit_id"]
        conn = connect_tiger_data()
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT CURRENT_DATE")
                database_today = cursor.fetchone()[0]
        finally:
            conn.close()

        try:
            set_claim_deadlines(
                audit_id,
                collection_deadline=database_today + timedelta(days=45),
                credit_warning_date=database_today + timedelta(days=180),
            )
            update_claim_status(audit_id, "dispute_in_progress")
            resolution = resolve_claim(audit_id, final_amount="300.00")
            with self.assertRaisesRegex(ValueError, "already resolved"):
                resolve_claim(audit_id, final_amount="250.00")
            with self.assertRaisesRegex(ValueError, "resolved claim"):
                update_claim_status(audit_id, "dispute_in_progress")
            saved = get_bill_audit(audit_id)

            self.assertEqual(resolution["status"], "resolved")
            self.assertEqual(resolution["final_settled_amount"], Decimal("300.00"))
            self.assertEqual(resolution["savings_amount"], Decimal("125.00"))
            self.assertIsNotNone(saved)
            assert saved is not None
            self.assertEqual(saved["status"], "resolved")
            self.assertEqual(saved["final_settled_amount"], Decimal("300.00"))
            self.assertEqual(saved["savings_amount"], Decimal("125.00"))
            self.assertIsNotNone(saved["resolved_at"])
            self.assertIsNone(saved["collection_days_remaining"])
            self.assertIsNone(saved["credit_warning_days_remaining"])
            self.assertEqual(saved["events"][-1]["event_type"], "resolved")
            self.assertEqual(
                saved["events"][-1]["details"]["savings_amount"], "125.00"
            )
        finally:
            conn = connect_tiger_data()
            try:
                with conn:
                    with conn.cursor() as cursor:
                        cursor.execute(
                            "DELETE FROM audit_records WHERE audit_id = %s",
                            (audit_id,),
                        )
            finally:
                conn.close()

    def test_database_snapshot_shows_the_created_mock_bill_rows(self) -> None:
        result = record_bill_audit(self.mock_bill)
        audit_id = result["audit_id"]

        try:
            conn = connect_tiger_data()
            try:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT CURRENT_DATE")
                    database_today = cursor.fetchone()[0]
            finally:
                conn.close()
            set_claim_deadlines(
                audit_id,
                collection_deadline=database_today + timedelta(days=12),
                credit_warning_date=database_today + timedelta(days=90),
            )
            snapshot = get_database_snapshot(limit=100)
            self.assertEqual(snapshot["schema"], "public")
            self.assertIn("audit_records", snapshot["tables"])
            self.assertIn("audit_line_items", snapshot["tables"])
            self.assertIn("audit_events", snapshot["tables"])

            audit_rows = [
                row
                for row in snapshot["audit_records"]
                if row["audit_id"] == audit_id
            ]
            self.assertEqual(len(audit_rows), 1)
            self.assertEqual(audit_rows[0]["claim_id"], "CLM-2026-0001")
            self.assertEqual(audit_rows[0]["total_billed"], Decimal("425.00"))
            self.assertEqual(audit_rows[0]["collection_days_remaining"], 12)
            self.assertEqual(audit_rows[0]["credit_warning_days_remaining"], 90)

            line_items = [
                row
                for row in snapshot["audit_line_items"]
                if row["audit_id"] == audit_id
            ]
            self.assertEqual(
                [(row["code"], row["description"], row["amount"]) for row in line_items],
                [
                    ("99213", "Office visit", Decimal("175.00")),
                    ("80053", "Laboratory services", Decimal("250.00")),
                ],
            )
            timeline = [
                row
                for row in snapshot["audit_events"]
                if row["audit_id"] == audit_id
            ]
            self.assertEqual(
                [event["event_type"] for event in timeline],
                ["bill_scanned", "audit_completed", "deadlines_set"],
            )
        finally:
            conn = connect_tiger_data()
            try:
                with conn:
                    with conn.cursor() as cursor:
                        cursor.execute(
                            "DELETE FROM audit_records WHERE audit_id = %s",
                            (audit_id,),
                        )
            finally:
                conn.close()

    def test_schema_initialization_migrates_pre_timeline_audits(self) -> None:
        result = record_bill_audit(self.mock_bill)
        audit_id = result["audit_id"]
        conn = connect_tiger_data()
        try:
            with conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "DELETE FROM audit_events WHERE audit_id = %s",
                        (audit_id,),
                    )
                    cursor.execute(
                        """
                        UPDATE audit_records
                        SET status = 'scanned'
                        WHERE audit_id = %s
                        """,
                        (audit_id,),
                    )

            initialize_tiger_data()
            saved = get_bill_audit(audit_id)
            self.assertIsNotNone(saved)
            assert saved is not None
            self.assertEqual(saved["status"], "audit_complete")
            self.assertEqual(
                [event["event_type"] for event in saved["events"]],
                ["legacy_audit_migrated"],
            )
        finally:
            with conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "DELETE FROM audit_records WHERE audit_id = %s",
                        (audit_id,),
                    )
            conn.close()


class TigerDataInputValidationTests(unittest.TestCase):
    def test_empty_items_are_rejected_before_connecting(self) -> None:
        with self.assertRaisesRegex(ValueError, "non-empty list"):
            record_bill_audit({"items": []})

    def test_invalid_item_amount_is_rejected_before_connecting(self) -> None:
        claim = {
            "items": [
                {"code": "99213", "description": "Office visit", "amount": "invalid"}
            ]
        }
        with self.assertRaisesRegex(ValueError, "valid monetary amount"):
            record_bill_audit(claim)

    def test_invalid_status_is_rejected_before_connecting(self) -> None:
        with self.assertRaisesRegex(ValueError, "new_status must be"):
            update_claim_status(uuid4(), "made_up_status")

    def test_at_least_one_deadline_is_required(self) -> None:
        with self.assertRaisesRegex(ValueError, "At least one deadline"):
            set_claim_deadlines(uuid4())

    def test_negative_settlement_is_rejected_before_connecting(self) -> None:
        with self.assertRaisesRegex(ValueError, "non-negative"):
            resolve_claim(uuid4(), final_amount="-1.00")


if __name__ == "__main__":
    unittest.main()
