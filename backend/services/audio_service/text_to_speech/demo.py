"""Turn mock Gemini answers into playable audio, without the backend.

    python -m text_to_speech.demo --dry-run          # free: show the cleaned text for every mock answer
    python -m text_to_speech.demo                    # speak one short mock answer, save it as an MP3
    python -m text_to_speech.demo --mock mock-numbers
    python -m text_to_speech.demo --text "Hello from ClaimPulse"
    python -m text_to_speech.demo --all --open       # speak every mock answer and open the first file
    python -m text_to_speech.demo --list-voices      # free: the voices users can choose (voices.json)
    python -m text_to_speech.demo --voice bunty      # speak in one of those voices
    python -m text_to_speech.demo --voice all        # the same answer in every voice, to compare

Each answer is requested twice to show the cache: the second request should
say cached=True and send 0 characters.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import subprocess
import sys
from pathlib import Path

from .config import SERVICE_DIR, TTSConfig
from .contract import TTSRequest
from .service import TTSService
from .text_prep import prepare_for_speech
from .voices import load_catalog

MOCK_FILE = Path(__file__).with_name("mock_data") / "gemini_responses.json"
OUTPUT_DIR = SERVICE_DIR / "demo_output"  # inside audio_service, git-ignored there


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m text_to_speech.demo", description=__doc__.split("\n\n")[0])
    choice = parser.add_mutually_exclusive_group()
    choice.add_argument("--mock", help="request_id of one mock answer (default: mock-plain)")
    choice.add_argument("--text", help="your own text instead of a mock answer")
    choice.add_argument("--all", action="store_true", help="every mock answer")
    parser.add_argument("--dry-run", action="store_true", help="only show the cleaned text; no API call, no cost")
    parser.add_argument("--open", action="store_true", help="open the first saved audio file in your default player")
    parser.add_argument("--voice", help='a voice key from voices.json, or "all" for every voice')
    parser.add_argument("--list-voices", action="store_true", help="show the voices users can choose; no cost")
    args = parser.parse_args(argv)

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")  # some Windows consoles cannot print emoji
    logging.basicConfig(level=logging.INFO, format="  log: %(message)s")

    try:
        catalog = load_catalog()
    except ValueError as exc:
        print(f"voices.json problem: {exc}")
        return 1
    if args.list_voices:
        for voice in catalog.voices:
            default = "  (default)" if voice.key == catalog.default_key else ""
            print(f"  {voice.key:<10} {voice.name}: {voice.description} ({voice.accent}, {voice.gender}){default}")
        return 0
    if args.voice == "all":
        voices = catalog.keys()
    elif args.voice:
        if catalog.get(args.voice) is None:
            parser.error(f"unknown voice {args.voice!r}; choose from: {', '.join(catalog.keys())}, or all")
        voices = [args.voice.strip().lower()]
    else:
        voices = [None]  # the default voice

    mocks = json.loads(MOCK_FILE.read_text(encoding="utf-8-sig"))  # -sig: tolerate a BOM from Windows editors
    if args.text is not None:
        answers = [{"request_id": "custom-text", "description": "your text", "text": args.text}]
    elif args.all or args.dry_run and not args.mock:
        answers = mocks
    else:
        wanted = args.mock or "mock-plain"
        answers = [m for m in mocks if m["request_id"] == wanted]
        if not answers:
            parser.error(f"unknown mock {wanted!r}; choose from: {', '.join(m['request_id'] for m in mocks)}")

    try:
        config = TTSConfig.from_env()
    except ValueError as exc:
        print(f"Setting error in .env: {exc}")
        return 1

    if args.dry_run:
        return _dry_run(answers, config)
    return _speak(answers, config, open_first=args.open, voices=voices)


def _dry_run(answers: list[dict], config: TTSConfig) -> int:
    print("Dry run: nothing is sent to ElevenLabs.\n")
    total = 0
    for answer in answers:
        spoken = prepare_for_speech(answer["text"])
        print(f"{answer['request_id']}: {answer['description']}")
        if not spoken:
            print("  -> would fail with EMPTY_TEXT (nothing speakable)\n")
            continue
        change = len(spoken) / max(len(answer["text"]), 1) - 1
        if change < 0:
            effect = f"{-change:.0%} fewer billed characters"
        elif change > 0:
            effect = f"{change:.0%} more: symbols and dates are spelled out"
        else:
            effect = "same length"
        print(f"  Gemini text: {len(answer['text'])} characters")
        print(f"  Spoken text: {len(spoken)} characters ({effect})")
        if len(spoken) > config.max_chars:
            print(f"  -> would fail with TEXT_TOO_LONG (limit {config.max_chars})")
        for line in spoken.split("\n"):
            print(f"  | {line}")
        print()
        total += len(spoken)
    print(f"Speaking all of these would send about {total} characters to ElevenLabs.")
    return 0


def _speak(answers: list[dict], config: TTSConfig, *, open_first: bool, voices: list[str | None]) -> int:
    print("Settings:")
    print(f"  ELEVENLABS_API_KEY  {'set' if config.api_key else 'MISSING'}")
    print(f"  voice(s): {', '.join(voice or 'default' for voice in voices)}")
    print(f"  model={config.model_id}  format={config.output_format}  speed={config.speed or 'voice default'}")
    print(f"  cache={config.cache_dir or 'memory only'}  timeout={config.timeout_seconds:g}s  retries={config.max_retries}")
    if not config.is_configured:
        print("\nAdd ELEVENLABS_API_KEY to backend/.env (see audio_service/.env.example).")
        return 1

    service = TTSService(config)
    OUTPUT_DIR.mkdir(exist_ok=True)
    saved_files: list[Path] = []
    failures = 0

    for answer, voice in ((answer, voice) for answer in answers for voice in voices):
        print(f"\n== {answer['request_id']}: {answer['description']}" + (f"  [voice: {voice}]" if voice else ""))
        for attempt_label in ("first request", "same text again"):
            result = service.synthesize(TTSRequest(request_id=answer["request_id"], text=answer["text"], voice=voice))
            if not result.ok:
                print(f"  {attempt_label}: FAILED {result.error_code} (retryable={result.retryable})")
                print(f"    {result.error_message}")
                if result.provider_request_id:
                    print(f"    ElevenLabs request id: {result.provider_request_id}")
                failures += 1
                break
            print(
                f"  {attempt_label}: ok  cached={result.cached}  characters_sent={result.characters_sent}"
                f"  characters_billed={result.characters_billed}  attempts={result.attempts}"
                f"  time={result.elapsed_ms} ms"
            )
            if not result.cached:
                print(f"    ElevenLabs request id: {result.provider_request_id}")
            suffix = f"-{voice}" if voice else ""  # no suffix for the default voice, as before
            path = OUTPUT_DIR / f"{result.request_id}{suffix}.{config.file_extension}"
            path.write_bytes(result.audio)
            if path not in saved_files:
                saved_files.append(path)
                print(f"    saved audio_service/{path.relative_to(SERVICE_DIR).as_posix()} ({len(result.audio):,} bytes)")

    print("\nStats:", json.dumps(service.stats(), indent=2))
    if open_first and saved_files:
        _open_file(saved_files[0])
    return 1 if failures else 0


def _open_file(path: Path) -> None:
    if sys.platform == "win32":
        os.startfile(path)  # noqa: S606 - opens the file with its default app
    elif sys.platform == "darwin":
        subprocess.run(["open", str(path)], check=False)
    else:
        subprocess.run(["xdg-open", str(path)], check=False)


if __name__ == "__main__":
    sys.exit(main())
