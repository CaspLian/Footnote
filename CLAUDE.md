@AGENTS.md

## Claude Code notes

- The shared instructions for every coding assistant are in `AGENTS.md`, imported above. Change shared rules
  there, not here; keep this file for Claude-specific notes only.
- Claude Code reads `AGENTS.md` by itself only when there is no `CLAUDE.md`. With this file, the import above
  loads it, and it is never loaded twice.
- `mobile/CLAUDE.md` imports `mobile/AGENTS.md` (Expo guidance) once Claude reads files in `mobile/`.
- `mobile/.claude/settings.json` turns on the official Expo plugin, but only in sessions started inside `mobile/`:
  Claude Code reads settings from the folder you start in. For app work, start Claude Code in `mobile/`; this
  file still loads from the folder above.
- Auto memory (`~/.claude/projects/.../memory/`) stays on your own machine. Anything a teammate needs goes into
  `docs/` (handoffs, decisions, status), not into memory.
- `.claude/skills/hackathon-grand-prize/` holds an optional skill for the pitch, judging and demo preparation.
