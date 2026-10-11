"""translate_for_speech never lets a changed number through: translations of the price findings keep their digits,
and one whose numbers differ from the English is asked for again, then dropped. Fake Gemini client; offline."""
import asyncio
import types

import pytest

from services.gemini_services import gemini_service
from services.gemini_services.gemini_service import _numbers, _same_numbers

FINDINGS = ("I also compared the charges with Medicare's national rates. “CT head” was billed about 30 times Medicare's "
            "national rate. “ER visit” was billed about 10.1 times. 2 other charges also look high.")


@pytest.mark.parametrize("text, numbers", [
    ("about 30 times", ["30"]),
    ("4.5 and 4,5", ["4.5", "4.5"]),
    ("1,234,567 / 1.234.567 / 1 234 567", ["1234567", "1234567", "1234567"]),
    ("1,234.5 and 1.234,5", ["1234.5", "1234.5"]),
    ("٣٠ مرة و١٠٫١", ["30", "10.1"]),  # Arabic-Indic digits and the Arabic decimal separator
    ("३० गुना", ["30"]),  # Devanagari
    ("about 30 times. Then 2 more.", ["2", "30"]),  # a full stop after a number is not a decimal point
])
def test_numbers_are_read_the_same_way_in_any_script(text, numbers):
    assert _numbers(text) == sorted(numbers)


def test_the_numbers_must_match_exactly():
    good = "También comparé los cargos. «Tomografía» se facturó a cerca de 30 veces. «Urgencias», 10.1 veces. 2 cargos más."
    assert _same_numbers(FINDINGS, good)
    assert _same_numbers(FINDINGS, good.replace("10.1", "10,1"))  # a decimal comma is the same number
    assert not _same_numbers(FINDINGS, good.replace("30", "31"))
    assert not _same_numbers(FINDINGS, good.replace("30 veces", "treinta veces"))  # a number written as a word
    assert not _same_numbers(FINDINGS, good + " Unos 3 más.")  # an extra number
    # The live case (2026-10-10): Traditional Chinese with 三十一倍 (31 times) or 三倍 (3 times).
    assert not _same_numbers(FINDINGS, "「頭部電腦斷層」的收費約為聯邦醫療保險全國費率的三十一倍。「急診」約十點一倍。另外2項收費也偏高。")
    assert _same_numbers(FINDINGS, "「頭部電腦斷層」的收費約為聯邦醫療保險全國費率的30倍。「急診」約10.1倍。另外2項收費也偏高。")


class FakeModels:
    """Answers each generate_content call with the next text in order."""

    def __init__(self, answers):
        self.answers = list(answers)
        self.models = []

    async def generate_content(self, *, model, contents, config):
        self.models.append(model)
        return types.SimpleNamespace(text=self.answers.pop(0) if self.answers else "")


@pytest.fixture
def gemini(monkeypatch):
    def install(answers):
        fake = FakeModels(answers)
        monkeypatch.setattr(gemini_service, "_get_client", lambda: types.SimpleNamespace(aio=types.SimpleNamespace(models=fake)))
        monkeypatch.setenv("GEMINI_MODEL", "main-model")
        monkeypatch.setenv("GEMINI_FALLBACK_MODEL", "small-model")
        monkeypatch.setenv("MOCK", "false")
        monkeypatch.setattr(gemini_service, "_translations", {})
        monkeypatch.setattr(gemini_service, "_translating", {})

        async def no_wait(seconds):
            return None

        monkeypatch.setattr(gemini_service.asyncio, "sleep", no_wait)
        return fake
    return install


def test_a_translation_with_a_changed_number_is_asked_for_again(gemini):
    fake = gemini(["「急診」約31倍，另10.1倍，2項。", "「急診」約30倍，另10.1倍，2項。"])
    result = asyncio.run(gemini_service.translate_for_speech(FINDINGS, "zh-TW"))
    assert result == "「急診」約30倍，另10.1倍，2項。"
    assert fake.models == ["main-model", "main-model"]


def test_without_a_correct_translation_the_findings_are_left_out(gemini):
    fake = gemini(["約31倍，10.1倍，2項。"] * 4)
    assert asyncio.run(gemini_service.translate_for_speech(FINDINGS, "zh-TW")) is None
    assert fake.models == ["main-model", "main-model", "small-model", "small-model"]  # every attempt, then none
    assert gemini_service._translations == {}  # a failure is not remembered
