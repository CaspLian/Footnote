"""Bounded API calls. Provider bodies, tokens and URLs are never logged."""
from __future__ import annotations

import requests
import time

from .config import AgentConfig


class AgentError(Exception):
    def __init__(self, code: str, message: str, status: int = 502, retryable: bool = False,
                 retry_after: int | None = None):
        super().__init__(message)
        self.code, self.status, self.retryable, self.retry_after = code, status, retryable, retry_after


class ConvaiClient:
    def __init__(self, config: AgentConfig):
        self.config = config

    def request(self, method: str, path: str, *, params=None, body=None, deadline: float | None = None) -> dict:
        remaining = (deadline - time.monotonic()) if deadline is not None else 8
        if remaining <= 0:
            raise AgentError("PROVIDER_TIMEOUT", "ElevenLabs took too long. Try again.", 503, True)
        try:
            response = requests.request(method, self.config.base_url + path,
                                        headers={"xi-api-key": self.config.api_key},
                                        params=params, json=body, timeout=(min(3, remaining / 2), min(5, remaining / 2)))
        except requests.Timeout:
            raise AgentError("PROVIDER_TIMEOUT", "ElevenLabs took too long. Try again.", 503, True) from None
        except requests.RequestException:
            raise AgentError("PROVIDER_UNAVAILABLE", "ElevenLabs could not be reached. Try again.", 503, True) from None
        if not response.ok:
            code, message, status, retryable = "PROVIDER_REJECTED", "ElevenLabs refused the agent request.", 502, False
            if response.status_code in (401, 403):
                code, message = "AUTH_FAILED", "The ElevenLabs key cannot access this agent. Check its Agents permissions."
            elif response.status_code == 404:
                code, message = "AGENT_NOT_FOUND", "The configured ElevenLabs agent was not found. Run voice_agent.provision."
            elif response.status_code == 429:
                # An exhausted quota cannot be fixed by immediate retries.
                try:
                    detail = str(response.json().get("detail", "")).lower()
                except ValueError:
                    detail = ""
                if "quota" in detail or "credit" in detail:
                    code, message = "QUOTA_EXCEEDED", "The ElevenLabs account has no agent credits available."
                else:
                    code, message, status, retryable = "RATE_LIMITED", "ElevenLabs is busy. Try again shortly.", 503, True
            elif response.status_code >= 500:
                code, message, status, retryable = "PROVIDER_UNAVAILABLE", "ElevenLabs is temporarily unavailable.", 503, True
            raise AgentError(code, message, status, retryable)
        try:
            result = response.json()
            if not isinstance(result, dict):
                raise ValueError()
            return result
        except ValueError:
            raise AgentError("PROVIDER_REJECTED", "ElevenLabs returned an invalid agent response.") from None

    def get_agent(self, agent_id: str, *, deadline: float | None = None) -> dict:
        return self.request("GET", f"/v1/convai/agents/{agent_id}", deadline=deadline)

    def credential(self, agent_id: str, connection_type: str, *, deadline: float | None = None) -> dict:
        path = "/v1/convai/conversation/token" if connection_type == "webrtc" else "/v1/convai/conversation/get-signed-url"
        params = {"agent_id": agent_id}
        if connection_type == "websocket":
            params["include_conversation_id"] = "true"
        result = self.request("GET", path, params=params, deadline=deadline)
        key = "token" if connection_type == "webrtc" else "signed_url"
        if not isinstance(result.get(key), str) or not result[key]:
            raise AgentError("PROVIDER_REJECTED", "ElevenLabs did not return a conversation credential.")
        return result
