# Final Red Team

Use for Phases 11, 12, and 18 after artifacts exist. Attack readiness, not the team's effort. Every finding needs evidence, owner, fix, and retest.

## Severity

| Severity | Definition | Release effect |
|---|---|---|
| CRITICAL | Disqualification, exposed secret/unsafe action, unusable core flow, missing required deliverable, or deceptive claim | Block submission/demo immediately |
| HIGH | Likely major judging loss, fragile magic moment, superficial sponsor use, serious security/privacy/reliability gap | Block readiness unless explicit time-bounded risk acceptance |
| MEDIUM | Credibility, usability, or completeness weakness with workaround | Fix if it outranks remaining polish |
| LOW | Cosmetic or minor clarity issue | Batch only after gates pass |

## Finding format

```text
ID / severity / area:
Observed evidence:
Attack or judge objection:
Likely consequence:
Required fix:
Owner / due time:
Retest method and evidence:
Status: OPEN / FIXED / ACCEPTED RISK
Approver/expiry if risk accepted:
```

A fix is not closed until retested.

## Judge attack questions

### Problem and impact
- Who has this problem, how painful/frequent is it, and what evidence exists?
- Why now? What happens without the product?
- Are impact numbers measured, simulated, estimated, or projected?

### Innovation and competition
- What is actually novel: workflow, mechanism, architecture, or only presentation?
- What does the closest alternative already do?
- After 20 similar projects, what one moment remains memorable?
- Could a competitor reproduce the differentiator during the event?

### Technical execution
- What is the hardest working technical achievement?
- Which parts are real, mocked, recorded, or future work?
- Why this architecture; what was deliberately omitted?
- What happens on malformed input, timeout, duplicate request, bad model output, or partial failure?

### Sponsor technology
- Which exact official requirement or prize condition is satisfied?
- If sponsor technology is removed, what user outcome worsens?
- Can its contribution be seen live, or is it a logo/API call?

### AI/agent claims
- Is this a single model call or a true goal-driven tool loop?
- What does it observe, plan, act on, verify, recover from, and report?
- What tools/permissions exist, where is approval required, and how are retries/cost bounded?
- How does it resist injected instructions from retrieved/tool content?

### UX and demo
- Can a new judge understand the first screen and magic moment without narration?
- Are loading, empty, partial, error, offline, and approval states real?
- What exact trigger switches to fallback, and has reset been rehearsed?
- Does the fallback prove the same claim and fit the time limit?

### Trust and deployment
- Are secrets, PII, dependencies, permissions, and retention controlled?
- What has actually been tested, in which environment and when?
- Is “production-ready,” “secure,” “scalable,” or market leadership being claimed without evidence?
- Which actions are destructive/external and who approves them?

### Submission compliance
- Were eligibility, organizer-wide restrictions/prohibited uses, deadline/time zone, required tech, repository, video, media, licensing, and submission fields reverified from dated official sources?
- Does the project, its data, and every demonstrated/deployed behavior remain inside those restrictions?
- Do all links open without team credentials?
- Does the final submitted artifact match the demo and claims?

## Break tests

Run or inspect, as applicable:
- clean setup and cold start;
- core path with empty/malformed/hostile input;
- network/API/model outage and quota failure;
- duplicate action and partial success;
- unauthorized/cross-user access;
- prompt/tool injection and unsafe output handling;
- leaked secret/PII in logs, browser, screenshots, fixtures, or video;
- dependency provenance/version/license gaps;
- offline fallback, reset, and three timed rehearsals;
- README/video/submission links in an incognito or logged-out context;
- score/claim evidence traced back to source or measurement.

## Final decision

Output findings in severity order, then:

```text
Readiness: READY / READY WITH ACCEPTED RISKS / NOT READY
Critical open:
High open:
Accepted risks (owner, approver, expiry):
Official rules reverified as of:
Demo rehearsal evidence:
Validation evidence:
Next action:
```

Never waive eligibility, unresolved restrictions/prohibited-use applicability, exposed credentials, missing mandatory deliverables, fabricated evidence, or an unapproved destructive/production action. Treat any such uncertainty as a CRITICAL blocker. Praise only demonstrated strengths that survive the attack.