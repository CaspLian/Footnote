# Android feature and connected-service verification

- Status: in progress
- Owner: Nimesh with Codex
- Branch: `Backend-Frontend-Connection-V1`
- Started: 2026-10-11, America/New_York
- Baseline: `0232d70`

## Objective and acceptance criteria

Wipe and restart the Android emulator, then install Footnote fresh. Exercise the synthetic-bill journey through upload,
extraction, confirmation, review, narration, live voice, drafts, tracking and persistent reopening. Check the
available profile, language, preferences and help flows. Verify actual Tiger Data persistence and Snowflake
queries separately from test doubles and CSV fallback. Check Gemini and ElevenLabs failures, cancellation,
missing values, invalid documents and recovery. Report exact device, live-provider and automated evidence,
remaining limitations and demo readiness; no deployment or push is requested.

## Boundaries

Use synthetic documents and isolated test storage. Nimesh subsequently requested a full emulator data wipe and
removed the earlier-name compatibility requirement: app identifiers now use `footnote.compare` (from `merged-v1`;
briefly `org.hackknights.footnote`) and earlier-brand storage fallbacks are removed. Preserve private backend settings and team data. Keep provider calls
bounded and credentials out of logs and Git. Earlier evidence is in
`footnote-rebrand.md` and `claude-resume-integration.md`; this task requires fresh checks.

## Verification

In progress; results will replace this section after execution.
