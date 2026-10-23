# F-03 implementation tasks

Current independent review: **PASS on 2026-10-07** in
`docs/reviews/F-03-m1-f02-b1-implementation.md`. T003/T007/T010 and both parent
boxes are checked. T006 is completed by M1's genuine contract-assertion RED,
not by relabeling the earlier route-unregistration RED. Historical returned
statuses below are retained and superseded by this acceptance.

Implementation boxes only; independent review stays on the parent checklist.

- [x] T001 Verify planner baseline and F-01/F-02 reviewed dependencies; capture
  surface-absence RED accurately.
- [x] T002 Enumerate master kinds, per-kind fields and the active-only selection rule,
  including the gate-location parent rule and the no-delete boundary.
- [x] T003 Implement shared master contracts in `packages/contracts` and export them.
- [x] T004 Implement the Admin-only master service over the existing F-01 tables:
  list (all/active), create, update, idempotent deactivate; no schema change.
- [x] T005 Add one shared session guard and wire `GET /masters/:kind` plus
  `/admin/masters/**` with server-side role and field enforcement.
- [x] T006 Record behavioural RED for the enforcement paths after surface wiring.
- [x] T007 Obtain GREEN on the planner acceptance and real-DB historical-preservation
  cases.
- [x] T008 Run disposable-copy fault sensitivity for the role check, active-only
  catalogue, gate parent rule, field validation, idempotent deactivation and
  history preservation; restore and rerun cleanly.
- [x] T009 Run all prescribed regression gates; verify every baseline; record actual
  counts and migration/seed effects.
- [x] T010 Write the implementer handoff and review request; tick parent Implemented
  only when acceptance holds; stop before F-04.

Implementation evidence: `docs/handoffs/F-03.md`. Parent `Reviewed` stays unticked
until an independent reviewer records `docs/reviews/F-03.md`.

Implementation evidence: `docs/handoffs/F-03.md` (historical) and
`docs/handoffs/F-03-prepared.md` revision 2 (the M1 correction). The independent
review `docs/reviews/F-03.md` returned CHANGES_REQUIRED and returned T003, T006,
T007, T010 and parent Implemented to unchecked:

- **T006** is unchecked because the recorded RED was surface absence (routes
  unregistered), which is not behavioural RED. The M1 contract correction supplies
  genuine contract-assertion RED.
- **T003/T007** are unchecked because the shared master contracts did not enforce
  their kind (M1); the implementer must tighten them and obtain GREEN.
- **T010** is unchecked pending the corrected evidence.

**Owner override / process compression:** F-03 preparation and implementation ran in
one session at the owner's direction while F-02's review is still owed. This is not
independent test-first preparation. Parent `Implemented` and `Reviewed` stay
unchecked. Baseline: `docs/handoffs/F-03-tests.sha256` revision 2 (rev 1 archived at
`docs/handoffs/F-03-tests-rev1.sha256`).
