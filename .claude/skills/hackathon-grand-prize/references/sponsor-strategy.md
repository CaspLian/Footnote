# Sponsor Technology Strategy

Use when a hackathon requires, rewards, or offers prizes for sponsor technology. Verify terms from official sources before designing around them.

## Official verification

| Sponsor/track | Required / rewarded / optional / bounty | Exact eligibility wording | Official URL | Updated/accessed dates | Mandatory product/API/deployment | Judging proof required | Unknown/owner |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

Check account/region limits, approved models or chains, new-build requirements, public deployment, open-source/licensing terms, credits, data restrictions, logo/name rules, and submission fields. Do not infer eligibility from marketing copy.

## Fit classification

| Integration | Natural fit test | Rating |
|---|---|---|
| Core engine | Product cannot deliver its main outcome without it | Excellent |
| Enabling infrastructure | Materially improves speed, trust, reach, cost, privacy, or reliability | Strong |
| Useful feature | Improves a secondary workflow but is replaceable | Moderate |
| Checkbox | Added only to mention sponsor; removal is invisible | Forced—reject |

Apply three tests:
1. **Removal:** what user outcome degrades if removed?
2. **Visibility:** where can a judge see its contribution?
3. **Specificity:** why this sponsor capability rather than a generic substitute?

## Integration decision record

| Capability | User problem solved | Workflow position | Why sponsor tech | Alternative considered | Measurable contribution | Demo proof | Failure/fallback | Cost/quota | Owner |
|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | |

Examples of measurable contribution: fewer manual steps, verified transaction state, lower observed latency, offline execution, narrower data exposure, successful tool action, or recovery behavior. Label simulated and estimated results honestly.

## Architecture and demo requirements

A strong sponsor integration has:
- a named component and data/control flow;
- least-privilege credentials and no client-side secret exposure;
- rate/quota/timeout behavior and a deterministic fallback;
- a visible trace, result, or before/after in the primary demo;
- an explanation of why it is architecturally relevant in one sentence;
- official eligibility evidence in the submission checklist.

Do not add multiple sponsors if they dilute the thesis or create brittle dependencies. One indispensable integration beats several decorative ones.

## Pitch proof block

```text
Sponsor capability:
Core product responsibility:
User value created:
Observable demo moment:
Measured/simulated evidence:
What worsens without it:
Official track requirement satisfied:
```

## Exit gate

Sponsor strategy passes only when eligibility is cited, the integration survives the removal test, its architecture and fallback are defined, and judges can observe its contribution. Otherwise remove it or redesign it as part of the core workflow.