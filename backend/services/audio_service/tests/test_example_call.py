"""The example call: two verified voices, the bill's facts only, made once and reused."""
import asyncio

import pytest

import example_call as module
from text_to_speech.voices import load_catalog

ANALYSIS = {"target_language": "es-MX", "mock": False, "model": "test",
            "result": {"document_type": "hospital_bill", "provider_name": "Northline Medical Center", "total_billed": 2670,
                       "amount_patient_owes": 494, "due_date": None,
                       "line_items": [{"cpt_code": "80053", "original_description": "Metabolic panel", "plain_description": "Blood test",
                                       "billed_amount": 250, "possible_issues": ["Listed twice"]}],
                       "plain_summary": "A test bill.", "spoken_summary": "A test bill.", "questions_to_ask": ["Why is the blood test listed twice?"]},
            "price_checks": []}
TURNS = [{"speaker": "representative", "text": "[friendly] Oficina de facturación, ¿en qué le ayudo?"},
         {"speaker": "patient", "text": "[calm] Llamo por mi factura de Northline: el análisis de 250 dólares aparece dos veces."},
         {"speaker": "representative", "text": "Lo reviso. Puedo enviarle una factura detallada."},
         {"speaker": "patient", "text": "Gracias. ¿Me da un número de referencia?"}]


@pytest.fixture(autouse=True)
def fresh(monkeypatch):
    module._done.clear()
    module._making.clear()
    stored = []
    monkeypatch.setattr(module, "store_audio", lambda audio: stored.append(audio) or "a" * 32)
    return stored


def make(writer, performer, **kwargs):
    options = dict(audit_id="saved-id", locale="es-MX", language_name="Spanish (Mexico)", voice=None, counterpart="billing")
    options.update(kwargs)
    return asyncio.run(module.example_call(ANALYSIS, writer=writer, performer=performer, config=object(), **options))


def test_two_different_voices_verified_for_the_language_perform_it():
    catalog = load_catalog()
    patient, representative = module.call_voices(catalog, "es-MX", None)
    assert patient.key == "anamaria" and representative.speaks("es-MX") and representative.gender != patient.gender
    patient, representative = module.call_voices(catalog, "fi-FI", "george")  # George is not verified for Finnish
    assert (patient.key, representative.key) == ("soili", "jaakko")


def test_the_call_is_written_from_the_bills_facts_performed_once_and_reused():
    seen, performed = [], []

    async def writer(facts, locale, counterpart):
        seen.append((facts, locale, counterpart))
        return TURNS

    def performer(turns, patient, representative, locale, config):
        performed.append((patient.key, representative.key, len(turns)))
        return b"ID3-call"

    first = make(writer, performer)
    again = make(writer, performer)
    assert first is again and len(seen) == 1 and len(performed) == 1
    facts, locale, counterpart = seen[0]
    assert "Northline Medical Center" in facts and "$250.00" in facts and "listed twice" in facts.lower()
    assert (locale, counterpart) == ("es-MX", "billing")
    assert first["audio_url"] == "/api/v1/voice/audio/" + "a" * 32 and first["voices"]["patient"] == "anamaria"
    assert first["turns"][0]["text"] == "Oficina de facturación, ¿en qué le ayudo?"  # delivery tags are performed, not shown


def test_no_safe_script_means_no_call():
    async def writer(facts, locale, counterpart):
        return None

    with pytest.raises(module.ExampleCallError) as exc:
        make(writer, lambda *args: b"never")
    assert exc.value.code == "SCRIPT_UNAVAILABLE"
