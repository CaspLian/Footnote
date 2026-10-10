# Submission Readiness Checklist

> Start at Phase 0, assign owners at Phase 13, update through Phase 15, and close at Phase 18. Status: `TODO`, `IN PROGRESS`, `VERIFIED`, `BLOCKED`, `N/A`, or `ACCEPTED RISK`. A checked box without evidence is not verified.

## Submission control

| Field | Value |
|---|---|
| Project / final version / commit | |
| Hackathon / track(s) | |
| Deadline + time zone | |
| Official rules URL | |
| Submission portal URL | |
| Rules last verified by / date | / YYYY-MM-DD |
| Submission owner / backup | / |
| Planned submit time / buffer | / |
| Final approver | |

## Official requirements ledger

| Requirement | Required? | Verification FACT / ASSUMPTION / UNVERIFIED | Exact official source + URL | Published/updated | Accessed | Acceptance criterion | Owner | Status | Evidence/blocker |
|---|---|---|---|---|---|---|---|---|---|
| Eligibility/team | | | | | | | | | |
| New-build/date restriction | | | | | | | | | |
| Restrictions/prohibited use cases | | | | | | | | | |
| Required technology | | | | | | | | | |
| Track/sponsor eligibility | | | | | | | | | |
| Repository visibility/history | | | | | | | | | |
| License/IP/asset rights | | | | | | | | | |
| Hosted deployment | | | | | | | | | |
| Demo/video format and duration | | | | | | | | | |
| Written fields/word limits | | | | | | | | | |
| Screenshots/diagram/media | | | | | | | | | |
| Team profiles/contact | | | | | | | | | |
| Judging/presentation logistics | | | | | | | | | |

Unverified material rules—including eligibility and prohibited-use applicability—block readiness. If official sources conflict, record both, use the stricter interpretation, and obtain organizer clarification.

## Judge-facing package

| Item | Acceptance criterion | Owner | Due | Status | Evidence/link |
|---|---|---|---|---|---|
| Project title/tagline | Specific, memorable, consistent everywhere | | | | |
| Problem / why now | Named user and credible evidence | | | | |
| Solution/thesis | Outcome and core differentiator clear | | | | |
| Innovation | Mechanism compared honestly with alternatives | | | | |
| Architecture diagram | Legible flow, sponsor role, trust/failure boundaries | | | | |
| Sponsor technology | Official eligibility + indispensable contribution + demo proof | | | | |
| Key features | Core workflow first; no roadmap presented as built | | | | |
| Setup instructions | Clean, reproducible, pinned dependencies, env example | | | | |
| Demo instructions | Known seed/reset, primary/fallback, expected result | | | | |
| Screenshots/media | Current version, captions, no secrets/PII | | | | |
| Technical challenges | Concrete decisions, verification, recovery | | | | |
| Security/privacy/reliability | Tested scope and residual risks stated honestly | | | | |
| Impact | Verification, proof strength, and medium recorded separately; no unsupported claim | | | | |
| Roadmap | Clearly separated from implemented scope | | | | |
| Team/contributions | Accurate names/roles; eligibility satisfied | | | | |

## Build and trust gate

| Check | Acceptance criterion | Command/method + date | Owner | Status | Evidence/remediation |
|---|---|---|---|---|---|
| Clean setup/build | Passes from documented environment | | | | |
| Tests/type/lint | Relevant checks pass; limitations stated | | | | |
| Core smoke flow | End-to-end expected outcome works | | | | |
| Error/degraded states | Timeout, empty, malformed, duplicate, outage handled | | | | |
| Auth/authorization | Applicable boundaries tested | | | | |
| Secrets | Repo/history/artifacts/video checked; none exposed | | | | |
| PII/data rights | Minimized, consented/synthetic, redacted, retention known | | | | |
| Prompt/tool injection | Untrusted content cannot override policy/tools | | | | |
| Dependencies | Exact versions, provenance, license, advisories reviewed | | | | |
| Production/destructive actions | Dry-run/backup/rollback + explicit approval if applicable | | | | |
| Health helper | `python scripts/project-health-check.py --checks-json '<all 13 documented checks>'` exits 0; mandatory checks pass, applicable optional checks are evidenced booleans, and only permitted absent capabilities use a ≥20-character `not_applicable` rationale | | | | |

## Demo and pitch gate

| Check | Acceptance criterion | Owner | Status | Evidence/blocker |
|---|---|---|---|---|
| Demo primary | Three consecutive timed successful runs | | | |
| Demo fallback/offline | Trigger, recovery, and same takeaway rehearsed | | | |
| Reset | Safe known-state reset between runs | | | |
| Recording | Final file plays with audio/text; within official limit | | | |
| Pitch | Timed with buffer; claims evidenced | | | |
| Accessibility/display | Readable at presentation resolution; keyboard/focus where applicable | | | |
| Q&A | Hard judge questions have concise evidence-backed answers | | | |

## Portal and link verification

Test as a judge, preferably logged out/incognito and on another device.

| Item | Expected result | Verified by/date | Status | Evidence/fix |
|---|---|---|---|---|
| Repository URL/permissions | Opens required branch/commit without team credentials | | | |
| Deployment URL | Loads exact submitted version | | | |
| Video URL/permissions | Plays from start, correct resolution/audio | | | |
| Images/diagram | Render and remain legible | | | |
| External docs/data citations | Open and support claims | | | |
| Sponsor/track selection | Correct fields selected | | | |
| Contact/team fields | Accurate and complete | | | |
| Final preview | No truncation, broken Markdown, placeholder, or draft text | | | |

## Automated section check

Run after the final written submission/README is assembled:

```text
python scripts/validate-submission.py --file <README-or-submission.md> --check-local-links
```

| Run date/operator | File/version | Exit/result | Missing/empty sections or local links fixed | Evidence |
|---|---|---|---|---|
| | | | | |

This helper checks required nonempty sections and local Markdown/image targets. It skips network URL availability and does not prove official compliance, accuracy, or quality.

## Red-team closure

| Finding ID | Severity | Fix/accepted risk | Retest evidence | Owner | Approver/expiry | Status |
|---|---|---|---|---|---|---|
| | | | | | | |

Never waive eligibility, unresolved restrictions/prohibited-use applicability, exposed credentials, fabricated evidence, missing mandatory deliverables, or unapproved destructive/production action.

## Submission event log

| Time | Action | Actor | Result/evidence | Recovery/escalation |
|---|---|---|---|---|
| | Final backup/export created | | | |
| | Portal draft saved | | | |
| | Final links rechecked | | | |
| | Submitted | | Confirmation ID: | |
| | Confirmation captured | | | |

## Final sign-off

```text
Readiness: READY / READY WITH ACCEPTED RISKS / NOT READY
G0 rules: PASS / FAIL
G3 build: PASS / FAIL
G4 presentation: PASS / FAIL
G5 submission: PASS / FAIL
Open CRITICAL:
Open HIGH / risk owner + approver + expiry:
Official rules reverified as of:
Exact submitted commit/version:
Submission owner confirmation:
Final approver/date:
Next action if blocked:
```