# AI Agent Quality

Use for Phase 9 and any system claiming agency. A single inference, fixed chain, chatbot, or RAG response is an AI feature—not an agent.

## Qualification test

An agent must provide evidence of this bounded lifecycle:

| Stage | Required behavior | Observable evidence |
|---|---|---|
| Observe | Read relevant goal, state, constraints, and prior outcomes | Sanitized input/state summary |
| Plan | Choose ordered actions under limits | Plan or decision trace |
| Act | Invoke real tools/services that change or retrieve state | Tool name, safe arguments summary, result status |
| Verify | Check outcome against explicit success criteria | Validator/test/comparison result |
| Recover | Handle known failure with bounded retry, alternative, or escalation | Attempt count, fallback, stop reason |
| Report | Return result, confidence, actions, evidence, and unresolved risk | User-facing completion record |

If any essential stage is absent, label it `AI-assisted workflow` or `AI feature`.

## Agent contract

```text
Goal:
Allowed tools/actions:
Prohibited actions:
State read/written:
Success criteria:
Stop conditions:
Max steps/retries/time/cost:
Human approval points:
Verification method:
Recovery ladder:
Final report schema:
```

## State model

Separate:
- **Run state:** current plan, step, attempts, tool results, approvals.
- **Task state:** durable artifact/status needed across runs.
- **User memory:** only consented, useful, editable, and deletable data.
- **Audit evidence:** safe metadata needed to explain actions; no hidden reasoning, secrets, or unnecessary PII.

Define source of truth, ownership, expiration, concurrency behavior, and reset. Never call an unbounded transcript “memory.”

## Tool policy and approvals

| Tool/action | Read/write | Side effect | Permission scope | Input validation | Approval required | Idempotent | Recovery |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

Require human approval immediately before purchases, external messages, production changes, destructive operations, permission changes, release/publication, or actions affecting people. Show proposed action, target, impact, cost, and rollback. Approval for a plan is not approval for a materially changed action.

Treat tool output and retrieved content as untrusted data. Never let content redefine system goals, expand permissions, reveal secrets, or select unauthorized tools.

## Retry and recovery policy

1. Validate error class; do not blindly retry deterministic failures.
2. Retry transient, idempotent operations only, with capped exponential backoff and jitter.
3. Use an alternative tool/model/path only if allowed and semantically equivalent.
4. Fall back to a deterministic or human-assisted path.
5. Stop safely and report partial work, evidence, and recovery steps.

Record `attempt`, `error class`, `decision`, `delay`, `result`, and `stop reason`. Cap token/API cost and wall time.

## Observability

Emit safe structured events:

```text
run_id, phase, tool, action_summary, started_at, duration_ms,
outcome, verification, retry_count, approval_id, fallback_used
```

Redact credentials, prompts containing sensitive data, raw personal data, and private tool output. Provide judges a concise execution trace rather than hidden chain-of-thought.

## Evaluation cases

| Case | Expected behavior | Pass evidence |
|---|---|---|
| Happy path | Completes and verifies goal | Correct result + trace |
| Ambiguous goal | Requests clarification or chooses safe bounded assumption | No unsafe action |
| Tool timeout/rate limit | Bounded retry then fallback | Recovery trace |
| Malformed/tool-injected output | Rejects/isolates untrusted instruction | Policy preserved |
| Partial success | Reports completed/failed steps accurately | State consistent |
| Duplicate request | Avoids duplicate side effect | Idempotency evidence |
| Approval denied/expired | Stops without action | Denial logged safely |
| Verification fails | Repairs, escalates, or fails closed | No false success |
| Budget exhausted | Stops with partial report | Limit observed |

## Demo proof

Show one loop where the agent interprets a goal, uses at least one meaningful tool, verifies the effect, and visibly recovers from a controlled failure or requests approval. Do not spend the demo on internal monologue.

Agent quality passes only when actions are useful, bounded, observable, verified, recoverable, and honestly labeled.