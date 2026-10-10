# Judging Framework

Use this reference for Phases 0, 11, and 12. Translate official criteria into observable proof; do not substitute generic product advice for the actual rubric.

## 1. Build the official-facts ledger

Record each material item before scoring strategy:

| Claim | FACT / ASSUMPTION / UNVERIFIED | Official source + URL | Published/updated | Accessed | Confidence | Impact if wrong | Owner/action |
|---|---|---|---|---|---|---|---|
| Deadline + time zone | | | | YYYY-MM-DD | | | |
| Eligibility/team limits | | | | | | | |
| Restrictions/prohibited use cases | | | | | | | |
| Required technologies | | | | | | | |
| Judging criteria/weights | | | | | | | |
| Submission/video/demo rules | | | | | | | |
| Repository/licensing rules | | | | | | | |
| Sponsor bounty terms | | | | | | | |

Prefer official rules/terms, judging/submission pages, sponsor documentation, then organizer announcements. Secondary coverage is context, never sole evidence for compliance. If official pages conflict, document both, apply the stricter rule provisionally, and seek organizer clarification. Unverified eligibility or prohibited-use applicability blocks project selection and submission readiness.

## 2. Map the winning surface

Use official weights when published. If absent, write `Weight: UNPUBLISHED`; do not invent percentages.

| Criterion | Official wording | Weight | What is directly observable | Average submission | Exceptional submission | Our advantage | Evidence artifact | Proof owner | Confidence |
|---|---|---:|---|---|---|---|---|---|---|
| | | | | | | | | | |

For each row answer:
- What can a judge verify in under two minutes?
- What claim would be dismissed without evidence?
- Which product moment earns this point rather than merely describing it?
- What trade-off could lose points elsewhere?

## 3. Evidence strength

Use the strongest available level and label it:

1. **Observed:** judge can see a successful live result or inspect the artifact.
2. **Measured:** repeatable result with method, sample, environment, and date.
3. **Corroborated:** external/official evidence supports the problem or rule.
4. **Simulated:** clearly identified fixture or controlled scenario.
5. **Estimated/projected:** assumptions and calculation disclosed.
6. **Asserted:** unsupported claim; treat as a gap.

Never convert simulated or projected evidence into measured impact. A polished architecture diagram proves design clarity, not production scale.

## 4. Judge-attention model

Plan evidence for three windows:

| Window | Judge question | Required signal |
|---|---|---|
| First 10 seconds | What is this and why care? | Specific user, painful problem, distinct promise |
| First 60 seconds | Does it work and differ? | Magic moment with visible before/after |
| Remaining time | Is it technically credible and eligible? | Architecture, sponsor role, verification, fallback, evidence |
| After 24 hours | What do I remember? | One nameable workflow/result, not a feature list |

## 5. Strategy checks

A criterion strategy passes only if:
- it traces to cited official wording or carries an explicit `ASSUMPTION`/`UNVERIFIED` label;
- it names an observable artifact and an owner;
- it does not double-count one weak feature as proof for every criterion;
- it makes sponsor use and technical depth understandable without a lecture;
- it survives the actual presentation time limit;
- it avoids claims that require unavailable production evidence.

When criteria conflict, prioritize official weight, disqualification risk, core workflow, then demo clarity. Record the trade-off explicitly.