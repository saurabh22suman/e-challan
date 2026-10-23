# F-01 correction-test preparation (planner-owned)

Prepared: 2026-10-02, planner/test-owner session, after the independent review
`docs/reviews/F-01.md` returned **CHANGES_REQUIRED** (findings R1–R3) and the
user requested the longer correction batch in
`docs/handoffs/F-01-corrections-request.md`.

Parent: **F-01**, with `Implemented` and `Reviewed` both **unchecked** (the review
unchecked implementation). Feature: `specs/002-demo-domain`.

**This record authorises no production change and approves nothing.** It adds the
additive executable acceptance the review asked for, records the real RED against
the delivered code, and hands R1–R3 plus the documentation corrections to an
implementer session.

## Planner-owned files added

| Path | Change |
|---|---|
| `apps/api/tests/integration/f01-corrections.test.ts` | **New.** 15 test methods, 17 executed cases (the severity `it.each` contributes 3), covering R1, R2 and R3. Revised three times before handoff — see the two addenda below |
| `docs/handoffs/F-01-corrections-tests.sha256` | **New.** Additive correction baseline (5 entries, revision history in its header) |
| `docs/handoffs/F-01-corrections-prepared.md` | **New.** This record, updated by two dated planner revisions |

**Unchanged and hash-verified:** `docs/handoffs/F-01-tests.sha256` and all 14 of
its entries, including the three original acceptance files, the approved
replacement specification, the source fixture, the test catalogue, the API project
config, the foundation migration `0000_stormy_nomor.sql`, the S-01 baseline and the
S-01 accepted snapshot. **No original assertion was weakened, relaxed, narrowed,
renamed or deleted, and no `.skip` was added.** The correction file is strictly
additive and lives in a separate file.

Original baseline re-verified after adding the correction tests:

```text
sha256sum -c docs/handoffs/F-01-tests.sha256   -> 14/14 OK
sha256sum -c docs/handoffs/F-01-corrections-tests.sha256 -> 5/5 OK
```

Do not regenerate either manifest to make a failure pass. A further test defect
returns to the planner with concrete evidence.

## Exact focused commands and recorded RED

```bash
sha256sum -c docs/handoffs/F-01-tests.sha256
sha256sum -c docs/handoffs/F-01-corrections-tests.sha256
pnpm db:up
pnpm --filter @echallan/api exec vitest run --project integration \
  tests/integration/f01-corrections.test.ts
```

Actual run against the **delivered** F-01 code, unchanged. The production code was
not touched while preparing or correcting these tests:

```text
pnpm --filter @echallan/api exec vitest run --project integration \
  tests/integration/f01-corrections.test.ts
  Test Files  1 failed (1)
  Tests       12 failed | 5 passed (17 executed cases from 15 methods), exit 1
```

**The 12 failures are two different kinds, and must not be read as equivalent:**

| Class | Count | Meaning |
|---|---|---|
| **Behavioural RED — accepted invalid data** | **7** | PostgreSQL *executed* a statement that the approved model forbids. This is genuine constraint RED. |
| **Surface absence — missing relationship column** | **5** | `posts.gate_id` does not exist, so PostgreSQL refused with `42703 undefined_column`. This is relationship-surface absence, **not** behavioural constraint proof. |

Full-suite confirmation that the original acceptance is undisturbed:

```text
pnpm run test:integration
  Test Files  1 failed | 4 passed (5)
  Tests       12 failed | 26 passed (38)
```

The 26 passes are the original 21 integration tests plus the 5 new correction
guards that are *supposed* to pass today. No original test changed state. Because
every diagnostic mutation now runs in a rolled-back transaction, the correction
suite can no longer pollute the shared test database for the original suite.

Preparation checks actually run: `pnpm format:check` PASS; `pnpm lint` PASS
(boundary gate scanned 60 files); `pnpm typecheck` PASS; `prettier --write`
applied to the new file before hashing it.

## The 12 RED failures, itemised



### Classified failure evidence

Every failure message, verbatim from the run above:

```text
BEHAVIOURAL RED - accepted invalid data (7)

R1: a registration differing only by case/whitespace must be refused:
    the statement was accepted but must be refused
R1: a registration differing only by internal whitespace must be refused:
    the statement was accepted but must be refused
R1: a gate pass differing only by case/whitespace must be refused:
    the statement was accepted but must be refused
R1: a gate pass containing internal whitespace must be refused:
    the statement was accepted but must be refused
R1 (lookup): the variant attempt preceding this lookup must be refused:
    the statement was accepted but must be refused
R2: clearing an active master severity must be refused:
    the statement was accepted but must be refused
R2: inserting a master without severity must be refused:
    the statement was accepted but must be refused

SURFACE ABSENCE - missing relationship column (5)

R3: a post bound to a gate at another location must be refused:
    refused with unacceptable SQLSTATE 42703
R3: a post bound to a missing gate must be refused:
    refused with unacceptable SQLSTATE 42703
R3: no authoritative post-to-gate association is persisted...:
    expected [] to deeply equal [ 'gate_id' ]
    (raised by all three association-dependent R3 cases)
```

The five R3 failures carry a `42703 undefined_column` refusal because
`posts.gate_id` is absent. An implementer therefore gets real behavioural RED
from R1 and R2, and relationship-surface RED from R3; R3 becomes behavioural RED
only once the association exists and is then shown to be inconsistently
constrained. That sequencing is stated plainly rather than overclaimed.

### R1 — normalised uniqueness (5 failures: 4 rejection + 1 lookup)

Each failure is `AssertionError: promise resolved "Result{ command: 'UPDATE', …(9) }"
instead of rejecting`, i.e. **PostgreSQL accepted a duplicate logical identity**:

| Failing test | Accepted duplicate |
|---|---|
| rejects a second registration that differs only by case and surrounding whitespace | `  tn09bk3542  ` beside `TN09BK3542` |
| rejects a second registration that differs only by internal whitespace | `TN 09BK 3542` beside `TN09BK3542` |
| rejects a second gate-pass number that differs only by case and whitespace | ` demo-gp-0007 ` beside `DEMO-GP-0007` |
| rejects a gate-pass number containing internal whitespace | `DEMO GP 0007` |
| still resolves exactly one row for a normalised lookup after a refused variant attempt | the variant attempt was **accepted**, so no normalised duplicate was prevented |

The fifth case is now **self-contained**: it performs its own variant attempt,
inspects the outcome, rolls it back, and only then runs the normalised lookup. It
no longer depends on pollution left behind by a preceding failing test, which was
the defect recorded in `docs/reviews/F-01-correction-preparation.md`.

**Normalisation is specified exactly, and the two rules differ on purpose.** These
match `packages/contracts/src/domain.ts` and replacement specification section 4,
so the implementer must not blur them to make a test pass:

- vehicle registration → uppercase with **all** whitespace removed
  (`upper(regexp_replace(x,'\s','','g'))`);
- gate-pass number → uppercase and **trimmed** (`upper(btrim(x))`), with internal
  whitespace **invalid** rather than silently stripped.

**Mechanism-agnostic on purpose.** A rejection may be a canonical-value CHECK
(`23514`) or uniqueness over a canonical/generated key (`23505`); the tests accept
either and are written `expect(...).rejects.toMatchObject({ code: /^(23505|23514)$/ })`.
They deliberately do **not** accept raw-string-only equality, which is the current
defect, and they do **not** dictate a particular DDL shape.

### R2 — required master severity (2 failures)

| Failing test | Result |
|---|---|
| refuses to clear the severity of an active violation master | `UPDATE violation_types SET severity = NULL` resolved instead of rejecting |
| refuses to insert a violation master without a severity | `INSERT INTO violation_types(id,label)` resolved instead of rejecting |

Acceptance is `23502` (not-null) or `23514` (check). The approved invariant: a
violation master carries one approved severity — Minor, Major or Critical. An
`Unknown` severity must not be invented, and the approved master data must not
change.

**Scope fence:** R2 is about `severity` only. `violation_types.default_action` is
deliberately nullable for fixture masters, and one new test
(`leaves the nullable master default action untouched`) asserts that boundary so a
fix cannot quietly tighten it.

### R3 — persisted post/gate association (5 failures: relationship-surface absence)

Four failures share one root cause, reported as an explicit assertion:

```text
R3: no authoritative post-to-gate association is persisted. The fixture supplies
gate.postId, so a post must be able to resolve its gate (and its location) from
stored data rather than a transient seed-time map.: expected [] to not have a length of +0
```

Failing: `persists the gate-to-post association supplied by the source fixture`,
`keeps every seeded challan consistent with its post, gate and location`,
`resolves one gate per post unambiguously when two gates share a location`,
`refuses a post that references a gate at a different location`, and
`refuses a post that references a gate which does not exist`.

**What the approved model requires**, per replacement specification sections 4/7/8:
the authorised current post determines the actual issuance location and gate, so
the post↔gate relationship must be recoverable from stored data. `docs/demo-data.json`
supplies `gate.postId`, and the current seed reconstructs that association only in
memory while inserting historical challans.

**Precision specified for the implementer.** Two things are DB-owned:

1. the persisted association itself, plus reference integrity — a post must not
   reference a missing gate (`23503`);
2. consistency — a post and its gate must sit at the **same** location, and a
   challan's `gate_id` and `location_id` must agree with the post's gate.

Authorisation of *which* post a marshal may issue from is API/session-owned and
belongs to F-02, not to these constraints. The tests assert only the two DB-owned
items above.

**Direction is fixed, with a stated reason.** The tests require
`posts.gate_id`. Approved specification section 4 says the *authorised current
post* determines the actual issuance location and gate, so attribution resolves
post → gate → location. A reverse `gates.post_id` would leave a post unable to
resolve its own gate without a search and would reverse the authoritative
direction. This was left discoverable in the first draft and corrected during
preparation — see the addendum.

**Unambiguity is proven constructively, not assumed.** The current fixture has one
gate per location, so the "two gates at one location" case is *constructed* in the
test: a second gate and a second post are inserted at `loc-main`, and the test then
asserts each post resolves to exactly one gate and no gate is claimed twice. A
location-only model cannot satisfy this.

## The 5 passing correction tests (honest guards, not gaps)

These pass against the delivered code today and are **not** counted as RED:

- `still accepts distinct canonical registrations and gate passes` — proves the R1
  invariant cannot be satisfied by rejecting everything;
- `accepts the approved severity %s and still refuses an unapproved one`
  (3 iterations) — proves R2 will not become a blanket rejection;
- `leaves the nullable master default action untouched` — the R2 scope fence.

## Documentation corrections also requested of the implementer

These are evidence/wording corrections, not new tests, and the review already
states them. The implementer must fix them in `docs/handoffs/F-01.md` **without
altering the original text's honest disclosures**:

1. **Audit is not yet append-only by enforcement.** `schema.ts` and the handoff
   claim append-only, but the delivered `audit_events` has no update/delete
   enforcement and its challan FK is `ON DELETE CASCADE`. F-01 may fix the storage
   shape, but the handoff must state the boundary accurately: actual append-only
   enforcement is R-06. The same distinction applies to immutable issued snapshots —
   stored snapshots preserve meaning after master edits; mutation *authorisation*
   arrives with later services.
2. **UUID derivation is not standard RFC 4122 v5.** `seed-domain-demo.ts` calls a
   SHA-256-based derivation "RFC 4122 version-5"; standard name-based v5 uses
   SHA-1. Correct the wording; do not gratuitously change already-seeded
   identities.
3. **Insert-if-absent, not upsert.** The seed uses `onConflictDoNothing`, which
   meets the tested repeat-without-duplicates guarantee but is not reconciliation
   of previously edited rows. Correct the wording.
4. **Keep the contract-TDD deviation disclosure, and narrow any over-broad
   sensitivity claim.** Fault A demonstrated the six strict-authority rejection
   tests, not every contract rejection assertion. Do not fabricate historical RED
   evidence and do not weaken the existing disclosure.

## Addendum — two defects found in my own draft, corrected before handoff

The first draft of the correction suite was **not** handed to an implementer. Two
real defects were found while preparing it, both fixed and re-hashed, and the
correction baseline pins the revised file. Recording them here because both would
otherwise have been shipped silently:

1. **An R3 assertion would have fought the correct fix.** The draft inserted a
   second post at `loc-main` *without* a gate reference. The whole point of R3 is
   that a post must resolve its gate, so the honest fix is `posts.gate_id NOT
   NULL` — and that fix would have made my own insert fail. I corrected the test to
   insert the post **with** its gate, which also makes the unambiguity assertion
   stronger: it now proves a post *must* name its gate to be resolvable at all.
   Direction is consequently now fixed to `posts.gate_id` rather than left
   discoverable in either direction, justified by approved specification section 4
   (the authorised current post determines the actual issuance location and gate).

2. **My assertion matcher could pass for the wrong reason.** I first wrote
   `await expect(stmt).rejects.toMatchObject({ code: /^(23503|23505|23514)$/ })`.
   I probed the matcher in this workspace and it **passes for an arbitrary wrong
   code string** (for example `42703`), so an unrelated database error would have
   satisfied an invariant test — a false green on the very findings being fixed.
   All nine rejection assertions now use an `expectSqlRejection` helper that
   captures the SQLSTATE and asserts it with `expect(code).toMatch(...)`, verified
   strict for missing, wrong and correct codes. The probe files were temporary and
   deleted; no repository file records them.

   Note the original planner-owned `apps/api/tests/integration/f01-domain.test.ts`
   uses `toMatchObject({ code: '23505' })` with **string literals**, which is
   strict equality and is unaffected. Only the RegExp form was unsafe, and it
   existed only in my new draft.

Final pinned state of the correction suite:

```text
9a10840a03e0868be0bdea093586b786868945633a693bc64551bde475f79b85  apps/api/tests/integration/f01-corrections.test.ts
56fe7b8295ab9c5ab65b0370b1321928d839c155c7deb112f0256f57dd3e5306  docs/handoffs/F-01-corrections-tests.sha256
```

## Addendum 2 — preparation review correction, 2026-10-02

`docs/reviews/F-01-correction-preparation.md` returned **CHANGES_REQUIRED for test
preparation**. Its finding was correct and the defect was real: **my normalised
lookup queries did not query the identity column.**

### What was wrong

The first drafts defined the canonical SQL as constants containing `$1` and then
interpolated them into both sides of the comparison without a values array:

```ts
const CANONICAL_REGISTRATION_SQL = String.raw`upper(regexp_replace($1, '\s', '', 'g'))`;
// produced: WHERE upper(regexp_replace($1,...)) = upper(regexp_replace('TN09BK3542',...))
```

The left-hand side normalised the *literal placeholder* `$1`, not
`registration_number`. `pool.query` was called with no values, so PostgreSQL
raised `there is no parameter $1`. The reviewer's focused run showed:

```text
pnpm --filter @echallan/api exec vitest run --project integration \
  tests/integration/f01-corrections.test.ts -t "returns exactly one row for a normalised lookup"
  Tests  1 failed | 16 not run, exit 1
  error: there is no parameter $1 (line 201)
```

So the earlier claim that this assertion "returned two rows" was **not supported by
the pinned test's actual query**. That claim is withdrawn.

### Corrections applied

1. **The lookup is now a genuine bound, row-specific normalised query.** The
   canonical form became a function over an operand, so the *same* transformation
   is applied to the table column and to a bound parameter:

   ```ts
   const canonicalRegistration = (e: string) => `upper(regexp_replace(${e}, ${String.raw`'\s'`}, '', 'g'))`;
   const canonicalGatePass = (e: string) => `upper(btrim(${e}))`;

   SELECT count(*)::int AS n FROM vehicles
     WHERE upper(regexp_replace(registration_number, '\s', '', 'g'))
         = upper(regexp_replace($1, '\s', '', 'g'))
   -- values: ['tn09bk3542']
   ```

   The approved vehicle and pass rules are still applied **separately**:
   registration strips all whitespace, gate pass trims only.

2. **Every diagnostic mutation is now transactional and rolled back.** A
   `diagnostic()` helper runs each probe on its own `PoolClient`, begins a
   transaction, captures the outcome, and rolls back in a `finally` block. This
   fixes three things at once: successful mutations no longer pollute the shared
   test database, the lookup case no longer depends on a preceding failing test,
   and a refused statement cannot leave the transaction unusable for the next
   query. Each refusal gets its **own** transaction, because PostgreSQL aborts a
   transaction on statement failure and a follow-up query would otherwise fail
   with `25P02` and be misread as an invariant result. The outcome is inspected
   *before* the rollback.

3. **Counts corrected.** Vitest reports **17 executed cases from 15 methods**; the
   severity `it.each` contributes 3. The earlier "17 methods / 19 iterations" was a
   descriptive error. No code was changed merely to match a count.

4. **RED evidence reclassified**, as above: 7 failures are behavioural
   (accepted-invalid-data) and 5 are relationship-surface absence (`42703`).
   The record no longer implies the R3 cases prove a behavioural constraint.

Final pinned state:

```text
885ea083e99decefc19d1ce4076e5a938c817274c1b461215a86e78a96ca7a65  apps/api/tests/integration/f01-corrections.test.ts
df5cc66b95d4304235e0a6428dc276b36fce24c136b8415bcce6ca3887bf4d20  docs/handoffs/F-01-corrections-tests.sha256
```

The original 14-entry baseline and every original acceptance assertion remain
byte-identical and verified. No production code, migration or applied history was
edited at any point during preparation or this correction.

## Boundaries for the implementer batch

Full A–E batch scope is in `docs/handoffs/F-01-corrections-request.md`. Binding
constraints for this correction work:

- Do not edit `apps/api/tests/integration/f01-domain.test.ts`,
  `apps/api/tests/unit/f01-contracts.test.ts`,
  `apps/api/tests/unit/f01-api-validation.test.ts`,
  `apps/api/tests/integration/f01-corrections.test.ts`, or either SHA-256 manifest.
- Do not edit `docs/eChallan_replacement_spec.md`, `docs/decisions.md` or
  `docs/demo-data.json`.
- Do not rewrite `0000_stormy_namor.sql`, `0001_curvy_squadron_supreme.sql` or
  `0002_groovy_charles_xavier.sql`, or edit an applied journal entry. `0001`/`0002`
  are already applied to the demo database, so repair with **new incremental
  migrations** and a safe check/backfill order that preserves valid existing data
  and stable seed IDs.
- If a corrective constraint collides with existing real data, **return the
  concrete conflicting rows** for resolution. Do not silently merge or delete rows
  to make a migration succeed.
- Do not add mocked substitutes for PostgreSQL invariants, do not skip tests, and
  do not narrow a failing assertion to reach green.
- Every correction probe runs in its own rolled-back transaction and inspects the
  SQLSTATE before rollback. When proving sensitivity, reproduce that: a refused
  statement must not be allowed to cascade a `25P02` into the next assertion.
- Do not tick `Reviewed`, do not self-review, and do not advance to F-02.

## Expected counts for the implementer

| Suite | Today | After the batch |
|---|---|---|
| correction acceptance | 12 failed / 5 passed (17) | **17 passed, 0 failed** |
| `pnpm test:integration` | 12 failed / 26 passed (38) | **38 passed** (up from 21) |
| `pnpm test` | 74 | **at least 74**, reported honestly |
| `pnpm test:e2e` | 7 | 7 (unchanged unless a browser journey is genuinely affected) |
| `pnpm test:foundation` | 27 | 27 |

The old 74/21 counts must **increase** by the new meaningful cases; report the real
numbers and never a narrowed or skipped check.

## Reviewer note

The next independent review should re-run both SHA-256 manifests, the focused
correction suite, the staged R1/R2/R3 fault mutations, the original acceptance
suite, and the full regression gates; confirm `0000`/`0001`/`0002` remain
byte-identical while new corrective migrations were appended; confirm the four
documentation corrections are accurate without erasing the contract-TDD
disclosure; and treat the corrected evidence in `docs/handoffs/F-01.md` as part of
the acceptance surface.

---

## Addendum 3 — follow-up review revision, 2026-10-02 (planner)

Prepared after `docs/reviews/F-01-correction-followup.md` returned
**CHANGES_REQUIRED**. That review was correct on every point, including the
correction to my own earlier conclusion. This revision adds
`apps/api/tests/integration/f01-legacy-upgrade.test.ts` and revises three R3 cases.

### Item 4 — corrected mutation interpretation (recorded, not testable)

My previous request stated that faults **F, G and H must each fail independently**
before acceptance. **That was wrong and is withdrawn.** Redundant enforcing
constraints are not a verification defect: if removing one clause leaves behaviour
correct, the remaining path still guarantees the invariant and a passing test is the
*correct* result. The composite `(gate_id, location_id)` foreign key necessarily
implies gate existence, so dropping the simple gate FK cannot be expected to break
reference integrity.

The meaningful mutations are therefore:

- location consistency → remove the **whole enforcing path** for that invariant;
- reference integrity → remove **all** FKs that enforce it;
- cardinality → assert the intended policy in both directions.

A constraint must not be weakened and no contrived assertion added merely to make a
redundant fault individually fail.

### Item 2 — post/gate cardinality is NOT automatically approved

The review is right that "each post resolves one gate" does not imply "each gate has
one post". Checking the approved sources:

- `docs/eChallan_replacement_spec.md` §4: "Location/gate/post | Required
  attribution | **Authorised current post determines actual issuance location/gate**";
- §7: "A marshal session is bound to a configured tablet post and selected active
  shift";
- §8: "Marshals issue only at their authorised posts".

All three constrain **post → gate**. **None** constrains how many posts a gate may
serve, and the demo fixture's 1:1 shape is incidental. Two tablets at one gate is
legitimate operational data, so `posts_gate_id_unique` is an **unapproved extra
restriction**, not an invariant of the approved model.

**Planner decision: the approved cardinality is many posts per gate.** The
delivered `UNIQUE(gate_id)` must be removed through a later migration rather than
described as approved. The new case
`allows several posts to share one gate, per the approved post-to-gate cardinality`
pins that policy, and the existing two-gates case now asserts only that **each post
resolves exactly one gate** — injectivity is deliberately not asserted.

### Item 1 — isolated location-consistency acceptance

The old cross-location case chose `gate-01`, which `DEMO-POST-01` already claimed, so
`posts_gate_id_unique` could refuse the insert and mask the invariant. It now uses a
**freshly created unclaimed gate at the other location** (`loc-dispatch`), asserts
that no post references it, and requires the refusal code to be `23503`/`23514`.
`23505` is **excluded on purpose**: a unique violation would prove only that an
unrelated constraint fired.

### Item 3 — real legacy-upgrade acceptance

New `apps/api/tests/integration/f01-legacy-upgrade.test.ts` (2 methods) drives the
**real** `runMigrations` entrypoint from a genuine legacy state built by applying only
migrations 0000–0002 into the guarded isolated test database, asserting that level
genuinely has no `posts.gate_id` column. It covers:

- **ambiguous legacy mapping** (one location, two gates, one unmapped post) must be
  **refused** with a diagnostic, and no gate may be associated with the post;
- **unambiguous legacy mapping** upgrades cleanly, retains pre-existing rows
  including a `foundation_demo_fixture` row, and is **idempotent** on repeat runs.

### Recorded RED against the current code

```text
pnpm --filter @echallan/api exec vitest run --project integration \
  tests/integration/f01-corrections.test.ts tests/integration/f01-legacy-upgrade.test.ts
  Test Files  2 failed (2)
  Tests       2 failed | 18 passed (20), exit 1

FAIL f01-legacy-upgrade.test.ts > refuses an ambiguous legacy post/gate mapping
     AssertionError: an ambiguous legacy post/gate mapping must be refused,
     not silently resolved: expected undefined to be defined

FAIL f01-corrections.test.ts > allows several posts to share one gate
     error: duplicate key value violates unique constraint "posts_gate_id_unique"
```

Both are genuine behavioural RED, each for one of the two real defects. The
isolated location-consistency case now **passes** today: the location FK already
refuses the unclaimed cross-location insert with `23503`, so that assertion is a
strengthening rather than a new requirement.

### Three planner test bugs found and fixed during this revision

Recorded because each would otherwise have produced a misleading result:

1. The positive legacy-upgrade case queried `posts.demo_source_id`, which the legacy
   inserts never populated, so it returned zero rows and failed for the wrong reason.
   It now queries by primary key.
2. The isolated cross-location case initially created the probe gate at the **same**
   location as the post, so there was no cross-location violation at all and the
   insert was correctly accepted. It now places the gate at `loc-dispatch`.
3. The first version of that case used a promise `.then(onFulfilled, onRejected)`
   chain around an `expect.unreachable`, which inverted the assertion. It now
   captures the outcome explicitly inside one rolled-back transaction.

### Pinned state

```text
apps/api/tests/integration/f01-corrections.test.ts   revised (16 methods, 18 cases)
apps/api/tests/integration/f01-legacy-upgrade.test.ts new    (2 methods,  2 cases)
```

Both baselines remain additive: the original 14-entry
`docs/handoffs/F-01-tests.sha256` is byte-identical, and
`docs/handoffs/F-01-corrections-tests.sha256` gains one entry for the new file with
its revision history retained.

### Expected results for the implementer

| Suite | Now | After the fix |
|---|---|---|
| correction + legacy focused | 2 failed / 18 passed (20) | **20 passed** |
| `pnpm test:integration` | 2 failed / 38 passed (40) | **40 passed** (from 21 at F-01 acceptance) |
| `pnpm test` | 74 | 74 (new cases are integration-only) |
| `pnpm test:e2e` | 7 | 7 |
| `pnpm test:foundation` | 27 | 27 |

The implementer must repair the **supported** upgrade path so the ambiguity is
detected **before** the existing `0003` backfill can choose a gate, without
rewriting applied migrations, and must add a migration removing
`posts_gate_id_unique`. Same-session preparation and implementation is a
**disclosed process deviation** authorised by the user; it is not evidence of
independence, and a separate reviewer is still required.

---

## Addendum 4 — legacy shared-gate upgrade, 2026-10-03 (planner)

Prepared after `docs/reviews/F-01-latest-correction-review.md` returned
**CHANGES_REQUIRED** for one remaining case: valid legacy shared-gate data cannot
upgrade. Contracts, R1/R2 identity and severity constraints, seed provenance and
attribution modelling stay exactly as they are; this is a targeted migration-path
correction, not a restart of F-01.

### New acceptance case

`apps/api/tests/integration/f01-legacy-upgrade.test.ts` gains
`upgrades a legacy shared-gate mapping: one gate serving two posts, with foundation
data retained`, built on the **actual 0000–0002 schema** (one location, exactly one
gate, two posts, a `foundation_demo_fixture` row). It requires the upgrade to
succeed, both post IDs to be preserved in order, both to resolve the shared gate, the
foundation row to survive, and a repeat `runMigrations` to be idempotent. The
ambiguous two-gates rejection case is unchanged.

### Recorded RED before the fix

```text
pnpm --filter @echallan/api exec vitest run --project integration \
  tests/integration/f01-legacy-upgrade.test.ts
  Tests  1 failed | 2 passed (3), exit 1

FAIL upgrades a legacy shared-gate mapping...
  AssertionError: a legacy shared-gate mapping is valid data under the approved
  cardinality and must upgrade: expected Error: Failed query:
    ALTER TABLE "posts" ADD CONSTRAINT "posts_gate_id_unique" UNIQUE("gate_id");
```

This matches the reviewer's independent probe exactly.

### Planner-approved migration strategy (authorised here, applied by the implementer)

The review is right that a further appended constraint drop cannot work, because
execution never reaches `0005`. A runner-based repair cannot work either: the failing
statement is inside `0003` itself. So a **controlled compatibility amendment of two
historical migration files** is the only mechanism that repairs the complete path.

**1. `0003` — remove the never-approved statement**
`ALTER TABLE "posts" ADD CONSTRAINT "posts_gate_id_unique" UNIQUE("gate_id");`

It was never an approved invariant: the approved specification constrains post → gate
only. While it sat in the chain, a legacy location with one gate and two posts was
unambiguous, yet the `0003` backfill bound both posts to that one gate and this
constraint then rejected them.

**2. `0005` — `DROP CONSTRAINT IF EXISTS "posts_gate_id_unique"`**

Necessary for correctness, not cosmetic: `0003` no longer creates the constraint, so
on a fresh database `0005` must no-op, while a database that applied the *original*
`0003` must still have it removed. Without `IF EXISTS` the fresh path fails at `0005`.

**Why amending applied SQL is safe, verified not assumed.** drizzle-orm selects
pending migrations with `Number(lastDbMigration.created_at) < migration.folderMillis`
(`drizzle-orm/pg-core/dialect.js`), never by content hash, and `folderMillis` is the
journal `when` value. An already-applied migration is therefore never re-executed.
The ledger stores `sha256(file content)` (`drizzle-orm/migrator.js`), so the recorded
hash for `0003` remains the **pre-amendment** hash — the divergence between the
ledger hash and the file hash *is* the audit record of this amendment.

**Explicitly not done:** no post deleted or merged, no gate cloned, no migration
ledger cleared, no demo database reset, no approval invariant weakened, and the new
positive case was not softened into a rejection.

### Expected results

| Suite | Before | After |
|---|---|---|
| legacy focused | 1 failed / 2 passed (3) | **3 passed** |
| `pnpm test:integration` | 41 | **42** |
| `pnpm test` | 74 | 74 (new case is integration-only) |
| `pnpm test:e2e` | 7 | 7 |
| `pnpm test:foundation` | 27 | 27 |

Baseline revision 5 pins the revised legacy test file and the two amended migration
files, with the amendment rationale and the pre/post hashes recorded in the manifest
header. The original 14-entry `docs/handoffs/F-01-tests.sha256` stays byte-identical.

Preparation and implementation ran in the same session at the user's explicit
instruction: a disclosed deviation that does not substitute for independent review.
