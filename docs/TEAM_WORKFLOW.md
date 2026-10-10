# Team workflow: for people and their coding assistants

How four people (and their assistants) work on ClaimPulse AI in parallel without stepping on each other.

**Commands below are for Git Bash**, which comes with Git for Windows, and they also work on macOS and Linux.
In PowerShell, run each part of a `&&` chain as its own line.

**`<integration-branch>` means the branch named in `docs/PROJECT_STATUS.md`.** On 2026-10-10 that was
`Gemini-Tiger-Snow-ElevenLabs-V2`.

## 1. Read these first

1. `AGENTS.md`: the rules every assistant follows. They're short, and worth reading yourself too.
2. `docs/PROJECT_STATUS.md`: what works right now, on which branch and commit.
3. `docs/PROJECT_CONTEXT.md`: what the product is, how it is built, what is real and what is only planned.
4. `docs/API_CONTRACTS.md`: before you call or change a route.
5. Your task's handoff in `docs/handoffs/`, and `docs/decisions/` for decisions that affect you.

## 2. Find the shared integration branch (it is not necessarily `main`)

```bash
git fetch --all --prune
git branch -r --sort=-committerdate                    # most recently updated branches first
git log -1 --format="%h %ci %an: %s" origin/main       # how old is main?
git show origin/<integration-branch>:docs/PROJECT_STATUS.md
```

The last command works once these documents are pushed to that branch. If the team moves the integration branch,
update `docs/PROJECT_STATUS.md` and tell everyone; this file never names it except above.

## 3. Getting the shared context onto your computer

Pushing files to GitHub does **not** change anyone else's computer. Each teammate has to pull them.

**Starting fresh, with no work in progress:**
```bash
git fetch origin
git switch <integration-branch>
git pull
```

**Already working on your own branch:**
```bash
git status                      # commit or stash your work first; never lose uncommitted changes
git fetch origin
git merge origin/<integration-branch>
```
Resolve any conflicts, run your tests, and commit the merge.

## 4. What Git shares, and what it doesn't

Git shares **committed files only**. It does not share:
- **Chat history** with your assistant.
- **An assistant's local memory** (for example Claude Code's `~/.claude/.../memory/`). Write anything the team
  needs into a handoff, a decision or the status file.
- **Keys and passwords.** `backend/.env` is git-ignored on purpose. Each person creates their own. Share keys
  privately, never in Git, chat or screenshots.
- **Uncommitted work, local databases and generated audio.**

## 5. Settings on your machine

Create `backend/.env` once, from the example. `-n` never overwrites an existing file, so running it again is safe:

```bash
cp -n backend/.env.example backend/.env
```

In PowerShell: `if (-not (Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }`.

Then fill in your own values. The voice settings are explained in `backend/services/audio_service/.env.example`.

Also change `GEMINI_MODEL` to `gemini-3.5-flash`. The example's `gemini-3.8-flash` did not answer on 2026-10-10,
so every analysis waited about 80 s for the fallback. The fallback line, `gemini-3.5-flash-lite`, can stay. See
`docs/decisions/2026-10-10-gemini-model-setting.md`.

## 6. Starting a task

1. Start a branch from the up-to-date integration branch:
   ```bash
   git fetch origin
   git switch -c <area>/<short-task> --no-track origin/<integration-branch>
   ```
   For example: `git switch -c frontend/bill-upload --no-track origin/<integration-branch>`. With `--no-track`, a
   plain `git push` can never land on the shared branch.
2. Create your handoff, `docs/handoffs/<area>-<short-task>.md` (for example `frontend-bill-upload.md`), from the
   template in `docs/handoffs/README.md`. Write the objective and acceptance criteria first.
3. Give your assistant the onboarding prompt (below) with the task filled in.

## 7. Keeping your handoff current

Update it after meaningful progress and before you stop for the day:
- what is done and what remains
- the tests you ran, with the actual results
- any interface changes, blockers and next steps

Only you edit your handoff, so it never causes merge conflicts. Replace stale lines instead of adding
contradictory ones.

## 8. Changing a shared contract or database schema

Routes, request and response fields (`backend/models.py`) and database tables are shared: other people's code
depends on them.
1. Write the proposal as a decision file (`docs/decisions/`, status `proposed`), and tell the people affected (the
   mobile app, Gemini, prices, voice).
2. Prefer additive changes: new optional fields, new routes. Renaming or removing something breaks others.
3. Update `docs/API_CONTRACTS.md` in the same pull request as the code.
4. Do not merge a breaking change until the affected teammates have agreed and are ready.

## 9. Preparing a merge or pull request

1. Push your branch, never the integration branch:
   ```bash
   git status                                   # add files by name; never backend/.env, real bills or generated audio
   git push -u origin <area>/<short-task>
   ```
2. On GitHub, open a pull request from your branch into `<integration-branch>`. Keep it small and focused, and
   describe:
   - **Purpose:** what problem it solves, and which handoff it belongs to.
   - **What changed:** files and behavior, plus any contract or schema change.
   - **Test evidence:** the commands you ran and their actual results, mocked and live separately.
   - **Integration notes:** what other teammates must do (new settings, migrations, changed fields).

## 10. Integration checkpoints

When branches are merged into the integration branch and tested together, whoever did the merge updates
`docs/PROJECT_STATUS.md` (date, commit, what was verified, failures, next priorities) and the feature-status table
in `docs/PROJECT_CONTEXT.md`. Nobody else edits those two between checkpoints, which avoids merge conflicts.

## Onboarding prompt for any coding assistant

Copy this, and replace `[TASK]`:

> Read AGENTS.md, docs/PROJECT_CONTEXT.md, docs/API_CONTRACTS.md, docs/PROJECT_STATUS.md, and the relevant task
> handoff in docs/handoffs/. Inspect the current branch and working tree. Summarize the relevant context, identify
> stale assumptions, and then work on this task: [TASK]. Follow the repository's instructions and update the task
> handoff with verified progress.
