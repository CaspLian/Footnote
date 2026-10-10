# One folder per backend service, with underscore names

- Status: accepted by Nimesh (implemented in `d1753db`); not yet confirmed by the whole team
- Date: 2026-10-10        Decision owner: Nimesh

## Context

The team wanted each service's files grouped in its own folder. Folders named with spaces (`gemini services`,
`analytical services`) had twice been created in working copies. Python cannot import a folder whose name has a
space, so `main.py` failed with `No module named 'services.gemini_service'`.

## Decision

Each service gets its own folder under `backend/services/`, named with underscores:

| Folder | Files |
|---|---|
| `gemini_services/` | `gemini_service.py`, `mock_gemini_response.json` |
| `snowflake_services/` | `snowflake_service.py` (still reads `backend/data/cpt_benchmarks.csv`) |
| `tigerdata_services/` | `tigerdata_service.py` (still reads `backend/.env`) |
| `analytical_services/` | `analysis_store.py` |
| `audio_service/` | unchanged |

Imports become `from services.gemini_services.gemini_service import analyze`.

## Alternatives and tradeoffs

- Folders with spaces: impossible to import.
- Leaving the files flat in `services/`: no change for teammates, but no grouping.
- The tradeoff of the choice made: open branches and new code must use the new import paths. Git usually carries
  edits to moved files across in a merge.

## Impacted components

`backend/main.py`, `voice_routes.py`, `dev_console.py`, `try_it.py`, `backend/tests/`, and every teammate's branch.
