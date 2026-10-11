"""Gemini's example call: alternating turns, short enough to perform, and no number the bill does not contain."""
import asyncio
from types import SimpleNamespace

import pytest

from services.gemini_services import gemini_service as service
from services.gemini_services.gemini_service import CallTurn, ExampleCall

FACTS = "Provider: Northline Medical Center\nTotal billed: $2,670.00\nLine 4: Metabolic panel. Code 80053. Billed $250.00.\nService date 2026-09-18"


def turns(*texts, first="representative"):
    other = {"representative": "patient", "patient": "representative"}
    speaker, out = first, []
    for text in texts:
        out.append(CallTurn(speaker=speaker, text=text))
        speaker = other[speaker]
    return out


def test_a_call_that_quotes_only_the_bills_numbers_fits():
    call = turns("Billing office, how can I help?", "My bill from Northline lists the $250 panel 2 times.",
                 "I see code 80053 twice on 2026-09-18. I can send an itemized bill.", "Thank you.")
    assert service._fits_call(call, FACTS)


@pytest.mark.parametrize("call", [
    turns("Billing office.", "Hi.", "Your reference number is 48213.", "Thanks."),  # an invented number
    turns("Hi, I'm calling about my bill.", "Billing office.", "Hello.", "Thanks.", first="patient"),  # wrong order
    turns("Hello.", "Hi.", "Yes.", *["Okay."] * 8),  # too many turns
    turns("Hello.", "x" * 1200, "Yes.", "Thanks."),  # too long to perform quickly
])
def test_a_call_that_invents_numbers_or_does_not_alternate_is_refused(call):
    assert not service._fits_call(call, FACTS)


def test_an_unfit_answer_is_asked_again_and_then_given_up(monkeypatch):
    bad = ExampleCall(turns=turns("Billing office.", "Hi.", "Your refund of $900 is approved.", "Thanks."))
    good = ExampleCall(turns=turns("Billing office.", "Hi, about my $250 panel.", "I can check that.", "Thank you."))
    replies, calls = iter([bad, good]), []

    async def generate(**kwargs):
        calls.append(kwargs["model"])
        return SimpleNamespace(parsed=next(replies), text="")

    monkeypatch.setattr(service, "_get_client", lambda: SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(generate_content=generate))))
    monkeypatch.setenv("MOCK", "false")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-3.5-flash")
    monkeypatch.setenv("GEMINI_FALLBACK_MODEL", "")

    async def no_delay(_):
        pass

    monkeypatch.setattr(service.asyncio, "sleep", no_delay)
    result = asyncio.run(service.write_example_call(FACTS, "en-US"))
    assert result[1] == {"speaker": "patient", "text": "Hi, about my $250 panel."} and len(calls) == 2
    replies = iter([bad, bad])
    assert asyncio.run(service.write_example_call(FACTS, "en-US")) is None
