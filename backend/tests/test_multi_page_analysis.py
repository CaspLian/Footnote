import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx
from google.genai import types

import main
from models import GeminiResult, PriceSummary
from services import gemini_service


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "multi_page_gemini_response.json"
FIXTURE_JSON = FIXTURE_PATH.read_text(encoding="utf-8")
FIXTURE_RESULT = GeminiResult.model_validate_json(FIXTURE_JSON)


class FakeGeminiModels:
    def __init__(self):
        self.contents = None
        self.model = None
        self.config = None

    async def generate_content(self, *, model, contents, config):
        self.model = model
        self.contents = contents
        self.config = config
        return SimpleNamespace(parsed=FIXTURE_RESULT, text=FIXTURE_JSON)


class GeminiMultiPageTests(unittest.IsolatedAsyncioTestCase):
    async def test_analyze_sends_every_attachment_in_order_and_returns_cross_page_data(self):
        fake_models = FakeGeminiModels()
        fake_client = SimpleNamespace(aio=SimpleNamespace(models=fake_models))

        with (
            patch.object(gemini_service, "_get_client", return_value=fake_client),
            patch.object(gemini_service, "is_mock", return_value=False),
            patch.object(gemini_service, "ATTEMPT_TIMEOUT_S", 1),
        ):
            result = await gemini_service.analyze(
                files=[
                    (b"page one", "image/jpeg"),
                    (b"page two", "image/png"),
                    (b"pages three and four", "application/pdf"),
                ]
            )

        self.assertIs(result, FIXTURE_RESULT)
        self.assertTrue(fake_models.model)
        self.assertEqual(fake_models.config.response_mime_type, "application/json")
        self.assertIs(fake_models.config.response_schema, GeminiResult)
        attachments = [
            part.inline_data
            for part in fake_models.contents
            if isinstance(part, types.Part) and part.inline_data is not None
        ]
        self.assertEqual(
            [(attachment.data, attachment.mime_type) for attachment in attachments],
            [
                (b"page one", "image/jpeg"),
                (b"page two", "image/png"),
                (b"pages three and four", "application/pdf"),
            ],
        )
        self.assertIn("all uploaded attachments together", fake_models.contents[0])
        self.assertEqual(result.line_items[0].remark_codes, ["N362"])
        self.assertEqual(result.remark_code_details[0].related_cpt_codes, ["70450"])
        self.assertEqual(result.denial_reasons[0].denial_code, "CO-197")
        self.assertEqual(result.appeal_deadlines[0].days_allowed, 180)
        self.assertIsNone(result.appeal_deadlines[0].deadline_date)

    async def test_existing_single_file_service_arguments_remain_supported(self):
        fake_models = FakeGeminiModels()
        fake_client = SimpleNamespace(aio=SimpleNamespace(models=fake_models))

        with (
            patch.object(gemini_service, "_get_client", return_value=fake_client),
            patch.object(gemini_service, "is_mock", return_value=False),
            patch.object(gemini_service, "ATTEMPT_TIMEOUT_S", 1),
        ):
            await gemini_service.analyze(file_bytes=b"pdf", mime_type="application/pdf")

        attachment = next(
            part.inline_data
            for part in fake_models.contents
            if isinstance(part, types.Part) and part.inline_data is not None
        )
        self.assertEqual((attachment.data, attachment.mime_type), (b"pdf", "application/pdf"))

    async def test_existing_mock_response_still_validates_with_new_optional_fields(self):
        result = GeminiResult.model_validate_json(
            gemini_service.MOCK_PATH.read_text(encoding="utf-8")
        )

        self.assertIsNone(result.provider_zip_code)
        self.assertEqual(result.remark_code_details, [])
        self.assertEqual(result.denial_reasons, [])
        self.assertEqual(result.appeal_deadlines, [])
        self.assertEqual(result.balance_billing_notices, [])
        self.assertEqual(result.line_items[0].diagnosis_codes, [])
        self.assertEqual(result.line_items[0].remark_codes, [])

    async def test_invalid_attachment_mime_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unsupported file type"):
            await gemini_service.analyze(files=[(b"not an image", "text/plain")])


class AnalyzeEndpointMultiPageTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.analyze = AsyncMock(return_value=FIXTURE_RESULT)
        self.check_prices = AsyncMock(
            return_value=([], PriceSummary(source="unavailable"))
        )
        self.patches = (
            patch.object(main, "analyze", self.analyze),
            patch.object(main, "check_prices", self.check_prices),
            patch.object(main, "suggest_letter", return_value=[]),
        )
        for patcher in self.patches:
            patcher.start()
            self.addCleanup(patcher.stop)

    async def asyncSetUp(self):
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=main.app),
            base_url="http://test",
        )

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_repeated_files_are_forwarded_to_service_in_multipart_order(self):
        response = await self.client.post(
            "/api/v1/analyze",
            files=[
                ("files", ("page-1.jpg", b"page one", "image/jpeg")),
                ("files", ("page-2.png", b"page two", "image/png")),
            ],
        )

        self.assertEqual(response.status_code, 200, response.text)
        kwargs = self.analyze.await_args.kwargs
        self.assertEqual(
            kwargs["files"],
            [(b"page one", "image/jpeg"), (b"page two", "image/png")],
        )
        self.assertEqual(response.json()["result"]["remark_code_details"][0]["code"], "N362")

    async def test_legacy_file_field_is_still_accepted(self):
        response = await self.client.post(
            "/api/v1/analyze",
            files={"file": ("bill.pdf", b"bill pages", "application/pdf")},
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            self.analyze.await_args.kwargs["files"],
            [(b"bill pages", "application/pdf")],
        )

    async def test_combined_upload_size_is_limited(self):
        with patch.object(main, "MAX_UPLOAD_MB", 1):
            response = await self.client.post(
                "/api/v1/analyze",
                files=[
                    ("files", ("page-1.jpg", b"a" * (600 * 1024), "image/jpeg")),
                    ("files", ("page-2.jpg", b"b" * (600 * 1024), "image/jpeg")),
                ],
            )

        self.assertEqual(response.status_code, 413, response.text)
        self.assertIn("Combined upload", response.json()["detail"])
        self.analyze.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
