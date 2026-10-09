"""Tests for the audio cache: memory limit, disk layer, and refusing bad keys."""

import pytest

from text_to_speech.cache import AudioCache, is_valid_key

KEY_A, KEY_B, KEY_C = "a" * 32, "b" * 32, "c" * 32


def test_memory_layer_is_bounded_by_bytes_and_drops_least_recently_used():
    cache = AudioCache(None, max_memory_bytes=10)
    cache.put(KEY_A, b"aaaa")
    cache.put(KEY_B, b"bbbb")
    assert cache.get(KEY_A) == b"aaaa"  # A is now the most recently used
    cache.put(KEY_C, b"cccc")  # 12 bytes > 10: B (least recently used) is dropped
    assert cache.get(KEY_B) is None
    assert cache.get(KEY_A) == b"aaaa" and cache.get(KEY_C) == b"cccc"


def test_clip_larger_than_memory_limit_still_goes_to_disk(tmp_path):
    cache = AudioCache(tmp_path, max_memory_bytes=3)
    cache.put(KEY_A, b"too big")
    assert (tmp_path / f"{KEY_A}.mp3").read_bytes() == b"too big"
    assert cache.get(KEY_A) == b"too big"  # read back from disk


def test_replacing_a_key_keeps_the_byte_count_right():
    cache = AudioCache(None, max_memory_bytes=8)
    for _ in range(5):
        cache.put(KEY_A, b"aaaa")
    cache.put(KEY_B, b"bbbb")
    assert cache.get(KEY_A) == b"aaaa" and cache.get(KEY_B) == b"bbbb"


def test_failed_disk_write_is_not_fatal_and_leaves_no_temp_file(tmp_path):
    blocker = tmp_path / "not-a-directory"
    blocker.write_text("a file where the cache folder should be")
    cache = AudioCache(blocker)
    cache.put(KEY_A, b"audio")  # cannot create the folder: logged, not raised
    assert cache.get(KEY_A) == b"audio"  # still served from memory
    assert sorted(p.name for p in tmp_path.iterdir()) == ["not-a-directory"]


def test_empty_file_on_disk_counts_as_missing(tmp_path):
    (tmp_path / f"{KEY_A}.mp3").write_bytes(b"")
    assert AudioCache(tmp_path).get(KEY_A) is None


@pytest.mark.parametrize("key", ["", "../" + "a" * 29, "A" * 32, "a" * 31, "a" * 33, None, 123])
def test_invalid_keys_are_refused(key, tmp_path):
    cache = AudioCache(tmp_path)
    assert not is_valid_key(key)
    cache.put(key, b"audio")
    assert cache.get(key) is None
    assert list(tmp_path.iterdir()) == []
