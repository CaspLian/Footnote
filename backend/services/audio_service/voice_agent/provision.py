"""Create/update our private dev agent. Keys stay in the chosen .env and process memory."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from .client import AgentError, ConvaiClient
from .config import AgentConfig
from .definition import AGENT_NAME, agent_body, tool_configs
from .session import check_agent


def matches(actual, expected) -> bool:
    """The provider adds defaults. Compare only fields we own, with unordered scalar lists."""
    if isinstance(expected, dict):
        return isinstance(actual, dict) and all(key in actual and matches(actual[key], value) for key, value in expected.items())
    if isinstance(expected, list):
        return isinstance(actual, list) and sorted(json.dumps(x, sort_keys=True) for x in actual) == sorted(json.dumps(x, sort_keys=True) for x in expected)
    return actual == expected


def pages(client, path: str, key: str, **params) -> list[dict]:
    found, cursors = [], set()
    while True:
        reply = client.request("GET", path, params={"page_size": 100, "created_by_user_id": "@me", **params})
        found.extend(reply.get(key, []))
        cursor = reply.get("next_cursor")
        if not reply.get("has_more") or not cursor:
            return found
        if cursor in cursors:
            raise AgentError("PROVIDER_REJECTED", "ElevenLabs repeated a pagination cursor.")
        cursors.add(cursor)
        params["cursor"] = cursor


def provision(config: AgentConfig, client=None, *, check: bool = False) -> tuple[str, dict]:
    if not config.api_key:
        raise AgentError("NOT_CONFIGURED", "Set ELEVENLABS_API_KEY in backend/.env.")
    client = client or ConvaiClient(config)
    agent_id = config.agent_id
    if not agent_id:
        agents = [x for x in pages(client, "/v1/convai/agents", "agents", search=AGENT_NAME) if x.get("name") == AGENT_NAME]
        if len(agents) > 1:
            raise AgentError("NOT_CONFIGURED", "More than one ClaimPulse dev agent exists. Set ELEVENLABS_AGENT_ID explicitly.")
        agent_id = agents[0]["agent_id"] if agents else ""
    existing = client.get_agent(agent_id) if agent_id else None
    if existing and existing.get("name") != AGENT_NAME:
        raise AgentError("NOT_CONFIGURED", "ELEVENLABS_AGENT_ID points to another agent; nothing was changed.")
    if check and not existing:
        raise AgentError("NOT_CONFIGURED", "The ClaimPulse dev agent has not been provisioned.")
    all_tools = pages(client, "/v1/convai/tools", "tools", types="client", search="show_")
    ids = []
    for expected in tool_configs():
        tools = [x for x in all_tools if x.get("tool_config", {}).get("name") == expected["name"]]
        if len(tools) > 1:
            raise AgentError("NOT_CONFIGURED", "Duplicate ClaimPulse client tool names; nothing further was changed.")
        if tools:
            if not matches(tools[0].get("tool_config"), expected):
                raise AgentError("NOT_CONFIGURED", "An existing client tool differs from ClaimPulse's definition; inspect it before changing a shared tool.")
            ids.append(tools[0]["id"])
        elif check:
            raise AgentError("NOT_CONFIGURED", "A ClaimPulse client tool is missing.")
        else:
            ids.append(client.request("POST", "/v1/convai/tools", body={"tool_config": expected})["id"])
    body = agent_body(ids)
    if check:
        if not matches(existing, body):
            raise AgentError("NOT_CONFIGURED", "The agent differs from the current ClaimPulse definition. Run provision without --check.")
    elif existing:
        if not matches(existing, body):
            client.request("PATCH", f"/v1/convai/agents/{agent_id}", body=body)
    else:
        agent_id = client.request("POST", "/v1/convai/agents/create", body=body)["agent_id"]
    verified = client.get_agent(agent_id)
    check_agent(verified)
    if not matches(verified, body):
        raise AgentError("NOT_CONFIGURED", "The provider read-back differs from the requested agent definition.")
    return agent_id, verified


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", help="Read voice settings from this file; never copy or print key values")
    parser.add_argument("--check", action="store_true", help="Read-only configuration check")
    parser.add_argument("--dry-run", action="store_true", help="Print the definition without keys or network calls")
    parser.add_argument("--output", help="Write nonsecret agent-ID/model configuration for local server setup")
    args = parser.parse_args()
    if args.dry_run:
        print(json.dumps(agent_body(["show_line_item_placeholder", "show_price_check_placeholder"]), ensure_ascii=False, indent=2))
        return 0
    try:
        agent_id, verified = provision(AgentConfig.from_env(args.env_file), check=args.check)
    except (AgentError, ValueError, KeyError) as exc:
        print(f"Provision failed: {exc if isinstance(exc, AgentError) else type(exc).__name__}")
        return 2
    summary = {"agent_id": agent_id, "model": verified["conversation_config"]["agent"]["prompt"]["llm"],
               "private": True, "record_voice": False, "retention_days": 7}
    if args.output:
        Path(args.output).write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary))
    print("Set ELEVENLABS_AGENT_ID to this agent_id in backend/.env and restart the backend.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
