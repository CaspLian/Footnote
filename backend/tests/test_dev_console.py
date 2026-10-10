"""Tests for dev_console.py: what it reports as live, and that only the console page itself can use it.

These never build the console app itself: that would add the console's checks to main.app, which the other tests share.
"""
import os

import pytest
from starlette.applications import Starlette
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

import dev_console

NO_KEYS = {
    "GEMINI_API_KEY": "", "ELEVENLABS_API_KEY": "", "SNOWFLAKE_ACCOUNT": "", "SNOWFLAKE_USER": "",
    "SNOWFLAKE_PASSWORD": "", "TIGER_DATA_POSTGRES_URL": "",
}


@pytest.fixture
def settings(monkeypatch):
    """No keys anywhere, and no settings file read (a developer's backend/.env or api.env must not change the result)."""
    for name, value in NO_KEYS.items():
        monkeypatch.setenv(name, value)
    for name in ("MOCK", "PRICE_SOURCE"):  # _decide_services sets these: setenv first, so teardown removes them again
        monkeypatch.setenv(name, "")
        monkeypatch.delenv(name)
    monkeypatch.setattr("services.audio_service.text_to_speech.config.find_env_file", lambda: None)
    return monkeypatch


def test_without_keys_everything_falls_back(settings):
    assert dev_console._decide_services() == {"gemini": "mock", "prices": "local_csv", "saving": "off", "voice": "off"}
    assert os.environ["MOCK"] == "true" and os.environ["PRICE_SOURCE"] == "csv"


def test_placeholders_count_as_missing(settings):
    settings.setenv("GEMINI_API_KEY", "your-gemini-api-key")
    settings.setenv("SNOWFLAKE_ACCOUNT", "your_account")
    settings.setenv("SNOWFLAKE_USER", "your_user")
    settings.setenv("SNOWFLAKE_PASSWORD", "your_password")
    settings.setenv("TIGER_DATA_POSTGRES_URL", "postgresql://user:password@host:port/dbname?sslmode=require")
    assert dev_console._decide_services() == {"gemini": "mock", "prices": "local_csv", "saving": "off", "voice": "off"}


def test_real_looking_settings_are_reported_live(settings):
    settings.setenv("GEMINI_API_KEY", "AIza-test-key")
    settings.setenv("SNOWFLAKE_ACCOUNT", "acct")
    settings.setenv("SNOWFLAKE_USER", "someone")
    settings.setenv("SNOWFLAKE_PASSWORD", "secret")
    settings.setenv("TIGER_DATA_POSTGRES_URL", "postgresql://someone:secret@db.example.com:5432/claims")
    settings.setenv("ELEVENLABS_API_KEY", "test-key")
    assert dev_console._decide_services() == {"gemini": "live", "prices": "snowflake", "saving": "Tiger Data", "voice": "live"}
    assert "MOCK" not in os.environ and "PRICE_SOURCE" not in os.environ  # nothing was switched off


def test_a_local_database_is_called_a_test_database(settings):
    settings.setenv("TIGER_DATA_POSTGRES_URL", "postgresql://someone:secret@127.0.0.1:54329/claims")
    assert dev_console._decide_services()["saving"] == "local test database"


def test_mock_and_csv_chosen_by_the_user_are_kept(settings):
    settings.setenv("GEMINI_API_KEY", "AIza-test-key")
    settings.setenv("MOCK", "true")
    settings.setenv("PRICE_SOURCE", "csv")
    services = dev_console._decide_services()
    assert services["gemini"] == "mock" and services["prices"] == "local_csv"


@pytest.fixture
def guarded():
    app = Starlette(routes=[Route("/", lambda request: PlainTextResponse("ok"), methods=["GET", "POST"])])
    return TestClient(dev_console.OnlyThisPage(app), base_url="http://127.0.0.1:8770")  # the console's own address


@pytest.mark.parametrize(
    "headers, status",
    [
        ({}, 200),  # curl, scripts, tests: no browser marks
        ({"Sec-Fetch-Site": "none"}, 200),  # typed into the address bar
        ({"Sec-Fetch-Site": "same-origin", "Origin": "http://127.0.0.1:8770"}, 200),  # the console page itself
        ({"Sec-Fetch-Site": "cross-site", "Origin": "https://evil.example"}, 403),  # another web site
        ({"Sec-Fetch-Site": "same-site", "Origin": "http://127.0.0.1:8765"}, 403),  # another local page, other port
        # Older browsers without Sec-Fetch-Site: only Origin tells, and it must be this server exactly.
        ({"Origin": "https://evil.example"}, 403),
        ({"Origin": "http://127.0.0.1:8765"}, 403),  # the playground's port
        ({"Origin": "http://localhost:3000"}, 403),  # some other local dev server
        ({"Origin": "https://127.0.0.1:8770"}, 403),  # another scheme
        ({"Origin": "null"}, 403),  # a sandboxed frame or a file:// page
    ],
)
def test_only_the_console_page_may_use_the_server(guarded, headers, status):
    assert guarded.post("/", headers=headers).status_code == status
    assert guarded.get("/", headers=headers).status_code == status


def test_the_page_opened_as_localhost_may_use_the_server():
    app = Starlette(routes=[Route("/", lambda request: PlainTextResponse("ok"), methods=["POST"])])
    client = TestClient(dev_console.OnlyThisPage(app), base_url="http://localhost:8770")
    assert client.post("/", headers={"Sec-Fetch-Site": "same-origin", "Origin": "http://localhost:8770"}).status_code == 200
    assert client.post("/", headers={"Origin": "http://127.0.0.1:8770"}).status_code == 403  # not this page's origin
