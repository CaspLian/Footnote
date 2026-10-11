# Footnote: instructions for coding assistants

Footnote is a hackathon project: an accessible, multilingual assistant that helps patients and caregivers
understand medical bills and insurance Explanation of Benefits (EOB) letters, spot charges worth asking about,
and prepare questions for the billing office. Users include people with limited English, low literacy or low
vision, so plain language and spoken output matter.

These instructions are shared by every coding assistant (Claude Code, Codex, others). Keep them short; details
live in `docs/`. **`docs/` is the team's shared memory: never delete or rename it.**

## Read when starting or resuming a task

1. `docs/PROJECT_STATUS.md`: last checked integration state (branch, commit, what works, blockers).
2. `docs/PROJECT_CONTEXT.md`: product, architecture, feature status, limitations, wrong assumptions to avoid.
3. `docs/API_CONTRACTS.md`: the HTTP contract the app uses. Read it before touching routes or models.
4. `docs/handoffs/<your-task>.md`: the handoff for your task, if there is one (convention: `docs/handoffs/README.md`).
5. `docs/decisions/`: accepted decisions and open proposals.
6. `docs/TEAM_WORKFLOW.md`: branches, handoffs and pull requests, written for humans too.
7. Before touching `mobile/`: `mobile/AGENTS.md`. Codex loads it only when started inside `mobile/`, so start app
   work there.

## Before editing anything

- Run `git status`, `git branch --show-current` and `git log --oneline -3`. Preserve uncommitted or unrelated work.
- Documentation on a branch can be stale after merges. Compare a document's date and commit with `git log`; the
  code wins over the docs, and you fix stale docs you rely on.
- Read the relevant code before changing it. Define observable acceptance criteria.
- For substantial work, give a short plan, then execute it. For small, clear tasks, proceed directly.

## Repository map

| Path | What it is |
|---|---|
| `backend/main.py` | FastAPI app: `/api/v1/analyze`, `/api/v1/audits/{id}`, `/api/v1/languages`; mounts the voice router |
| `backend/models.py` | Pydantic models shared by every route (`AnalyzeResponse`, `GeminiResult`, `PriceCheck`, ...) |
| `backend/services/gemini_services/` | Gemini extraction and explanation (`gemini_service.py`, MOCK answer JSON) |
| `backend/services/snowflake_services/` | Price check against Medicare rates (Snowflake, CSV fallback in `backend/data/`) |
| `backend/services/analytical_services/` | `analysis_store.py`: saves each analysis to Tiger Data and loads it back |
| `backend/services/tigerdata_services/` | Tiger Data claim audit/lifecycle tables used by claim routes; regional benchmark table remains separate |
| `backend/services/audio_service/` | ElevenLabs speech-to-text and text-to-speech, `/api/v1/voice/*`, playground |
| `backend/dev_console.py` | Local test page for every route (http://127.0.0.1:8770/console) |
| `backend/tests/`, `backend/services/audio_service/**/tests/` | Backend and audio tests |
| `backend/samples/` | Sample bills for tests and demos |
| `mobile/` | Footnote Expo Router/TypeScript app; `Camera-capture` sends imported bill pages to the analysis API |
| `docs/` | Shared project context (this system) |
| `BACKEND_VERIFICATION_REPORT.md` | Dated verification evidence and open bugs (2026-10-10) |

## Commands

Checked on 2026-10-10 at commit `d1753db` unless marked UNEXECUTED; the latest results are in
`docs/PROJECT_STATUS.md`. Every line starts in the repository root. The syntax is bash, so on Windows use Git Bash;
Windows PowerShell 5.1 rejects `&&` and line continuations, and needs `$env:NAME = "value"` for variables.

```bash
# Backend setup: Python 3.10 or newer (a fresh clone installed and passed the tests on 3.11, 3.12 and 3.14)
cd backend && python -m venv venv && source venv/Scripts/activate && pip install -r requirements.txt -r services/audio_service/requirements-dev.txt && cd ..
#   (macOS/Linux: venv/bin/activate)

# Tests. PYTHON_DOTENV_DISABLED=1 keeps backend/.env out: otherwise tests/test_tigerdata_service.py connects to the
# real TIGER_DATA_POSTGRES_URL in it and writes test rows to the team's database.
cd backend/services/audio_service && python -m pytest -q
cd backend && PYTHON_DOTENV_DISABLED=1 python -m pytest tests -q                      # database tests skip or error
cd backend && PYTHON_DOTENV_DISABLED=1 TIGER_TEST_DATABASE_URL=<test db> TIGER_DATA_POSTGRES_URL=<test db> python -m pytest tests -q
# Never run plain `python -m pytest` in backend/: collection fails (the audio conftest works only from its own
# folder), and test_snowflake.py makes a live Snowflake login on import.

# Run
cd backend && python dev_console.py   # console + API on 127.0.0.1:8770. With a real backend/.env it spends credits
                                      # and saves every analysis to the team's Tiger Data; for tests add --tiger-url <test db>
cd backend && MOCK=true python try_it.py --text "What is a copay?"   # one analysis, no server, no Gemini call
cd backend/services/audio_service && python -m playground             # voice playground on 127.0.0.1:8765
cd backend && uvicorn main:app --reload                               # the real server; for a phone: docs/API_CONTRACTS.md
cd mobile && npm install && npx expo start                            # UNEXECUTED here
```

Settings live in `backend/.env` (git-ignored; names in `backend/.env.example` and
`backend/services/audio_service/.env.example`). Never print, paste or commit their values.

## Working rules

**Implementation**
- Prefer the simplest maintainable solution that meets the requirements. Reuse existing abstractions and
  dependencies. No unrelated refactors, speculative features or premature optimization; measure before optimizing.
- Search and read the relevant files before expanding into unrelated areas.
- Keep money calculations deterministic, with explicit units (dollars, per unit) and suitable precision.
- Keep extraction, benchmark results, saved records, displayed explanations and spoken output consistent with
  each other: they must describe the same numbers.
- Routes, models (`backend/models.py`) and database tables are shared interfaces. For a breaking change, update
  `docs/API_CONTRACTS.md`, tell the affected teammates and agree before merging. Keep backward compatibility
  where practical; never change behavior silently.

**Domain**
- A difference from a benchmark is a reason to ask questions, never proof of an error, an overcharge or savings.
- Missing values and missing benchmarks are unknown, not zero.
- Do not infer deductibles, out-of-pocket balances or what the patient owes without evidence in the document.
- Details and further cautions: `docs/PROJECT_CONTEXT.md`, "Assumptions to avoid".

**Verification**
- Fix root causes. Never weaken tests, remove validation or bypass an integration to claim success.
- Add targeted tests for changed behavior and real integration risks. Run the relevant tests first; broaden
  when the change warrants it.
- Report mocked and live results separately. Use synthetic inputs and isolated test data (a local or throwaway
  database schema, never the team's tables). Keep live API calls small and bounded.
- Say clearly what was not tested, and why.

**Communication**
- Lead with the outcome, in concise plain English that a beginner can follow.
- Report what changed, how it was verified, and what remains.
- Challenge weak assumptions respectfully and offer a practical alternative.
- Continue routine reversible work without asking. Ask when a missing decision materially affects correctness,
  scope, cost or something irreversible. Do not promise optimality or perfect memory.

**Git and external actions**
- Work on the intended feature branch. Never overwrite teammates' changes.
- No force-push, discarding work or rewriting shared history without explicit permission.
- Do not push, deploy, send messages, place calls or spend money unless asked.
- Never commit secrets, connection strings, private patient documents or generated audio of real bills.

## Keeping shared context accurate

- Update your task handoff after meaningful progress and before ending substantial work.
- Update `docs/API_CONTRACTS.md` in the same change as any interface change.
- At integration checkpoints only, the person who merged updates `docs/PROJECT_STATUS.md` and the feature-status
  table in `docs/PROJECT_CONTEXT.md`. Between checkpoints, record status changes in your handoff.
- Record consequential decisions, and proposals, as separate files in `docs/decisions/`.
- Replace stale statements instead of appending contradictory notes. Never claim something was saved or
  verified unless it was.
- Recheck these documents after switching branches or merging.
