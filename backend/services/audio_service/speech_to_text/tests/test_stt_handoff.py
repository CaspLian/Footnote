import json

from speech_to_text.contract import ErrorCode, STTResult
from speech_to_text.handoff import VOICE_INPUT_NOTE, to_gemini_handoff


def ok_result(confidence=0.92, text="Why was my MRI billed $3,200?"):
    return STTResult(request_id="voice-1", ok=True, text=text, language="eng", confidence=confidence, audio_seconds=3.0)


def test_successful_transcript_becomes_a_handoff_for_gemini():
    handoff = to_gemini_handoff(ok_result())
    assert handoff.text == "Why was my MRI billed $3,200?"
    assert handoff.request_id == "voice-1"
    assert handoff.language == "eng"
    assert handoff.input_mode == "voice"
    assert not handoff.needs_confirmation


def test_low_confidence_asks_for_confirmation():
    assert to_gemini_handoff(ok_result(confidence=0.3)).needs_confirmation
    assert not to_gemini_handoff(ok_result(confidence=0.3), confirm_below=0.2).needs_confirmation
    assert not to_gemini_handoff(ok_result(confidence=None)).needs_confirmation


def test_nothing_is_handed_off_when_transcription_failed():
    failed = STTResult(request_id="voice-1", ok=False, error_code=ErrorCode.NO_SPEECH)
    assert to_gemini_handoff(failed) is None
    assert to_gemini_handoff(ok_result(text="")) is None


def test_handoff_is_json_ready():
    data = to_gemini_handoff(ok_result()).to_dict()
    assert json.loads(json.dumps(data)) == data
    assert set(data) == {"request_id", "text", "language", "confidence", "needs_confirmation", "input_mode"}


def test_voice_input_note_is_available_for_the_gemini_prompt():
    assert "transcribed" in VOICE_INPUT_NOTE
