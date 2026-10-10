# UX and Visual Quality

Use for Phase 8. Judge-facing UX must make the problem, action, differentiation, and result obvious without narration.

## Five-second test

A new viewer should identify:
1. what the product does;
2. who it is for;
3. why the outcome matters;
4. the primary next action;
5. the distinct mechanism or promise.

If any answer depends on a pitch explanation, revise the first screen.

## Core-flow review

| Step/screen | User goal | Primary action | Required information | System feedback | Exit condition | Friction to remove |
|---|---|---|---|---|---|---|
| | | | | | | |

Protect the demo path: avoid login, configuration, blank dashboards, or data entry unless intrinsic to the differentiator. Pre-seed non-sensitive demo state.

## State completeness

For every critical surface define:

| State | Content/action required | Acceptance check |
|---|---|---|
| Initial/onboarding | Value and next step without a tutorial wall | First action obvious |
| Loading/progress | Specific work/status; prevent duplicate action | No unexplained stall/layout shift |
| Empty | Why empty and how to create/use data | Actionable, not decorative |
| Success | Observable outcome and evidence | User knows what changed |
| Partial | Completed vs unresolved work | No false success |
| Error | Plain cause, safe details, retry/fallback | Recovery works |
| Offline/degraded | Labeled limitation and usable fallback | Demo remains coherent |
| Permission/approval | Scope, consequence, confirm/cancel | No dark pattern |

## Visual system

Check:
- one clear hierarchy per screen;
- consistent typography, spacing, color, radius, and interaction patterns;
- readable contrast and focus indicators;
- restrained motion that explains state change and respects reduced motion;
- responsive layouts at demo and common mobile widths;
- real content lengths, not only ideal placeholders;
- charts/metrics with units, source, date, and separate verification/proof-strength/medium fields where relevant;
- product identity distinct from a default component template.

Avoid excessive cards/gradients, fake command centers, meaningless AI animation, tiny gray text, and dashboards that hide the core action.

## Accessibility minimum

- Semantic headings/landmarks and logical tab order.
- Keyboard operation for the critical flow.
- Visible focus; labeled controls and form errors.
- Text alternatives for meaningful visuals.
- Color is not the only signal.
- Target sizes and contrast are usable.
- Status updates are perceivable without depending solely on animation.

## Magic-moment design

| Before | User action | System transformation | Visible after | Evidence | Duration target |
|---|---|---|---|---|---|
| | | | | | |

Use progressive disclosure: lead with the outcome, then allow judges to inspect trace, source, architecture, or verification. Preserve provenance and uncertainty rather than presenting model output as fact.

## Polish triage

1. Broken/unclear core flow and trust failures.
2. Loading, errors, empty states, responsiveness, accessibility.
3. Hierarchy and content clarity.
4. Consistency and perceived performance.
5. Motion and delight.

UX passes when a fresh observer can complete or understand the core flow, recognize the magic moment, recover from an error, and distinguish real evidence from simulated content.