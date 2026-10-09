"""Tidy ElevenLabs' transcript for Gemini, and estimate how sure the model was.

Only spacing and sound tags such as "(laughter)" are changed. Words are never removed:
"um" or a false start is harmless to Gemini, while dropping a real word could change meaning.
"""

from __future__ import annotations

import math
import re


def clean_transcript(text: str, words: list[dict]) -> str:
    for word in words:
        if word.get("type") == "audio_event" and word.get("text"):
            text = text.replace(word["text"], " ")
    return re.sub(r"\s+", " ", text).strip()


def has_speech(text: str) -> bool:
    return re.search(r"\w", text) is not None


def average_word_confidence(words: list[dict]) -> float | None:
    """Mean probability of the recognised words (0 to 1), from ElevenLabs' per-word logprob."""
    probabilities = []
    for word in words:
        logprob = word.get("logprob")
        if word.get("type") == "word" and isinstance(logprob, (int, float)) and not math.isnan(logprob):
            probabilities.append(math.exp(min(logprob, 0.0)))
    if not probabilities:
        return None
    return round(sum(probabilities) / len(probabilities), 3)


def audio_seconds_from_words(words: list[dict]) -> float | None:
    """Fallback length of the speech when ElevenLabs does not report the audio duration."""
    ends = [word["end"] for word in words if isinstance(word.get("end"), (int, float))]
    return round(max(ends), 2) if ends else None
