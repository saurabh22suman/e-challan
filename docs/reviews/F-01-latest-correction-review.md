# F-01 latest correction review

Date: 2026-10-03. **Result: CHANGES_REQUIRED — one remaining legacy-upgrade case.**
Independent reviewer of the user-authorised same-session correction batch. No
production code, migration, planner test or frozen baseline was edited during
this review. Earlier reviews are retained unchanged because they are baseline
inputs. This report supersedes their disposition only for the findings listed
closed below; overall F-01 acceptance remains pending.

## Confirmed corrections

- Original baseline: **14/14 OK**; additive revision 4: **7/7 OK**.
- R1 canonical vehicle/pass identities and R2 required approved master severity
  remain correctly represented by DB constraints and real rejection tests.
- R3 post/gate association and location/attribution FKs are persisted; the
  cross-location test now uses an unclaimed gate and excludes unrelated UNIQUE
  errors. Redundant FK enforcement is interpreted correctly.
- The unapproved one-post-per-gate restriction is removed from the **final**
  schema by migration 0005; multiple posts sharing a gate pass final-state tests.
- The supported migration runner now refuses the previously reproduced
  ambiguous legacy mapping before running the guessing backfill. Independently
  reran the legacy probe with one location, two gates and one old post: the
  diagnostic identifies the post/location and two matching gates; no gate is guessed.
- Audit/UUID/seed wording and historical TDD/session deviations are honestly
  recorded; no new authentication/issuance/media or production-readiness claim.

The preflight's documented lack of a lock across migration is acceptable for this
bounded demo's single maintenance operation before seeding. This is not acceptance
of concurrent production migrations. The remaining finding below is a deterministic
valid-input upgrade failure, not a hypothetical concurrency concern.

## Remaining finding — Medium: allowed shared-gate legacy data cannot upgrade

References: `apps/api/drizzle/0003_certain_zarda.sql:23–24,41`;
`apps/api/drizzle/0005_complex_captain_flint.sql:1`;
`apps/api/src/db/migrate.ts:19–21,73–98`;
`apps/api/tests/integration/f01-legacy-upgrade.test.ts:160–200`.

The corrected cardinality allows several posts to resolve the same gate. The
legacy 0000–0002 schema also permits multiple posts at a location. When that
location has exactly one gate, every post maps unambiguously to that gate.

However, 0003 backfills all those posts and then creates
`UNIQUE(posts.gate_id)`. This rejects the legitimate shared gate. Migration 0005
would drop the restriction, but execution never reaches it. The preflight correctly
finds one gate for each post and cannot fix an intermediate migration restriction
by itself.

Independent real-DB reproduction:

```bash
pnpm --filter @echallan/api exec tsx /tmp/opencode/f01-ambiguous-upgrade-probe.mts --shared-gate
```

The probe builds the actual legacy database with only journal entries 0000–0002,
inserts one location, **one gate and two posts**, and calls the real `runMigrations`.
Actual result:

```text
Shared-gate legacy upgrade refused: Error: Failed query:
ALTER TABLE "posts" ADD CONSTRAINT "posts_gate_id_unique" UNIQUE("gate_id");
```

The probe uses only guarded `TEST_DATABASE_URL` and restores it to current empty
migrations afterward. No development/demo database or repository file was mutated.
The failure is safe (not silent corruption), but the promised unambiguous upgrade
does not succeed for the same supported cardinality that final-state tests allow.

Current positive legacy acceptance inserts only one post, so it misses the interaction
between backfill, an obsolete intermediate constraint and its later removal. A test
of the final schema alone cannot prove the historical migration chain works.

### Required next correction

Planner: add a positive **legacy shared-gate upgrade** acceptance case with two
posts at one location and exactly one gate. Require successful upgrade, preservation
of both post IDs, both gate associations, retained foundation data and repeat-run
idempotence. Keep the ambiguous-two-gates rejection case unchanged. Record meaningful
RED and a documented additive baseline revision.

Implementer: repair the complete supported upgrade path so it preserves this valid
data without deleting/merging posts, cloning gates or falsely rejecting it as
ambiguous. Merely appending another constraint drop after 0003 is insufficient.
Preserve auditable applied migration history; if the solution requires a controlled
compatibility revision of historical SQL rather than a runner-based repair, obtain
a documented planner-approved migration/baseline strategy first. Do not silently
edit old SQL, clear the migration ledger, reset the demo DB or weaken the new
positive case to rejection. Document the mechanism for existing and clean databases.

## Commands actually rerun

| Command | Result |
|---|---|
| `sha256sum -c docs/handoffs/F-01-tests.sha256` | 14/14 OK |
| `sha256sum -c docs/handoffs/F-01-corrections-tests.sha256` | 7/7 OK |
| `pnpm format:check` | Passed |
| `pnpm lint` | Passed; boundary scans 61 files |
| `pnpm typecheck` | All package/e2e checks passed |
| `pnpm test` | 74 passed: API 58, contracts 8, admin 4, tablet 4 |
| `pnpm db:up` | Both PostgreSQL containers healthy |
| `pnpm test:integration` | 41 passed in 6 files |
| `pnpm test:e2e` | 7 passed against the API and both Vite clients |
| `pnpm build` | All five workspace artifacts built |
| `pnpm check:tablet-size` | 139722 B gzip, below 250000 B |
| `pnpm test:foundation` | 27 passed in 100.934 seconds |
| Independent original ambiguous-upgrade probe | Correctly refused before guessing |
| Independent shared-gate legacy upgrade probe | Failed at obsolete 0003 UNIQUE, as above |

The new positive-path defect prevents acceptance, so the full implementer mutation
matrix was not independently repeated in this pass. Relevant meaningful fault
mutations and clean/full reruns are required after the final upgrade correction.
No hosted-CI, deployment, hardware, camera/signature or backup/restore sign-off is
claimed. No new accepted implementation snapshot is issued while this finding
remains open; earlier snapshots remain historical comparison records.

Key inspected snapshot hashes (not an acceptance approval):

```text
385ac1c43860971dacc59853d7a3812b66d264a41134a165871d8557cc3abd27  apps/api/src/db/migrate.ts
f56be97bf0bd10a5b09259ff62ae888119b4029d417c714d54d676ed3867c032  apps/api/src/db/schema.ts
90de4cdced192d0386a5f3b533b3b7795c8b28151976978a47541120576f5a58  apps/api/drizzle/0003_certain_zarda.sql
a34e4fd35625d02fb2515d37abd6cdea31530fe9ceff8f56879d75e658fec645  apps/api/drizzle/0004_lowly_power_man.sql
0e39b800a9bfb6eb835869e6be6172d94da1e577cea1af20c8daecd5f0707bf0  apps/api/drizzle/0005_complex_captain_flint.sql
aeb1634ac57a4770649e7a13fa6d0d0b5a186f3fd4c39702e258db8414016722  docs/handoffs/F-01-corrections-tests.sha256
```

## Gate disposition

Uncheck F-01 Implemented; leave Reviewed unchecked. Reopen T005/T007/T009/T010
for migration-path repair, the new acceptance case and final verification/handback.
Keep previously corrected contracts, seed provenance, R1/R2 and attribution
modelling evidence intact. This is a targeted upgrade correction, not a restart
of domain implementation. F-02 remains pending independent F-01 PASS and its
env-login planner handoff.
