"""A short example phone call about a saved bill, performed by two ElevenLabs voices (Text to Dialogue, Eleven v4).

Gemini writes the call from the saved analysis (gemini_service.write_example_call: only the bill's facts, no
promises); the patient speaks with the user's voice for the language, the representative with another voice
ElevenLabs verified for it. The audio is kept like reply audio and played from GET /api/v1/voice/audio/{id}.
It shows how a calm call could go; it is not a prediction of what the billing office will say.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import re
from typing import Awaitable, Callable

import requests

try:
    from .text_to_speech.config import TTSConfig, language_base
    from .text_to_speech.service import store_audio
    from .text_to_speech.voices import Voice, VoiceCatalog, load_catalog
    from .voice_agent.bill_context import build_context
except ImportError:  # imported from audio_service's own tests
    from text_to_speech.config import TTSConfig, language_base
    from text_to_speech.service import store_audio
    from text_to_speech.voices import Voice, VoiceCatalog, load_catalog
    from voice_agent.bill_context import build_context

# 389 characters in 8.5 s for 47 credits; Eleven v3 took as long for 171 (measured 2026-10-11).
DIALOGUE_MODEL = "eleven_v4"
DIALOGUE_TIMEOUT_S = 90
_TAG = re.compile(r"\[[^\]]{1,30}\]\s*")  # delivery tags such as [calm]: performed, not shown
_ELEVENLABS_LANGUAGE = {"nb": "no"}

Writer = Callable[[str, str, str], Awaitable["list[dict] | None"]]


class ExampleCallError(Exception):
    def __init__(self, code: str, message: str, status: int = 503):
        super().__init__(message)
        self.code, self.status = code, status


def call_voices(catalog: VoiceCatalog, locale: str, chosen: str | None) -> tuple[Voice, Voice]:
    """(patient, representative): the user's voice for the language, and another voice verified for it, of
    another gender when there is one, so the two speakers are easy to tell apart."""
    patient = catalog.choose(chosen, locale) or catalog.default_for(locale)
    others = [voice for voice in catalog.voices if voice.speaks(locale) and voice.key != patient.key]
    different = [voice for voice in others if voice.gender and patient.gender and voice.gender != patient.gender]
    return patient, (different or others or [patient])[0]


def facts_for(analysis: dict, language_name: str) -> str:
    """The bill as the live agent sees it (bill_context): bounded, without patient or account fields."""
    variables, _ = build_context(analysis, language_name)
    return "\n".join([variables["bill_facts"], "Lines:", variables["bill_lines"], "Price check: " + variables["price_check"],
                      "Questions to ask:", variables["questions_to_ask"]])


def perform(turns: list[dict], patient: Voice, representative: Voice, locale: str, config: TTSConfig) -> bytes:
    """The call as one MP3 from Text to Dialogue."""
    base = language_base(locale)
    body = {"model_id": DIALOGUE_MODEL, "language_code": _ELEVENLABS_LANGUAGE.get(base, base),
            "inputs": [{"text": turn["text"], "voice_id": (patient if turn["speaker"] == "patient" else representative).voice_id}
                       for turn in turns]}
    try:
        response = requests.post(f"{config.base_url}/v1/text-to-dialogue", params={"output_format": "mp3_44100_128"},
                                 headers={"xi-api-key": config.api_key}, json=body, timeout=(5, DIALOGUE_TIMEOUT_S))
    except requests.RequestException as exc:
        raise ExampleCallError("PROVIDER_UNAVAILABLE", f"ElevenLabs could not be reached ({type(exc).__name__}).") from None
    if response.status_code != 200 or not response.content:
        # Only the status: an error body can quote the text.
        raise ExampleCallError("PROVIDER_REJECTED", f"ElevenLabs could not perform the call (HTTP {response.status_code}).", 502)
    return response.content


_done: dict[str, dict] = {}
_making: dict[str, asyncio.Task] = {}


async def example_call(analysis: dict, *, audit_id: str, locale: str, language_name: str, voice: str | None,
                       counterpart: str, writer: Writer, config: TTSConfig | None = None, performer=perform) -> dict:
    """The example call for a saved analysis, made once per bill, language, voices and counterpart, then reused:
    the app asks for it when the call screen opens, so it is usually ready before Play is pressed."""
    catalog = load_catalog()
    patient, representative = call_voices(catalog, locale, voice)
    key = hashlib.sha256(json.dumps([audit_id, locale, patient.key, representative.key, counterpart, DIALOGUE_MODEL]).encode()).hexdigest()
    if key in _done:
        return _done[key]
    task = _making.get(key)
    if task is None or task.get_loop() is not asyncio.get_running_loop():
        task = asyncio.ensure_future(_make(analysis, locale, language_name, counterpart, patient, representative, writer, config, performer))
        _making[key] = task
        task.add_done_callback(lambda finished: _finish(key, finished))
    return await asyncio.shield(task)  # a caller that stops waiting does not cancel it for the others


def _finish(key: str, task: asyncio.Task) -> None:
    _making.pop(key, None)
    if not task.cancelled() and task.exception() is None:
        _done[key] = task.result()


async def _make(analysis, locale, language_name, counterpart, patient, representative, writer, config, performer) -> dict:
    turns = await writer(facts_for(analysis, language_name), locale, counterpart)
    if not turns:
        raise ExampleCallError("SCRIPT_UNAVAILABLE", "An example call could not be written for this bill. Try again.")
    audio = await asyncio.to_thread(performer, turns, patient, representative, locale, config or TTSConfig.from_env())
    audio_id = store_audio(audio)
    return {"ok": True, "audio_url": f"/api/v1/voice/audio/{audio_id}", "mime_type": "audio/mpeg",
            "turns": [{"speaker": turn["speaker"], "text": _TAG.sub("", turn["text"]).strip()} for turn in turns],
            "voices": {"patient": patient.key, "representative": representative.key},
            "counterpart": counterpart, "model": DIALOGUE_MODEL, "characters": sum(len(turn["text"]) for turn in turns)}
