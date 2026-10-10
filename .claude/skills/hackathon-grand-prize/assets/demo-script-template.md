# Demo Script and Recovery Runbook

> Start at Phase 7; finalize and rehearse at Phase 17. Duplicate step rows as needed. Label every fixture, replay, estimate, and simulation honestly.

## Control sheet

| Field | Value |
|---|---|
| Project / demo version / commit | |
| Hackathon / track | |
| Official demo limit + source URL | |
| Rule verified by / date | / YYYY-MM-DD |
| Target duration / buffer | / |
| Presenter / demo operator / fallback owner | / / |
| Environment / deployment URL | |
| Primary device/browser/resolution | |
| Magic moment | |
| Outcome verification | FACT / ASSUMPTION / UNVERIFIED |
| Outcome proof strength | OBSERVED / MEASURED / CORROBORATED / SIMULATED / ESTIMATED / PROJECTED / ASSERTED |
| Presentation medium | LIVE / SEEDED REPLAY / RECORDED / DOCUMENTED |
| Last successful rehearsal | YYYY-MM-DD HH:MM TZ |

## Promise and path

```text
User/problem context:
Single action:
System transformation:
Visible verified result:
Why it is different:
Why it matters:
```

```text
Start → user action → system action → transformation → verification/approval
→ visible result → impact
```

## Preflight

| Check | Acceptance criterion | Evidence/location | Owner | Status | Recovery if failed |
|---|---|---|---|---|---|
| Official time/format verified | Dated official URL recorded | | | | |
| Build/deployment | Exact demo version loads from clean session | | | | |
| Accounts/permissions/credits | Least-privilege demo accounts work | | | | |
| Secrets/PII | None visible in UI/logs/video; data consented or synthetic | | | | |
| Seed/fixture data | Deterministic and clearly labeled | | | | |
| Network/external APIs | Primary and degraded paths tested | | | | |
| Reset | Restores known start state without production deletion | | | | |
| Recording | Current working proof opens offline | | | | |
| Accessibility/display | Text, focus, zoom, audio readable | | | | |

## Word-for-word runbook

| # | Start–end | Presenter says | Presenter does | System does | Expected visible result | Why it matters / judge notices | Proceed cue | Failure trigger | Fallback ID | Owner |
|---:|---:|---|---|---|---|---|---|---|---|---|
| 1 | 0:00–0:__ | “…” | | | | | | | | |
| 2 | | “…” | | | | **MAGIC MOMENT:** | | | | |
| 3 | | “…” | | | | | | | | |

## Evidence callouts

| Claim shown/spoken | Verification | Proof strength | Presentation medium | Method/source/date | On-screen proof | Caveat wording | Owner/status |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## Fallback matrix

| ID | Dependency/failure | Trigger threshold | Switch action | Presenter line | Result state reached | Proof strength | Medium | Recovery time | Owner |
|---|---|---|---|---|---|---|---|---:|---|
| F1 | Live API/model timeout | No valid result by __s | Load seeded replay | “The live service exceeded our safe limit, so I’m switching to our labeled replay of the same verified path.” | | SIMULATED | SEEDED REPLAY | | |
| F2 | Network unavailable | | Launch local fixture | | | | | | |
| F3 | Deployment unavailable | | Launch local build / recording | | | | | | |
| F4 | Invalid result | Validation fails | One bounded retry, then golden result | | | | | | |
| F5 | Presenter/navigation error | Wrong state/page | Open checkpoint route | | | | | | |

## Reset and recovery

```text
Safe reset command/action:
State it changes:
State it must not change:
Seed version:
Expected completion time:
Verification after reset:
Rollback if reset fails:
Owner:
```

## Rehearsal log

Acceptance: three consecutive on-time runs; each fallback rehearsed; one offline run; reset succeeds between runs; primary and fallback preserve the same takeaway.

| Run/date | Environment | Duration | Primary/fallback | Failure injected | Recovery time | Result | Recording/evidence | Owner/action | Status |
|---|---|---:|---|---|---:|---|---|---|---|
| 1 | | | | | | | | | |
| 2 | | | | | | | | | |
| 3 | | | | | | | | | |

## Final sign-off

| Gate | Acceptance criterion | Owner | Status/evidence |
|---|---|---|---|
| Timing | Under official limit with buffer | | |
| Determinism | Known start/result and bounded waits | | |
| Fallback | Triggered, timed, same core proof | | |
| Recovery | Reset and checkpoint routes tested | | |
| Integrity | Fixtures and claims use separate verification, proof-strength, and medium fields | | |
| Safety | No secrets/PII/unsafe production action | | |
| Observability | Operator can detect success/failure | | |

```text
Demo readiness: READY / NOT READY
Open blockers:
Fallback owner confirmation:
Presenter confirmation:
Final verification date:
```