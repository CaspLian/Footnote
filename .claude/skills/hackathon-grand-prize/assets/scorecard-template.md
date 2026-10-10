# Grand Prize Scorecard

> Fill at Phase 12. Scores describe current evidence, not planned work. Use `TODO`, `IN PROGRESS`, `VERIFIED`, `BLOCKED`, or `ACCEPTED RISK` for status.

## Snapshot

| Field | Value |
|---|---|
| Project / version / commit | |
| Hackathon / track | |
| Scored by / date | / YYYY-MM-DD |
| Deadline + time zone | |
| Official rules/judging URL | |
| Rules last verified | YYYY-MM-DD by |
| Build/demo environment | |
| Evidence cutoff | YYYY-MM-DD HH:MM TZ |

## Official-rule verification

| Material fact | FACT / ASSUMPTION / UNVERIFIED | Official source + URL | Published/updated | Accessed | Owner | Status/blocker |
|---|---|---|---|---|---|---|
| Eligibility/team | | | | | | |
| Restrictions/prohibited use cases | | | | | | |
| Required technology | | | | | | |
| Judging criteria/weights | | | | | | |
| Submission/demo/video | | | | | | |
| Sponsor prize terms | | | | | | |

## Scoring evidence

Score 0–10. A 9–10 requires exceptional observable evidence. Confidence: H/M/L.

| Criterion | Weight | Score | Confidence | Evidence record: verification / proof / medium | Judge-observable proof | Gap / acceptance criterion | Owner | Status |
|---|---:|---:|---|---|---|---|---|---|
| Problem | 1.0 | | | | | | | |
| Innovation | 1.0 | | | | | | | |
| Technical execution | 1.0 | | | | | | | |
| Sponsor integration | 1.0 | | | | | | | |
| UX / design | 1.0 | | | | | | | |
| Demo | 1.0 | | | | | | | |
| Real-world impact | 1.0 | | | | | | | |
| Completeness | 1.0 | | | | | | | |
| Reliability | 1.0 | | | | | | | |
| Pitch | 1.0 | | | | | | | |
| Memorability | 1.0 | | | | | | | |

Evidence proof-strength values: `OBSERVED`, `MEASURED`, `CORROBORATED`, `SIMULATED`, `ESTIMATED`, `PROJECTED`, `ASSERTED`. Track verification (`FACT`, `ASSUMPTION`, `UNVERIFIED`) and medium (`LIVE`, `SEEDED REPLAY`, `RECORDED`, `DOCUMENTED`) separately when relevant. Add method, sample/environment, and date for measured evidence.

## Normalized result

Use the helper after filling all 11 values:

```text
python scripts/score-project.py --scores-json '{"problem":0,"innovation":0,"technical_execution":0,"sponsor_integration":0,"ux_design":0,"demo":0,"real_world_impact":0,"completeness":0,"reliability":0,"pitch":0,"memorability":0}'
```

The helper defaults every criterion to weight `1.0`. If official judging publishes usable weights, cite them above, replace the Weight column, and add `--weights-json` with all 11 criterion keys. If weights are unpublished, do not invent them.

| Field | Result |
|---|---|
| Weighted overall /100 | |
| Script classification | |
| Script run date / operator | |
| Script output evidence | |

Heuristic bands: `<60` unlikely competitive; `60–69.9` decent; `70–79.9` competitive; `80–89.9` strong finalist potential; `90–94.9` elite; `95+` grand-prize caliber. These are internal strategy heuristics, not official judging predictions.

## Gate overlay

A high score never overrides a failed gate.

| Gate | Pass criteria | Evidence | Owner | Status | Blocker / accepted risk + approver/expiry |
|---|---|---|---|---|---|
| G0 Rules known | Material eligibility, restrictions/prohibited uses, judging, sponsor, and submission rules officially cited | | | | |
| G1 Direction chosen | Problem/differentiator/scope/fit supported | | | | |
| G2 Design ready | Thesis/architecture/security/demo/schedule align | | | | |
| G3 Build healthy | Applicable checks pass; inapplicable controls have rationale; health script passes | | | | |
| G4 Presentation ready | Timed primary/fallback + evidenced claims | | | | |
| G5 Submission ready | Eligibility and prohibited-use rules reverified + checklist/validator/red team pass | | | | |

## Priority actions

| Priority | Score/gate gap | Action | Acceptance criterion | Evidence to collect | Owner | Due | Status |
|---:|---|---|---|---|---|---|---|
| 1 | | | | | | | |
| 2 | | | | | | | |
| 3 | | | | | | | |

## Verdict

```text
Verdict: WEAK / PROMISING / STRONG / ELITE / GRAND-PRIZE CONTENDER
Readiness: READY / READY WITH ACCEPTED RISKS / NOT READY
Strongest proven advantage:
Why judges remember it in 24 hours:
Weakest critical evidence:
Open CRITICAL/HIGH blockers:
Next highest-value action:
Reviewer / date:
```