# F-01 longer correction-batch request

Requested by the user, 2026-10-02: review the completed work and give the other
agent longer tasks. Independent result: CHANGES_REQUIRED, `docs/reviews/F-01.md`.

This is a **correction request**, not a prepared executable test baseline or
permission to implement F-02. It defines a substantial A–E internal batch so the
implementer can work continuously once the planner's correction tests are ready.

## Planner preparation first

Act in a planner/test-owner session; read the review, approved replacement spec,
original F-01 handoff/baseline and current implementation. Prepare additive
executable tests for:

1. R1: raw SQL case/whitespace variants cannot create normalised registration or
   gate-pass duplicates; positive canonical distinct values still work. Permit
   canonical-form rejection or canonical-key uniqueness, not raw-string-only
   equality. Match the approved registration/pass normalisation exactly.
2. R2: NULL/missing master severity cannot create selectable active violations;
   approved severity values remain allowed. Specify the precise NOT NULL/check
   invariant for the approved master model.
3. R3: persisted post/gate/location association reproduces the existing source
   fixture, remains unambiguous with two gates at one location, and rejects
   invalid relationship references. Specify how redundant location data is
   constrained or derived. This is technical modelling under existing approved
   post attribution, not a new workflow/product question for the owner.

Record the current meaningful SQL/relationship assertion RED, exact commands and
counts in `docs/handoffs/F-01-corrections-prepared.md`. Record an additive
correction baseline, preserving the original baseline history and test assertions;
any change to an original planner input needs a documented planner revision.
Do not fix production code to prepare tests or add mocked DB substitutes.

## Implementer batch after preparation

Use a separate implementer session and the supplied correction baseline.
Complete all phases without stopping between them unless blocked:

### A — Verify and reproduce

Verify original and correction hashes. Read actual source/migrations and capture
the new failing acceptance assertions. Preserve user/other-agent work.

### B — Repair relational invariants

Fix normalised uniqueness, required severity and authoritative post/gate mapping.
Add incremental corrective migrations because 0001/0002 have already been
applied to the demo DB; do not rewrite applied migration history to hide a defect.
Use safe backfill/check order, preserving valid existing data and stable seed IDs.
Do not silently merge/delete invalid colliding records to make migration pass;
return concrete existing-data conflicts for resolution if encountered.

### C — Complete seed and evidence corrections

Update the synthetic seed mapping for post/gate relationships and ensure repeat
runs retain identity/history and do not manufacture media. Correct append-only
enforcement claims, custom UUID standards wording and insert-if-absent/upsert
wording. Append a dated correction to the original handoff, preserving its
honest contract-TDD deviation and historical evidence.

### D — Prove acceptance and regression

Obtain GREEN on original plus correction acceptance. In a disposable copy, remove
or bypass each corrected invariant and demonstrate a corresponding test fails;
restore and rerun cleanly. Verify empty migration, upgrade of actual existing
F-01 data, repeat seed, snapshot retention, rollback and existing foundation
behaviour against PostgreSQL.

Run format → lint → typecheck → all unit/integration checks → relevant browser
checks → affected builds → tablet size → foundation clean-artifact checks,
following exact commands in the prepared correction handoff. Report real counts;
the old 74/21 counts must increase by the new meaningful cases. No skipped tests,
baseline edits, false-green mocks or zero-test passes.

### E — Hand back once

Verify hashes again. Update `docs/handoffs/F-01.md` and
`docs/review-requests/F-01.md` with changed files, migrations, RED/GREEN/mutation
results and limits. Tick implementation only when conditions hold; keep Reviewed
unchecked. Request independent review and stop. Do not self-review or proceed to
F-02/F-03/F-04/issuance automatically.

## Following larger feature, after review PASS

The next long prepared chunk should be F-02 demo authentication: env-backed role
accounts, API session/role/location enforcement, stable demo actor attribution,
post/shift context, actual frontend login and route protection, logout and
10-minute tablet idle expiry. Source:
`docs/handoffs/demo-env-login-decision.md`. Planner must first reconcile the
amendment and prepare bounded acceptance; login alone must not be represented as
full completion of deferred production credential-management requirements.
