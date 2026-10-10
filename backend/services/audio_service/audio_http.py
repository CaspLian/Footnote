"""HTTP responses for audio, shared by voice_routes.py (the backend) and playground.py.

Finished clips are sent whole, or in byte ranges when the player asks for them: Safari and iPhones
(AVPlayer, which expo-audio uses) first ask for "Range: bytes=0-1" and expect "206 Partial Content".
Audio that is still being made is streamed piece by piece as it arrives. Its length is not known
yet, so there are no ranges, and it must not be cached because it could still fail part-way.
Chrome, Edge, Firefox and Android play such a stream as it arrives; iPhones may not, so the app
asks for streaming only where it has been tested (see README, "Speed").
"""

from __future__ import annotations

import re

from fastapi.responses import Response, StreamingResponse

_SINGLE_RANGE = re.compile(r"bytes=(\d*)-(\d*)")


def audio_response(stream, range_header: str | None = None, *, finished_headers: dict | None = None) -> Response:
    """The HTTP response for a text_to_speech.AudioStream (from open_audio()).

    range_header: the request's Range header, if any. finished_headers: extra headers for finished
    audio only, e.g. Cache-Control for clips that never change."""
    if not stream.complete:
        return StreamingResponse(stream.chunks, media_type=stream.mime_type, headers={"Cache-Control": "no-store"})

    data = b"".join(stream.chunks)
    headers = {"Accept-Ranges": "bytes", **(finished_headers or {})}
    byte_range = _byte_range(range_header, len(data))
    if byte_range is None:
        return Response(content=data, media_type=stream.mime_type, headers=headers)
    if byte_range == "unsatisfiable":
        return Response(status_code=416, headers={**headers, "Content-Range": f"bytes */{len(data)}"})
    start, end = byte_range
    return Response(
        content=data[start : end + 1],
        status_code=206,
        media_type=stream.mime_type,
        headers={**headers, "Content-Range": f"bytes {start}-{end}/{len(data)}"},
    )


def _byte_range(header: str | None, size: int):
    """(start, end) for one "bytes=..." range, "unsatisfiable", or None to send everything
    (no header, several ranges, or a header we don't understand: HTTP allows ignoring it)."""
    match = _SINGLE_RANGE.fullmatch((header or "").strip())
    if match is None or not any(match.groups()):
        return None
    first, last = match.groups()
    if not first:  # "bytes=-500": the last 500 bytes
        length = int(last)
        if length == 0:
            return "unsatisfiable"
        return max(size - length, 0), size - 1
    start = int(first)
    if start >= size:
        return "unsatisfiable"
    end = int(last) if last else size - 1
    if end < start:
        return None  # not a valid range: ignore it
    return start, min(end, size - 1)
