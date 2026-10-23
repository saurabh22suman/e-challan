# F-01 correction-preparation review

Date: 2026-10-02. **Result: CHANGES_REQUIRED for test preparation.**
The original F-01 implementation review remains CHANGES_REQUIRED. No production
or acceptance file was edited during this check.

## Integrity

`sha256sum -c docs/handoffs/F-01-tests.sha256` passes 14/14;
`sha256sum -c docs/handoffs/F-01-corrections-tests.sha256` passes 4/4.
The original acceptance and approval baseline is intact. The additive correction
suite was inspected along with its prepared record. Its SQLSTATE helper now
captures an actual error and checks its string code, which is stronger than
the disclosed unsafe RegExp object-matcher draft.

## Blocking test defect — lookup query does not query the identity column

References: `apps/api/tests/integration/f01-corrections.test.ts:37–38,198–215`.
The canonical SQL constants use `$1`, but the lookup queries call `pool.query`
without a values array. Their left-hand expressions normalise `$1`, not
`registration_number` or `gate_pass_number` from the table. This is neither a
valid bound query nor a row-specific normalised lookup.

Exact command rerun:

```bash
pnpm --filter @echallan/api exec vitest run --project integration tests/integration/f01-corrections.test.ts -t "returns exactly one row for a normalised lookup"
```

Actual result: 1 selected test failed, 16 filtered tests not run; exit 1,
`error: there is no parameter $1`, at line 201. This is a focused diagnostic,
not a full-suite pass or a committed skip. The reported claim that this assertion
returned two rows is not supported by the pinned test's actual query.

Planner correction needed:

- Compare the canonicalised table column to a canonicalised supplied parameter,
  passing the values array. Use the approved vehicle and pass rules separately.
- Make the “after a variant attempt” case self-contained instead of relying on
  mutations from preceding failed tests. Roll back diagnostic mutations and
  inspect the result before rollback; rejection must not leave a transaction
  unusable for the subsequent query.
- Run the revised lookup check and full correction suite against unchanged
  production code. Record actual assertion failures and honest counts.
- Correct the preparation evidence: R3 undefined-column/missing-association
  failures are relationship-surface absence, not behavioural constraint proof.
  The actual R1/R2 accepted-invalid-data failures remain meaningful behavioural RED.
- Clarify counts: Vitest currently reports 17 executed cases including the
  three severity `it.each` iterations; this is not 17 methods plus 19 executed
  iterations. Do not change the code merely to match a descriptive count.
- Document this additional pre-implementation planner revision and revise only
  the additive correction baseline entries affected. Preserve the original
  14-entry baseline and all original assertions.

## Session disposition

Use option **(b)**: retain the current session as planner/test owner, correct the
test defect, and stop after the preparation handoff. Then start a fresh
implementer session for the uninterrupted A–E correction batch. Hash pinning
records integrity; it does not substitute for role separation or make an
incorrect query meaningful acceptance. A separate final reviewer remains required.

The original review and correction request were left unchanged because they are
entries in the additive baseline. This separate report is an additional planner
correction request; it does not rewrite that history.
