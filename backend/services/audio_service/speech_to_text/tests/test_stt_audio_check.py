import pytest

from speech_to_text.audio_check import detect_format, looks_like_audio_mime


@pytest.mark.parametrize(
    "first_bytes, expected",
    [
        (b"\x00\x00\x00\x20ftypM4A \x00\x00\x00\x00", "m4a"),  # iPhone recording
        (b"\x00\x00\x00\x1cftypisom\x00\x00\x02\x00", "m4a"),  # Android "mpeg4" recording
        (b"\x00\x00\x00\x18ftyp3gp4\x00\x00\x00\x00", "3gp"),  # Android LOW_QUALITY preset
        (b"\x1a\x45\xdf\xa3\x9f\x42\x86\x81", "webm"),  # browser MediaRecorder
        (b"RIFF\x24\x08\x00\x00WAVEfmt ", "wav"),
        (b"ID3\x04\x00\x00\x00\x00\x00\x00", "mp3"),
        (b"\xff\xfb\x90\x64\x00\x00", "mp3"),  # MP3 frame without an ID3 tag
        (b"\xff\xf1\x50\x80\x00\x1f", "aac"),  # raw AAC (ADTS)
        (b"OggS\x00\x02\x00\x00", "ogg"),
        (b"fLaC\x00\x00\x00\x22", "flac"),
        (b"FORM\x00\x00\x00\x00AIFFCOMM", "aiff"),
        (b"#!AMR\n\x3c\x00", "amr"),
    ],
)
def test_formats_are_recognised_from_their_first_bytes(first_bytes, expected):
    assert detect_format(first_bytes + b"\x00" * 2000) == expected


@pytest.mark.parametrize(
    "not_audio",
    [b'{"text": "hello"}', b"<html><body>", b"%PDF-1.7", b"\x89PNG\r\n\x1a\n", b"", b"\xff"],
)
def test_non_audio_is_not_recognised(not_audio):
    assert detect_format(not_audio) is None


@pytest.mark.parametrize(
    "mime_type, expected",
    [
        ("audio/m4a", True),
        ("audio/webm;codecs=opus", True),
        ("video/mp4", True),
        ("Audio/MPEG", True),
        ("application/octet-stream", False),
        ("text/plain", False),
        ("", False),
        (None, False),
    ],
)
def test_audio_mime_types(mime_type, expected):
    assert looks_like_audio_mime(mime_type) is expected
