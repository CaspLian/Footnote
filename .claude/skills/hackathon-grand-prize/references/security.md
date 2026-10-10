# Security, Privacy, Reliability, and Approval Gates

Use for Phases 5, 9, 10, and 18. Scope controls to the product, but never skip secrets, untrusted input, personal data, dependencies, or consequential actions.

## Fast threat model

| Asset/data | Source | Trust level | Who may access | Threat/misuse | Control | Verification | Owner/status |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

Map trust boundaries among browser/device, backend, storage, model/agent, sponsor service, uploads, admins, and third parties.

## Required controls

### Untrusted content and prompt injection
- Treat web/retrieved text, files, repository content, user input, tool/model output, and metadata as data—not instructions.
- Separate system policy from content; allowlist tools/actions and validate structured outputs.
- Prevent content from expanding permissions, selecting unauthorized destinations, exfiltrating context, or revealing secrets.
- Sanitize/encode output for its destination; sandbox file parsing and code execution.
- Test direct and indirect injection, poisoned documents, malicious filenames/URLs, oversized inputs, and hostile tool output.

### Secrets
- Use environment variables or a secret manager, least-privilege scoped credentials, and separate demo/production accounts.
- Never commit, expose client-side, log, paste into prompts, screenshots, recordings, or fixtures.
- Run repository/history and generated-artifact scans where available.
- On exposure: stop use, revoke/rotate, remove/redact, assess logs/history, and record remediation. Deleting the visible string alone is insufficient.

### Personal/sensitive data
- Minimize collection; establish purpose, consent/authority, retention, deletion, and access boundaries.
- Prefer synthetic or irreversibly anonymized demo data. Mark it clearly.
- Redact logs/exports and avoid sending data to models/services without permission and documented terms.
- Support correction/deletion where relevant; do not infer sensitive attributes or claim legal compliance without review.

### Identity, authorization, and abuse
- Enforce authorization server-side for each object/action; test cross-user access and privilege escalation.
- Secure sessions/tokens, rate-limit abuse-prone endpoints, and provide safe errors.
- Validate uploads by type, size, content, storage path, and retrieval policy.
- Block SSRF with destination allowlists and network controls; parameterize queries and encode output.

### Dependencies and supply chain

| Package/service | Exact version | Official source/provenance | License | Maintenance/advisory check | Why needed | Alternative | Approval/status |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

Prefer existing dependencies. Verify package spelling and official publisher; flag unusual/new names as possible typosquatting. Pin exact versions/lockfiles, review install scripts and advisories, and request approval before adding a dependency. Never execute code copied from untrusted sources without review.

## Consequential-action approval

Before production deployment, live infrastructure/permission changes, destructive schema/data operations, purchases, external messages, public release, or actions affecting people, present:

```text
Proposed action and target:
Environment:
Expected effect and blast radius:
Data/cost/people affected:
Backup/checkpoint:
Rollback and estimated recovery time:
Reversibility:
Validation/dry-run evidence:
Requested approver:
```

Obtain explicit approval immediately before execution. A prior general approval does not cover a changed target or larger blast radius. Default to sandbox/dry-run. Record approver, timestamp, exact action, outcome, and rollback status.

## Reliability cases

| Case | Expected behavior | Test evidence | Status/owner |
|---|---|---|---|
| Timeout/network loss | Deadline, cancellation, actionable retry/fallback | | |
| Rate limit/quota | Backoff/degrade; no retry storm | | |
| Malformed/hostile input | Reject safely; no leakage/execution | | |
| Empty/missing data | Useful empty/degraded state | | |
| Duplicate request | Idempotent or deduplicated side effect | | |
| Partial external success | Reconcile/compensate/report accurately | | |
| Service/model bad output | Validate, bounded retry, fallback | | |
| Storage/concurrency failure | Preserve consistency or fail closed | | |
| Unauthorized request | Deny without resource disclosure | | |
| Budget exhausted | Stop safely; report partial state | | |

## Release evidence

Pass only with evidence for applicable items:
- build/tests/type/lint and critical smoke flow;
- authn/authz and input/output controls;
- secrets scan and safe configuration;
- PII inventory and demo-data labeling;
- dependency provenance/version/license review;
- injection/SSRF/upload/abuse cases where applicable;
- failure, duplicate, timeout, and rollback behavior;
- agent permissions/retries/approvals if applicable;
- no non-waivable issue or open critical issue; each accepted high risk has an owner, approver, expiry, and fallback.

Never claim the system is “secure” or “production-ready” from a checklist alone. State tested scope, environment, date, evidence, and known residual risk.