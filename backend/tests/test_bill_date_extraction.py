import unittest
from datetime import date
from unittest.mock import patch

from fastapi.testclient import TestClient

import main
from services.gemini_service import validate_extracted_bill
from services.timeline import estimate_deadlines


class BillDateExtractionTests(unittest.TestCase):
    def test_parsed_dates_are_normalized_and_optional_due_date_is_kept(self):
        bill = validate_extracted_bill(
            {
                "service_date": "2026-01-10",
                "bill_received_date": "2026-02-01",
                "payment_due_date": "2026-03-01",
                "items": [{"description": "Office visit", "amount": 80}],
            }
        )
        self.assertEqual(bill["service_date"], "2026-01-10")
        self.assertEqual(bill["bill_received_date"], "2026-02-01")
        self.assertEqual(bill["payment_due_date"], "2026-03-01")
        self.assertEqual(bill["total_billed"], 80)

    def test_unknown_source_dates_do_not_create_invented_deadlines(self):
        bill = validate_extracted_bill(
            {
                "service_date": None,
                "bill_received_date": "unknown",
                "items": [{"description": "Office visit", "amount": 80}],
            }
        )
        self.assertEqual(bill["bill_received_date"], None)
        self.assertEqual(estimate_deadlines(None, None), (None, None))

    def test_estimates_use_received_and_service_date_offsets(self):
        self.assertEqual(
            estimate_deadlines(date(2026, 1, 1), date(2026, 1, 10)),
            (date(2026, 5, 1), date(2026, 7, 9)),
        )

    def test_invalid_date_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "service_date"):
            validate_extracted_bill(
                {
                    "service_date": "not-a-date",
                    "items": [{"description": "Office visit", "amount": 80}],
                }
            )

    def test_image_route_passes_gemini_extraction_to_tiger_and_returns_timeline(self):
        parsed = {
            "service_date": "2026-01-10",
            "bill_received_date": "2026-02-01",
            "payment_due_date": "2026-03-01",
            "items": [{"description": "Office visit", "amount": 80}],
        }
        saved_audit = {"audit_id": "audit-123", "collection_deadline": "2026-06-01"}
        with (
            patch.object(main, "analyze_bill_image", return_value=parsed) as gemini,
            patch.object(main, "record_bill_audit", return_value={"audit_id": "audit-123"}) as tiger_write,
            patch.object(main, "get_bill_audit", return_value=saved_audit),
        ):
            response = TestClient(main.app).post(
                "/api/v1/analyze-image",
                files={"file": ("bill.jpg", b"jpeg-bytes", "image/jpeg")},
            )
        self.assertEqual(response.status_code, 200)
        gemini.assert_called_once_with(b"jpeg-bytes", "image/jpeg")
        tiger_write.assert_called_once_with(parsed)
        self.assertEqual(response.json()["audit"], saved_audit)

    def test_image_route_rejects_non_image_upload(self):
        response = TestClient(main.app).post(
            "/api/v1/analyze-image",
            files={"file": ("bill.pdf", b"pdf", "application/pdf")},
        )
        self.assertEqual(response.status_code, 415)


if __name__ == "__main__":
    unittest.main()
