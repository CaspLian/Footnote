"""Tests for audio_http.audio_response: byte ranges for finished clips, streaming for the rest."""

import pytest

pytest.importorskip("fastapi")

from fastapi.responses import StreamingResponse  # noqa: E402

from audio_http import audio_response  # noqa: E402
from text_to_speech.contract import AudioStream  # noqa: E402

CLIP = b"ID3" + bytes(range(97))  # 100 bytes


def finished():
    return AudioStream(iter((CLIP,)), "audio/mpeg", complete=True, size=len(CLIP))


def test_finished_audio_is_sent_whole_and_says_ranges_are_supported():
    response = audio_response(finished(), finished_headers={"Cache-Control": "max-age=60"})
    assert response.status_code == 200 and response.body == CLIP
    assert response.headers["accept-ranges"] == "bytes"
    assert response.headers["content-length"] == "100"
    assert response.headers["cache-control"] == "max-age=60"
    assert response.media_type == "audio/mpeg"


@pytest.mark.parametrize(
    "header, start, end",
    [
        ("bytes=0-1", 0, 1),  # what Safari and iPhones ask for first
        ("bytes=10-", 10, 99),
        ("bytes=-30", 70, 99),  # the last 30 bytes
        ("bytes=90-500", 90, 99),  # an end past the clip is cut to the clip
        ("bytes=-500", 0, 99),
        (" bytes=0-0 ", 0, 0),
    ],
)
def test_a_byte_range_gets_206_partial_content(header, start, end):
    response = audio_response(finished(), header)
    assert response.status_code == 206
    assert response.body == CLIP[start : end + 1]
    assert response.headers["content-range"] == f"bytes {start}-{end}/100"
    assert response.headers["content-length"] == str(end - start + 1)


@pytest.mark.parametrize("header", ["bytes=100-", "bytes=500-600", "bytes=-0"])
def test_a_range_outside_the_clip_is_416(header):
    response = audio_response(finished(), header)
    assert response.status_code == 416
    assert response.headers["content-range"] == "bytes */100"


@pytest.mark.parametrize("header", [None, "", "bytes=0-1,5-6", "items=0-1", "bytes=5-2", "bytes=-", "bytes=abc"])
def test_ranges_we_do_not_handle_get_the_whole_clip(header):
    response = audio_response(finished(), header)
    assert response.status_code == 200 and response.body == CLIP  # HTTP allows ignoring Range


def test_audio_still_being_made_is_streamed_and_not_cacheable():
    live = AudioStream(iter((b"ID3", b"-more")), "audio/mpeg", complete=False)
    response = audio_response(live, "bytes=0-1", finished_headers={"Cache-Control": "immutable"})
    assert isinstance(response, StreamingResponse) and response.status_code == 200
    assert response.headers["cache-control"] == "no-store"  # it could still fail part-way
    assert "accept-ranges" not in response.headers  # the length is not known yet
    assert response.media_type == "audio/mpeg"
