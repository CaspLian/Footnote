# Task handoffs

A handoff is one short file per task that lets anyone, a teammate or a coding assistant, pick the task up without
the chat history. Each task gets its own uniquely named file, so handoffs never collide in merges.

## Convention

- **One file per task:** `docs/handoffs/<area>-<short-task>.md`, named like your branch `<area>/<short-task>`
  (`docs/TEAM_WORKFLOW.md`) where you can, for example:
  - `docs/handoffs/audio-streaming.md`
  - `docs/handoffs/frontend-bill-upload.md`
  - `docs/handoffs/audit-persistence.md`
- **Ownership:** the owner keeps their own handoff current; others add comments in pull requests instead of
  editing it.
- **When to update:** after meaningful progress and before stopping substantial work.
- **Content:** replace outdated lines rather than appending new ones that contradict them. Record only what
  actually happened; tests "run" means run, with their real output.
- **Finished tasks:** keep the file as a record and set the status to done. Move anything still open into a new
  task's handoff; the next integration checkpoint carries shared blockers into `docs/PROJECT_STATUS.md`.

## Template

```markdown
# <Task name>

- Status: not started | in progress | blocked | done
- Owner: <name, if known>        Branch: <branch>        Last updated: <YYYY-MM-DD>

## Objective and acceptance criteria
<what "done" means, as observable checks>

## Files and interfaces affected
<paths; routes, models or tables touched>

## Done
- ...

## Remaining
- ...

## Tests run (actual results)
- `<command>` → <result>, <date>, <commit or "uncommitted">; live or mocked

## API, dependency or schema changes
<none | what changed, and who was told>

## Blockers and assumptions
- ...

## Next steps
1. ...
```

## Finding handoffs

List the folder (`ls docs/handoffs`). There is deliberately no index to keep up to date: a list that everyone
edits would cause merge conflicts.
