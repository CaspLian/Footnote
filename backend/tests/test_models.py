"""Gemini sometimes writes the text "null" instead of a JSON null (seen live on 2026-10-10 for a line without a
code). Those placeholder texts must arrive in the app, the price check and the saved record as real nulls."""
import asyncio
import json

import pytest

from models import GeminiResult, LineItem
from services.snowflake_services import snowflake_service


@pytest.mark.parametrize("placeholder", ["null", "NULL", " null ", "None", "", "n/a", "N/A"])
def test_placeholder_texts_become_null(placeholder):
    item = LineItem(cpt_code=placeholder, original_description="MED SUPPLIES", plain_description="Supplies",
                    date_of_service=placeholder)
    assert item.cpt_code is None
    assert item.date_of_service is None


def test_real_values_are_kept():
    item = LineItem(cpt_code="70450", original_description="CT HEAD", plain_description="Head CT",
                    date_of_service="2026-09-14")
    assert item.cpt_code == "70450"
    assert item.date_of_service == "2026-09-14"


def test_a_gemini_answer_with_null_texts_parses_to_nulls():
    answer = {
        "document_type": "hospital_bill", "provider_name": "null", "due_date": "None",
        "line_items": [{"cpt_code": "null", "original_description": "MED SUPPLIES", "plain_description": "Supplies",
                        "billed_amount": 85.0}],
        "plain_summary": "A short summary.", "spoken_summary": "A short summary.", "questions_to_ask": [],
    }
    result = GeminiResult.model_validate_json(json.dumps(answer))
    assert result.provider_name is None
    assert result.due_date is None
    assert result.line_items[0].cpt_code is None


def test_a_line_whose_code_was_null_text_is_flagged_no_code(monkeypatch):
    monkeypatch.setenv("PRICE_SOURCE", "csv")
    line = LineItem(cpt_code="null", original_description="MED SUPPLIES", plain_description="Supplies", billed_amount=85.0)
    checks, _summary = asyncio.run(snowflake_service.check_prices([line]))
    assert checks[0].cpt_code is None
    assert checks[0].flag == "no_code"


def test_separate_bill_and_eob_financial_evidence_round_trips_without_merging():
    result = GeminiResult.model_validate({
        'document_type': 'hospital_bill', 'plain_summary': 'Different services.', 'spoken_summary': 'Summary.',
        'documents': [{'document_index': 1, 'document_type': 'hospital_bill'}, {'document_index': 2, 'document_type': 'eob'}],
        'documents_match': False, 'document_mismatch_reason': 'The EOB includes an MRI.',
        'financials': {'statement_billed': 2670, 'bill_adjustments': 1440, 'after_bill_adjustments': 1230,
                       'statement_insurer_paid': 686, 'prior_patient_payment': 50, 'statement_balance': 494,
                       'eob_billed': 8450, 'eob_allowed': 6550, 'eob_insurer_paid': 2840, 'eob_patient_responsibility': 3710, 'copay_coinsurance': 710},
        'line_items': [{'original_description': 'Visit', 'plain_description': 'Visit', 'document_index': 1, 'source_page': 4}],
    })
    saved = GeminiResult.model_validate_json(result.model_dump_json())
    assert saved.financials.statement_balance == 494
    assert saved.financials.prior_patient_payment == 50
    assert saved.financials.eob_patient_responsibility == 3710
    assert saved.financials.statement_insurer_paid != saved.financials.eob_insurer_paid
    assert saved.financials.copayment is None
    assert saved.financials.coinsurance is None
    assert saved.financials.copay_coinsurance == 710
    assert saved.documents_match is False
    assert saved.documents[1].document_type == 'eob'
    assert saved.line_items[0].source_page == 4
    assert saved.line_items[0].document_index == 1
