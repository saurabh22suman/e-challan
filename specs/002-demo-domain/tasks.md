# F-01 implementation tasks

Implementation boxes only; independent review stays on the parent checklist.

- [x] T001 Verify planner baseline and reviewed dependency; capture surface-absence RED accurately.
- [x] T002 Enumerate domain field dictionary, attribution relationships, object-reference shapes and seed-history provenance.
- [x] T003 Implement strict shared submission/action/transition/enumeration contracts and approved pure helpers.
- [x] T004 Add internal API adapter consuming shared validation; verify package exports in API and both clients.
- [x] T005 Add incremental Drizzle domain migrations, FK/unique/check constraints and required query indexes while retaining foundation harness.
- [x] T006 Implement separate guarded/idempotent domain fixture adapter with explicit UUID/source mapping and no fabricated operational media proof.
- [x] T007 Record behavioural RED after surface wiring; obtain GREEN on planner contracts and real-DB acceptance.
- [x] T008 Run disposable-copy fault sensitivity, restore and rerun cleanly.
- [x] T009 Run prescribed regression gates; verify planner hashes; record actual counts and migration/seed effects.
- [x] T010 Write implementer handoff/review request; tick parent Implemented only when acceptance holds; stop before F-02.

Implementation evidence: `docs/handoffs/F-01.md`. Review requested in
`docs/review-requests/F-01.md`. Parent `Reviewed` stays unticked until an
independent reviewer records `docs/reviews/F-01.md`. Note the disclosed process
deviation at T007: the SQL half has a reproducible staged behavioural RED, while
the contract half went from surface-absence RED straight to GREEN and relies on
fault mutation A for load-bearing evidence.

Independent review returned CHANGES_REQUIRED on 2026-10-02 and reopened
T002/T005/T007/T009/T010. See `docs/reviews/F-01.md` and the longer internal
correction-batch request `docs/handoffs/F-01-corrections-request.md`.

Correction batch completed 2026-10-02; see "Follow-up correction batch" in
`docs/handoffs/F-01.md`. R1/R2 are load-bearing, R3 invariants are isolated, the
ambiguous legacy upgrade is refused by a pre-migration guard, and the unapproved
one-post-per-gate restriction is removed. Redundant-constraint faults are not
required to fail individually (see Addendum 3 of the correction preparation).
Independent review still required; F-02 remains blocked.

Targeted legacy-upgrade correction 2026-10-03 (latest correction review): a positive
legacy shared-gate upgrade case was added and the complete migration path repaired by
a planner-approved compatibility amendment of `0003`/`0005`. Integration is now 42
cases. `Implemented` is ticked again on that evidence; `Reviewed` remains unchecked.
Contracts, R1/R2 and attribution modelling were not restarted.

Final independent review PASS on 2026-10-03. All implementation subtasks and the
parent Reviewed box are complete; see `docs/reviews/F-01-final.md`. Earlier
unticked-review statements above are retained as historical handoff state.
