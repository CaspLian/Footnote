"""The only file in speech_to_text that talks to ElevenLabs.

One call to transcribe() = one HTTPS request:

    POST {base_url}/v1/speech-to-text                          (multipart/form-data)
    xi-api-key: <your key>
    model_id=scribe_v2  language_code=en  tag_audio_events=false  file=<the recording>

    200 -> JSON {"text", "language_code", "language_probability", "words": [...], ...}
    4xx/5xx -> JSON {"detail": ...} describing the error

Retries are not done here; service.py decides whether to try again.
Reference: https://elevenlabs.io/docs/api-reference/speech-to-text/convert
"""

from __future__ import annotations

from dataclasses import dataclass, field

import requests

from .config import STTConfig
from .contract import ErrorCode
from .errors import STTError

CONNECT_TIMEOUT_SECONDS = 5.0

# ElevenLabs error codes (detail.code, or the older detail.status) that need a specific mapping.
_QUOTA_CODES = {"quota_exceeded", "insufficient_credits"}
_PLAN_OR_ACCESS_CODES = {
    "feature_not_available",
    "subscription_required",
    "model_access_denied",
    "paid_plan_required",
}


@dataclass(frozen=True)
class ProviderTranscript:
    text: str
    language: str | None = None
    words: list[dict] = field(default_factory=list)
    audio_seconds: float | None = None
    request_id: str | None = None  # ElevenLabs transcription_id, or the request-id header
    redacted: tuple[str, ...] = ()  # the kinds of identifier Scribe removed, e.g. ("ssn",)


class ElevenLabsSTTProvider:
    def __init__(self, config: STTConfig, session: requests.Session | None = None) -> None:
        self._config = config
        self._session = session if session is not None else requests.Session()

    def transcribe(self, audio: bytes, filename: str, mime_type: str, language: str) -> ProviderTranscript:
        config = self._config
        # Repeated form fields: Scribe refuses lists sent as JSON strings (checked 2026-10-11).
        form = [("model_id", config.model_id), ("tag_audio_events", "false")]
        if language:
            form.append(("language_code", language))
        if config.redact_entities:
            form += [("entity_detection", entity) for entity in config.redact_entities]
            form += [("entity_redaction", entity) for entity in config.redact_entities]
            form.append(("entity_redaction_mode", "entity_type"))
        form += [("keyterms", term) for term in config.keyterms_for(language)]
        try:
            response = self._session.post(
                f"{config.base_url}/v1/speech-to-text",
                data=form,
                files={"file": (filename, audio, mime_type)},
                headers={"xi-api-key": config.api_key, "Accept": "application/json"},
                timeout=(CONNECT_TIMEOUT_SECONDS, config.timeout_seconds),
            )
        except requests.Timeout:
            raise STTError(
                ErrorCode.PROVIDER_TIMEOUT,
                f"ElevenLabs did not answer within {config.timeout_seconds:g}s (STT_TIMEOUT_SECONDS).",
                retryable=True,
            ) from None
        except requests.RequestException as exc:
            raise STTError(
                ErrorCode.PROVIDER_UNAVAILABLE,
                f"Could not reach ElevenLabs ({type(exc).__name__}).",
                retryable=True,
            ) from None

        try:
            if response.status_code != 200:
                raise _error_from_response(response)
            try:
                payload = response.json()
            except ValueError:
                payload = None
        finally:
            response.close()

        if not isinstance(payload, dict) or not isinstance(payload.get("text"), str):
            raise STTError(
                ErrorCode.PROVIDER_UNAVAILABLE,
                "ElevenLabs answered 200 but the transcript was missing.",
                retryable=True,
                status_code=200,
                provider_request_id=_request_id(response),
            )
        words = payload.get("words") if isinstance(payload.get("words"), list) else []
        duration = payload.get("audio_duration_secs")
        entities = payload.get("entities") if isinstance(payload.get("entities"), list) else []
        redacted = tuple(sorted({str(item.get("entity_type")) for item in entities if isinstance(item, dict) and item.get("entity_type")}))
        return ProviderTranscript(
            text=payload["text"],
            language=payload.get("language_code") if isinstance(payload.get("language_code"), str) else None,
            words=[word for word in words if isinstance(word, dict)],
            audio_seconds=float(duration) if isinstance(duration, (int, float)) else None,
            request_id=payload.get("transcription_id") or _request_id(response),
            redacted=redacted,
        )


def _error_from_response(response: requests.Response) -> STTError:
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

    def error(error_code: str, retryable: bool = False) -> STTError:
        return STTError(
            error_code,
            described,
            retryable=retryable,
            retry_after=_retry_after_seconds(response) if retryable else None,
            status_code=status,
            provider_request_id=request_id,
        )

    quota_in_words = status in (401, 402, 403) and "quota" in str(message).lower()
    if code in _QUOTA_CODES or legacy_status in _QUOTA_CODES or quota_in_words:
        return error(ErrorCode.QUOTA_EXCEEDED)
    if code in _PLAN_OR_ACCESS_CODES or legacy_status in _PLAN_OR_ACCESS_CODES:
        return error(ErrorCode.PROVIDER_REJECTED)
    if status == 429:
        return error(ErrorCode.RATE_LIMITED, retryable=True)
    if status in (401, 403):
        return error(ErrorCode.AUTH_FAILED)  # includes a key without the "Speech to Text" permission
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


def _retry_after_seconds(response: requests.Response) -> float | None:
    try:
        return max(0.0, float(response.headers["Retry-After"]))
    except (KeyError, TypeError, ValueError):
        return None
