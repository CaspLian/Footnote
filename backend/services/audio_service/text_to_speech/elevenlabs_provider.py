"""The only file that talks to ElevenLabs.

One call to generate() = one HTTPS request:

    POST {base_url}/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128
    xi-api-key: <your key>
    {"text": "...", "model_id": "...", "voice_settings": {...}}

    200 -> audio bytes (+ "request-id" and "character-cost" headers)
    4xx/5xx -> JSON {"detail": ...} describing the error

Retries are not done here; service.py decides whether to try again.
Reference: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from urllib.parse import quote

import requests

from .config import TTSConfig
from .contract import ErrorCode
from .errors import TTSError

CONNECT_TIMEOUT_SECONDS = 5.0
_CHUNK_BYTES = 64 * 1024

# ElevenLabs error codes (detail.code, or the older detail.status) that need a specific mapping.
# Docs list both "quota_exceeded" (older help-centre pages) and "insufficient_credits" (errors page).
_QUOTA_CODES = {"quota_exceeded", "insufficient_credits"}
# "paid_plan_required" (402) is what free accounts get for Voice Library voices;
# "free_users_not_allowed" (400) for voices their owner restricted to paid tiers.
_PLAN_OR_ACCESS_CODES = {
    "feature_not_available",
    "subscription_required",
    "voice_access_denied",
    "model_access_denied",
    "paid_plan_required",
    "free_users_not_allowed",
}


@dataclass(frozen=True)
class ProviderAudio:
    audio: bytes
    request_id: str | None = None  # ElevenLabs "request-id" header
    characters_billed: int | None = None  # ElevenLabs "character-cost" header


class ElevenLabsProvider:
    def __init__(self, config: TTSConfig, session: requests.Session | None = None, *, clock=time.monotonic) -> None:
        self._config = config
        self._session = session if session is not None else requests.Session()
        self._clock = clock

    def generate(self, text: str) -> ProviderAudio:
        config = self._config
        settings = config.audio_settings()
        url = f"{config.base_url}/v1/text-to-speech/{quote(settings['voice_id'], safe='')}"
        body: dict = {"text": text, "model_id": settings["model_id"]}
        if settings["voice_settings"]:
            body["voice_settings"] = settings["voice_settings"]

        # requests' timeouts limit each wait for data, not the whole call, so we also check a
        # total deadline as data arrives (worst case: the deadline plus one stalled read).
        # A timeout here does NOT cancel the generation on ElevenLabs' side: it may still
        # finish and be billed.
        deadline = self._clock() + config.timeout_seconds
        try:
            response = self._session.post(
                url,
                params={"output_format": settings["output_format"]},
                json=body,
                headers={"xi-api-key": config.api_key, "Accept": "audio/*, application/json"},
                timeout=(CONNECT_TIMEOUT_SECONDS, config.timeout_seconds),
                stream=True,
            )
        except requests.Timeout:
            raise _timeout_error(config.timeout_seconds) from None
        except requests.RequestException as exc:
            raise TTSError(
                ErrorCode.PROVIDER_UNAVAILABLE,
                f"Could not reach ElevenLabs ({type(exc).__name__}).",
                retryable=True,
            ) from None

        try:
            if response.status_code != 200:
                raise _error_from_response(response)
            if "json" in response.headers.get("Content-Type", "").lower():
                raise TTSError(
                    ErrorCode.PROVIDER_UNAVAILABLE,
                    "ElevenLabs answered 200 but sent JSON instead of audio.",
                    retryable=True,
                    status_code=200,
                    provider_request_id=_request_id(response),
                )
            audio = self._read_body(response, deadline)
        finally:
            response.close()

        return ProviderAudio(
            audio=audio,
            request_id=_request_id(response),
            characters_billed=_int_header(response, "character-cost"),
        )

    def _read_body(self, response: requests.Response, deadline: float) -> bytes:
        chunks = []
        try:
            for chunk in response.iter_content(chunk_size=_CHUNK_BYTES):
                chunks.append(chunk)
                if self._clock() > deadline:
                    raise _timeout_error(self._config.timeout_seconds)
        except requests.RequestException:  # connection dropped or stalled mid-download
            raise TTSError(
                ErrorCode.PROVIDER_UNAVAILABLE,
                "The connection to ElevenLabs broke while downloading the audio.",
                retryable=True,
                provider_request_id=_request_id(response),
            ) from None
        return b"".join(chunks)


def _timeout_error(timeout_seconds: float) -> TTSError:
    return TTSError(
        ErrorCode.PROVIDER_TIMEOUT,
        f"ElevenLabs did not finish within {timeout_seconds:g}s (TTS_TIMEOUT_SECONDS).",
        retryable=True,
    )


def _error_from_response(response: requests.Response) -> TTSError:
    status = response.status_code
    detail = _error_detail(response)
    code = str(detail.get("code") or "").lower()
    legacy_status = str(detail.get("status") or "").lower()  # older error format
    message = detail.get("message") or response.reason or "no message"
    request_id = detail.get("request_id") or _request_id(response)
    described = f"ElevenLabs returned HTTP {status}"
    if code or legacy_status:
        described += f" ({code or legacy_status})"
    described += f": {message}"

    def error(error_code: str, retryable: bool = False) -> TTSError:
        return TTSError(
            error_code,
            described,
            retryable=retryable,
            retry_after=_retry_after_seconds(response) if retryable else None,
            status_code=status,
            provider_request_id=request_id,
        )

    # Some quota errors only say so in words: "401 ... This request exceeds your quota limit of ...".
    # Only trusted for auth/payment statuses, so a 429 "per-minute quota" stays a retryable rate limit.
    quota_in_words = status in (401, 402, 403) and "quota" in str(message).lower()
    if code in _QUOTA_CODES or legacy_status in _QUOTA_CODES or quota_in_words:
        return error(ErrorCode.QUOTA_EXCEEDED)
    if code in _PLAN_OR_ACCESS_CODES or legacy_status in _PLAN_OR_ACCESS_CODES:
        return error(ErrorCode.PROVIDER_REJECTED)
    if status == 429:
        return error(ErrorCode.RATE_LIMITED, retryable=True)
    if status in (401, 403):
        return error(ErrorCode.AUTH_FAILED)
    if status == 402:
        return error(ErrorCode.QUOTA_EXCEEDED)
    if status == 408:
        return error(ErrorCode.PROVIDER_TIMEOUT, retryable=True)
    if status >= 500:
        return error(ErrorCode.PROVIDER_UNAVAILABLE, retryable=True)
    return error(ErrorCode.PROVIDER_REJECTED)  # 400, 404, 422, ...: the request itself is wrong


def _error_detail(response: requests.Response) -> dict:
    """ElevenLabs errors look like {"detail": {...}} or, for validation errors, {"detail": [...]}."""
    try:
        payload = response.json()
    except ValueError:
        return {"message": (response.text or "")[:200].strip() or None}
    detail = payload.get("detail") if isinstance(payload, dict) else None
    if isinstance(detail, dict):
        return detail
    if isinstance(detail, list) and detail and isinstance(detail[0], dict):
        first = detail[0]
        location = ".".join(str(part) for part in first.get("loc", []))
        return {"code": "validation_error", "message": f"{location}: {first.get('msg', '')}".strip(": ")}
    if isinstance(detail, str):
        return {"message": detail}
    return {}


def _request_id(response: requests.Response) -> str | None:
    return response.headers.get("request-id") or response.headers.get("x-trace-id")


def _int_header(response: requests.Response, name: str) -> int | None:
    try:
        return int(response.headers[name])
    except (KeyError, TypeError, ValueError):
        return None


def _retry_after_seconds(response: requests.Response) -> float | None:
    try:
        return max(0.0, float(response.headers["Retry-After"]))
    except (KeyError, TypeError, ValueError):
        return None
