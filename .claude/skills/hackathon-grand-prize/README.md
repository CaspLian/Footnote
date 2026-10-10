# hackathon-grand-prize

A portable Agent Skill that makes an autonomous coding agent operate like a competitive hackathon CTO: research the real rules, choose a defensible project, ship one memorable workflow, validate it, and present it with reliable evidence.

## Package contract

`SKILL.md` is the entry point and source of truth. Keep this directory intact:

```text
hackathon-grand-prize/
├── SKILL.md
├── README.md
├── references/   # loaded on demand
├── assets/       # fillable working artifacts
└── scripts/      # optional dependency-free Python helpers
```

All paths in `SKILL.md` are relative to this directory. Copying only `SKILL.md`, or copying a lightweight repository adapter, creates an incomplete installation.

## Install with npm / npx

After publication, install this skill without cloning the repository:

```powershell
npx hackathon-skills add hackathon-grand-prize --agent kiro
```

Use `claude`, `codex`, `antigravity`, `cursor`, `kiro`, `copilot`, or `agents` as the agent value. Add `--scope user` for a documented user-level location, `--dry-run` to inspect the destination, `--target <skills-directory>` for a verified custom location, or `--json` for automation. The installer refuses existing destinations unless `--force` is explicit; forced installs preserve the old directory as a timestamped backup.

```powershell
npx hackathon-skills list
npx hackathon-skills agents
npx hackathon-skills add hackathon-grand-prize --agent claude --scope user
```

## Manual installation of the canonical package

Use one destination supported by the active client. Avoid installing the same skill name into several directories discovered by one client.

| Client | Project scope | User scope / notes |
|---|---|---|
| Claude Code | `.claude/skills/hackathon-grand-prize/` | `~/.claude/skills/hackathon-grand-prize/` |
| OpenAI Codex | `.agents/skills/hackathon-grand-prize/` | Use the skill location supported by the installed Codex version |
| Google Antigravity CLI | `.agents/skills/hackathon-grand-prize/` | Official local-project discovery path |
| Cursor | `.cursor/skills/hackathon-grand-prize/` or `.agents/skills/hackathon-grand-prize/` | `~/.cursor/skills/` or `~/.agents/skills/` |
| Kiro | `.kiro/skills/hackathon-grand-prize/` | Import through **Agent Steering & Skills**, or commit a workspace skill |
| VS Code / GitHub Copilot | `.github/skills/hackathon-grand-prize/` or `.agents/skills/hackathon-grand-prize/` | `~/.copilot/skills/` or `~/.agents/skills/` where supported |

### PowerShell example

From the repository containing this package:

```powershell
New-Item -ItemType Directory -Force -Path .agents\skills | Out-Null
Copy-Item -Recurse -Force hackathon-grand-prize .agents\skills\hackathon-grand-prize
python .agents\skills\hackathon-grand-prize\scripts\validate-skill.py
```

Replace `.agents\skills` with the selected client path. If the destination already exists, review and remove or rename it before copying; do not accidentally nest the package inside itself.

### POSIX shell example

```sh
mkdir -p .agents/skills
cp -R hackathon-grand-prize .agents/skills/hackathon-grand-prize
python3 .agents/skills/hackathon-grand-prize/scripts/validate-skill.py
```

### Repository adapters

This source repository contains lightweight adapters for development and demonstration:

- `.agents/skills/hackathon-grand-prize/SKILL.md` — Codex, Antigravity, Cursor, and compatible clients
- `.claude/skills/hackathon-grand-prize/SKILL.md` — Claude Code
- `.github/skills/hackathon-grand-prize/SKILL.md` — GitHub Copilot
- `.cursor/rules/hackathon-grand-prize.mdc` — legacy/thin Cursor rule
- `.kiro/steering/hackathon-grand-prize.md` — Kiro auto-included steering adapter

They route agents to the repository-root canonical package. They are not self-contained and should not be copied as installations. For redistribution, copy this full directory to one native skill location instead.

### Kiro without duplication

Kiro's native install is `.kiro/skills/hackathon-grand-prize/`. While developing this source repository, the checked-in steering adapter uses Kiro's file-reference syntax to include `hackathon-grand-prize/SKILL.md` without maintaining a second copy. A custom Kiro agent can alternatively declare the canonical path as a `skill://` resource.

### Antigravity

Current Antigravity CLI documentation supports project skills in `.agents/skills/<skill-name>/SKILL.md`. Install this complete directory there and confirm discovery in the CLI skills view. Do not invent another configuration path for environments that expose different capabilities; inspect that environment first.

## Invoke

The description supports automatic activation for hackathon strategy and execution. Explicit modes include:

```text
/hackathon-analyze       /hackathon-ideas       /hackathon-score
/hackathon-pivot         /hackathon-architecture /hackathon-mvp
/hackathon-build         /hackathon-review      /hackathon-redteam
/hackathon-demo          /hackathon-pitch       /hackathon-readme
/hackathon-submit
```

Some clients expose the skill name itself as a slash command rather than registering every mode. In that case invoke `/hackathon-grand-prize` and include the desired mode in the request.

## Helper scripts

Requirements: Python 3.9+, standard library only. All CLIs use exit code `0` for pass/success, `1` for a failed readiness gate, and `2` for invalid usage or input.

### Validate the skill package

```powershell
python scripts\validate-skill.py
```

Checks canonical frontmatter, directory/name agreement, the under-500-line recommendation, and referenced local resources.

### Score Phase 12 readiness

```powershell
python scripts\score-project.py --scores-json '{"problem":8,"innovation":8,"technical_execution":8,"sponsor_integration":8,"ux_design":8,"demo":8,"real_world_impact":8,"completeness":8,"reliability":8,"pitch":8,"memorability":8}'
```

Scores are 0–10 and default to equal weights. Only use `--weights-json` with all 11 keys when official judging weights or a documented strategy justifies them. A score never overrides a failed gate.

### Evaluate project health

```powershell
python scripts\project-health-check.py --checks-json '{"build_passes":true,"tests_pass":true,"lint_or_typecheck_passes":true,"core_flows_work":true,"error_flows_work":true,"authorization_enforced":{"status":"not_applicable","rationale":"No identities or protected resources exist in this offline prototype."},"inputs_validated":true,"api_failures_handled":true,"data_integrity_verified":true,"retries_safe":true,"security_reviewed":true,"secrets_scanned":true,"demo_fallback_ready":true}'
```

Supply all 13 top-level checks. Use `true` only for an applicable check backed by observed evidence and `false` for an applicable failed or unverified check. Only build, tests, lint/typecheck, authorization, API-failure, data-integrity, and retry checks may use `{"status":"not_applicable","rationale":"..."}` when that capability is genuinely absent; the rationale must be specific and at least 20 characters. Core/error flows, input validation, security review, secret scanning, and demo fallback are mandatory. Permitted N/A checks are reported without failing the gate.

### Validate a submission document

```powershell
python scripts\validate-submission.py --file path\to\README.md --check-local-links
```

This verifies required nonempty Markdown sections and local link targets. It does not check network URLs, official compliance, factual accuracy, or content quality; complete the bundled submission checklist as well.

## Updating

Update the canonical package first, run `validate-skill.py`, compile and smoke-test the helpers, and only then update adapter wording. Never add full copies of the skill to this source repository.

## Troubleshooting

- **Skill not discovered:** confirm the destination path, exact uppercase filename `SKILL.md`, matching lowercase folder/frontmatter name, and restart clients that do not watch newly created skill roots.
- **References missing:** reinstall the entire directory, not only `SKILL.md`.
- **Duplicate skill:** remove extra copies from overlapping discovery roots and keep one installation.
- **Script unavailable:** reproduce the documented checks manually and label the result `MANUAL`; do not claim script validation.
- **Current rules unavailable:** mark rule-dependent conclusions `UNVERIFIED`, list the exact official facts still needed—including restrictions/prohibited uses—and do not claim compliance or readiness.

## Authoritative references

Format and progressive-disclosure guidance: [Agent Skills specification](https://agentskills.io/specification). Client installation behavior: [GitHub Copilot](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-skills), [Claude Code](https://docs.anthropic.com/en/docs/claude-code/skills), [Cursor](https://cursor.com/docs/skills), [Kiro](https://kiro.dev/docs/skills), and [Google Antigravity CLI](https://codelabs.developers.google.com/antigravity/how-to-create-agent-skills-for-antigravity-cli). Distribution behavior follows official npm documentation for [npx](https://docs.npmjs.com/cli/v11/commands/npx) and [npm publish](https://docs.npmjs.com/cli/v10/commands/npm-publish/).

Content derived from those sources is rephrased for compliance with licensing restrictions.
