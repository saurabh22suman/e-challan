# F-02 implementation tasks

Current independent review: **PASS on 2026-10-07** in
`docs/reviews/F-03-m1-f02-b1-implementation.md`. C1 and B1 are closed; T011/T013
and both parent completion boxes are checked on verified evidence. Historical
returned statuses below are retained and superseded by this acceptance.

Implementation boxes only; independent review stays on the parent checklist.

- [x] T001 Verify planner and F-01 baselines; capture surface-absence RED accurately.
- [x] T002 Enumerate session/attribution field dictionary and the demo credential
  configuration contract, including the deferred-requirement boundary.
- [x] T003 Implement shared login/session/error contracts in `packages/contracts`.
- [x] T004 Implement the env credential loader with missing/blank/ambiguous validation
  and no secret leakage.
- [x] T005 Add one additive migration creating `sessions` with hashed tokens and
  retention; retain every applied F-01 migration.
- [x] T006 Implement the session store: create, resolve with idle/absolute expiry and
  `last_seen_at` refresh, revoke.
- [x] T007 Wire login/logout/session routes and the read-only scoped challan read with
  API-side role and location enforcement.
- [x] T008 Record behavioural RED for the enforcement paths after surface wiring.
- [x] T009 Add tablet and admin login screens, session handling, protected routes, login
  error feedback and logout.
- [x] T010 Add the tablet idle-logout hook with unsent-state clearing.
- [x] T011 Obtain GREEN on planner acceptance; prove fault sensitivity in a disposable
  copy and restore.
- [x] T012 Run all prescribed regression gates; verify all three baselines; record real
  counts and migration effects.
- [x] T013 Write implementer handoff and review request; tick parent Implemented only
  when acceptance holds; stop before F-03.

Implementation evidence: `docs/handoffs/F-02.md` — original record, planner addendum
and the **correction batch** section (2026-10-04, revision-3 acceptance). The first
implementation review returned CHANGES_REQUIRED (`docs/reviews/F-02.md`) and the
preparation reviews returned Q1-Q4/N1-N2; all are corrected and the preparation
checkpoint passed (`docs/reviews/F-02-preparation-revision-3-followup.md`).
Correction batch gates: 114 unit, 66 real-DB integration, 17 browser, builds,
144771 B gzip, 27 foundation, with nine load-bearing guards fault-verified in a
disposable copy. Independent correction re-review on 2026-10-05 returned
**CHANGES_REQUIRED**, `docs/reviews/F-02-correction-implementation.md`, for C1
malformed JSON restoration handling. T009/T011/T013 and parent Implemented are
returned to unchecked; Reviewed remains unchecked. Passing gates are retained
as evidence, not final acceptance.

C1 regression preparation and implementation are complete: revision-4 acceptance
lives in `docs/handoffs/F-02-prepared.md`, the preparation PASS is
`docs/reviews/F-02-preparation-revision-4.md`, and the implementation evidence is the
"C1 regression correction" section of `docs/handoffs/F-02.md`. `fetchSession` in both
clients resolves to `null` on body-read/decoding failure, providers handle restoration
rejections defensively, and cleanup is guarded by the transition identity. Gates after
the fix: tablet 21, admin 17, root units 122, integration 66, browser 17 (two clean
runs), builds, 144788 B gzip, foundation 27; three C1 faults verified in a disposable
copy. T009/T011/T013 and parent Implemented are ticked on that evidence; **Reviewed
remains unchecked** pending the independent implementation re-review.

`Reviewed` on the parent task stays unticked: preparation and implementation ran in the
same session at the owner's instruction, so independent review is still required and must
come from a separate session/model.

Historical revision-2 test defect (corrected by revision 3):
`tests/integration/f02-auth.test.ts:353` cannot reach the stored-role guard, because it
also makes two configured usernames identical and the loader refuses that first. See
"Test defect returned to the planner" in the handoff.
