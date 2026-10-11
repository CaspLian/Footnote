# Private live voice agent

- Status: merged; live HTTP and web conversation verified; Android runtime recorded in the resume handoff
- Owner: Nimesh with Codex
- Branch: `voice-agent-v1`, merged into `Backend-Frontend-Connection-V1` at `7bd92f0`
- Updated: 2026-10-10

The new `/api/v1/voice/agent/session` route uses a saved audit, bounded bill context, a private Gemini-powered
ElevenLabs agent, and fresh WebRTC/WebSocket credentials. It preserves existing voice routes and does not change
database tables. The definition includes local/provider limits, narrow overrides, client highlight tools and the
exact privacy notice the app shows.

Core tests: 35 passed. The first complete audio run had 616 passed and one settings-loader failure; that failure
was fixed using the existing restricted `load_settings_file()` helper and covered by an explicit synthetic-env
regression. The final merged audio suite passed 648 tests; combined backend passed 165 with 2 skipped in an
isolated local PostgreSQL database. The private session route returned a valid no-store WebRTC credential live.

Provisioning succeeded with the configured backend key held in process: a private `ClaimPulse Bill Helper (dev)`
agent was created and read back with Gemini 3.5 Flash, voice recording disabled, seven-day retention, and only
the intended tools/overrides. Its nonsecret ID is retained in local configuration, never committed here.
The provider requires English Agents to use Flash/Turbo v2, so English uses Flash v2 and other presets Flash
v2.5; this was verified from the live API rejection and successful retry. Existing regular TTS keeps its default.

The live web conversation heard the synthetic microphone question, used the saved CT amount and Medicare
reference, streamed captions, and highlighted its card. Mute, End and a fresh second conversation passed. The
second answer correctly declined to classify the ER charge from a doctor-only reference. ElevenLabs records
Gemini 3.5 Flash usage and normal client termination for both calls (40 and 20 seconds).

The Android APK built successfully and installed. Native runtime verification is recorded separately in the
resume handoff; a System UI ANR required an emulator restart. Physical-device and iOS behavior remain unverified.

`docs/decisions/2026-10-10-voice-agent.md` and `docs/API_CONTRACTS.md` document the implementation and setup.
No outbound calls, messages or production deployment were performed. Use synthetic data and isolated schemas.
