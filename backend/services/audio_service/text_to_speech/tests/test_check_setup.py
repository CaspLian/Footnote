"""Tests for the setup checker, with a fake session: no network, no API key, no cost."""

import pytest

from text_to_speech.check_setup import run
from text_to_speech.config import TTSConfig
from text_to_speech.voices import Voice, VoiceCatalog

CONFIG = TTSConfig(api_key="sk-test", voice_id="voice-george", cache_dir=None)
# The voices users can choose, as the tests see them: one is in the account, one is not.
CATALOG = VoiceCatalog((Voice("george", "George", "Warm storyteller", "British", "male", "voice-george"),), "george")
LIBRARY_VOICE = Voice("bunty", "Bunty", "Fun", "Indian", "male", "voice-from-library")

USER_FREE_NEW = {
    "subscription": {"tier": "free", "status": "free", "character_count": 1200, "character_limit": 10000},
    "created_at": 1790000000,  # 2026-09: after the Default-voice cutoff
}
USER_FREE_OLD = {**USER_FREE_NEW, "created_at": 1700000000}  # 2023
VOICES = {
    "voices": [
        {"voice_id": "voice-george", "name": "George", "category": "premade",
         "labels": {"gender": "male", "accent": "british"}},
        {"voice_id": "voice-sarah", "name": "Sarah", "category": "premade", "labels": {}},
    ],
    "has_more": False,
    "next_page_token": None,
}


class FakeResponse:
    def __init__(self, status, body):
        self.status_code = status
        self._body = body
        self.text = str(body)

    def json(self):
        return self._body


class FakeSession:
    def __init__(self, routes):
        self.routes = routes  # path suffix -> list of (status, body)
        self.calls = []

    def get(self, url, headers=None, params=None, timeout=None):
        self.calls.append((url, headers, params))
        for suffix, responses in self.routes.items():
            if url.endswith(suffix):
                return FakeResponse(*responses.pop(0))
        raise AssertionError(f"unexpected URL {url}")


def check(routes, config=CONFIG, catalog=CATALOG):
    lines = []
    code = run(config, FakeSession(routes), out=lines.append, catalog=catalog)
    return code, "\n".join(lines)


def test_good_setup_passes_and_marks_the_configured_voice():
    code, output = check({"/v1/user": [(200, USER_FREE_OLD)], "/v2/voices": [(200, VOICES)]})
    assert code == 0
    assert "voice-george  George  [premade] male, british   <- ELEVENLABS_VOICE_ID" in output
    assert "8,800 left" in output
    assert "Default voices should work until December 31, 2026" in output


def test_new_free_account_is_warned_about_default_voices():
    _, output = check({"/v1/user": [(200, USER_FREE_NEW)], "/v2/voices": [(200, VOICES)]})
    assert "Default voices are not available" in output
    assert "paid_plan_required" in output


def test_each_voice_users_can_choose_is_checked():
    _, output = check({"/v1/user": [(200, USER_FREE_OLD)], "/v2/voices": [(200, VOICES)]})
    assert "george     George: Warm storyteller, British (default): in your account" in output


def test_library_voices_fail_on_the_free_plan():
    catalog = VoiceCatalog(CATALOG.voices + (LIBRARY_VOICE,), "george")
    code, output = check({"/v1/user": [(200, USER_FREE_OLD)], "/v2/voices": [(200, VOICES)]}, catalog=catalog)
    assert code == 1
    assert "bunty      Bunty: Fun, Indian: Voice Library voice: will fail on the free plan" in output


def test_library_voices_are_fine_on_paid_plans():
    paid_user = {**USER_FREE_OLD, "subscription": {"tier": "creator", "status": "active"}}
    catalog = VoiceCatalog(CATALOG.voices + (LIBRARY_VOICE,), "george")
    code, output = check({"/v1/user": [(200, paid_user)], "/v2/voices": [(200, VOICES)]}, catalog=catalog)
    assert code == 0
    assert "Voice Library voice (works on paid plans)" in output


def test_voice_id_override_is_reported():
    config = TTSConfig(api_key="sk-test", voice_id="not-in-account", cache_dir=None)
    code, output = check({"/v1/user": [(200, USER_FREE_OLD)], "/v2/voices": [(200, VOICES)]}, config)
    assert code == 0
    assert "ELEVENLABS_VOICE_ID=not-in-account replaces the default voice (george); not in your account." in output


def test_missing_key_stops_early_without_network():
    code, output = check({}, TTSConfig(cache_dir=None))
    assert code == 1 and "ELEVENLABS_API_KEY is missing" in output


def test_rejected_key_stops():
    body = {"detail": {"code": "unauthorized", "status": "invalid_api_key", "message": "Invalid API key"}}
    code, output = check({"/v1/user": [(401, body)]})
    assert code == 1 and "Invalid API key" in output


@pytest.mark.parametrize(
    "body",
    [
        {"detail": {"status": "missing_permissions", "message": "missing the permission user_read"}},
        {"detail": {"code": "insufficient_permissions", "message": "not allowed"}},
    ],
)
def test_key_without_user_read_still_lists_voices(body):
    code, output = check({"/v1/user": [(401, body)], "/v2/voices": [(200, VOICES)]})
    assert code == 0
    assert "User: Read" in output
    assert "voice-george" in output


def test_key_without_voices_read_explains_the_fix():
    body = {"detail": {"status": "missing_permissions", "message": "missing the permission voices_read"}}
    code, output = check({"/v1/user": [(200, USER_FREE_OLD)], "/v2/voices": [(401, body)]})
    assert code == 1 and "Voices: Read" in output


def test_voice_pages_are_followed():
    page1 = {"voices": [{"voice_id": "a", "name": "A", "category": "premade"}], "has_more": True, "next_page_token": "t2"}
    page2 = {"voices": [{"voice_id": "voice-george", "name": "George", "category": "premade"}], "has_more": False}
    session = FakeSession({"/v1/user": [(200, USER_FREE_OLD)], "/v2/voices": [(200, page1), (200, page2)]})
    lines = []
    assert run(CONFIG, session, out=lines.append, catalog=CATALOG) == 0
    assert session.calls[-1][2] == {"page_size": 100, "next_page_token": "t2"}


def test_unexpected_field_types_do_not_crash():
    odd_user = {"subscription": {"tier": "free", "next_character_count_reset_unix": "soon"}, "created_at": "2026"}
    code, output = check({"/v1/user": [(200, odd_user)], "/v2/voices": [(200, VOICES)]})
    assert code == 0
    assert "Plan: free" in output


def test_api_key_is_sent_as_header_and_never_printed():
    session = FakeSession({"/v1/user": [(200, USER_FREE_OLD)], "/v2/voices": [(200, VOICES)]})
    lines = []
    run(CONFIG, session, out=lines.append)
    assert all(call[1] == {"xi-api-key": "sk-test"} for call in session.calls)
    assert "sk-test" not in "\n".join(lines)


def test_the_number_reading_setting_in_use_is_shown():
    flash = TTSConfig(api_key="sk-test", model_id="eleven_flash_v2_5", cache_dir=None)
    _, output = check({"/v1/user": [(200, USER_FREE_OLD)], "/v2/voices": [(200, VOICES)]}, config=flash)
    assert "Model eleven_flash_v2_5, format mp3_44100_128, number reading on." in output
    _, output = check({"/v1/user": [(200, USER_FREE_OLD)], "/v2/voices": [(200, VOICES)]})
    assert "number reading auto." in output  # Multilingual v2: ElevenLabs' default
