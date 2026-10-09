"""Tests for the ElevenLabs HTTP layer, using a fake session: no network, no API key, no cost.

The error bodies below follow the shapes in the ElevenLabs errors page and the
live 401/422 responses observed on 2026-10-09.
"""

import json

import pytest
import requests
from requests.structures import CaseInsensitiveDict

from text_to_speech.config import TTSConfig
from text_to_speech.contract import ErrorCode
from text_to_speech.elevenlabs_provider import ElevenLabsProvider
from text_to_speech.errors import TTSError

SECRET_KEY = "sk-test-secret-123"
CONFIG = TTSConfig(api_key=SECRET_KEY, voice_id="voice-1", model_id="model-1", cache_dir=None)


def make_response(status=200, body=b"", headers=None, json_body=None):
    response = requests.Response()
    response.status_code = status
    response.reason = {200: "OK", 401: "Unauthorized", 429: "Too Many Requests"}.get(status, "")
    if json_body is not None:
        body = json.dumps(json_body).encode()
        headers = {"Content-Type": "application/json", **(headers or {})}
    response.headers = CaseInsensitiveDict(headers or {})
    response._content = body
    response._content_consumed = True
    response.encoding = "utf-8"
    return response


def audio_response(body=b"ID3fake-mp3", **headers):
    return make_response(200, body, {"Content-Type": "audio/mpeg", **headers})


class FakeSession:
    def __init__(self, *outcomes):
        self.outcomes = list(outcomes)
        self.calls = []

    def post(self, url, **kwargs):
        self.calls.append({"url": url, **kwargs})
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def generate(*outcomes, config=CONFIG, clock=None):
    session = FakeSession(*outcomes)
    provider = ElevenLabsProvider(config, session, **({"clock": clock} if clock else {}))
    return provider.generate("Hello there.", config.voice_id or "voice-1"), session


def generate_error(*outcomes, config=CONFIG) -> TTSError:
    with pytest.raises(TTSError) as caught:
        generate(*outcomes, config=config)
    return caught.value


# --- The request we send -----------------------------------------------------------------


def test_request_matches_the_documented_api():
    _, session = generate(audio_response())
    call = session.calls[0]
    assert call["url"] == "https://api.elevenlabs.io/v1/text-to-speech/voice-1"
    assert call["params"] == {"output_format": "mp3_44100_128"}
    assert call["json"] == {"text": "Hello there.", "model_id": "model-1"}  # no voice_settings unless set
    assert call["headers"]["xi-api-key"] == SECRET_KEY
    assert call["timeout"] == (5.0, 60.0)
    assert call["stream"] is True


def test_speed_is_sent_as_a_voice_setting():
    config = TTSConfig(api_key="k", voice_id="v", model_id="m", speed=1.1, cache_dir=None)
    _, session = generate(audio_response(), config=config)
    assert session.calls[0]["json"]["voice_settings"] == {"speed": 1.1}


def test_voice_id_cannot_change_the_url_path():
    config = TTSConfig(api_key="k", voice_id="../v1/user?x=1", model_id="m", cache_dir=None)
    _, session = generate(audio_response(), config=config)
    assert session.calls[0]["url"] == "https://api.elevenlabs.io/v1/text-to-speech/..%2Fv1%2Fuser%3Fx%3D1"


# --- Success -----------------------------------------------------------------------------


def test_success_returns_audio_and_documented_headers():
    audio, _ = generate(audio_response(b"ID3audio", **{"request-id": "req-abc", "character-cost": "12"}))
    assert audio.audio == b"ID3audio"
    assert audio.request_id == "req-abc"
    assert audio.characters_billed == 12


def test_missing_optional_headers_are_none():
    audio, _ = generate(audio_response())
    assert audio.request_id is None and audio.characters_billed is None


def test_json_instead_of_audio_is_an_error():
    error = generate_error(make_response(200, json_body={"unexpected": True}))
    assert error.code == ErrorCode.PROVIDER_UNAVAILABLE and error.retryable


# --- Error mapping -----------------------------------------------------------------------


@pytest.mark.parametrize(
    "status, detail, expected_code, retryable",
    [
        # Live 401 shape: new "code" plus legacy "status".
        (401, {"type": "authentication_error", "code": "unauthorized", "message": "Invalid API key",
               "status": "invalid_api_key", "request_id": "trace-1"}, ErrorCode.AUTH_FAILED, False),
        (401, {"status": "quota_exceeded", "message": "You have insufficient quota."}, ErrorCode.QUOTA_EXCEEDED, False),
        (401, {"code": "unauthorized", "message": "This request exceeds your quota limit of 10000."},
         ErrorCode.QUOTA_EXCEEDED, False),
        (401, {"status": "missing_permissions", "message": "The API key is missing the permission text_to_speech"},
         ErrorCode.AUTH_FAILED, False),
        (401, {"status": "detected_unusual_activity", "message": "Unusual activity detected."},
         ErrorCode.AUTH_FAILED, False),
        # Free plan + Voice Library voice (developer-reported body, 2026-09/10).
        (402, {"type": "payment_required", "code": "paid_plan_required",
               "message": "Free users cannot use library voices via the API."}, ErrorCode.PROVIDER_REJECTED, False),
        (400, {"type": "invalid_request", "code": "bad_request", "status": "free_users_not_allowed",
               "message": "You need to be on the creator tier or above to use this voice."},
         ErrorCode.PROVIDER_REJECTED, False),
        (402, {"type": "payment_required", "code": "insufficient_credits"}, ErrorCode.QUOTA_EXCEEDED, False),
        (402, {"type": "payment_required"}, ErrorCode.QUOTA_EXCEEDED, False),
        (403, {"type": "authorization_error", "code": "voice_access_denied"}, ErrorCode.PROVIDER_REJECTED, False),
        (403, {"type": "authorization_error", "code": "subscription_required"}, ErrorCode.PROVIDER_REJECTED, False),
        (403, {"type": "authorization_error", "code": "missing_permissions"}, ErrorCode.AUTH_FAILED, False),
        (404, {"type": "not_found", "code": "voice_not_found"}, ErrorCode.PROVIDER_REJECTED, False),
        (400, {"status": "voice_not_found", "message": "voice not found"}, ErrorCode.PROVIDER_REJECTED, False),
        (400, {"type": "validation_error", "code": "invalid_output_format"}, ErrorCode.PROVIDER_REJECTED, False),
        (429, {"type": "rate_limit_error", "code": "concurrent_limit_exceeded",
               "status": "too_many_concurrent_requests"}, ErrorCode.RATE_LIMITED, True),
        (429, {"type": "rate_limit_error", "code": "system_busy"}, ErrorCode.RATE_LIMITED, True),
        (429, {"code": "rate_limit_exceeded", "message": "You exceeded your per-minute quota."},
         ErrorCode.RATE_LIMITED, True),
        (408, {}, ErrorCode.PROVIDER_TIMEOUT, True),
        (500, {"type": "internal_error"}, ErrorCode.PROVIDER_UNAVAILABLE, True),
        (503, {"type": "service_unavailable"}, ErrorCode.PROVIDER_UNAVAILABLE, True),
    ],
)
def test_error_responses_are_mapped(status, detail, expected_code, retryable):
    error = generate_error(make_response(status, json_body={"detail": detail}))
    assert error.code == expected_code
    assert error.retryable is retryable
    assert error.status_code == status


def test_error_message_includes_provider_code_message_and_request_id():
    error = generate_error(
        make_response(401, json_body={"detail": {"code": "unauthorized", "message": "Invalid API key",
                                                 "request_id": "trace-1"}})
    )
    assert error.message == "ElevenLabs returned HTTP 401 (unauthorized): Invalid API key"
    assert error.provider_request_id == "trace-1"


def test_validation_error_list_is_readable():
    body = {"detail": [{"type": "missing", "loc": ["body", "text"], "msg": "Field required", "input": None}]}
    error = generate_error(make_response(422, json_body=body))
    assert error.code == ErrorCode.PROVIDER_REJECTED
    assert "body.text: Field required" in error.message


def test_non_json_error_body_is_handled():
    error = generate_error(make_response(502, b"<html>Bad gateway</html>", {"Content-Type": "text/html"}))
    assert error.code == ErrorCode.PROVIDER_UNAVAILABLE and error.retryable
    assert "Bad gateway" in error.message


def test_retry_after_header_is_read_for_retryable_errors():
    error = generate_error(make_response(429, json_body={"detail": {}}, headers={"Retry-After": "2"}))
    assert error.retry_after == 2.0


def test_trace_id_header_is_used_when_body_has_no_request_id():
    error = generate_error(make_response(500, json_body={"detail": {}}, headers={"x-trace-id": "trace-9"}))
    assert error.provider_request_id == "trace-9"


@pytest.mark.parametrize(
    "exception, expected_code",
    [
        (requests.ConnectTimeout("connect timed out"), ErrorCode.PROVIDER_TIMEOUT),
        (requests.ReadTimeout("read timed out"), ErrorCode.PROVIDER_TIMEOUT),
        (requests.ConnectionError("DNS failure"), ErrorCode.PROVIDER_UNAVAILABLE),
    ],
)
def test_network_failures_are_retryable(exception, expected_code):
    error = generate_error(exception)
    assert error.code == expected_code and error.retryable


def test_total_deadline_stops_a_slow_download():
    class SlowBody(requests.Response):
        def iter_content(self, chunk_size=1, decode_unicode=False):
            yield b"part1"
            yield b"part2"

    response = SlowBody()
    response.status_code = 200
    response.headers = CaseInsensitiveDict({"Content-Type": "audio/mpeg"})
    response._content_consumed = True  # nothing left for close() to release
    times = iter([0.0, 5.0, 65.0])  # start, after chunk 1, after chunk 2 (> 60 s deadline)
    with pytest.raises(TTSError) as caught:
        generate(response, clock=lambda: next(times))
    assert caught.value.code == ErrorCode.PROVIDER_TIMEOUT


def test_connection_drop_during_download_is_retryable():
    class BrokenBody(requests.Response):
        def iter_content(self, chunk_size=1, decode_unicode=False):
            yield b"part1"
            raise requests.ConnectionError("connection reset")

    response = BrokenBody()
    response.status_code = 200
    response.headers = CaseInsensitiveDict({"Content-Type": "audio/mpeg"})
    response._content_consumed = True  # nothing left for close() to release
    error = generate_error(response)
    assert error.code == ErrorCode.PROVIDER_UNAVAILABLE and error.retryable


# --- Secrets -----------------------------------------------------------------------------


def test_api_key_never_appears_in_errors_or_config_repr():
    errors = [
        generate_error(make_response(401, json_body={"detail": {"message": "Invalid API key"}})),
        generate_error(requests.ConnectionError(f"failed for {SECRET_KEY}")),
    ]
    for error in errors:
        assert SECRET_KEY not in error.message
        assert SECRET_KEY not in str(error)
    assert SECRET_KEY not in repr(CONFIG)
