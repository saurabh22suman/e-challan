# Implementation plan: inclusive UX revamp (007)

Feature: `specs/007-inclusive-ux/spec.md`. Batch brief:
`docs/handoffs/inclusive-ux-batch.md`.

## Approach

Presentation and copy only, in dependency order: shared primitives
(packages/theme) → tablet shell/progress → entry form → summary → photos →
signature/refusal → admin copy. Existing state, contracts, lookups, repeat
checks and the E-02/E-03/E-03 binding contracts are reused unchanged.

## Units

1. UX-01 — ErrorSummary + stage progress + focus + reflow + target evidence.
2. UX-02 — sign-in screens (both apps).
3. UX-03 — entry form grouping, picker keyboard, manual mode, remarks.
4. UX-04 — summary semantics/completeness, action naming, notices.
5. UX-05 — photo instruction and failure presentation.
6. UX-06 — signature states and refusal copy, honest local endpoint.
7. UX-07 — admin workspace copy.
8. UX-08 — automated sweeps; manual validation protocol recorded as pending.

## Gates

Focused tests per unit with recorded RED where behaviour changes; full gate
sequence at batch exit (format, lint, typecheck, unit, integration, e2e,
build, tablet size, foundation); Playwright screen/state verification;
fault-sensitivity for the new ErrorSummary/focus and picker keyboard guards in
a disposable copy; documented exact-label test baseline revision.
