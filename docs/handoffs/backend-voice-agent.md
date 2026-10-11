# Private live voice agent

- Status: implemented; final combined runtime verification pending
- Owner: Nimesh with Codex
- Branch: `voice-agent-v1`
- Updated: 2026-10-10

The new `/api/v1/voice/agent/session` route uses a saved audit, bounded bill context, a private Gemini-powered
ElevenLabs agent, and fresh WebRTC/WebSocket credentials. It preserves existing voice routes and does not change
database tables. The definition includes local/provider limits, narrow overrides, client highlight tools and the
exact privacy notice the app shows.

Core tests: 35 passed. The first complete audio run had 616 passed and one settings-loader failure; that failure
was fixed using the existing restricted `load_settings_file()` helper and covered by an explicit synthetic-env
regression. The final merged suite is still pending and recorded in the root resume handoff.

Provisioning succeeded with the configured backend key held in process: a private `ClaimPulse Bill Helper (dev)`
agent was created and read back with Gemini 3.5 Flash, voice recording disabled, seven-day retention, and only
the intended tools/overrides. Its nonsecret ID is retained in local configuration, never committed here.
The provider requires English Agents to use Flash/Turbo v2, so English uses Flash v2 and other presets Flash
v2.5; this was verified from the live API rejection and successful retry. Existing regular TTS keeps its default.

Remaining: merge with the connected 42-locale frontend, run all combined tests, exercise the session route and a
real conversation, rebuild Android and verify runtime. No browser/device/conversation success is claimed yet.

`docs/decisions/2026-10-10-voice-agent.md` and `docs/API_CONTRACTS.md` document the implementation and setup.
No outbound calls, messages or production deployment were performed. Use synthetic data and isolated schemas.
