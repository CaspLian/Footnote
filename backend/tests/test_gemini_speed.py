"""Gemini's thinking level and media resolution: low thinking by default (measured 3x faster, same extraction)."""
import asyncio
from types import SimpleNamespace

import pytest
from google.genai import types

from models import GeminiResult
from services.gemini_services import gemini_service as service

GOOD = GeminiResult(document_type="hospital_bill", total_billed=425, amount_patient_owes=None,
                    plain_summary="A test bill.", spoken_summary="A test bill.")


@pytest.fixture
def configs(monkeypatch):
    seen = []

    async def generate(**kwargs):
        seen.append((kwargs["model"], kwargs["config"]))
        return SimpleNamespace(parsed=GOOD, text="")

    monkeypatch.setattr(service, "_get_client", lambda: SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(generate_content=generate))))
    monkeypatch.setenv("MOCK", "false")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-3.5-flash")
    monkeypatch.setenv("GEMINI_FALLBACK_MODEL", "")
    monkeypatch.delenv("GEMINI_THINKING_LEVEL", raising=False)
    monkeypatch.delenv("GEMINI_MEDIA_RESOLUTION", raising=False)
    return seen


def analyze():
    return asyncio.run(service.analyze(text="Synthetic test bill", target_language="en-US"))


def test_gemini_3_thinks_low_by_default(configs):
    assert analyze() == GOOD
    model, config = configs[-1]
    assert model == "gemini-3.5-flash" and config.thinking_config.thinking_level == types.ThinkingLevel.LOW
    assert config.media_resolution is None  # the model's own resolution unless GEMINI_MEDIA_RESOLUTION is set


@pytest.mark.parametrize("setting,expected", [("medium", types.ThinkingLevel.MEDIUM), ("HIGH", types.ThinkingLevel.HIGH),
                                              ("minimal", types.ThinkingLevel.MINIMAL)])
def test_the_thinking_level_can_be_changed(configs, monkeypatch, setting, expected):
    monkeypatch.setenv("GEMINI_THINKING_LEVEL", setting)
    analyze()
    assert configs[-1][1].thinking_config.thinking_level == expected


def test_default_keeps_the_models_own_thinking_and_other_models_are_left_alone(configs, monkeypatch):
    monkeypatch.setenv("GEMINI_THINKING_LEVEL", "default")
    analyze()
    assert configs[-1][1].thinking_config is None
    monkeypatch.delenv("GEMINI_THINKING_LEVEL")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.5-flash")  # thinks by budget, not level
    analyze()
    assert configs[-1][1].thinking_config is None


def test_media_resolution_can_be_raised_for_hard_photos(configs, monkeypatch):
    monkeypatch.setenv("GEMINI_MEDIA_RESOLUTION", "high")
    analyze()
    assert configs[-1][1].media_resolution == types.MediaResolution.MEDIA_RESOLUTION_HIGH


def test_translations_think_low_too(configs, monkeypatch):
    async def generate(**kwargs):
        configs.append((kwargs["model"], kwargs["config"]))
        return SimpleNamespace(text="La revisi\u00f3n cuesta 30 d\u00f3lares.")

    monkeypatch.setattr(service, "_get_client", lambda: SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(generate_content=generate))))
    assert asyncio.run(service._translate("The check costs 30 dollars.", "es-MX")) == "La revisi\u00f3n cuesta 30 d\u00f3lares."
    assert configs[-1][1].thinking_config.thinking_level == types.ThinkingLevel.LOW
