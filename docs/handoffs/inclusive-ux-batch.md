# Inclusive UX revamp batch brief (2026-10-18)

Owner-authorised batch (owner clarification 2026-10-18 in `docs/decisions.md`)
executing `docs/handoffs/inclusive-ux-revamp-plan.md` UX-01–UX-08 under the
single-planning-pass, implementer-batch, one combined review pattern. The
combined review at batch exit is mandatory and independent; nothing here is
approval.

- Readiness and gates: `docs/handoffs/ux-00-readiness.md`.
- Prepared acceptance (this batch): `docs/handoffs/inclusive-ux-prepared.md`.
- Implementation evidence: `docs/handoffs/inclusive-ux.md`.
- Independent review request: `docs/review-requests/inclusive-ux.md`.
- Spec Kit feature: `specs/007-inclusive-ux/`.

## Units

| Unit | Scope in this batch |
| --- | --- |
| UX-01 | Progress (three stages, no section step numbers), heading focus on stage change, shared ErrorSummary with linked focus, action area, narrow-width reflow/overflow, tablet target sizes. |
| UX-02 | Both sign-in screens: titles, Show/Hide password, plain copy, one h1 + main landmark, generic failure wording. |
| UX-03 | Entry grouping and copy, vehicle picker keyboard/touch (combobox/listbox), manual-entry honesty copy, Other-last display, remarks helper/counter, Check details action area. |
| UX-04 | Summary completeness and definition-list semantics, Change details focus, repeat/duplicate honest wording, Continue to photos action. |
| UX-05 | Photos: one persistent instruction (remove duplicated guidance), distinct recoverable failure actions retained. |
| UX-06 | Signature confirmed/sign-again states, local-only endpoint copy, refusal copy and validation feedback, invalidation consistency. |
| UX-07 | Admin workspace honest copy/semantics, role from session only. |
| UX-08 | Automated accessibility/overflow/keyboard sweep in this batch; representative-user and real-device validation prepared but NOT executed (separately gated). |

## Fences

No contract/API/schema/route changes; no storage, submission, dashboard,
production auth, deployment or offline work. Frozen test selectors may change
only for the copy/layout the plan requires, through a documented planner
baseline revision recorded in the batch records; no behavioural assertion may
be weakened. Real-device and representative-user evidence cannot be produced in
this session and will be recorded as pending.
