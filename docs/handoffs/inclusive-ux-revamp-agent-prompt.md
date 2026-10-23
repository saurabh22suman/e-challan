# Copy-paste handoff for the next agent

```text
Act as the planner for an inclusive UX revamp of this e-Challan app.

Read docs/handoffs/inclusive-ux-revamp-plan.md in full, then AGENTS.md,
docs/development-workflow.md, the current implementation/checklist and decisions,
and the active entry-media and owner-UI review/baseline records it references.

Owner goal: make the app understandable and usable for staff with limited reading
confidence or digital experience. Prioritise plain language, clear next actions,
familiar terms, easy corrections, large controls and truthful success states.
Do not infer a language preference or treat education as intelligence.

Start with UX-00 readiness and test preparation. Recheck the actual tree and latest
independent reviews. The last inspected entry-media review was CHANGES_REQUIRED
for C1 acquired-camera cancellation and C2 drawing/confirmation invalidation.
The owner-UI revision also requested independent review. If newer reviews resolve
these, cite them; otherwise preserve their gates and prepare the correction path.

Keep B-02's approved single scrolling entry form → driver summary →
photos/signature or witnessed refusal. Remove confusing step labels and improve
grouping; do not introduce a wizard without an explicit new owner decision.
Preserve editable registry autofill, gate-pass requirement, API role/location
scoping, repeat/duplicate gates, signature-summary binding, E-02 media limits,
E-03 resize invalidation and 600-second inactivity clearing.

No storage/submission/receipt, operational dashboard, production auth, deployment
or offline feature is authorised by this UX plan. Keep local capture explicitly
distinct from issued challans. Do not offer refusal as a shortcut for consent.

Create the bounded spec/tasks and planner-owned executable acceptance for the
next ready UX unit, with genuine RED evidence and a frozen test manifest.
Do not alter old protected expectations to make new copy/layout pass; propose
any necessary baseline revision explicitly for reviewer confirmation.

Report readiness, blockers, the first prepared implementation unit and exact test
commands. Stop for the separate implementation handoff. If the owner explicitly
assigns you implementation instead, implement only a ready, test-prepared unit,
record RED→GREEN and the required gates, request independent review, and stop.
Never self-approve or assume an old batch override covers this revamp.

Use Playwright to inspect actual screens and failure states. Respect the project's
package boundaries, existing MUI/React versions, static labels, tablet 56–64px
targets, 12px gaps, contrast, self-hosted fonts, green-only commit and <250 KB
initial-JS gzip budget. No broad dependency/state-management rewrite is needed.

Finish with evidence and a handoff that another session can reproduce. Browser
fake-camera tests are not physical-device or representative-user acceptance.
```
