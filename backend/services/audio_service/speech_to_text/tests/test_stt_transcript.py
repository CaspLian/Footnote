import math

import pytest

from speech_to_text.transcript import (
    audio_seconds_from_words,
    average_word_confidence,
    clean_transcript,
    has_speech,
)


def word(text, logprob=0.0, kind="word", end=None):
    return {"text": text, "type": kind, "logprob": logprob, "end": end}


def test_spacing_is_tidied_and_words_are_kept():
    text = "  Why was my  MRI\nbilled   $3,200?  "
    assert clean_transcript(text, []) == "Why was my MRI billed $3,200?"


def test_sound_tags_are_removed_but_words_stay():
    words = [word("(laughter)", kind="audio_event"), word("Um"), word("is"), word("this"), word("covered")]
    assert clean_transcript("(laughter) Um, is this not covered?", words) == "Um, is this not covered?"


@pytest.mark.parametrize("text, expected", [("Hello", True), ("...", False), ("", False), ("  ", False), ("5", True)])
def test_has_speech(text, expected):
    assert has_speech(text) is expected


def test_confidence_is_the_average_word_probability():
    words = [word("sure", 0.0), word("maybe", math.log(0.5)), word(" ", -9.0, kind="spacing"), word("(cough)", -9.0, kind="audio_event")]
    assert average_word_confidence(words) == 0.75  # spacing and sound tags do not count


def test_confidence_ignores_bad_values_and_handles_no_words():
    assert average_word_confidence([]) is None
    assert average_word_confidence([word("a", float("nan"))]) is None
    assert average_word_confidence([word("a", float("-inf")), word("b", 0.0)]) == 0.5
    assert average_word_confidence([word("a", 0.3)]) == 1.0  # a positive logprob is capped at probability 1


def test_audio_length_falls_back_to_the_last_word_end():
    assert audio_seconds_from_words([word("a", end=0.4), word("b", end=2.25)]) == 2.25
    assert audio_seconds_from_words([word("a")]) is None
