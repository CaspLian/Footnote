# Demo Engineering and Fallbacks

Use for Phases 7 and 17. The demo is a tested product path, not an improvised tour.

## Define the proof

```text
Audience and official time limit:
One-sentence promise:
Start state:
Single user action:
System transformation:
Magic moment / visible result:
Impact verification / proof strength / presentation medium:
Primary dependency risk:
```

Preferred path:

```text
Context (brief) → user action → visible system work → transformation
→ verification/approval → outcome → impact
```

Skip login, setup, navigation, and feature lists unless required to understand the innovation.

## Step design

| # | Time | Operator action/words | System action | Expected visible result | Judge takeaway | Failure trigger | Immediate fallback | Owner |
|---:|---:|---|---|---|---|---|---|---|
| | | | | | | | | |

Every step must have one observable exit condition. Use explicit cues for slow work so the presenter knows when to continue.

## Dependency plan

| Dependency | Failure modes | Detection | Timeout | Retry | Cached/fixture alternative | Degraded message | Recovery owner |
|---|---|---|---:|---|---|---|---|
| Network | | | | | | | |
| Sponsor/API/model | | | | | | | |
| Auth/account/quota | | | | | | | |
| Database/storage | | | | | | | |
| Device/browser | | | | | | | |
| Deployment | | | | | | | |

Fixtures must be credible, deterministic, sanitized, versioned with the demo, and visibly marked with separate axes: proof strength `SIMULATED` and presentation medium `LIVE`, `SEEDED REPLAY`, or `RECORDED`.

## Fallback ladder

1. **Live primary:** normal end-to-end request.
2. **Degraded live:** skip optional dependency; preserve core result.
3. **Seeded replay:** use precomputed response through the real UI.
4. **Local fixture:** offline deterministic path demonstrating the same contract.
5. **Recorded proof:** short capture of the working flow plus live inspection of result/architecture.
6. **Narrated artifact:** last resort; state honestly what failed and show evidence.

Define trigger thresholds before rehearsal—e.g., no response by N seconds, quota warning, authentication error—so presenters switch instead of waiting.

## Recovery playbooks

### External service timeout
Stop after the scripted threshold; do not retry repeatedly on stage. Announce the fallback in one confident sentence, switch to seeded replay, and continue at the same result state.

### Bad/non-deterministic model output
Validate output before display. If invalid, use one bounded retry with a fixed seed/input where supported, then load the labeled golden result. Never claim the golden result was generated live.

### Deployment unavailable
Keep a tested local build and a pre-opened recorded proof. Verify local environment, ports, credentials, and fixture data before presenting.

### State contamination
Provide a one-command or one-action reset that clears only demo state, reseeds fixtures, and restores accounts. Never perform a destructive production reset.

### Presenter mistake
Include bookmarks/direct routes, a known checkpoint after each step, and recovery wording. A co-presenter owns the fallback switch when possible.

## Rehearsal protocol

Run at least:
- cold start;
- normal primary flow;
- every fallback trigger;
- offline/network-disabled path;
- reset between consecutive runs;
- exact official time limit with spoken pitch;
- presentation device, resolution, account, and network conditions;
- screen recording and link/media playback.

Log:

| Run/date | Environment | Duration | Primary/fallback | Failure | Recovery time | Result | Owner/action |
|---|---|---:|---|---|---:|---|---|
| | | | | | | | |

## Demo readiness gate

These checks are cumulative operational requirements for the canonical `G4-DEMO` component. Pass only when prerequisites are assigned, primary and fallback reach the same core takeaway, reset is tested, no secret/PII appears, fixtures use separate proof-strength and medium labels, three consecutive timed runs succeed, every fallback and an offline path where applicable are rehearsed, and a recorded proof exists. Otherwise mark `NOT READY` and remove fragile steps.