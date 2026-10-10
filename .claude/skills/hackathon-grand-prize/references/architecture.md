# Right-Sized Architecture

Use for Phases 5–6 and 13–14. Design the smallest system that proves the core differentiator, survives the demo, and respects real security and data boundaries.

## Start with constraints

```text
Core workflow:
Magic moment:
Deadline / team / skills:
Official technology constraints:
Expected demo load and data:
Privacy/security boundary:
External dependencies and quotas:
Deployment target:
Offline/fallback requirement:
```

Do not design production-scale infrastructure without evidence it earns judging points or prevents a likely failure.

## System map

```text
User/input → interface → core orchestration/domain logic → sponsor/external services
           → state/storage → verification/observability → visible result
```

For every component complete:

| Component | Responsibility | Why it exists | Technology + pinned version | Alternative rejected | Inputs/outputs | Trust boundary | Failure behavior | Fallback | Demo proof | Owner |
|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | |

## Decision rules

Prefer:
- one deployable unit before unnecessary services;
- deterministic code before model inference for validation/calculation;
- existing project dependencies before new packages;
- explicit interfaces and fixtures around unstable external APIs;
- managed services only when setup and failure risk are lower;
- synchronous flows unless asynchronous work creates visible value;
- state only where continuity, audit, collaboration, or recovery needs it.

Reject architecture theater: unused queues, speculative microservices, generic vector databases, multi-agent systems without distinct responsibilities, or blockchain where ordinary persistence provides the same trust model.

## Critical-flow sequence

For each demo-critical path:

| Step | Caller → callee | Data | Validation | Timeout/retry | Idempotency | Observable event | User-visible failure |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

Bound retries with maximum attempts and backoff. Do not retry destructive or non-idempotent actions without a deduplication key or explicit approval.

## Trade-off record

```text
Decision:
Context:
Options:
Chosen because:
Evidence/assumption:
Cost introduced:
Revisit trigger:
Owner:
```

At minimum record decisions for core framework, data store/state, sponsor service, model/agent orchestration if used, deployment, and fallback.

## Cross-cutting acceptance

- **Security/privacy:** trust boundaries, auth, data minimization, secret handling, retention, and approvals are explicit.
- **Reliability:** timeouts, malformed/missing data, duplicate requests, external outage, empty results, and rollback have behavior.
- **Observability:** critical steps emit safe status, duration, outcome, and correlation identifiers; never secret/PII payloads.
- **Demo:** primary flow is seedable/resettable; external calls can be replaced by clearly labeled fixtures.
- **Cost:** likely event usage fits quotas/credits; spending or production changes require approval.
- **Portability:** setup and fallback do not depend on an undocumented workstation state.

## MVP slicing

| Scope | Include when | Acceptance condition |
|---|---|---|
| Must | Required for core outcome, rule compliance, safety, or fallback | Working end-to-end with evidence |
| Should | Materially raises judge score or comprehension | Implement after core passes |
| Could | Helpful but not score-changing | Only after polish/rehearsal buffer is protected |
| Cut | Decorative, duplicative, risky, or setup-heavy | Remove now; record rationale |

Architecture is ready only when every must-have maps to a component, owner, acceptance test, failure behavior, and demo moment—and the team can finish it before feature freeze.