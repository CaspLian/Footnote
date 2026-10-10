# Idea Scoring and Selection

Use for Phases 1–2. Score candidate potential, not team enthusiasm. Every 8+ needs concrete evidence; every unknown lowers confidence.

## Candidate scorecard

Score 1–10:

| Dimension | 1–3 | 4–6 | 7–8 | 9–10 evidence bar |
|---|---|---|---|---|
| Originality | Commodity clone/wrapper | Familiar idea with a twist | Distinct workflow or mechanism | Clearly novel and defensible after competitor scan |
| Problem strength | Vague/infrequent | Real but low urgency | Painful, specific, evidenced | Severe, timely, underserved, with credible proof |
| Technical depth | CRUD/thin API | Some nontrivial integration | Meaningful system challenge | Difficult mechanism works and can be explained |
| Sponsor alignment | Decorative | Useful but replaceable | Central to outcome | Officially eligible, indispensable, visibly proven |
| Demo potential | Mostly explanation | Understandable result | Fast visual transformation | Repeatable magic moment with strong before/after |
| UX potential | Setup-heavy/confusing | Usable prototype | Clear guided workflow | Instantly legible and memorable interaction |
| Feasibility | Core cannot finish | Major execution risk | Credible within time | Core plus fallback and polish buffer are realistic |
| Judge appeal | Weak rubric fit | Some criteria served | Strong observable rubric fit | Multiple criteria won without diluted story |
| Grand-prize potential | No memorable advantage | Solid category entry | Finalist-shaped if executed | Exceptional evidence across problem, proof, polish, reliability |

Record each score as:

```text
Dimension | Score | Evidence | Confidence high/medium/low | Unknown | Fastest validation
```

## Verdict thresholds

Use the unweighted mean as a comparison aid, never as automatic truth:

- **1.0–4.9 — WEAK: pivot required.**
- **5.0–6.4 — PROMISING: needs differentiation.**
- **6.5–7.7 — STRONG: proceed with improvements.**
- **7.8–8.7 — ELITE: highly competitive.**
- **8.8–10 — GRAND-PRIZE CONTENDER:** only when all critical dimensions have high-confidence evidence and no feasibility, eligibility, sponsor, or demo blocker exists.

Cap verdict at `PROMISING` if feasibility or demo potential is below 6. Cap at `STRONG` if official fit is unverified. Do not average away a fatal flaw.

## Multi-idea comparison

| Candidate | Problem | Novelty | Saturation | Sponsor use | Technical edge | Demo | Visual identity | Complexity | Failure risk | Pitch clarity | 24h memory | Confidence |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| | | | | | | | | | | | | |

For each candidate write:
- **Judge after 20 similar entries:** likely one-sentence reaction.
- **Remembered in 24 hours because:** one concrete moment.
- **Cheapest falsification:** test/interview/prototype/research that could kill it quickly.
- **Winning constraint:** the one capability that must work.

## Tie-break order

1. Official eligibility and criterion fit.
2. Demonstrable user outcome.
3. Core differentiator clarity.
4. Feasibility with fallback and polish time.
5. Sponsor centrality.
6. Technical depth that judges can understand.
7. Long-term potential.

Reject generic chatbots, simple RAG, summarizers, CRUD dashboards, recommendation wrappers, or thin integrations unless a distinct mechanism changes the workflow and is visible live.

## Selection exit gate

Select only when one candidate has:
- a named user and evidenced problem;
- a one-sentence thesis;
- a demo-visible differentiator competitors cannot copy during the event;
- a realistic vertical slice and fallback;
- no unresolved eligibility blocker;
- a stated reason it beats the runner-up.

Otherwise run another validation or pivot; do not start a broad build.