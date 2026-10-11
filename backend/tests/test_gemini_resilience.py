"""Exercise Gemini's actual attempt/fallback loop with an offline provider double."""
import asyncio
from types import SimpleNamespace
import pytest
from google.genai import errors
from models import GeminiResult
from services.gemini_services import gemini_service as service

GOOD = GeminiResult(document_type='hospital_bill', total_billed=425, amount_patient_owes=None,
                    plain_summary='A test bill.', spoken_summary='A test bill.')

@pytest.fixture
def provider(monkeypatch):
    calls = []
    def install(replies):
        answers = iter(replies)
        async def generate(**kwargs):
            calls.append(kwargs['model'])
            reply = next(answers)
            if isinstance(reply, BaseException): raise reply
            return reply
        monkeypatch.setattr(service, '_get_client', lambda: SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(generate_content=generate))))
        return calls
    monkeypatch.setenv('MOCK', 'false')
    monkeypatch.setenv('GEMINI_MODEL', 'primary')
    monkeypatch.setenv('GEMINI_FALLBACK_MODEL', 'fallback')
    async def no_delay(_): pass
    monkeypatch.setattr(service.asyncio, 'sleep', no_delay)
    return install

def analyze(): return asyncio.run(service.analyze(text='Synthetic test bill', target_language='en-US'))

@pytest.mark.parametrize('code', [429, 500, 503])
def test_retryable_outage_retries_primary_then_uses_fallback(provider, code):
    calls = provider([errors.APIError(code, {'error': {'message': 'temporary outage'}})] * 2 + [SimpleNamespace(parsed=GOOD, text='')])
    assert analyze() == GOOD
    assert calls == ['primary', 'primary', 'fallback']

@pytest.mark.parametrize('code', [401, 403, 400])
def test_credentials_and_invalid_requests_are_not_retried(provider, code):
    calls = provider([errors.APIError(code, {'error': {'message': 'request refused'}})])
    with pytest.raises(errors.APIError): analyze()
    assert calls == ['primary']

def test_timeout_exhausts_bounded_attempts_and_reports_failure(provider):
    calls = provider([asyncio.TimeoutError()] * 4)
    with pytest.raises(RuntimeError, match='unavailable'): analyze()
    assert calls == ['primary', 'primary', 'fallback', 'fallback']

def test_bad_json_and_missing_required_fields_are_retried(provider):
    calls = provider([SimpleNamespace(parsed=None, text='not JSON'), SimpleNamespace(parsed=None, text='{}'),
                      SimpleNamespace(parsed=None, text=GOOD.model_dump_json())])
    assert analyze() == GOOD
    assert calls == ['primary', 'primary', 'fallback']

def test_unknown_amounts_are_not_invented_by_response_validation(provider):
    provider([SimpleNamespace(parsed=None, text=GOOD.model_dump_json())])
    assert analyze().amount_patient_owes is None

@pytest.mark.parametrize('kwargs', [dict(text=' '), dict(text='bill', target_language='invalid'),
                                     dict(file_bytes=b'fake', mime_type='text/plain')])
def test_invalid_input_is_rejected_before_a_provider_call(provider, kwargs):
    calls = provider([])
    with pytest.raises(ValueError): asyncio.run(service.analyze(**kwargs))
    assert calls == []
