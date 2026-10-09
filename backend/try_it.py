"""Quick test from the terminal, no server needed.

    python try_it.py samples/sample_bill.png --lang es
    python try_it.py --text "What does co-insurance after deductible mean?" --lang es
"""
import argparse
import asyncio
import mimetypes

from dotenv import load_dotenv

load_dotenv()

from services.gemini_service import analyze  # noqa: E402


async def main():
    p = argparse.ArgumentParser()
    p.add_argument("file", nargs="?", help="Path to a bill image or PDF")
    p.add_argument("--text", help="Typed text or question")
    p.add_argument("--lang", default="en", help="Target language code (en, es, zh, ar, ...)")
    a = p.parse_args()

    data = mime = None
    if a.file:
        with open(a.file, "rb") as f:
            data = f.read()
        mime = mimetypes.guess_type(a.file)[0]

    result = await analyze(file_bytes=data, mime_type=mime, text=a.text, target_language=a.lang)
    print(result.model_dump_json(indent=2))
    print("\n--- spoken_summary (send this to ElevenLabs) ---\n" + result.spoken_summary)


if __name__ == "__main__":
    asyncio.run(main())
