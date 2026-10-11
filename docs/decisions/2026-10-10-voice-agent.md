# Live voice conversations about a saved bill

- Status: accepted for Nimesh's requested local development integration; implemented
- Date: 2026-10-10
- Decision owner: Nimesh (audio), continued with Codex

## Context

The existing Unfold orb has conversation controls and captions but needed a live provider. Nimesh requested an
ElevenLabs voice agent using Gemini and the app connection. The recovered revision-2 design supplied the session
contract; this record describes the implemented result rather than unbuilt design steps.

## Decision

Use one private development agent named `ClaimPulse Bill Helper (dev)` with Gemini 3.5 Flash. Runtime bill context
comes from a saved analysis identified by `audit_id`; the backend constructs eight bounded dynamic variables.
The API key stays on the backend. The app obtains a fresh short-lived WebRTC token per Start; the optional
WebSocket transport returns a signed URL for tools and scripted tests. Neither credential is cached or logged.

The live API rejected English Flash v2.5 with `English Agents must use turbo or flash v2`. Therefore the agent's
English base uses `eleven_flash_v2`, and its non-English presets use `eleven_flash_v2_5`. This provider constraint
was observed during provisioning on 2026-10-10. The ordinary saved-analysis TTS service retains its Flash v2.5
default and Hebrew/Thai model fallback.

The two client tools highlight an existing bill line or price finding. They do not navigate, change records or
contact anyone. The app refuses omitted lines and doctor-only comparisons. The prompt treats document text as
data, keeps dollars deterministic, and makes reference differences reasons to ask questions rather than proof
of errors or savings. A changed confirmed bill pauses its original saved narration and live context.

## Session boundary

`POST /api/v1/voice/agent/session` takes form fields:

- `audit_id`: required saved-analysis UUID
- `target_language`: optional, defaulting to the saved locale
- `voice`: optional catalog key
- `connection_type`: `webrtc` by default, or `websocket`

The response includes the credential, locale/language/voice, random user ID, eight dynamic variables, permitted
camelCase SDK overrides, numbered lines, client tool names and privacy notice. It uses `Cache-Control: no-store`.
The app sends no profile, insurer, ZIP or arbitrary monetary overrides to this route. A modified client can still
alter provider-side dynamic variables after receiving a credential; this is not a guarantee against that threat.

Web origins must be localhost/loopback or explicitly configured. Native requests have no Origin. Local limits
are one successful grant per address per 10 seconds and 30 per hour by default. The provider agent is private,
allows four simultaneous calls, at most 60 per day, no queue/burst billing, ten minutes per call, and ends after
two minutes of silence. These limits do not provide application authentication.

The backend checks the agent's private-auth, voice-recording, retention, allowed-override and Gemini settings
before issuing credentials, caching that check for ten minutes. It allows language, first greeting, voice,
text-only test mode and recognition keywords overrides; it does not allow clients to replace the prompt or LLM.

## Privacy and scope

The agent is provisioned with voice recording disabled and seven-day retention. The app displays this exact
notice before Start: "Sample bills only: the bill details and everything said in this call go to ElevenLabs,
which uses Google's Gemini, and ElevenLabs keeps them for 7 days."

Free-text bill fields can contain identifying information; omitting dedicated patient/account fields is not
anonymization. This development setup uses synthetic bills. It has no enterprise BAA/Zero Retention setup.
Manual/sample cases without a saved analysis and the Guide orb are unavailable for live bill conversations.
Hebrew and Thai regular readings work, but those live-agent languages are unavailable in this version.
The server supplies its local calendar date, consistent with its existing deadline calculations.

## Impacted components

- `backend/services/audio_service/voice_agent/`: settings, context, provider calls, rate limits, agent definition,
  session service, prompt and idempotent provisioning CLI
- `backend/services/audio_service/voice_routes.py`: additive session route
- `mobile/src/services/voice-agent-session.ts`, `elevenlabs-conversation.ts`, event/tool/audio ownership modules
- `mobile/src/native/live-agent.ts`, microphone checks and SDK platform loaders
- `docs/API_CONTRACTS.md` and the voice/frontend integration handoffs

No database schema change. The provision command reads an existing `.env` in process and prints only nonsecret
agent-ID/model metadata. It will not alter a differently named existing agent or shared client tool definition.

## Evidence and remaining checks

The private agent was created and read back successfully with Gemini 3.5 Flash on 2026-10-10. Core agent tests
pass (35). The complete UI suite passes (153), and its typecheck, lint and web/Android Hermes exports pass.
Final combined HTTP, browser and rebuilt Android runtime evidence is recorded in
`docs/handoffs/claude-resume-integration.md`; these results must not be inferred from provisioning alone.
