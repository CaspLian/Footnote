from __future__ import annotations

import os
from dataclasses import dataclass, field

try:
    from ..text_to_speech.config import TTSConfig, load_settings_file
except ImportError:  # python -m voice_agent.provision from audio_service/
    from text_to_speech.config import TTSConfig, load_settings_file


@dataclass(frozen=True)
class AgentConfig:
    api_key: str = field(default="", repr=False)
    agent_id: str = ""
    base_url: str = "https://api.elevenlabs.io"
    allowed_origins: tuple[str, ...] = ()
    sessions_per_hour: int = 30

    @classmethod
    def from_env(cls, env_file: str | None = None) -> AgentConfig:
        if env_file is not None:
            load_settings_file(env_file)
        voice = TTSConfig.from_env(load_env_file=env_file is None)
        limit = int(os.getenv("ELEVENLABS_AGENT_SESSIONS_PER_HOUR", "30"))
        if not 1 <= limit <= 300:
            raise ValueError("ELEVENLABS_AGENT_SESSIONS_PER_HOUR must be between 1 and 300.")
        return cls(voice.api_key, os.getenv("ELEVENLABS_AGENT_ID", "").strip(), voice.base_url,
                   tuple(x.strip() for x in os.getenv("ELEVENLABS_AGENT_ALLOWED_ORIGINS", "").split(",") if x.strip()), limit)
