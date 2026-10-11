"""Tests for the ElevenLabs speech-to-text HTTP layer, with a fake session: no network, no cost."""

import json

import pytest
import requests
from requests.structures import CaseInsensitiveDict

from speech_to_text.config import DEFAULT_KEYTERMS, DEFAULT_REDACTED_ENTITIES, STTConfig
from speech_to_text.contract import ErrorCode
from speech_to_text.elevenlabs_provider import ElevenLabsSTTProvider
from speech_to_text.errors import STTError

SECRET_KEY = "sk-test-secret-456"
CONFIG = STTConfig(api_key=SECRET_KEY, model_id="scribe_v2")
AUDIO = b"\x00\x00\x00\x20ftypM4A " + b"\x00" * 2000

TRANSCRIPT_JSON = {
    "language_code": "eng",
    "language_probability": 0.98,
    "text": "Why was my MRI billed so much?",
    "words": [
        {"text": "Why", "type": "word", "logprob": -0.01, "start": 0.0, "end": 0.3},
        {"text": " ", "type": "spacing", "logprob": 0.0, "start": 0.3, "end": 0.32},
        {"text": "was", "type": "word", "logprob": -0.02, "start": 0.32, "end": 0.5},
    ],
    "audio_duration_secs": 2.4,
    "transcription_id": "tr-123",
}


def make_response(status=200, json_body=None, body=b"", headers=None):
    response = requests.Response()
    response.status_code = status
    response.reason = {200: "OK"}.get(status, "")
    if json_body is not None:
        body = json.dumps(json_body).encode()
        headers = {"Content-Type": "application/json", **(headers or {})}
    response.headers = CaseInsensitiveDict(headers or {})
    response._content = body
    response._content_consumed = True
    response.encoding = "utf-8"
    return response


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


def transcribe(*outcomes, config=CONFIG, language="en"):
    session = FakeSession(*outcomes)
    result = ElevenLabsSTTProvider(config, session).transcribe(AUDIO, "recording.m4a", "audio/mp4", language)
    return result, session


def transcribe_error(*outcomes, config=CONFIG) -> STTError:
    with pytest.raises(STTError) as caught:
        transcribe(*outcomes, config=config)
    return caught.value


def test_request_matches_the_documented_api():
    _, session = transcribe(make_response(json_body=TRANSCRIPT_JSON))
    call = session.calls[0]
    assert call["url"] == "https://api.elevenlabs.io/v1/speech-to-text"
    assert call["data"][:3] == [("model_id", "scribe_v2"), ("tag_audio_events", "false"), ("language_code", "en")]
    assert call["files"] == {"file": ("recording.m4a", AUDIO, "audio/mp4")}
    assert call["headers"]["xi-api-key"] == SECRET_KEY
    assert call["timeout"] == (5.0, 60.0)


def test_empty_language_lets_elevenlabs_detect_it():
    _, session = transcribe(make_response(json_body=TRANSCRIPT_JSON), language="")
    assert "language_code" not in [name for name, _ in session.calls[0]["data"]]


def test_success_returns_text_words_duration_and_id():
    result, _ = transcribe(make_response(json_body=TRANSCRIPT_JSON))
    assert result.text == "Why was my MRI billed so much?"
    assert result.language == "eng"
    assert len(result.words) == 3
    assert result.audio_seconds == 2.4
    assert result.request_id == "tr-123"


def test_request_id_header_is_used_when_there_is_no_transcription_id():
    body = {key: value for key, value in TRANSCRIPT_JSON.items() if key != "transcription_id"}
    result, _ = transcribe(make_response(json_body=body, headers={"request-id": "req-9"}))
    assert result.request_id == "req-9"


@pytest.mark.parametrize("bad_body", [{"words": []}, {"text": 5}, ["not", "a", "dict"]])
def test_200_without_a_transcript_is_an_error(bad_body):
    error = transcribe_error(make_response(json_body=bad_body))
    assert error.code == ErrorCode.PROVIDER_UNAVAILABLE and error.retryable


def test_200_that_is_not_json_is_an_error():
    error = transcribe_error(make_response(body=b"<html>oops</html>", headers={"Content-Type": "text/html"}))
    assert error.code == ErrorCode.PROVIDER_UNAVAILABLE


@pytest.mark.parametrize(
    "status, detail, expected_code, retryable",
    [
        (401, {"code": "unauthorized", "status": "invalid_api_key", "message": "Invalid API key"},
         ErrorCode.AUTH_FAILED, False),
        (401, {"status": "missing_permissions", "message": "The API key is missing the permission speech_to_text"},
         ErrorCode.AUTH_FAILED, False),
        (401, {"code": "unauthorized", "message": "This request exceeds your quota limit."}, ErrorCode.QUOTA_EXCEEDED, False),
        (402, {"type": "payment_required", "code": "insufficient_credits"}, ErrorCode.QUOTA_EXCEEDED, False),
        (403, {"code": "model_access_denied"}, ErrorCode.PROVIDER_REJECTED, False),
        (400, {"type": "validation_error", "code": "invalid_parameters", "message": "audio too short"},
         ErrorCode.PROVIDER_REJECTED, False),
        (422, [{"type": "missing", "loc": ["body", "model_id"], "msg": "Field required"}], ErrorCode.PROVIDER_REJECTED, False),
        (429, {"code": "concurrent_limit_exceeded"}, ErrorCode.RATE_LIMITED, True),
        (500, {"type": "internal_error"}, ErrorCode.PROVIDER_UNAVAILABLE, True),
        (503, {}, ErrorCode.PROVIDER_UNAVAILABLE, True),
    ],
)
def test_error_responses_are_mapped(status, detail, expected_code, retryable):
    error = transcribe_error(make_response(status, json_body={"detail": detail}))
    assert error.code == expected_code
    assert error.retryable is retryable
    assert error.status_code == status


def test_validation_error_list_is_readable():
    error = transcribe_error(make_response(422, json_body={"detail": [{"loc": ["body", "file"], "msg": "Field required"}]}))
    assert "body.file: Field required" in error.message


@pytest.mark.parametrize(
    "exception, expected_code",
    [
        (requests.ConnectTimeout("connect timed out"), ErrorCode.PROVIDER_TIMEOUT),
        (requests.ReadTimeout("read timed out"), ErrorCode.PROVIDER_TIMEOUT),
        (requests.ConnectionError("DNS failure"), ErrorCode.PROVIDER_UNAVAILABLE),
    ],
)
def test_network_failures_are_retryable(exception, expected_code):
    error = transcribe_error(exception)
    assert error.code == expected_code and error.retryable


def test_api_key_never_appears_in_errors_or_config_repr():
    errors = [
        transcribe_error(make_response(401, json_body={"detail": {"message": "Invalid API key"}})),
        transcribe_error(requests.ConnectionError(f"failed for {SECRET_KEY}")),
    ]
    for error in errors:
        assert SECRET_KEY not in error.message and SECRET_KEY not in str(error)
    assert SECRET_KEY not in repr(CONFIG)


def test_identifiers_are_redacted_and_billing_words_are_listened_for():
    _, session = transcribe(make_response(json_body=TRANSCRIPT_JSON))
    data = session.calls[0]["data"]
    # Repeated form fields: Scribe refuses lists sent as JSON strings.
    assert [value for name, value in data if name == "entity_detection"] == list(DEFAULT_REDACTED_ENTITIES)
    assert [value for name, value in data if name == "entity_redaction"] == list(DEFAULT_REDACTED_ENTITIES)
    assert ("entity_redaction_mode", "entity_type") in data and "ssn" in DEFAULT_REDACTED_ENTITIES
    assert "name" not in DEFAULT_REDACTED_ENTITIES and "condition" not in DEFAULT_REDACTED_ENTITIES  # the question needs them
    assert [value for name, value in data if name == "keyterms"] == list(DEFAULT_KEYTERMS)


def test_other_languages_get_only_names_as_keyterms():
    _, session = transcribe(make_response(json_body=TRANSCRIPT_JSON), language="es")
    assert [value for name, value in session.calls[0]["data"] if name == "keyterms"] == ["Footnote", "Medicare", "Medicaid"]


def test_redaction_and_keyterms_can_be_turned_off():
    config = STTConfig(api_key=SECRET_KEY, model_id="scribe_v2", redact_entities=(), keyterms=())
    _, session = transcribe(make_response(json_body=TRANSCRIPT_JSON), config=config)
    assert {name for name, _ in session.calls[0]["data"]} == {"model_id", "tag_audio_events", "language_code"}


def test_the_kinds_of_identifier_removed_are_reported():
    body = {**TRANSCRIPT_JSON, "text": "My member ID is {ACCOUNT_NUMBER}.",
            "entities": [{"text": "{ACCOUNT_NUMBER}", "entity_type": "account_number", "start_char": 16, "end_char": 32},
                         {"text": "{SSN}", "entity_type": "ssn", "start_char": 40, "end_char": 45}]}
    result, _ = transcribe(make_response(json_body=body))
    assert result.redacted == ("account_number", "ssn") and "{ACCOUNT_NUMBER}" in result.text
