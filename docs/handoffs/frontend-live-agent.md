# Live voice behind the Unfold orb

- Owner: Nimesh, recovered Claude work with Codex
- Branch: `frontend-ui-v3`, isolated `wt-ui` worktree
- Updated: 2026-10-10
- Status: implemented; whole-app TypeScript/lint, 153 tests and Expo web/Android exports passed; runtime verification handled by root agent

## Objective and acceptance criteria

Connect the existing orb to a real ElevenLabs WebRTC conversation about a saved sample bill, preserving the
offline refusal and the existing captions, controls and Review findings. Start must obtain a fresh backend
ticket, never expose an API key, and keep every spoken bill amount tied to its saved analysis.

- Missing backend, saved analysis or supported language refuses before SDK/microphone work.
- Missing native modules and denied microphone explain recovery; no session request is minted.
- Start cancellation, timeout and early remote hang-up close a late SDK connection once.
- Remote goodbye/drop releases controller and audio state so Start works again.
- Partial, final and corrected replies update the same transcript turn and clear obsolete captions.
- Client tools only highlight known, included lines and do not show a doctor-only rate as a total-charge comparison.
- The backend privacy notice is visible before Start. Bill corrections pause original-analysis voice.

## Implementation

- `mobile/src/native/live-agent.ts` installs the session adapter with injected preparation/conversation functions.
- `services/elevenlabs-conversation.ts` contains SDK controls, startup cancellation and audio ownership cleanup.
- `services/elevenlabs-sdk.ts` lazily registers the native SDK; `.web.ts` registers the browser entry early.
- `native/microphone.ts` checks Expo recording permission; `.web.ts` checks a secure page and stops probe tracks.
- `services/agent-events.ts` maps audio modes, streamed/final/corrected text, interruptions and disconnects.
- `services/agent-tools.ts` validates line numbers and publishes a Review finding highlight. The React hook lives
  in `native/agent-highlight.ts` and expires the highlight after 20 seconds.
- `services/audio-focus.ts` makes device narration, backend readings and live conversation share one audio owner.
- `services/voice-agent.ts` adds optional remote-ending callbacks, corrections and sanitized input/output levels.
- `components/agent-orb-control.tsx` shows the privacy note, handles permission-dialog AppState transitions and
  ends calls on real backgrounding, route changes, source-context changes or preferences changes.
- The existing orb polls SDK audio levels at 100 ms through a shared animation value. It does not rerender React
  for every sample. Recorded questions are clearly presented as separate general answers when live voice fails.

The session HTTP boundary and recorded fallback belong to the frontend integration handoff. The backend session
route and agent settings belong to the backend voice-agent handoff. Root owns dependency/config verification.

## Contracts

`createElevenLabsConversation()` exposes `prepare(context, signal)` and `open(grant, context, options, prepared)`.
It uses only WebRTC `conversationToken`; it never sends a signed URL, `textOnly`, API key or profile fields.
The grant comes from `POST /api/v1/voice/agent/session` and the confirmed backend revision 2 contract.

`AgentConnectOptions.onEnd({error?})` means the SDK or another audio owner ended the call. A normal ending keeps
the transcript and returns idle; an error permits retry. `AgentSession.levels()` is optional for local adapters.
`useAgentHighlight(caseId)` returns only the matching finding ID. Tools reject `inContext !== true` and reject
price cards for `doctor_part_only` and `not_compared` labels.

## Checks actually run by this agent

- `node node_modules/typescript/bin/tsc --noEmit`: passed for the whole app after runtime/UI/tests landed.
- Scoped `node node_modules/eslint/bin/eslint.js ...`: passed for all owned runtime, UI and test files.
- Added targeted tests for SDK/microphone order, controls, cancellation, late startup disposal, timeout, remote
  hang-up during/after startup, audio competition, synchronous startup failure, captions, tool validation,
  microphone probe release and app permission configuration.
- A redundant test run of the recovered scratch prototype failed with sandbox `spawn EPERM`; its escalation
  was user-aborted. No successful prototype run is claimed from this resumed task.
- Frontend integration ran the app's complete regression suite: 153 passed, 0 failed; whole-app typecheck/lint
  passed. Expo web and Android Hermes exports passed. The separate web app passed 19 tests with 3 live tests
  skipped and its production build passed. Root handles browser/live/device verification; no real conversation
  or physical-device result is claimed here.

## Documentation checked

- Expo SDK 57 audio: https://docs.expo.dev/versions/v57.0.0/sdk/audio/
- Expo documentation index: https://docs.expo.dev/llms.txt
- ElevenLabs JavaScript SDK: https://elevenlabs.io/docs/eleven-agents/libraries/java-script
- ElevenLabs React Native SDK: https://elevenlabs.io/docs/eleven-agents/libraries/react-native
- The recovered exact 1.25.0 client and 1.2.27 native package types/source confirm native registration order.

Native requires a rebuilt development client containing LiveKit. Startup itself cannot be cancelled inside the
SDK; the adapter disposes its connection as soon as its promise resolves after cancellation or timeout.
The optional `EXPO_PUBLIC_VOICE_AGENT=off` switch preserves the unavailable path for demo recovery.
