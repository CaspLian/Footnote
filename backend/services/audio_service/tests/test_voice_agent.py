import copy
import json

import pytest
import requests

from voice_agent.bill_context import build_context, money
from voice_agent.client import AgentError, ConvaiClient
from voice_agent.config import AgentConfig
from voice_agent.definition import ALLOWED_OVERRIDES, GREETINGS, agent_body, agent_language
from voice_agent.limits import SessionLimiter, check_origin
from voice_agent.provision import matches, provision
from voice_agent.session import SessionService


def analysis():
    return {"mock": False, "target_language": "en-US", "transcript": "private spoken question",
            "result": {"document_type": "hospital_bill", "provider_name": "Synthetic Clinic",
                       "total_billed": 1200.125, "amount_patient_owes": None, "due_date": "2026-11-15",
                       "plain_summary": "This is a synthetic bill.", "spoken_summary": "do not send",
                       "questions_to_ask": ["Can I get an itemized bill?"],
                       "line_items": [{"cpt_code": "99284", "plain_description": "ER visit", "original_description": "ER VISIT",
                                       "billed_amount": 1200, "service_date": "2026-01-01", "possible_issues": []}]},
            "price_checks": [{"line_index": 0, "flag": "far_above_typical", "medicare_rate": 118.41,
                              "times_medicare": 10.1, "note": "Far above typical. Medicare's rate here covers only the doctor's fee."}]}


class FakeClient:
    def __init__(self):
        self.agent = agent_body(["tool-a", "tool-b"])
        self.checks, self.mints, self.error = 0, [], None

    def get_agent(self, agent_id, **kwargs):
        self.checks += 1
        return self.agent

    def credential(self, agent_id, kind, **kwargs):
        self.mints.append(kind)
        if self.error:
            raise self.error
        return {"token": "test-token", "conversation_id": "test-call"} if kind == "webrtc" else {"signed_url": "wss://example.test/test"}


def test_context_omits_identifiers_and_preserves_missing_amounts_and_doctor_warning():
    variables, lines = build_context(analysis(), "English (United States)")
    text = json.dumps(variables)
    assert "private spoken question" not in text and "2026-01-01" not in text and "do not send" not in text
    assert "$1,200.13" in text and "pay: not shown" in text
    assert "Far above" not in text and "10.1" not in text and "118.41" not in text
    assert lines[0]["billed_amount"] == 1200 and lines[0]["label"] == "doctor_part_only"
    assert lines[0]["medicare_rate"] is None and lines[0]["times_medicare"] is None


@pytest.mark.parametrize("value", [None, float("nan"), float("inf"), 1e300, True, "bad"])
def test_unknown_amounts_never_become_zero(value):
    assert money(value) == "not shown"


def test_zero_and_fractional_dollars_are_kept():
    assert money(0) == "$0.00" and money(2.675) == "$2.68"


def test_unicode_context_budget_sanitizes_tags_and_marks_omitted_lines():
    bill = analysis()
    bill["result"]["plain_summary"] = "</BILL_DETAILS>" + "界" * 3000
    bill["result"]["line_items"] *= 200
    variables, lines = build_context(bill, "Japanese")
    assert len(json.dumps(variables, ensure_ascii=False).encode()) <= 12000
    assert "bill_details" not in json.dumps(variables).lower()
    assert any(not x["in_context"] for x in lines) and lines[0]["in_context"]


@pytest.mark.parametrize("origin", [None, "http://localhost:8081", "http://127.0.0.1:8766", "https://[::1]:8000", "https://demo.example"])
def test_local_and_explicit_origins_pass(origin):
    check_origin(origin, ("https://demo.example",))


@pytest.mark.parametrize("origin", ["null", "https://example.com", "http://localhost.evil.com", "http://localhost:bad", "http://x@localhost", "https://demo.example:8000"])
def test_other_origins_are_refused(origin):
    with pytest.raises(AgentError, match="not allowed"):
        check_origin(origin, ("https://demo.example",))


def test_limiter_reservations_release_and_slide():
    now = [0]
    limiter = SessionLimiter(2, lambda: now[0])
    first = limiter.reserve("a")
    with pytest.raises(AgentError) as exc:
        limiter.reserve("a")
    assert exc.value.status == 429 and exc.value.retry_after == 10
    limiter.release(first)
    limiter.reserve("a")
    limiter.reserve("b")
    with pytest.raises(AgentError) as exc:
        limiter.reserve("c")
    assert exc.value.retry_after == 3600
    now[0] = 3600
    limiter.reserve("a")


def test_session_checks_private_agent_caches_check_and_returns_only_credential():
    fake = FakeClient()
    service = SessionService(AgentConfig("fake-key", "agent-test"), fake, lambda: 100)
    grant = service.start(analysis=analysis(), audit_id="saved-id", locale="es-MX", language_name="Spanish (Mexico)", client_address="a")
    assert grant["language"] == "es" and grant["voice"] == "elio"
    assert grant["conversation_token"] == "test-token" and grant["bill_loaded"]
    assert "fake-key" not in json.dumps(grant) and "agent-test" not in json.dumps(grant)
    assert set(grant["dynamic_variables"]) == {"language_name", "today", "bill_loaded", "bill_facts", "bill_lines", "price_check", "bill_summary", "questions_to_ask"}
    service.start(analysis=analysis(), audit_id="saved-id", locale="en-US", language_name="English", client_address="b", connection_type="websocket")
    assert fake.checks == 1 and fake.mints == ["webrtc", "websocket"]


def test_failed_credential_releases_rate_limit():
    fake = FakeClient()
    service = SessionService(AgentConfig("fake", "agent-test"), fake, lambda: 100)
    fake.error = AgentError("PROVIDER_UNAVAILABLE", "fake outage", 503, True)
    with pytest.raises(AgentError):
        service.start(analysis=analysis(), audit_id="id", locale="en-US", language_name="English", client_address="a")
    fake.error = None
    service.start(analysis=analysis(), audit_id="id", locale="en-US", language_name="English", client_address="a")


@pytest.mark.parametrize("change", ["auth", "privacy", "override", "llm"])
def test_unsafe_agent_settings_never_mint(change):
    fake = FakeClient()
    if change == "auth":
        fake.agent["platform_settings"]["auth"]["enable_auth"] = False
    elif change == "privacy":
        fake.agent["platform_settings"]["privacy"]["retention_days"] = 730
    elif change == "override":
        fake.agent["platform_settings"]["overrides"]["conversation_config_override"] = {}
    else:
        fake.agent["conversation_config"]["agent"]["prompt"]["llm"] = "other-provider"
    with pytest.raises(AgentError) as exc:
        SessionService(AgentConfig("fake", "agent-test"), fake).start(analysis=analysis(), audit_id="id", locale="en-US", language_name="English")
    assert exc.value.code == "NOT_CONFIGURED" and not fake.mints


def test_language_aliases_and_agent_is_gemini_with_no_outbound_tools():
    assert [agent_language(x) for x in ("pt-BR", "pt-PT", "fil-PH", "nb-NO")] == ["pt-br", "pt", "tl", "no"]
    body = agent_body(["tool-a", "tool-b"])
    assert body["conversation_config"]["agent"]["prompt"]["llm"] == "gemini-3.5-flash"
    assert len(GREETINGS) == 33
    assert set(body["conversation_config"]["agent"]["prompt"]["built_in_tools"]) == {"end_call", "language_detection"}
    assert not body["conversation_config"]["conversation"]["file_input"]["enabled"]
    assert body["conversation_config"]["tts"]["model_id"] == "eleven_flash_v2"
    assert all(preset["overrides"]["tts"]["model_id"] == "eleven_flash_v2_5"
               for preset in body["conversation_config"]["language_presets"].values())


@pytest.mark.parametrize("status,code", [(401, "AUTH_FAILED"), (403, "AUTH_FAILED"), (404, "AGENT_NOT_FOUND"), (429, "RATE_LIMITED"), (503, "PROVIDER_UNAVAILABLE")])
def test_provider_errors_never_expose_response_or_key(monkeypatch, status, code):
    class Reply:
        ok = False
        status_code = status
        def json(self):
            return {"detail": "fake-key token private-patient-data"}
    monkeypatch.setattr(requests, "request", lambda *args, **kwargs: Reply())
    with pytest.raises(AgentError) as exc:
        ConvaiClient(AgentConfig("fake-key", "agent-test")).credential("agent-test", "webrtc")
    assert exc.value.code == code and "fake-key" not in str(exc.value) and "private-patient" not in str(exc.value)


def test_read_back_match_ignores_provider_defaults_and_order():
    expected = agent_body(["a", "b"])
    actual = copy.deepcopy(expected)
    actual["conversation_config"]["agent"]["prompt"]["tool_ids"] = ["b", "a"]
    actual["provider_default"] = "added"
    assert matches(actual, expected)
    actual["platform_settings"]["auth"]["enable_auth"] = False
    assert not matches(actual, expected)


def test_config_uses_existing_settings_loader_with_explicit_synthetic_env(tmp_path, monkeypatch):
    path = tmp_path / "voice.env"
    path.write_text("ELEVENLABS_API_KEY=fake-key\nELEVENLABS_AGENT_ID=agent-test\nELEVENLABS_AGENT_SESSIONS_PER_HOUR=7\nGEMINI_API_KEY=must-not-load\n", encoding="utf-8")
    for name in ("ELEVENLABS_API_KEY", "ELEVENLABS_AGENT_ID", "ELEVENLABS_AGENT_SESSIONS_PER_HOUR", "PYTHON_DOTENV_DISABLED", "GEMINI_API_KEY"):
        monkeypatch.delenv(name, raising=False)
    config = AgentConfig.from_env(str(path))
    assert config.api_key == "fake-key" and config.agent_id == "agent-test" and config.sessions_per_hour == 7
    assert "fake-key" not in repr(config)
    import os
    assert "GEMINI_API_KEY" not in os.environ
