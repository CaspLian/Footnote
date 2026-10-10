"""Tests for the pipeline, using a fake provider: no network, no API key, no cost."""

import asyncio
import threading
import time

import pytest

import text_to_speech.service as service_module
from text_to_speech.cache import AudioCache
from text_to_speech.config import TTSConfig
from text_to_speech.contract import ErrorCode, TTSRequest
from text_to_speech.elevenlabs_provider import ProviderAudio
from text_to_speech.errors import TTSError
from text_to_speech.service import TTSService, synthesize, synthesize_async

CONFIG = TTSConfig(api_key="test-key", voice_id="voice-1", model_id="model-1", cache_dir=None, max_chars=200)


class FakeProvider:
    """Returns b"AUDIO:" + text. Can fail a given number of times, or wait at a gate."""

    def __init__(self, failures=(), gate: threading.Event | None = None):
        self.calls: list[str] = []
        self.voice_ids: list[str] = []
        self._failures = list(failures)
        self._gate = gate
        self._lock = threading.Lock()

    def generate(self, text: str, voice_id: str, settings: dict | None = None) -> ProviderAudio:
        with self._lock:
            self.calls.append(text)
            self.voice_ids.append(voice_id)
            failure = self._failures.pop(0) if self._failures else None
        if self._gate is not None:
            assert self._gate.wait(timeout=5), "test gate was never opened"
        if failure is not None:
            raise failure
        return ProviderAudio(audio=b"AUDIO:" + text.encode(), request_id="req-123", characters_billed=len(text))


def make_service(provider=None, config=CONFIG, cache=None):
    sleeps: list[float] = []
    service = TTSService(
        config,
        provider if provider is not None else FakeProvider(),
        cache if cache is not None else AudioCache(None),
        pronunciations={},
        sleep=sleeps.append,
    )
    return service, sleeps


def req(text="Hello there.", request_id="r1", **kwargs) -> TTSRequest:
    return TTSRequest(request_id=request_id, text=text, **kwargs)


def temporary_failure(retry_after=None):
    return TTSError(ErrorCode.PROVIDER_UNAVAILABLE, "server error", retryable=True, retry_after=retry_after)


# --- Happy path -------------------------------------------------------------------------


def test_success_returns_audio_and_metadata():
    provider = FakeProvider()
    service, _ = make_service(provider)
    result = service.synthesize(req("Hello **there**", request_id="msg-42"))

    assert result.ok
    assert result.request_id == "msg-42"
    assert result.audio == b"AUDIO:Hello there."
    assert result.mime_type == "audio/mpeg"
    assert len(result.audio_id) == 32
    assert result.spoken_text == "Hello there."
    assert provider.calls == ["Hello there."]  # the cleaned text, not the Markdown
    assert not result.cached
    assert result.characters_sent == len("Hello there.")
    assert result.characters_billed == len("Hello there.")
    assert result.attempts == 1
    assert result.provider_request_id == "req-123"
    assert result.error_code is None


def test_speech_text_is_used_instead_of_text():
    provider = FakeProvider()
    service, _ = make_service(provider)
    service.synthesize(req("Displayed **answer** with [link](https://x.com)", speech_text="Spoken answer"))
    assert provider.calls == ["Spoken answer."]


def test_blank_speech_text_falls_back_to_text():
    provider = FakeProvider()
    service, _ = make_service(provider)
    service.synthesize(req("Displayed answer", speech_text="   "))
    assert provider.calls == ["Displayed answer."]


def test_metadata_is_json_safe_and_has_no_audio_bytes():
    service, _ = make_service()
    data = service.synthesize(req()).metadata()
    assert "audio" not in data
    assert data["audio_bytes"] == len(b"AUDIO:Hello there.")


# --- Failing fast, before any cost ------------------------------------------------------


def test_empty_text_fails_without_calling_provider():
    provider = FakeProvider()
    service, _ = make_service(provider)
    result = service.synthesize(req("  **  ** \n---\n"))
    assert not result.ok
    assert result.error_code == ErrorCode.EMPTY_TEXT
    assert not result.retryable
    assert provider.calls == []


def test_too_long_text_fails_without_calling_provider():
    provider = FakeProvider()
    service, _ = make_service(provider)
    result = service.synthesize(req("word " * 100))  # 500 characters, limit is 200
    assert result.error_code == ErrorCode.TEXT_TOO_LONG
    assert "200" in result.error_message
    assert provider.calls == []


@pytest.mark.parametrize(
    "bad_request",
    [
        {"request_id": "r1", "text": "a dict instead of a TTSRequest"},
        TTSRequest(request_id="", text="Hello"),
        TTSRequest(request_id="r1", text={"candidates": []}),  # the whole Gemini response object
        TTSRequest(request_id="r1", text="Hello", speech_text=123),
        TTSRequest(request_id="r1", text="Bonjour", language="fr", model="model-1"),  # a chosen model that cannot speak it
        TTSRequest(request_id="r1", text="Nei hou", language="yue"),  # no model here speaks it
    ],
)
def test_invalid_requests_return_an_error_instead_of_raising(bad_request):
    provider = FakeProvider()
    service, _ = make_service(provider)
    result = service.synthesize(bad_request)
    assert not result.ok
    assert result.error_code == ErrorCode.INVALID_REQUEST
    assert provider.calls == []


def test_missing_api_key_reports_not_configured():
    provider = FakeProvider()
    service, _ = make_service(provider, config=TTSConfig(voice_id="voice-1", cache_dir=None))
    result = service.synthesize(req())
    assert result.error_code == ErrorCode.NOT_CONFIGURED
    assert provider.calls == []


def test_cached_audio_still_plays_when_not_configured():
    cache = AudioCache(None)
    configured, _ = make_service(cache=cache)
    first = configured.synthesize(req())

    keyless_config = TTSConfig(voice_id="voice-1", model_id="model-1", cache_dir=None, max_chars=200)
    keyless, _ = make_service(config=keyless_config, cache=cache)
    second = keyless.synthesize(req())
    assert second.ok and second.cached
    assert second.audio == first.audio


# --- Cache ------------------------------------------------------------------------------


def test_repeated_request_is_served_from_cache():
    provider = FakeProvider()
    service, _ = make_service(provider)
    first = service.synthesize(req(request_id="a"))
    second = service.synthesize(req(request_id="b"))

    assert len(provider.calls) == 1
    assert second.ok and second.cached
    assert second.request_id == "b"
    assert second.audio == first.audio
    assert second.audio_id == first.audio_id
    assert second.characters_sent == 0 and second.attempts == 0
    assert service.stats()["cache_hits"] == 1


@pytest.mark.parametrize(
    "changed",
    [
        {"voice_id": "voice-2"},
        {"model_id": "model-2"},
        {"output_format": "mp3_22050_32"},
        {"speed": 1.1},
    ],
)
def test_any_audio_setting_change_gives_a_new_cache_key(changed):
    base, _ = make_service()
    settings = dict(api_key="test-key", voice_id="voice-1", model_id="model-1", cache_dir=None, max_chars=200)
    settings.update(changed)
    other, _ = make_service(config=TTSConfig(**settings))
    assert base.synthesize(req()).audio_id != other.synthesize(req()).audio_id


def test_formatting_differences_that_sound_the_same_share_audio():
    provider = FakeProvider()
    service, _ = make_service(provider)
    service.synthesize(req("**Hello** there"))
    service.synthesize(req("Hello there."))
    assert len(provider.calls) == 1


def test_disk_cache_survives_a_restart(tmp_path):
    config = TTSConfig(api_key="k", voice_id="v", model_id="m", cache_dir=str(tmp_path), max_chars=200)
    first, _ = make_service(config=config, cache=AudioCache(tmp_path))
    generated = first.synthesize(req())

    provider_after_restart = FakeProvider()
    second, _ = make_service(provider_after_restart, config=config, cache=AudioCache(tmp_path))
    replayed = second.synthesize(req())

    assert replayed.cached and replayed.audio == generated.audio
    assert provider_after_restart.calls == []
    assert (tmp_path / f"{generated.audio_id}.mp3").read_bytes() == generated.audio


def test_get_audio_returns_known_audio_and_rejects_bad_ids():
    service, _ = make_service()
    result = service.synthesize(req())
    assert service.get_audio(result.audio_id) == (result.audio, "audio/mpeg")
    assert service.get_audio("0" * 32) is None
    for bad_id in ["", "../../secret", "../" + result.audio_id, result.audio_id.upper(), None]:
        assert service.get_audio(bad_id) is None


# --- Voices -----------------------------------------------------------------------------

MATILDA_ID, GEORGE_ID, BUNTY_ID = "XrExE9yKIg1WjnnlVkGX", "JBFqnCBsd6RMkjVDRZzb", "nwj0s2LU9bDWRKND5yzA"


def test_the_users_voice_choice_is_used():
    provider = FakeProvider()
    service, _ = make_service(provider)
    result = service.synthesize(req(voice="bunty"))
    assert result.ok and result.voice == "bunty"
    assert provider.voice_ids == [BUNTY_ID]


def test_no_choice_uses_the_default_voice_from_voices_json():
    provider = FakeProvider()
    service, _ = make_service(provider, config=TTSConfig(api_key="k", cache_dir=None))
    assert service.synthesize(req()).voice == "matilda"
    assert provider.voice_ids == [MATILDA_ID]


def test_elevenlabs_voice_id_setting_replaces_only_the_default_voice():
    provider = FakeProvider()
    service, _ = make_service(provider)  # CONFIG.voice_id is "voice-1"
    service.synthesize(req())
    service.synthesize(req(voice="george"))
    assert provider.voice_ids == ["voice-1", GEORGE_ID]


def test_voice_choice_ignores_case_and_spaces():
    service, _ = make_service()
    assert service.synthesize(req(voice=" Bunty ")).voice == "bunty"


def test_unknown_voice_fails_fast_and_lists_the_choices():
    provider = FakeProvider()
    service, _ = make_service(provider)
    result = service.synthesize(req(voice="shakespeare"))
    assert result.error_code == ErrorCode.INVALID_REQUEST
    assert "matilda, sarah, george, charlie, bunty" in result.error_message
    assert provider.calls == []


def test_voice_must_be_a_string():
    service, _ = make_service()
    assert service.synthesize(req(voice=5)).error_code == ErrorCode.INVALID_REQUEST


def test_the_same_text_in_two_voices_is_two_audios_each_cached():
    provider = FakeProvider()
    service, _ = make_service(provider)
    bunty = service.synthesize(req(voice="bunty"))
    george = service.synthesize(req(voice="george"))
    bunty_again = service.synthesize(req(voice="bunty"))
    assert bunty.audio_id != george.audio_id
    assert len(provider.calls) == 2
    assert bunty_again.cached and bunty_again.audio_id == bunty.audio_id


def test_a_broken_voice_catalog_is_reported_not_raised(monkeypatch, tmp_path):
    def broken_catalog():
        raise ValueError("voices.json is not valid JSON")

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(service_module, "_default_service", None)
    monkeypatch.setattr(service_module, "load_catalog", broken_catalog)
    result = synthesize(req())
    assert result.error_code == ErrorCode.NOT_CONFIGURED and "voices.json" in result.error_message


# --- Retries ----------------------------------------------------------------------------


def test_temporary_failure_is_retried_once_then_succeeds():
    provider = FakeProvider(failures=[temporary_failure()])
    service, sleeps = make_service(provider)
    result = service.synthesize(req())
    assert result.ok
    assert result.attempts == 2
    assert result.characters_sent == 2 * len("Hello there.")
    assert len(sleeps) == 1 and 0.5 <= sleeps[0] <= 0.75


@pytest.mark.parametrize("retry_after, expected_sleep", [(1.5, 1.5), (60, 5.0), (0, 0)])
def test_retry_after_is_honoured_but_capped(retry_after, expected_sleep):
    provider = FakeProvider(failures=[temporary_failure(retry_after=retry_after)])
    service, sleeps = make_service(provider)
    assert service.synthesize(req()).ok
    assert sleeps == [expected_sleep]


def test_permanent_failures_are_not_retried():
    auth_failure = TTSError(ErrorCode.AUTH_FAILED, "bad key", retryable=False, status_code=401)
    provider = FakeProvider(failures=[auth_failure])
    service, sleeps = make_service(provider)
    result = service.synthesize(req())
    assert result.error_code == ErrorCode.AUTH_FAILED
    assert not result.retryable
    assert result.attempts == 1 and sleeps == []


def test_retries_are_bounded():
    provider = FakeProvider(failures=[temporary_failure()] * 5)
    service, sleeps = make_service(provider)  # max_retries defaults to 1
    result = service.synthesize(req())
    assert result.error_code == ErrorCode.PROVIDER_UNAVAILABLE
    assert result.retryable  # the backend may try again later
    assert result.attempts == 2 and len(provider.calls) == 2 and len(sleeps) == 1


def test_retries_can_be_turned_off():
    provider = FakeProvider(failures=[temporary_failure()])
    config = TTSConfig(api_key="k", voice_id="v", model_id="m", cache_dir=None, max_retries=0)
    service, sleeps = make_service(provider, config=config)
    assert service.synthesize(req()).attempts == 1
    assert sleeps == []


def test_failed_audio_is_not_cached():
    provider = FakeProvider(failures=[TTSError(ErrorCode.PROVIDER_REJECTED, "bad voice")])
    service, _ = make_service(provider)
    assert not service.synthesize(req()).ok
    assert service.synthesize(req()).ok
    assert len(provider.calls) == 2


def test_unexpected_exception_becomes_internal_error():
    provider = FakeProvider(failures=[RuntimeError("bug")])
    service, _ = make_service(provider)
    result = service.synthesize(req())
    assert result.error_code == ErrorCode.INTERNAL_ERROR
    assert "bug" not in result.error_message  # internal details stay in the server log


# --- Concurrency ------------------------------------------------------------------------


def _run_in_threads(service, requests):
    results = [None] * len(requests)

    def worker(index, request):
        results[index] = service.synthesize(request)

    threads = [threading.Thread(target=worker, args=(i, r)) for i, r in enumerate(requests)]
    for thread in threads:
        thread.start()
    return threads, results


def test_identical_requests_at_the_same_time_generate_once():
    gate = threading.Event()
    provider = FakeProvider(gate=gate)
    service, _ = make_service(provider)

    threads, results = _run_in_threads(service, [req(request_id=f"click-{i}") for i in range(5)])
    time.sleep(0.2)  # let every thread reach the provider or the in-flight wait
    gate.set()
    for thread in threads:
        thread.join(timeout=5)

    assert len(provider.calls) == 1
    assert all(r.ok for r in results)
    assert len({r.audio for r in results}) == 1
    assert sorted(r.request_id for r in results) == [f"click-{i}" for i in range(5)]
    assert sum(not r.cached for r in results) == 1  # exactly one call paid for the audio
    assert sum(r.characters_sent for r in results) == len("Hello there.")


def test_requests_waiting_on_a_failed_generation_get_the_same_error():
    gate = threading.Event()
    provider = FakeProvider(failures=[TTSError(ErrorCode.QUOTA_EXCEEDED, "out of credits")], gate=gate)
    service, _ = make_service(provider)

    threads, results = _run_in_threads(service, [req(request_id=f"click-{i}") for i in range(3)])
    time.sleep(0.2)
    gate.set()
    for thread in threads:
        thread.join(timeout=5)

    assert len(provider.calls) == 1
    assert all(r.error_code == ErrorCode.QUOTA_EXCEEDED for r in results)
    assert sorted(r.attempts for r in results) == [0, 0, 1]


def test_switching_quickly_between_answers_keeps_each_audio_with_its_answer():
    service, _ = make_service()
    requests = [req(f"Answer number {i}.", request_id=f"msg-{i}") for i in range(10)]
    threads, results = _run_in_threads(service, requests)
    for thread in threads:
        thread.join(timeout=5)

    for i, result in enumerate(results):
        assert result.ok
        assert result.request_id == f"msg-{i}"
        assert result.audio == f"AUDIO:Answer number {i}.".encode()
    assert len({r.audio_id for r in results}) == 10


# --- Stats ------------------------------------------------------------------------------


def test_stats_count_requests_cache_hits_and_failures():
    service, _ = make_service()
    service.synthesize(req())
    service.synthesize(req())
    service.synthesize(req(""))
    stats = service.stats()
    assert stats["requests"] == 3
    assert stats["succeeded"] == 2 and stats["failed"] == 1
    assert stats["cache_hits"] == 1
    assert stats["provider_attempts"] == 1
    assert stats["characters_sent"] == len("Hello there.")
    assert stats["failures_by_code"] == {ErrorCode.EMPTY_TEXT: 1}


# --- Module-level functions the backend calls ---------------------------------------------


@pytest.fixture
def default_service(monkeypatch):
    service, _ = make_service()
    monkeypatch.setattr(service_module, "_default_service", service)
    return service


def test_module_synthesize_uses_the_shared_service(default_service):
    assert synthesize(req()).ok
    assert default_service.stats()["requests"] == 1


def test_module_synthesize_async(default_service):
    result = asyncio.run(synthesize_async(req()))
    assert result.ok and result.audio == b"AUDIO:Hello there."


def test_malformed_setting_is_reported_not_raised(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)  # so no real .env is loaded
    monkeypatch.setattr(service_module, "_default_service", None)
    monkeypatch.setenv("TTS_MAX_CHARS", "abc")
    result = synthesize(req())
    assert result.error_code == ErrorCode.NOT_CONFIGURED
    assert "TTS_MAX_CHARS" in result.error_message
    # The audio endpoint and stats must not crash either.
    assert service_module.get_audio("a" * 32) is None
    assert "TTS_MAX_CHARS" in service_module.get_stats()["error"]


def test_request_object_whose_attributes_raise_still_gets_a_result():
    class Hostile:
        @property
        def request_id(self):
            raise RuntimeError("boom")

    service, _ = make_service()
    result = service.synthesize(Hostile())
    assert result.error_code == ErrorCode.INVALID_REQUEST and result.request_id == ""


def test_waiting_for_an_identical_request_lasts_longer_than_that_request_can_take():
    service, _ = make_service(config=TTSConfig(api_key="k", voice_id="v", timeout_seconds=20, max_retries=1))
    worst_single_request = 2 * (5 + 2 * 20) + 5  # two attempts of connect + deadline + stalled read, plus backoff
    assert service._in_flight_wait_seconds() >= worst_single_request
