"""Tests for the voice catalog (voices.json): the voices users can choose."""

import json
from collections import Counter

import pytest

from text_to_speech.voices import VOICES_FILE, load_catalog

ALL_KEYS = [
    "matilda", "sarah", "george", "charlie", "bunty",  # the first five, in their original order
    "alice", "jessica", "noor", "saavi", "ololade", "harris", "rachel", "claire", "river",
    "brian", "bill", "patrick", "dayo", "elio", "andy",
    # Native voices from the Voice Library for languages and regions the voices above are not verified for (2026-10-11)
    "stephanie", "anamaria", "jeanne", "mariza", "tiago", "annasu", "zara", "meera", "nila", "arunika", "milena",
    "soili", "jaakko", "pilar", "dana", "amit", "siriporn", "somchai",
]


def test_the_shipped_catalog_has_thirty_eight_voices():
    catalog = load_catalog()
    assert catalog.keys() == ALL_KEYS
    assert catalog.default.key == "matilda"
    bunty = catalog.get("bunty")
    assert bunty.accent == "Indian" and bunty.voice_id == "nwj0s2LU9bDWRKND5yzA"
    assert len({voice.voice_id for voice in catalog.voices}) == 38  # no ElevenLabs voice listed twice
    assert all(voice.verified_languages for voice in catalog.voices)  # every voice says which languages it speaks


def test_the_choice_is_varied_and_every_voice_is_described():
    catalog = load_catalog()
    assert Counter(voice.gender for voice in catalog.voices) == {"female": 24, "male": 13, "neutral": 1}
    assert len({voice.accent for voice in catalog.voices}) >= 10
    for voice in catalog.voices:
        assert voice.name and voice.description and voice.accent and voice.gender, voice.key


def test_lookup_ignores_case_and_spaces():
    catalog = load_catalog()
    assert catalog.get(" Bunty ").key == "bunty"
    assert catalog.get("nobody") is None


def test_the_app_gets_names_and_descriptions_but_not_elevenlabs_ids():
    public = load_catalog().public()
    assert public["default"] == "matilda"
    entry = dict(public["voices"][4])
    verified = entry.pop("verified_languages")
    assert any(item["language"] == "en" for item in verified)
    assert any(item["language"] == "hi" for item in verified)
    assert all(set(item) <= {"language", "locale", "accent"} for item in verified)
    assert entry == {
        "key": "bunty", "name": "Bunty", "description": "Energetic, expressive and fun",
        "accent": "Indian", "gender": "male", "source": "ElevenLabs Voice Library (paid plans only)",
    }
    assert all("voice_id" not in voice for voice in public["voices"])


def write(tmp_path, data):
    path = tmp_path / "voices.json"
    path.write_text(data if isinstance(data, str) else json.dumps(data), encoding="utf-8")
    return path


def voice(key="a", voice_id="id-a", **extra):
    return {"key": key, "name": key.title(), "voice_id": voice_id, **extra}


@pytest.mark.parametrize(
    "data, message",
    [
        ("{not json", "not valid JSON"),
        ({"voices": []}, "non-empty"),
        ({"voices": ["not an object"]}, "not an object"),
        ({"voices": [{"key": "a", "name": "A"}]}, "missing voice_id"),
        ({"voices": [voice(key="Has Spaces")]}, "lowercase"),
        ({"voices": [voice("a"), voice("a", "id-2")]}, "duplicate keys a"),
        ({"default": "zed", "voices": [voice("a")]}, "default 'zed'"),
    ],
    ids=["bad-json", "empty", "not-object", "missing-id", "bad-key", "duplicate", "bad-default"],
)
def test_a_broken_catalog_says_exactly_what_is_wrong(tmp_path, data, message):
    with pytest.raises(ValueError, match=message):
        load_catalog(write(tmp_path, data))


def test_missing_file_is_reported(tmp_path):
    with pytest.raises(ValueError, match="missing"):
        load_catalog(tmp_path / "nope.json")


def test_default_falls_back_to_the_first_voice(tmp_path):
    assert load_catalog(write(tmp_path, {"voices": [voice("a"), voice("b", "id-b")]})).default_key == "a"


def test_file_saved_with_a_bom_still_loads(tmp_path):
    path = tmp_path / "voices.json"
    path.write_text("\N{BYTE ORDER MARK}" + json.dumps({"voices": [voice("a")]}), encoding="utf-8")
    assert load_catalog(path).keys() == ["a"]


def test_the_catalog_file_lives_next_to_the_code():
    assert VOICES_FILE.name == "voices.json" and VOICES_FILE.is_file()


def test_a_voice_speaks_only_the_languages_it_is_verified_for():
    catalog = load_catalog()
    george, dana, andy = catalog.get("george"), catalog.get("dana"), catalog.get("andy")
    assert george.speaks("ja-JP") and george.speaks("fil-PH") and not george.speaks("he-IL")
    assert dana.speaks("he-IL") and dana.speaks("he") and not dana.speaks("en-US")
    assert andy.speaks("nb-NO")  # ElevenLabs lists Norwegian as "no"
    assert catalog.choose("dana", "en-US").key == "matilda" and catalog.choose("george", "ja-JP").key == "george"
    assert catalog.choose("nobody", "en-US") is None and catalog.choose(None, "fi-FI").key == "soili"


def test_previews_are_spoken_in_the_listeners_language():
    from text_to_speech.voices import sample_text

    catalog = load_catalog()
    assert catalog.get("george").preview_language("ja-JP") == "ja-JP"
    assert catalog.get("dana").preview_language("en-US") == "he"  # a Hebrew voice previews in Hebrew
    assert sample_text("ja-JP", "George").startswith("\u3053\u3093\u306b\u3061\u306f\u3001George")
    assert sample_text("pt-PT", "Mariza") != sample_text("pt-BR", "Saavi").replace("Saavi", "Mariza")
    assert sample_text("xx", "Matilda") == sample_text("en-US", "Matilda")  # unknown: English
