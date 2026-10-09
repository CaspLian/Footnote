"""Recognise the audio format from the file's first bytes.

Apps often send a generic or wrong content type (application/octet-stream), so the bytes
decide. This costs nothing and stops non-audio uploads before they reach ElevenLabs.
"""

from __future__ import annotations

# Detected format -> (file extension, MIME type) used when the file is sent to ElevenLabs.
FORMATS = {
    "m4a": ("m4a", "audio/mp4"),  # Expo HIGH_QUALITY recordings on iOS and Android
    "3gp": ("3gp", "audio/3gpp"),  # Expo LOW_QUALITY recordings on Android
    "webm": ("webm", "audio/webm"),  # browser recordings (MediaRecorder)
    "mp3": ("mp3", "audio/mpeg"),
    "wav": ("wav", "audio/wav"),
    "ogg": ("ogg", "audio/ogg"),
    "flac": ("flac", "audio/flac"),
    "aac": ("aac", "audio/aac"),
    "aiff": ("aiff", "audio/aiff"),
    "amr": ("amr", "audio/amr"),
}

# ElevenLabs needs at least 100 ms of audio; no real recording of that length is under 1 KB.
MIN_AUDIO_BYTES = 1000


def detect_format(audio: bytes) -> str | None:
    """Return a key of FORMATS, or None if the bytes are not a format we recognise."""
    head = audio[:16]
    if head[4:8] == b"ftyp":  # MPEG-4 family: m4a, mp4, 3gp
        return "3gp" if head[8:10] == b"3g" else "m4a"
    if head.startswith(b"RIFF") and head[8:12] == b"WAVE":
        return "wav"
    if head.startswith(b"ID3"):
        return "mp3"
    if head.startswith(b"OggS"):
        return "ogg"
    if head.startswith(b"fLaC"):
        return "flac"
    if head.startswith(b"\x1a\x45\xdf\xa3"):  # Matroska / WebM
        return "webm"
    if head.startswith(b"FORM") and head[8:12] in (b"AIFF", b"AIFC"):
        return "aiff"
    if head.startswith(b"#!AMR"):
        return "amr"
    if len(head) >= 2 and head[0] == 0xFF and (head[1] & 0xE0) == 0xE0:  # an audio frame header
        return "aac" if (head[1] & 0x06) == 0 else "mp3"  # ADTS AAC has layer bits 00
    return None


def looks_like_audio_mime(mime_type: str | None) -> bool:
    return bool(mime_type) and mime_type.split(";")[0].strip().lower().startswith(("audio/", "video/"))
