"""Tests for the speech-to-text pipeline, using a fake provider: no network, no API key, no cost."""

import asyncio
import math
import threading

import pytest

import speech_to_text.service as service_module
from speech_to_text.config import STTConfig
from speech_to_text.contract import ErrorCode, STTRequest
from speech_to_text.elevenlabs_provider import ProviderTranscript
from speech_to_text.errors import STTError
from speech_to_text.service import STTService, transcribe, transcribe_async

CONFIG = STTConfig(api_key="test-key", model_id="scribe_v2", max_audio_mb=1)
M4A = b"\x00\x00\x00\x20ftypM4A " + b"\x01" * 4000  # looks like a phone recording
WEBM = b"\x1a\x45\xdf\xa3" + b"\x02" * 4000


def words(*pairs):
    return [{"text": text, "type": "word", "logprob": math.log(probability)} for text, probability in pairs]


class FakeProvider:
    """Returns a fixed transcript; can fail a given number of times first."""

    def __init__(self, text="Why was my MRI  billed $3,200?", failures=(), audio_seconds=3.5, transcript_words=None):
        self.calls = []
        self._text = text
        self._failures = list(failures)
        self._audio_seconds = audio_seconds
        self._words = transcript_words if transcript_words is not None else words(("Why", 0.9), ("MRI", 0.7))
        self._lock = threading.Lock()

    def transcribe(self, audio, filename, mime_type, language):
        with self._lock:
            self.calls.append({"audio": audio, "filename": filename, "mime_type": mime_type, "language": language})
            failure = self._failures.pop(0) if self._failures else None
        if failure is not None:
            raise failure
        return ProviderTranscript(
            text=self._text, language="eng", words=self._words, audio_seconds=self._audio_seconds, request_id="tr-1"
        )


def make_service(provider=None, config=CONFIG):
    sleeps = []
    service = STTService(config, provider if provider is not None else FakeProvider(), sleep=sleeps.append)
    return service, sleeps


def req(audio=M4A, request_id="voice-1", **kwargs):
    return STTRequest(request_id=request_id, audio=audio, **kwargs)


def temporary_failure():
    return STTError(ErrorCode.PROVIDER_UNAVAILABLE, "server error", retryable=True)


# --- Happy path -------------------------------------------------------------------------


def test_success_returns_clean_text_and_evidence():
    provider = FakeProvider()
    service, _ = make_service(provider)
    result = service.transcribe(req(mime_type="application/octet-stream", request_id="msg-7"))

    assert result.ok
    assert result.request_id == "msg-7"
    assert result.text == "Why was my MRI billed $3,200?"  # spacing tidied, words kept
    assert result.language == "eng"
    assert result.confidence == 0.8
    assert result.audio_seconds == 3.5
    assert result.audio_format == "m4a"
    assert result.attempts == 1 and not result.cached
    assert result.provider_request_id == "tr-1"
    # The detected format wins over the generic content type the app sent.
    assert provider.calls[0]["filename"] == "recording.m4a"
    assert provider.calls[0]["mime_type"] == "audio/mp4"
    assert provider.calls[0]["language"] == "en"


def test_browser_recording_is_sent_as_webm():
    provider = FakeProvider()
    service, _ = make_service(provider)
    assert service.transcribe(req(audio=WEBM)).audio_format == "webm"
    assert provider.calls[0]["mime_type"] == "audio/webm"


def test_unknown_format_with_an_audio_content_type_is_left_to_elevenlabs():
    provider = FakeProvider()
    service, _ = make_service(provider)
    result = service.transcribe(req(audio=b"\x07" * 4000, mime_type="audio/x-caf; codecs=opus"))
    assert result.ok and result.audio_format is None
    assert provider.calls[0]["filename"] == "recording"
    assert provider.calls[0]["mime_type"] == "audio/x-caf"


def test_bytearray_audio_is_accepted():
    service, _ = make_service()
    assert service.transcribe(req(audio=bytearray(M4A))).ok


def test_empty_language_lets_elevenlabs_detect_it():
    provider = FakeProvider()
    service, _ = make_service(provider)
    service.transcribe(req(language=""))
    assert provider.calls[0]["language"] == ""


# --- Failing fast, before any cost ------------------------------------------------------


@pytest.mark.parametrize(
    "audio, mime_type, expected_code",
    [
        (b"", None, ErrorCode.EMPTY_AUDIO),
        (M4A[:500], "audio/m4a", ErrorCode.EMPTY_AUDIO),
        (b"{" + b'"a": 1, ' * 600 + b"}", "application/json", ErrorCode.UNSUPPORTED_AUDIO),
        (b"<html>" + b"x" * 2000, None, ErrorCode.UNSUPPORTED_AUDIO),
        (M4A + b"\x00" * (2 * 1024 * 1024), "audio/m4a", ErrorCode.AUDIO_TOO_LARGE),  # limit is 1 MB here
    ],
    ids=["empty", "tiny", "json", "html", "too-large"],  # short names: the 2 MB value would become the test id
)
def test_bad_audio_fails_without_calling_elevenlabs(audio, mime_type, expected_code):
    provider = FakeProvider()
    service, _ = make_service(provider)
    result = service.transcribe(req(audio=audio, mime_type=mime_type))
    assert result.error_code == expected_code and not result.retryable
    assert provider.calls == []


@pytest.mark.parametrize(
    "bad_request",
    [
        {"request_id": "r1", "audio": M4A},
        STTRequest(request_id="", audio=M4A),
        STTRequest(request_id="r1", audio="not bytes"),
        STTRequest(request_id="r1", audio=M4A, mime_type=123),
        STTRequest(request_id="r1", audio=M4A, language="English"),
        STTRequest(request_id="r1", audio=M4A, language=None),
    ],
)
def test_invalid_requests_return_an_error_instead_of_raising(bad_request):
    provider = FakeProvider()
    service, _ = make_service(provider)
    result = service.transcribe(bad_request)
    assert result.error_code == ErrorCode.INVALID_REQUEST
    assert provider.calls == []


def test_missing_api_key_reports_not_configured():
    provider = FakeProvider()
    service, _ = make_service(provider, config=STTConfig())
    assert service.transcribe(req()).error_code == ErrorCode.NOT_CONFIGURED
    assert provider.calls == []


@pytest.mark.parametrize("silent_text", ["", "   ", "...", "(silence)"])
def test_silence_is_no_speech(silent_text):
    tags = [{"text": "(silence)", "type": "audio_event", "logprob": 0.0}] if silent_text == "(silence)" else []
    service, _ = make_service(FakeProvider(text=silent_text, transcript_words=tags))
    result = service.transcribe(req())
    assert result.error_code == ErrorCode.NO_SPEECH and not result.retryable
    assert result.attempts == 1


# --- Cache ------------------------------------------------------------------------------


def test_same_recording_again_is_free():
    provider = FakeProvider()
    service, _ = make_service(provider)
    first = service.transcribe(req(request_id="a"))
    again = service.transcribe(req(request_id="b"))
    assert len(provider.calls) == 1
    assert again.ok and again.cached and again.attempts == 0
    assert again.request_id == "b" and again.text == first.text
    assert service.stats()["cache_hits"] == 1


def test_a_different_language_is_a_new_transcription():
    provider = FakeProvider()
    service, _ = make_service(provider)
    service.transcribe(req(language="en"))
    service.transcribe(req(language="es"))
    assert len(provider.calls) == 2


def test_no_speech_is_not_cached():
    provider = FakeProvider(text="")
    service, _ = make_service(provider)
    service.transcribe(req())
    service.transcribe(req())
    assert len(provider.calls) == 2


# --- Retries ----------------------------------------------------------------------------


def test_temporary_failure_is_retried_once_then_succeeds():
    provider = FakeProvider(failures=[temporary_failure()])
    service, sleeps = make_service(provider)
    result = service.transcribe(req())
    assert result.ok and result.attempts == 2 and len(sleeps) == 1


def test_permanent_failure_is_not_retried():
    provider = FakeProvider(failures=[STTError(ErrorCode.AUTH_FAILED, "no permission", status_code=401)])
    service, sleeps = make_service(provider)
    result = service.transcribe(req())
    assert result.error_code == ErrorCode.AUTH_FAILED and result.attempts == 1 and sleeps == []


def test_retries_are_bounded():
    provider = FakeProvider(failures=[temporary_failure()] * 5)
    service, _ = make_service(provider)
    result = service.transcribe(req())
    assert result.error_code == ErrorCode.PROVIDER_UNAVAILABLE and result.retryable
    assert result.attempts == 2 and len(provider.calls) == 2


def test_unexpected_exception_becomes_internal_error():
    provider = FakeProvider(failures=[RuntimeError("bug")])
    service, _ = make_service(provider)
    result = service.transcribe(req())
    assert result.error_code == ErrorCode.INTERNAL_ERROR and "bug" not in result.error_message


def test_request_object_whose_attributes_raise_still_gets_a_result():
    class Hostile:
        @property
        def request_id(self):
            raise RuntimeError("boom")

    service, _ = make_service()
    assert service.transcribe(Hostile()).error_code == ErrorCode.INVALID_REQUEST


# --- Stats ------------------------------------------------------------------------------


def test_stats_count_billed_audio_including_silence():
    service, _ = make_service(FakeProvider(audio_seconds=2.0))
    service.transcribe(req())
    service.transcribe(req())  # cached: not billed again
    silent, _ = make_service(FakeProvider(text="", audio_seconds=1.5))
    silent.transcribe(req())
    assert service.stats()["audio_seconds_transcribed"] == 2.0
    assert service.stats()["cache_hits"] == 1
    assert silent.stats()["audio_seconds_transcribed"] == 1.5  # ElevenLabs bills silence too
    assert silent.stats()["failures_by_code"] == {ErrorCode.NO_SPEECH: 1}


def test_concurrent_different_recordings_keep_their_own_request_ids():
    service, _ = make_service()
    results = [None] * 8

    def worker(index):
        results[index] = service.transcribe(req(audio=M4A + bytes([index]), request_id=f"v{index}"))

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=5)
    assert [r.request_id for r in results] == [f"v{i}" for i in range(8)]
    assert all(r.ok for r in results)


# --- Module-level functions the backend calls ---------------------------------------------


@pytest.fixture
def default_service(monkeypatch):
    service, _ = make_service()
    monkeypatch.setattr(service_module, "_default_service", service)
    return service


def test_module_transcribe_and_async(default_service):
    assert transcribe(req()).ok
    assert asyncio.run(transcribe_async(req(request_id="async"))).cached
    assert default_service.stats()["requests"] == 2


def test_malformed_setting_is_reported_not_raised(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(service_module, "_default_service", None)
    monkeypatch.setenv("STT_MAX_AUDIO_MB", "lots")
    result = transcribe(req())
    assert result.error_code == ErrorCode.NOT_CONFIGURED and "STT_MAX_AUDIO_MB" in result.error_message
    assert "STT_MAX_AUDIO_MB" in service_module.get_stats()["error"]
