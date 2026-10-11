from __future__ import annotations

import asyncio
import logging
import secrets
import threading
import time
from functools import lru_cache

from .bill_context import build_context, clean
from .client import AgentError, ConvaiClient
from .config import AgentConfig
from .definition import ALLOWED_OVERRIDES, CLIENT_TOOL_NAMES, PRIVACY_NOTICE, agent_language, greeting_for_locale
from .limits import SessionLimiter, check_origin

try:
    from ..text_to_speech.voices import load_catalog
except ImportError:
    from text_to_speech.voices import load_catalog

logger = logging.getLogger(__name__)


def check_agent(agent: dict) -> None:
    settings = agent.get("platform_settings", {})
    enabled = settings.get("overrides", {}).get("conversation_config_override", {})
    safe = settings.get("auth", {}).get("enable_auth") is True
    safe = safe and settings.get("privacy", {}).get("record_voice") is False
    safe = safe and settings.get("privacy", {}).get("retention_days") == 7
    for group, fields in ALLOWED_OVERRIDES.items():
        safe = safe and all(enabled.get(group, {}).get(field) is True for field in fields)
    prompt = agent.get("conversation_config", {}).get("agent", {}).get("prompt", {})
    safe = safe and str(prompt.get("llm", "")).startswith("gemini-")
    # The client must never be allowed to replace the instruction text or LLM.
    safe = safe and not enabled.get("agent", {}).get("prompt", {}).get("prompt")
    safe = safe and not enabled.get("agent", {}).get("prompt", {}).get("llm")
    if not safe:
        raise AgentError("NOT_CONFIGURED", "The agent settings changed. Run python -m services.audio_service.voice_agent.provision from backend/ and restart the backend.", 503)


class SessionService:
    def __init__(self, config: AgentConfig, client=None, clock=time.monotonic):
        self.config, self.clock = config, clock
        self.client = client or ConvaiClient(config)
        self.catalog = load_catalog()
        self.limiter = SessionLimiter(config.sessions_per_hour, clock)
        self.checked_until = 0.0
        self.check_lock = threading.Lock()

    def check_origin(self, origin: str | None) -> None:
        check_origin(origin, self.config.allowed_origins)

    def start(self, *, analysis: dict, audit_id: str, locale: str, language_name: str,
              voice: str | None = None, connection_type: str = "webrtc", client_address: str = "",
              analysis_language_name: str | None = None) -> dict:
        if connection_type not in ("webrtc", "websocket"):
            raise AgentError("INVALID_REQUEST", "connection_type must be webrtc or websocket.", 400)
        try:
            language = agent_language(locale)
        except ValueError:
            raise AgentError("LANGUAGE_NOT_SUPPORTED", "The agent cannot speak this language.", 400) from None
        selected_voice = self.catalog.get(voice) if voice else self.catalog.default_for(locale)
        if selected_voice is None:
            raise AgentError("INVALID_REQUEST", "Unknown voice. Use one of: " + ", ".join(self.catalog.keys()), 400)
        if not self.config.api_key or not self.config.agent_id:
            raise AgentError("NOT_CONFIGURED", "Add ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID to backend/.env and restart the backend. Run python -m services.audio_service.voice_agent.provision from backend/ to create the agent.", 503)
        variables, lines = build_context(analysis, language_name, analysis_language_name)
        reservation = self.limiter.reserve(client_address)
        deadline = self.clock() + 15
        try:
            with self.check_lock:
                if self.clock() >= self.checked_until:
                    check_agent(self.client.get_agent(self.config.agent_id, deadline=deadline))
                    self.checked_until = self.clock() + 600
            if self.clock() >= deadline:
                raise AgentError("PROVIDER_TIMEOUT", "ElevenLabs took too long. Try again.", 503, True)
            credential = self.client.credential(self.config.agent_id, connection_type, deadline=deadline)
        except BaseException:
            self.limiter.release(reservation)
            raise
        keywords = ["Footnote", "Medicare"]
        provider = clean(analysis["result"].get("provider_name"), 100)
        if provider:
            keywords.append(provider)
        if language == "en":
            keywords.extend(["deductible", "copay", "coinsurance", "itemized bill"])
        return {"connection_type": connection_type, "conversation_token": credential.get("token"),
                "signed_url": credential.get("signed_url"), "conversation_id": credential.get("conversation_id"),
                "start_within_seconds": 600 if connection_type == "webrtc" else 900,
                "user_id": "cp-" + secrets.token_hex(6), "locale": locale, "language": language,
                "voice": selected_voice.key, "audit_id": audit_id, "bill_loaded": True,
                "dynamic_variables": variables,
                "overrides": {"agent": {"language": language, "firstMessage": greeting_for_locale(locale)},
                              "tts": {"voiceId": selected_voice.voice_id}, "asr": {"keywords": keywords}},
                "client_tools": list(CLIENT_TOOL_NAMES), "lines": lines, "privacy_notice": PRIVACY_NOTICE}


@lru_cache(maxsize=1)
def get_service() -> SessionService:
    try:
        return SessionService(AgentConfig.from_env())
    except ValueError:
        raise AgentError("NOT_CONFIGURED", "Check the voice-agent settings in backend/.env and restart the backend.", 503) from None


async def start_session_async(**kwargs) -> dict:
    try:
        return await asyncio.wait_for(asyncio.to_thread(get_service().start, **kwargs), timeout=15)
    except asyncio.TimeoutError:
        raise AgentError("PROVIDER_TIMEOUT", "ElevenLabs took too long. Try again.", 503, True) from None
    except AgentError:
        raise
    except Exception as exc:
        # Only the exception type: neither bill text nor credentials can enter logs.
        logger.error("Voice agent session failed (%s)", type(exc).__name__)
        raise AgentError("INTERNAL_ERROR", "The conversation could not be prepared.", 500) from None
