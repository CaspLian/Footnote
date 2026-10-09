import json
import unittest
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from services.tigerdata_service import (
    connect_tiger_data,
    get_bill_audit,
    initialize_tiger_data,
    record_bill_audit,
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


if __name__ == "__main__":
    unittest.main()
