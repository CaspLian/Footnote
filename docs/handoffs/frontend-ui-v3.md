# Aarush UI and backend integration

Owner: Codex. Branch: `frontend-ui-v3`. Updated: 2026-10-10.

The pinned Aarush UI `c04f38f` is integrated in merge `9758308`; `locales-42` at `b6cee00` is integrated in
`34ebcac`. The 17 pre-reviewed resolution files retained all connection work and Android fixes.

Confirmed imports now follow Your documents → Understanding → Verify → Processing → Review. Gemini receives
ordered files and the working locale. Errors retain readable backend messages. Saved answers reopen without a
second analysis, changing file sets clears stale extractions, and confirmed edits survive Review reopening.
Each extraction stores a stable input fingerprint. Material confirmed corrections disable the original saved
audio and live bill context; Review explains why and uses the confirmed summary. Reverting to the source values
recovers the saved context. Missing line amounts stay explicitly unknown in Verify and block review/comparisons
until confirmed; the internal required numeric storage slot is never presented as a known zero.

Calm uses language defaults, Clear Alice, Warm George. Samples come from the server and reset when finished.
Saved readings are prepared early and cached by audit/voice. Live conversation is installed through the separate
`native/live-agent.ts` provider; no provider key is in the app. The session boundary validates tickets, preserves
camelCase provider overrides, sends form fields only, and distinguishes unavailable setup/limits/language from
retryable failures. Highlight tools never use omitted lines.

Every current application route has a UI consumer:

| Backend route | UI consumer / targeted evidence |
|---|---|
| `/` | Settings health; backend-client test |
| `/languages` | Languages validation and all 31 picker mappings to the 42-locale fixture |
| `/analyze` | Understanding ordered multipart / readable failure / cancellation tests |
| `/audits/{id}` | Reopen unchanged reading; wrapper-unwrapping tests; Review preserves confirmed edits |
| `/benchmarks/{code}` | Processing/review; unique parallel lookup, retry, professional-rate caveat tests |
| `/analyze-image` | Optional missing-date image recovery; persisted before request; once per case including failure; returned claim reused |
| `/claims`, `/claims/{id}` | First confirmation, Track missed-claim retry and deadlines refresh; in-flight dedup tests |
| claim `/actions`, `/status`, `/deadlines`, `/resolve` | Draft/submit/follow-up/notice/resolve; dollars and unknown-balance guard tests |
| `/voice/voices`, `/voice/voices/{key}/sample` | Voices and settings labels; language-default mapping/catalog retry tests |
| `/voice/speak`, `/voice/audio/{id}` | Review Listen; chosen voice sent and caches separate clips |
| `/voice/analyze` | Explicit 30-second recorded-question fallback; audio/locale/voice-only form tests |
| `/voice/agent/session` | Live orb; request/refusal/cancellation/parser tests, separate provider runtime tests |

All paths above except `/` are under `/api/v1`. POST/PATCH aliases on status/deadline routes share the same
behavior; the app uses POST. Audio GET/range delivery is consumed through Expo Audio and the browser player.

Executed here: final whole-app typecheck and lint pass, 153 mobile tests pass, preserving all original 82 tests.
Expo web export passes (1,826 modules), Android Hermes export passes (2,561 modules). The separate web app passes
19 tests with 3 live tests skipped and its production build passes. These use synthetic inputs and mocked provider
clients; they do not claim a real conversation or device result. Final browser and Android runtime checks belong
to the root integration handoff.

Root owns native package/config integration and final browser/Android runtime verification. Never run backend
tests against the team's database, and never push this branch without user authorization. Root's isolated backend
check is recorded in its resume handoff.

Remaining at this checkpoint: browser route/interaction checks and Android rebuild/runtime tests. iOS native live
voice remains unverified. Price
differences are questions; Medicare physician rates are not full hospital bills or evidence of savings.
