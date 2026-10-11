"""Turn a recording into text and show what would be sent to Gemini, without the backend.

    python -m speech_to_text.demo --file recording.m4a           # transcribe a recording
    python -m speech_to_text.demo --file recording.m4a --check   # free: only check the file
    python -m speech_to_text.demo --round-trip mock-bill-summary # transcribe the text-to-speech demo MP3
                                                                 # and compare with the text it came from

Speech-to-text costs $0.22 per hour of audio with scribe_v2: one minute is about $0.004.
"""

from __future__ import annotations

import argparse
import dataclasses
import json
import logging
import mimetypes
import re
import sys
from pathlib import Path

from .audio_check import detect_format
from .config import SERVICE_DIR, STTConfig
from .contract import STTRequest
from .handoff import to_gemini_handoff
from .service import STTService

PRICE_PER_HOUR_USD = 0.22  # scribe_v2 and scribe_v2_medical, ElevenLabs API pricing checked 2026-10-09
TTS_DEMO_OUTPUT = SERVICE_DIR / "demo_output"
TTS_MOCK_FILE = SERVICE_DIR / "text_to_speech" / "mock_data" / "gemini_responses.json"
TTS_PRONUNCIATIONS_FILE = SERVICE_DIR / "text_to_speech" / "pronunciations.json"

# Numbers come back from speech-to-text as words ("$3,200" -> "three thousand two hundred dollars"),
# so the round-trip comparison leaves them out and prints them for checking by eye.
_NUMBER_WORDS = set(
    "zero oh one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen "
    "sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred "
    "thousand million billion first second third fourth fifth sixth seventh eighth ninth tenth eleventh "
    "twelfth thirteenth fourteenth fifteenth sixteenth seventeenth eighteenth nineteenth twentieth "
    "thirtieth dollar dollars cent cents percent point".split()
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m speech_to_text.demo", description=__doc__.split("\n\n")[0])
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--file", type=Path, help="an audio file (m4a, webm, mp3, wav, ...)")
    source.add_argument("--round-trip", metavar="MOCK_ID", help="transcribe demo_output/<MOCK_ID>.mp3 made by text_to_speech")
    parser.add_argument("--check", action="store_true", help="only check the file; no API call, no cost")
    parser.add_argument("--language", default="en", help='spoken language code, or "" to detect it (default: en)')
    parser.add_argument("--model", help="override ELEVENLABS_STT_MODEL_ID, e.g. scribe_v2_medical")
    args = parser.parse_args(argv)

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")
    logging.basicConfig(level=logging.INFO, format="  log: %(message)s")

    expected_text = None
    if args.round_trip:
        path = TTS_DEMO_OUTPUT / f"{args.round_trip}.mp3"
        expected_text = _mock_text(args.round_trip)
        if not path.is_file():
            print(f"{path} does not exist yet. Make it first: python -m text_to_speech.demo --mock {args.round_trip}")
            return 1
    else:
        path = args.file
        if not path.is_file():
            print(f"File not found: {path}")
            return 1

    audio = path.read_bytes()
    print(f"File: {path.name}  {len(audio):,} bytes  detected format: {detect_format(audio) or 'unknown'}")
    if args.check:
        print("Check only: nothing was sent to ElevenLabs.")
        return 0

    try:
        config = STTConfig.from_env()
    except ValueError as exc:
        print(f"Setting error in .env: {exc}")
        return 1
    if args.model:
        config = dataclasses.replace(config, model_id=args.model)
    if not config.is_configured:
        print("Add ELEVENLABS_API_KEY to backend/.env (see audio_service/.env.example).")
        return 1

    service = STTService(config)
    request = STTRequest(
        request_id=f"demo-{path.stem}",
        audio=audio,
        mime_type=mimetypes.guess_type(path.name)[0],
        language=args.language,
    )
    print(f"Model: {config.model_id}  language: {args.language or 'auto-detect'}\n")
    result = service.transcribe(request)
    if not result.ok:
        print(f"FAILED {result.error_code} (retryable={result.retryable})\n  {result.error_message}")
        if result.provider_request_id:
            print(f"  ElevenLabs request id: {result.provider_request_id}")
        return 1

    print(f"Transcript:\n  {result.text}\n")
    cost = (result.audio_seconds or 0) / 3600 * PRICE_PER_HOUR_USD
    print(
        f"language={result.language}  confidence={result.confidence}  audio_seconds={result.audio_seconds}"
        f"  time={result.elapsed_ms} ms  estimated cost=${cost:.4f}"
    )
    print(f"ElevenLabs request id: {result.provider_request_id}")
    if expected_text is not None:
        spoken = _as_spoken(expected_text)
        accuracy = word_accuracy(spoken, result.text, ignore_numbers=True)
        print(f"Round trip: {accuracy:.1%} of the spoken words came back (numbers left out of this comparison)")
        numbers = re.findall(r"\$?\d[\d,]*(?:\.\d+)?%?", spoken)
        if numbers:
            print(f"Numbers in the original, to check by eye in the transcript: {', '.join(numbers)}")

    handoff = to_gemini_handoff(result)
    print("\nWhat the backend would send to Gemini (GeminiHandoff):")
    print(json.dumps(handoff.to_dict(), indent=2))
    print("\nAgain (same recording): ", end="")
    again = service.transcribe(request)
    print(f"cached={again.cached}  attempts={again.attempts}  time={again.elapsed_ms} ms")
    print("\nStats:", json.dumps(service.stats(), indent=2))
    return 0


def word_accuracy(expected: str, actual: str, *, ignore_numbers: bool = False) -> float:
    """1 - word error rate, after ignoring case, punctuation, "$" and thousands separators.
    With ignore_numbers, digits and number words are left out on both sides."""
    reference, hypothesis = _words(expected, ignore_numbers), _words(actual, ignore_numbers)
    if not reference:
        return 1.0 if not hypothesis else 0.0
    previous = list(range(len(hypothesis) + 1))
    for i, ref_word in enumerate(reference, 1):
        current = [i]
        for j, hyp_word in enumerate(hypothesis, 1):
            current.append(min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (ref_word != hyp_word)))
        previous = current
    return max(0.0, 1 - previous[-1] / len(reference))


def _words(text: str, ignore_numbers: bool = False) -> list[str]:
    text = text.lower().replace("%", " percent ")
    text = re.sub(r"(?<=\d),(?=\d)", "", text).replace("$", " ")
    if ignore_numbers:
        text = text.replace("-", " ")  # "twenty-six" -> "twenty six"
    words = re.findall(r"[a-z0-9']+(?:\.[0-9]+)?", text)
    if ignore_numbers:
        words = [word for word in words if not any(c.isdigit() for c in word) and word not in _NUMBER_WORDS]
    return words


def _as_spoken(text: str) -> str:
    """The mock text the way the voice said it: text_to_speech replaces words like Footnote first."""
    try:
        sounds = json.loads(TTS_PRONUNCIATIONS_FILE.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        return text
    for word, spoken in sounds.items():
        if not word.startswith("_"):
            text = re.sub(rf"(?<!\w){re.escape(word)}(?!\w)", lambda _: str(spoken), text)
    return text


def _mock_text(mock_id: str) -> str | None:
    try:
        mocks = json.loads(TTS_MOCK_FILE.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        return None
    return next((m["text"] for m in mocks if m.get("request_id") == mock_id), None)


if __name__ == "__main__":
    sys.exit(main())
