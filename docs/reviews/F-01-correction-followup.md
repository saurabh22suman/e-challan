# F-01 correction follow-up and mutation interpretation

Date: 2026-10-02. **Result: CHANGES_REQUIRED.** No production or planner-owned
acceptance file was edited by this review. F-01's parent implementation/review
boxes correctly remain unchecked.

The user explicitly elected same-session preparation/implementation after the
separate-session recommendation. Treat that as a disclosed process deviation,
not as evidence of independence from hash pinning. This reviewer did not implement
the corrections and continues the separate review gate.

## What was confirmed

- Original baseline: **14/14 OK**; revised additive baseline: **5/5 OK**.
- The earlier broken normalised-lookup query is corrected. It now normalises the
  actual table columns, passes bound values, performs its own attempted variants
  and rolls diagnostic mutations back.
- Original plus correction focused DB acceptance was rerun:

  ```bash
  pnpm --filter @echallan/api exec vitest run --project integration tests/integration/f01-corrections.test.ts tests/integration/f01-domain.test.ts
  ```

  Actual result: **2 files, 28 tests passed** (17 correction + 11 original-domain).
- R1 canonical CHECKs and R2 NOT NULL/approved severity CHECK are present.
- `posts.gate_id` is persisted and NOT NULL, the seed inserts gates before posts,
  and composite post/gate/location and challan attribution FKs are present.
- Audit/UUID/insert-if-absent wording is corrected in the new source and appended
  evidence, with the historical contract-TDD deviation retained.

Full 74/38/7/27 regression results are implementer-recorded in this checkpoint;
this targeted follow-up did not independently rerun that entire table because
the concrete new upgrade defect below prevents acceptance. They must be rerun
after correction before final approval.

## Correct interpretation of faults F/G/H

### F: real test-isolation gap

The existing cross-location test chooses a gate already claimed by a post.
`posts_gate_id_unique` can therefore reject the insert even when the location
constraint is absent. The planner should use a newly inserted **unclaimed** gate
at the other location and require the relationship error, not an unrelated
uniqueness rejection.

Independent rolled-back DB probe `/tmp/opencode/f01-r3-behaviour-probe.mts`:

```text
Unclaimed cross-location, current schema:
  rejected 23503 / posts_gate_location_fk
Unclaimed cross-location, location FK removed:
  INVALID ASSOCIATION ACCEPTED
```

This demonstrates the intended location invariant and the proper isolated fault.

### H: redundancy is not a verification defect

The composite `(gate_id, location_id)` FK necessarily requires the gate to exist.
Removing the simple gate FK while leaving the composite FK retains that same
reference-integrity guarantee. A test should remain green when behaviour remains
correct; it is not required to fail for every individual DDL clause removed.

The same independent probe confirms:

```text
Missing gate, redundant simple FK removed:
  rejected 23503 / posts_gate_location_fk
Missing gate, all enforcing FKs removed:
  INVALID ASSOCIATION ACCEPTED
```

A meaningful reference-integrity mutation removes/bypasses the complete enforcing
path. Do not weaken a correct schema or add contrived assertions merely to make
fault H individually red. Correct the handoff/request's conclusion that all
F/G/H must individually fail before acceptance.

### G: cardinality needs a source, not automatic test expansion

“Each post resolves one gate” does not logically imply “each gate has only one
post”. The original approved replacement specifies the former; its demo fixture
happens to have one post per gate. `posts_gate_id_unique` introduces the latter
restriction. The planner must explicitly justify/document that additional demo
cardinality as a delegated design choice or remove the unnecessary restriction
through a later migration. Do not describe it as automatically required by the
existing approved model. Once the intended cardinality is clear, test that policy
with positive and negative cases rather than blindly adding a duplicate-post
rejection to legitimise an accidental constraint.

## New production finding: ambiguous legacy backfill silently guesses

**Severity: High.** References:
`apps/api/drizzle/0003_certain_zarda.sql:23–33`;
`docs/handoffs/F-01.md:399–401`; correction preparation's safe upgrade boundary.

The backfill joins every gate at the same location:

```sql
UPDATE posts AS p SET gate_id = g.id
FROM gates AS g
WHERE g.location_id = p.location_id AND p.gate_id IS NULL;
```

When two gates match, PostgreSQL selects one matching source row. The subsequent
DO guard checks only for NULL after the UPDATE, so it does **not** detect the
ambiguity. A pre-flight check on one existing local database does not make the
delivered upgrade path safe for other valid legacy data.

Reproduction: `/tmp/opencode/f01-ambiguous-upgrade-probe.mts` loads only migrations
0000–0002 into the guarded isolated test DB, inserts a location with two gates
and one legacy post with no challan history, then calls the real `runMigrations`.
**The upgrade succeeds and assigns gate one silently.** It should stop with a
clear ambiguous-mapping diagnostic before guessing an authoritative association.
The script then resets the isolated DB to the current migrations and removes
its temporary migration directory. No source or development/demo DB was changed.

Planner: add a real legacy-0002 upgrade case with two gates at one location and
an unmapped post; require explicit refusal/no guessed association. Also retain
positive unambiguous upgrade, data retention and rerun/idempotence coverage.

Implementer: repair the supported upgrade path **before** the old backfill can
choose a gate. Because 0003/0004 are already applied history, do not silently
rewrite them. An applicable pre-migration validation in the supported migration
runner is one possible solution; a check appended only after the old backfill
has guessed is insufficient. Document the supported entrypoint and limitations
and report conflicts rather than merging/deleting or choosing a gate arbitrarily.

## Next bounded action

Keep both task boxes unchecked. Return to planner for:

1. Isolated unclaimed-gate location-consistency acceptance.
2. Explicit cardinality rationale and matching acceptance, without inventing
   one-post-per-gate as a previously approved requirement.
3. Ambiguous legacy-upgrade rejection and positive retention/idempotence cases.
4. Corrected mutation evidence: test invariants, allowing redundant enforcing
   constraints; no mandatory independent failure for redundant fault H.

Record a documented additive planner revision, preserving baseline history.
Then an implementer performs the remaining fix and meaningful mutations, reruns
the full prescribed gates, and requests independent review. User-authorised
same-session continuation may be recorded, but it does not authorise self-review
or weakening tests. F-02 still waits for F-01 review PASS; its future scope is the
env-backed demo-login amendment.

This report is separate because the original F-01 review and preparation-review
files are themselves entries in the frozen additive baseline. They were not
rewritten during this follow-up.
