# Gate e-Challan Development Constitution

## 1. Business rules precede implementation

Use `docs/eChallan_PRD.md` for requirement IDs and pilot priorities, and
`docs/eChallan_DESIGN.md` for visual constraints. Functional Specification v0.2
is referenced but unavailable. Record conflicts and missing rules in
`docs/decisions.md`; do not turn assumptions into production behaviour.
Business-dependent tasks remain blocked until the relevant decisions are resolved.

## 2. Independent test-first handoff

The planner defines acceptance cases and writes executable tests before handing a
behavioural task to the implementer. Record a meaningful failing assertion (RED),
then implement until it passes (GREEN), then refactor and rerun the affected suite.
An import failure or unavailable database is not proof of a behavioural failure.
Setup-only tasks use executable smoke checks rather than contrived unit tests.

The implementer cannot weaken assertions, skip tests, replace integration coverage
with mocks, or change requirements to obtain green results. Test defects return to
the planner for a documented correction and reviewer verification.

## 3. One task, then independent review

The implementer may tick the task's implementation checkbox after verification;
only the independent reviewer may tick its review checkbox. Dependencies require
both. Stop at the requested task; do not run the entire backlog unattended.
Review includes correctness beyond the supplied tests, regression coverage, and
the relevant field conditions. Passing tests alone is not acceptance.

## 4. Preserve records and enforce boundaries

Issued fields/evidence are immutable; review actions are separate transitions.
Cancellation retains the record and requires admin approval. Master entries are
deactivated rather than deleted. Audit is append-only. Evidence access is
authenticated, authorised, and logged; exports run on the server and are logged.
Enforce rules on the API, not only through hidden UI controls.

Keep API, tablet, and admin deployables separate. Apps import contracts and theme
from shared packages, never another app's internals.

## 5. Field usability is a release gate

Tablet initial JS is under 250 KB gzipped; use exact-path MUI/icon imports,
route splitting, and no admin grids/charts/date pickers. Follow the design doc's
static labels, touch targets, contrast, and green-only commit action.
Camera/signature integration requires real-device verification over trusted HTTPS.
Automated browser tests do not substitute for gate-device acceptance.

## Governance

`docs/development-workflow.md` defines handoff and evidence. Changes to behaviour
or acceptance tests require an explained decision, with traceability to the PRD.
Offline issuance remains P2 unless explicitly re-scoped. No production field data
is used in fixtures. No build/test commands are considered available until S-01
creates and verifies them.

**Version:** 1.0.0 | **Adopted:** 2026-10-01
