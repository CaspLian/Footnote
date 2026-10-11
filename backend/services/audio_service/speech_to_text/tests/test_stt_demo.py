import pytest

from speech_to_text.demo import _as_spoken, word_accuracy


@pytest.mark.parametrize(
    "expected, actual, accuracy",
    [
        ("Your total is $4,850.75.", "your total is $4850.75", 1.0),  # formatting differences do not count
        ("Covered only 60% of the visit.", "covered only 60 percent of the visit", 1.0),
        ("one two three four", "one two tree four", 0.75),  # one word misheard out of four
        ("one two three four", "one two three", 0.75),  # one word missing
        ("", "", 1.0),
    ],
)
def test_word_accuracy(expected, actual, accuracy):
    assert word_accuracy(expected, actual) == pytest.approx(accuracy)


def test_numbers_written_as_words_are_not_counted_as_errors():
    expected = "CPT code 70551 was billed at $3,200, dated September 15, 2026."
    actual = "CPT code seven oh five five one was billed at three thousand two hundred dollars, dated September fifteenth, twenty twenty-six."
    assert word_accuracy(expected, actual) < 0.8  # a plain comparison punishes the number formatting
    assert word_accuracy(expected, actual, ignore_numbers=True) == 1.0


def test_a_real_word_error_still_counts_when_numbers_are_ignored():
    assert word_accuracy("your claim was denied", "your claim was defined", ignore_numbers=True) == 0.75


def test_round_trip_compares_with_the_words_the_voice_actually_said():
    assert _as_spoken("Welcome to Footnote") == "Welcome to Foot note"
