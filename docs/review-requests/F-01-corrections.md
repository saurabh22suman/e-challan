# Independent review requested: F-01 (corrections complete)

Task: **F-01 — Approved contracts and schema**, feature `specs/002-demo-domain`,
tasks T001–T010, acceptance DOM-01–DOM-03.

Authority: `docs/eChallan_replacement_spec.md` v0.1, owner-approved 2026-10-02, with
the dated resolutions in `docs/decisions.md`. The unavailable Functional
Specification v0.2 was not reconstructed.

Implementation evidence: **`docs/handoffs/F-01.md`** — three dated sections
(original, "Correction batch A–E", "Follow-up correction batch"). This request
supersedes `docs/review-requests/F-01.md` and
`docs/review-requests/F-01-corrections.md`, which asked for a planner correction
that is now complete.

**Disclosed process deviation:** preparation and implementation ran in the same
session at the user's explicit instruction. Hash pinning is not independence, and
this does not authorise self-review. No self-review was performed.

## Findings now closed

| Finding | Source | Status |
|---|---|---|
| R1 normalised SQL uniqueness | `docs/reviews/F-01.md` | Canonical CHECKs on `vehicles` and `gate_pass_records`; individually load-bearing (faults D, I) |
| R2 required master severity | `docs/reviews/F-01.md` | `NOT NULL` + strict approved-severity CHECK; load-bearing (fault E) |
| R3 persisted post/gate attribution | `docs/reviews/F-01.md` | `posts.gate_id` persisted, NOT NULL, location-consistency and reference FKs, challan attribution composite FKs; isolated (faults J, K) |
| Ambiguous legacy backfill guessed a gate | `docs/reviews/F-01-correction-followup.md` (High) | Pre-migration guard in `runMigrations` refuses before the guess; load-bearing (fault L) |
| Unapproved one-post-per-gate restriction | follow-up, item G | `UNIQUE(gate_id)` removed by migration 0005; approved cardinality documented and tested (fault M) |
| Audit append-only overclaim | `docs/reviews/F-01.md` | Documentation states storage shape only; enforcement remains R-06 |
| UUID "RFC 4122 v5" overclaim | `docs/reviews/F-01.md` | Corrected to a custom SHA-256 mapping, identities preserved |
| "Upsert" overclaim | `docs/reviews/F-01.md` | Corrected to insert-if-absent |
| Contract-TDD deviation | `docs/reviews/F-01.md` | Disclosure preserved verbatim, not weakened |

Baselines: `docs/handoffs/F-01-tests.sha256` **14/14**, byte-identical.
`docs/handoffs/F-01-corrections-tests.sha256` **7/7**, additive.

## Reviewer checklist

1. Verify **both** SHA-256 manifests. Confirm the original 14 entries, all original
   acceptance assertions, the approved specification, `docs/decisions.md` and
   `docs/demo-data.json` are unmodified.
2. Focus: unit **34**, correction + legacy **20**, integration **41**. Re-run:

   ```bash
   pnpm build:packages
   pnpm db:up
   pnpm --filter @echallan/api exec vitest run --project unit \
     tests/unit/f01-contracts.test.ts tests/unit/f01-api-validation.test.ts
   pnpm --filter @echallan/api exec vitest run --project integration \
     tests/integration/f01-corrections.test.ts tests/integration/f01-legacy-upgrade.test.ts
   ```

3. **Independently reproduce the ambiguous-legacy-upgrade defect being fixed.** Load
   only migrations 0000–0002 into the guarded test database, insert one location with
   two gates and one unmapped post, call the real `runMigrations`, and confirm it is
   refused with a diagnostic and that no gate was guessed. The committed test does
   this; a reviewer-side probe is worth running independently.
4. **Confirm the guard is a no-op where it should be**: a clean checkout, a repeat
   `pnpm db:migrate`, and the integration reset path all pass, and an unambiguous
   legacy mapping still upgrades with rows retained and idempotently.
5. **Judge the pre-migration guard's limitation honestly.** It runs before
   `migrate()` and is not a lock held across the migration, so a concurrent writer
   could introduce ambiguity in that window. The source comment states this. Decide
   whether the documented pilot workflow (migrate once, then seed) is acceptable for
   this demo or whether the check belongs inside the migration transaction.
6. **Confirm the cardinality decision traces to the approved model.** Sections 4/7/8
   of the replacement specification constrain post → gate only; verify no approved
   source requires one post per gate, and that removing `UNIQUE(gate_id)` is
   justified rather than a loosening.
7. **Confirm applied migration history is intact**: `0000`–`0004` byte-identical,
   `0003`/`0004` still the versions actually applied locally, and `0005` additive.
   Check that `0003`'s hand-reordering and backfill are documented and did not drop a
   generated statement.
8. **Re-run the mutation matrix** and judge it against the corrected interpretation:
   J (whole location-consistency path), K (all gate-existence FKs), L (guard
   disabled), M (unapproved uniqueness re-added), E (severity), D/I (canonical
   checks). Confirm that **redundant constraints are not required to fail
   individually** and that the handoff's earlier F/G/H conclusion has been corrected
   rather than quietly dropped.
9. Re-run the regression table: `format:check`, `lint`, `typecheck`, `test`
   (expect 74), `test:integration` (expect 41), `test:e2e` (expect 7), `build`,
   `check:tablet-size` (expect 139 722 B gzip), `test:foundation` (expect 27).
10. **Verify the corrected evidence claims.** The prepared record predicted 40
    integration cases and the actual total is 41; confirm the arithmetic (the revised
    correction suite contributes 18 executed cases from 16 methods) and that nothing
    was skipped or narrowed to reach it.
11. **Check the seed's insert ordering fix** (gates before posts, required by the new
    FK) and confirm repeat seeding still yields 10 drivers / 9 vehicles / 10 gate
    passes / 14 challans with **0 evidence and 0 signatures**.
12. Confirm the four documentation corrections are accurate, that the contract-TDD
    deviation disclosure survives, and that no later feature is claimed as built.
13. Confirm no F-02/F-03/F-04 or issuance work is implied, and no commit, push or
    deployment.

## State

F-01 `Implemented` is ticked by the implementer; T001–T010 are complete.
**`Reviewed` is deliberately unchecked** — only the independent reviewer ticks it.
F-02 remains blocked until this review passes. Its future scope is the env-backed
demo-login amendment in `docs/handoffs/demo-env-login-decision.md`, which must be
reconciled into F-02 planning and revised acceptance first; login alone must not be
represented as completing the deferred production credential-management
requirements.

## Targeted legacy-upgrade correction, 2026-10-03 (latest finding answered)

`docs/reviews/F-01-latest-correction-review.md` left one finding: valid legacy
shared-gate data could not upgrade, because `0003` created the never-approved
`UNIQUE(posts.gate_id)` and execution never reached the `0005` that dropped it.

Addressed as a targeted correction; contracts, R1/R2 constraints, seed provenance and
attribution modelling were not restarted.

1. **New positive acceptance** built on the actual 0000-0002 schema: one location, one
   gate, **two posts**, plus a `foundation_demo_fixture` row. Requires successful
   upgrade, both post IDs preserved, both posts resolving the shared gate, foundation
   data retained, and repeat-run idempotence. The ambiguous two-gates rejection case is
   unchanged. RED reproduced the reviewer's exact failure before the fix.
2. **Planner-approved compatibility amendment** (`F-01-corrections-prepared.md`
   Addendum 4): `0003` no longer creates the never-approved `UNIQUE(gate_id)`;
   `0005` became `DROP CONSTRAINT IF EXISTS`, which is required rather than cosmetic
   because a database that applied the *original* `0003` must still have the
   constraint removed while a fresh database must no-op. Both files carry dated
   in-file rationale, and one sentence in `0003` that the amendment made inaccurate
   was corrected rather than left to contradict it.
3. **Mechanism for existing and clean databases.** Verified in the installed
   migrator rather than assumed: drizzle-orm selects pending migrations by
   `created_at < folderMillis`, never by content hash, so already-applied migrations
   never re-run. The ledger therefore keeps the **pre-amendment** hashes for `0003`
   and `0005` — that divergence is the audit record of the amendment. Confirmed on the
   real demo database: six ledger rows unchanged, no re-run, no error, constraints and
   data intact.
4. **Proof the test detects the defect.** Mutations N (reinstate the obsolete
   constraint in `0003`) and O (revert `0005` to the non-`IF EXISTS` drop) each fail
   their intended case; both restored byte-for-byte with a clean rerun.
5. Nothing prohibited was done: no post deleted or merged, no gate cloned, no ledger
   cleared, no demo DB reset, no invariant weakened, and the positive case was not
   softened into a rejection.

Counts: legacy focused **3 passed**, `pnpm test:integration` **42**, root units 74,
e2e 7, foundation 27, tablet 139 722 B gzip. Baselines **14/14** and **10/10**
(revision 5).

**Decision requested from the reviewer.** Amending two already-applied migration files
is an audit trade-off: it is safe for execution and leaves a detectable ledger
divergence, but it means applied SQL no longer matches the recorded hash. If the
project prefers a fresh baseline with regenerated history, say so explicitly; that is
a strategy decision, not an implementer's discretion, so it was escalated rather than
assumed.

`Reviewed` remains unchecked. No self-review was performed, and F-02 stays blocked.
