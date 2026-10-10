"""Tests for streaming (synthesize_streaming + open_audio) and the model choice, with a fake
provider whose audio the test hands out piece by piece: no network, no API key, no cost."""

import queue
import threading
import time

import pytest

import text_to_speech.service as service_module
from text_to_speech.cache import AudioCache
from text_to_speech.config import TTSConfig
from text_to_speech.contract import AudioCutShort, ErrorCode, TTSRequest
from text_to_speech.elevenlabs_provider import ProviderStream
from text_to_speech.errors import TTSError
from text_to_speech.service import TTSService

CONFIG = TTSConfig(api_key="test-key", voice_id="voice-1", cache_dir=None, max_chars=200)
WAIT = 5  # seconds; every wait in these tests is bounded, so a bug fails instead of hanging


class ControlledStream:
    """One ElevenLabs answer. The test sends pieces (or an exception) and ends it."""

    def __init__(self):
        self._pieces = queue.Queue()
        self.closed = False

    def send(self, *pieces):
        for piece in pieces:
            self._pieces.put(piece)

    def end(self):
        self._pieces.put(None)

    def chunks(self):
        try:
            while True:
                piece = self._pieces.get(timeout=WAIT)
                if piece is None:
                    return
                if isinstance(piece, BaseException):
                    raise piece
                yield piece
        finally:
            self.closed = True


class FakeStreamingProvider:
    def __init__(self, failures=()):
        self.calls = []  # (text, voice_id, settings)
        self.streams: queue.Queue[ControlledStream] = queue.Queue()
        self._failures = list(failures)
        self._lock = threading.Lock()

    def generate(self, text, voice_id, settings=None):
        raise AssertionError("a streaming provider should be read with open_stream()")

    def open_stream(self, text, voice_id, settings=None):
        with self._lock:
            self.calls.append((text, voice_id, settings))
            failure = self._failures.pop(0) if self._failures else None
        if failure is not None:
            raise failure
        stream = ControlledStream()
        self.streams.put(stream)
        return ProviderStream(stream.chunks(), request_id=f"req-{len(self.calls)}", characters_billed=len(text))

    def next_stream(self) -> ControlledStream:
        return self.streams.get(timeout=WAIT)


def make_service(provider, config=CONFIG):
    sleeps = []
    service = TTSService(config, provider, AudioCache(None), pronunciations={}, sleep=sleeps.append)
    return service, sleeps


def req(text="Hello there.", request_id="r1", **kwargs):
    return TTSRequest(request_id=request_id, text=text, **kwargs)


def in_thread(function, *args):
    """Run function(*args) in a thread; .join() returns its result."""
    box = {}
    thread = threading.Thread(target=lambda: box.update(value=function(*args)), daemon=True)
    thread.start()

    class Handle:
        @staticmethod
        def join():
            thread.join(WAIT)
            assert not thread.is_alive(), "call did not finish"
            return box["value"]

    return Handle


def wait_until(condition):
    deadline = time.monotonic() + WAIT
    while not condition():
        assert time.monotonic() < deadline, "condition never became true"
        time.sleep(0.01)


def temporary_failure():
    return TTSError(ErrorCode.PROVIDER_UNAVAILABLE, "connection reset", retryable=True)


# --- The first audio comes back before the rest exists ------------------------------------


def test_streaming_returns_at_the_first_audio_and_the_rest_follows():
    provider = FakeStreamingProvider()
    service, _ = make_service(provider)
    call = in_thread(service.synthesize_streaming, req())
    stream = provider.next_stream()
    stream.send(b"ID3")
    result = call.join()

    assert result.ok and result.streaming
    assert result.audio is None  # not finished: it is read with open_audio()
    assert result.characters_billed == len("Hello there.")  # known from the headers already
    assert result.attempts == 1 and not result.cached
    assert service.get_audio(result.audio_id) is None  # get_audio() only has finished audio

    live = service.open_audio(result.audio_id)
    assert live is not None and not live.complete and live.mime_type == "audio/mpeg"
    assert next(live.chunks) == b"ID3"
    stream.send(b"-middle")
    assert next(live.chunks) == b"-middle"
    stream.send(b"-end")
    stream.end()
    assert list(live.chunks) == [b"-end"]

    wait_until(lambda: service.get_audio(result.audio_id) is not None)
    assert service.get_audio(result.audio_id) == (b"ID3-middle-end", "audio/mpeg")
    assert stream.closed  # the connection was released


def test_a_listener_who_joins_late_hears_the_clip_from_the_start():
    provider = FakeStreamingProvider()
    service, _ = make_service(provider)
    call = in_thread(service.synthesize_streaming, req())
    stream = provider.next_stream()
    stream.send(b"ID3", b"-a")
    result = call.join()
    first = service.open_audio(result.audio_id)
    assert next(first.chunks) == b"ID3"

    late = service.open_audio(result.audio_id)
    stream.send(b"-b")
    stream.end()
    assert b"".join(late.chunks) == b"ID3-a-b"
    assert b"".join(first.chunks) == b"-a-b"


def test_finished_audio_is_served_in_one_piece_with_its_size():
    provider = FakeStreamingProvider()
    service, _ = make_service(provider)
    call = in_thread(service.synthesize_streaming, req())
    stream = provider.next_stream()
    stream.send(b"ID3-all")
    stream.end()
    result = call.join()
    wait_until(lambda: not service._in_flight)  # finished and handed over to the cache

    finished = service.open_audio(result.audio_id)
    assert finished.complete and finished.size == len(b"ID3-all")
    assert list(finished.chunks) == [b"ID3-all"]


def test_streaming_a_clip_made_before_returns_it_whole_for_free():
    provider = FakeStreamingProvider()
    service, _ = make_service(provider)
    call = in_thread(service.synthesize, req())
    stream = provider.next_stream()
    stream.send(b"ID3-all")
    stream.end()
    assert call.join().ok

    again = service.synthesize_streaming(req(request_id="again"))
    assert again.ok and again.cached and not again.streaming
    assert again.audio == b"ID3-all"
    assert len(provider.calls) == 1


def test_open_audio_refuses_unknown_and_malformed_ids():
    service, _ = make_service(FakeStreamingProvider())
    assert service.open_audio("0" * 32) is None
    for bad_id in ["", "../../secret", "A" * 32, None]:
        assert service.open_audio(bad_id) is None


# --- One generation, shared ------------------------------------------------------------------


def test_identical_streaming_requests_share_one_generation():
    provider = FakeStreamingProvider()
    service, _ = make_service(provider)
    first_call = in_thread(service.synthesize_streaming, req(request_id="a"))
    stream = provider.next_stream()
    stream.send(b"ID3")
    first = first_call.join()
    second = service.synthesize_streaming(req(request_id="b"))
    stream.end()

    assert len(provider.calls) == 1
    assert second.ok and second.streaming and second.audio_id == first.audio_id
    assert second.cached and second.characters_sent == 0  # this call paid for nothing
    assert first.characters_sent == len("Hello there.")


def test_synthesize_waits_for_a_running_stream_and_gets_all_the_audio():
    provider = FakeStreamingProvider()
    service, _ = make_service(provider)
    streaming = in_thread(service.synthesize_streaming, req(request_id="stream"))
    stream = provider.next_stream()
    stream.send(b"ID3")
    job = service._in_flight[streaming.join().audio_id]

    whole = in_thread(service.synthesize, req(request_id="whole"))
    wait_until(lambda: job._changed._waiters)  # synthesize() is waiting on the running job
    stream.send(b"-rest")
    stream.end()
    result = whole.join()
    assert result.ok and result.audio == b"ID3-rest" and result.cached
    assert len(provider.calls) == 1
    assert service.stats()["shared_in_flight"] == 1  # it joined the stream, not a later cache hit


def test_a_stream_can_join_audio_that_synthesize_is_making():
    provider = FakeStreamingProvider()
    service, _ = make_service(provider)
    whole = in_thread(service.synthesize, req(request_id="whole"))
    stream = provider.next_stream()
    stream.send(b"ID3")
    joined = service.synthesize_streaming(req(request_id="stream"))
    assert joined.ok and joined.streaming
    live = service.open_audio(joined.audio_id)
    stream.send(b"-rest")
    stream.end()
    assert b"".join(live.chunks) == b"ID3-rest"
    assert whole.join().audio == b"ID3-rest"
    assert len(provider.calls) == 1


# --- Failures and retries --------------------------------------------------------------------


def test_a_failure_before_any_audio_is_reported_like_synthesize():
    provider = FakeStreamingProvider(failures=[TTSError(ErrorCode.AUTH_FAILED, "bad key", status_code=401)])
    service, sleeps = make_service(provider)
    result = service.synthesize_streaming(req())
    assert not result.ok and result.error_code == ErrorCode.AUTH_FAILED
    assert result.attempts == 1 and sleeps == []
    key = service._cache_key("Hello there.", "en", "voice-1", CONFIG.audio_settings())
    assert service.open_audio(key) is None  # nothing is served for the failed clip
    assert service._in_flight == {}


def test_a_temporary_failure_before_any_audio_is_retried():
    provider = FakeStreamingProvider(failures=[temporary_failure()])
    service, sleeps = make_service(provider)
    call = in_thread(service.synthesize_streaming, req())
    stream = provider.next_stream()  # the second attempt
    stream.send(b"ID3")
    stream.end()
    result = call.join()
    assert result.ok and result.attempts == 2
    assert len(provider.calls) == 2 and len(sleeps) == 1


def test_a_drop_before_anyone_listened_starts_the_clip_over():
    provider = FakeStreamingProvider()
    service, sleeps = make_service(provider)
    call = in_thread(service.synthesize_streaming, req())
    first = provider.next_stream()
    first.send(b"ID3-half")
    result = call.join()
    first.send(temporary_failure())  # nobody has read any audio yet: safe to start over

    second = provider.next_stream()
    second.send(b"ID3-whole")
    second.end()
    wait_until(lambda: service.get_audio(result.audio_id) is not None)
    assert service.get_audio(result.audio_id)[0] == b"ID3-whole"  # not "ID3-halfID3-whole"
    assert len(sleeps) == 1


def test_a_drop_after_a_listener_heard_part_of_the_clip_fails_and_caches_nothing():
    provider = FakeStreamingProvider()
    service, sleeps = make_service(provider)
    call = in_thread(service.synthesize_streaming, req())
    stream = provider.next_stream()
    stream.send(b"ID3")
    result = call.join()
    live = service.open_audio(result.audio_id)
    assert next(live.chunks) == b"ID3"

    stream.send(temporary_failure())
    with pytest.raises(AudioCutShort, match="PROVIDER_UNAVAILABLE"):  # so the player sees an error
        next(live.chunks)  # no retry: starting over would replay the start the listener already heard
    wait_until(lambda: not service._in_flight)
    assert service.get_audio(result.audio_id) is None
    assert sleeps == [] and len(provider.calls) == 1

    retry = in_thread(service.synthesize_streaming, req(request_id="try-again"))
    again = provider.next_stream()  # a later request makes it again
    again.send(b"ID3-whole")
    again.end()
    assert retry.join().ok


def test_an_unexpected_error_while_streaming_is_an_internal_error():
    provider = FakeStreamingProvider()
    service, _ = make_service(provider)
    call = in_thread(service.synthesize_streaming, req())
    provider.next_stream().send(RuntimeError("bug"))
    result = call.join()
    assert result.error_code == ErrorCode.INTERNAL_ERROR
    assert "bug" not in result.error_message


def test_streaming_without_an_api_key_reports_not_configured():
    provider = FakeStreamingProvider()
    service, _ = make_service(provider, config=TTSConfig(voice_id="voice-1", cache_dir=None))
    result = service.synthesize_streaming(req())
    assert result.error_code == ErrorCode.NOT_CONFIGURED and provider.calls == []


# --- Choosing the model ------------------------------------------------------------------------


def _made_with(service, provider, request):
    call = in_thread(service.synthesize_streaming, request)
    stream = provider.next_stream()
    stream.send(b"ID3")
    stream.end()
    return call.join()


def test_a_request_can_choose_the_model():
    provider = FakeStreamingProvider()
    service, _ = make_service(provider)
    default = _made_with(service, provider, req())
    multilingual = _made_with(service, provider, req(model="eleven_multilingual_v2"))

    assert default.model == "eleven_flash_v2_5" and multilingual.model == "eleven_multilingual_v2"
    assert default.audio_id != multilingual.audio_id  # a different model is a different clip
    (_, _, default_settings), (_, _, multilingual_settings) = provider.calls
    assert default_settings["model_id"] == "eleven_flash_v2_5"
    assert default_settings["apply_text_normalization"] == "on"  # so Flash reads money and codes right
    assert multilingual_settings["model_id"] == "eleven_multilingual_v2"
    assert "apply_text_normalization" not in multilingual_settings


@pytest.mark.parametrize("model", ["eleven_monolingual_v1", "gpt-4"])
def test_unknown_models_are_refused_before_any_cost(model):
    provider = FakeStreamingProvider()
    service, _ = make_service(provider)
    result = service.synthesize_streaming(req(model=model))
    assert result.error_code == ErrorCode.INVALID_REQUEST
    assert "eleven_flash_v2_5" in result.error_message and provider.calls == []


def test_an_empty_model_choice_means_the_configured_model():
    provider = FakeStreamingProvider()
    service, _ = make_service(provider)
    assert _made_with(service, provider, req(model="  ")).model == "eleven_flash_v2_5"


def test_the_configured_model_is_always_allowed():
    provider = FakeStreamingProvider()
    service, _ = make_service(provider, config=TTSConfig(api_key="k", model_id="eleven_turbo_v2_5", cache_dir=None))
    assert _made_with(service, provider, req(model="eleven_turbo_v2_5")).model == "eleven_turbo_v2_5"


def test_model_must_be_a_string():
    service, _ = make_service(FakeStreamingProvider())
    assert service.synthesize(req(model=5)).error_code == ErrorCode.INVALID_REQUEST


# --- Module-level functions ---------------------------------------------------------------------


def test_module_streaming_functions_use_the_shared_service(monkeypatch):
    provider = FakeStreamingProvider()
    service, _ = make_service(provider)
    monkeypatch.setattr(service_module, "_default_service", service)
    call = in_thread(service_module.synthesize_streaming, req())
    stream = provider.next_stream()
    stream.send(b"ID3")
    result = call.join()
    live = service_module.open_audio(result.audio_id)
    stream.end()
    assert b"".join(live.chunks) == b"ID3"


def test_module_streaming_reports_a_malformed_setting(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(service_module, "_default_service", None)
    monkeypatch.setenv("ELEVENLABS_TEXT_NORMALIZATION", "maybe")
    result = service_module.synthesize_streaming(req())
    assert result.error_code == ErrorCode.NOT_CONFIGURED and "ELEVENLABS_TEXT_NORMALIZATION" in result.error_message
    assert service_module.open_audio("a" * 32) is None


# --- Review fixes ---------------------------------------------------------------------------------


def test_if_the_background_thread_cannot_start_nothing_is_left_behind(monkeypatch):
    provider = FakeStreamingProvider()
    service, _ = make_service(provider)
    real_start = threading.Thread.start

    def failing_start(thread):
        if thread.name == "tts-stream":
            raise RuntimeError("cannot start new thread")
        return real_start(thread)

    monkeypatch.setattr(threading.Thread, "start", failing_start)
    assert service.synthesize_streaming(req()).error_code == ErrorCode.INTERNAL_ERROR
    assert service._in_flight == {}  # no dead job for the next request to wait on
    monkeypatch.setattr(threading.Thread, "start", real_start)

    retry = in_thread(service.synthesize_streaming, req(request_id="again"))
    stream = provider.next_stream()  # a new generation
    stream.send(b"ID3")
    stream.end()
    assert retry.join().ok


def test_an_empty_answer_is_reported_without_a_retry():
    provider = FakeStreamingProvider()
    service, sleeps = make_service(provider)
    call = in_thread(service.synthesize, req())
    provider.next_stream().end()  # 200 OK, but no audio
    result = call.join()
    assert result.error_code == ErrorCode.PROVIDER_UNAVAILABLE and "no audio" in result.error_message
    assert result.attempts == 1 and sleeps == [] and len(provider.calls) == 1


def test_stats_count_a_retry_made_after_the_streamed_result_went_out():
    provider = FakeStreamingProvider()
    service, _ = make_service(provider)
    call = in_thread(service.synthesize_streaming, req())
    first = provider.next_stream()
    first.send(b"ID3-half")
    result = call.join()
    first.send(temporary_failure())  # nobody listened yet, so it starts over: a second paid attempt
    second = provider.next_stream()
    second.send(b"ID3-whole")
    second.end()
    wait_until(lambda: not service._in_flight)

    stats = service.stats()
    assert result.attempts == 1  # what was known when the result went out
    assert stats["provider_attempts"] == 2 and stats["characters_sent"] == 2 * len("Hello there.")
    assert stats["streams_cut_short"] == 0


def test_stats_count_a_stream_that_was_cut_short():
    provider = FakeStreamingProvider()
    service, _ = make_service(provider)
    call = in_thread(service.synthesize_streaming, req())
    stream = provider.next_stream()
    stream.send(b"ID3")
    result = call.join()
    live = service.open_audio(result.audio_id)
    next(live.chunks)
    stream.send(temporary_failure())
    with pytest.raises(AudioCutShort):
        next(live.chunks)
    wait_until(lambda: not service._in_flight)

    stats = service.stats()
    assert stats["succeeded"] == 1  # the result went out fine...
    assert stats["streams_cut_short"] == 1  # ...but the audio stopped part-way
    assert stats["failures_by_code"] == {ErrorCode.PROVIDER_UNAVAILABLE: 1}


def test_a_listener_waiting_on_a_stalled_stream_gets_an_error():
    provider = FakeStreamingProvider()
    service, _ = make_service(provider)
    call = in_thread(service.synthesize_streaming, req())
    stream = provider.next_stream()
    stream.send(b"ID3")
    result = call.join()
    job = service._in_flight[result.audio_id]
    chunks = job.read(timeout=0.05)
    assert next(chunks) == b"ID3"
    with pytest.raises(AudioCutShort, match="No more audio"):
        next(chunks)
    stream.end()
