# F-01 prepared planner handoff

Prepared: 2026-10-02, planner session following consolidated owner approval of
`docs/eChallan_replacement_spec.md` v0.1. Parent: F-01, both boxes unchecked.
Feature: `specs/002-demo-domain`; active feature state selects this directory.
Scope: demo contracts, internal API validation adapter, relational migration and
synthetic domain seed adapter. Cases: DOM-01–DOM-03. No F-02 or issuance/UI work.

## Preconditions and approval

- S-01 independently reviewed PASS; accepted source snapshot and planner baseline
  both verified unchanged during this preparation.
- B-01/B-02/D3/D5 and demo B-04/B-05/B-06 are resolved in the decision register.
  Original Functional Specification v0.2 is unavailable. The approved replacement
  is the source of authority; do not invent unavailable document contents.
- Production gate-pass sourcing, hosting/device sign-off and detailed E-01–E-03
  media parameters remain separate later-task gates, not missing prerequisites
  for these bounded demo contracts and relationships.
- PostgreSQL demo/test containers are available. Tests reset only the guarded
  `TEST_DATABASE_URL` database. Do not run destructive resets against demo data.

## Planner-owned acceptance files

| File | Cases and assertions | Tests |
|---|---|---|
| `apps/api/tests/unit/f01-contracts.test.ts` | DOM-01: canonicalisation, signed/refused shapes, required fields, forged authority, distinct violations/photo IDs, 1–4 photos, remarks, strict vocabulary, transition request shape, severity and recommendation helpers | 32 |
| `apps/api/tests/unit/f01-api-validation.test.ts` | DOM-01: internal API consumes shared parsing and returns the canonical object | 2 |
| `apps/api/tests/integration/f01-domain.test.ts` | DOM-02/03: empty migration, actual S-01 upgrade with retained row, seed idempotence/identity, zero-history/shared vehicle cases, target guard, SQL unique/FK/enum constraints, snapshots and real rollback | 11 |

No skipped or placeholder success tests. These files use the installed API
Vitest project globs. No root/application package, API implementation, production
contract or migration file was edited by the planner. The original synthetic
fixture and S-01 acceptance files are intact.

Baseline: `docs/handoffs/F-01-tests.sha256`; verify before implementation and
review. Includes acceptance tests, read-only feature spec/plan, this preparation,
approved replacement/decisions, source fixture/catalogue, integration project
config and the preserved foundation migration/baseline records. Mutable feature
tasks and implementation evidence are excluded. Do not regenerate this manifest
to fix a failure; return test defects to the planner with concrete evidence.

## Exact focused commands and recorded RED

```bash
sha256sum -c docs/handoffs/F-01-tests.sha256
pnpm build:packages
pnpm --filter @echallan/api exec vitest run --project unit tests/unit/f01-contracts.test.ts tests/unit/f01-api-validation.test.ts
pnpm db:up
pnpm --filter @echallan/api exec vitest run --project integration tests/integration/f01-domain.test.ts
```

Actual focused unit run: **2 files, 34 tests failed**, exit 1. Contracts lack the
new exports, producing e.g. `F-01 surface absent: ChallanSubmissionSchema`;
the API adapter reports `F-01 API adapter surface absent`. This is explicit
surface-absence RED, **not** demonstrated rejection behaviour or a claimed
behavioural TDD assertion failure.

Actual focused real-DB run: **1 file, 11 tests failed**, exit 1. PostgreSQL answers
successfully, but `pg_tables` contains only `foundation_demo_fixture`, failing
the required domain-table assertion. The actual S-01-upgrade fixture executes
the original migration through Drizzle in a temporary migration directory, then
the current full migration set; it fails because no domain migration exists.
The seed guard also reports the absent domain seed adapter. These are schema/
surface-absence failures, not an unavailable DB or claimed constraint sensitivity.

**Required behavioural RED stage:** after exporting the schemas and wiring the
domain migration/adapter, run these same unchanged tests before completing all
rejection rules and SQL constraints. Record the actual failing malformed-payload,
uniqueness/FK/snapshot/idempotence assertions. Missing exports/tables alone cannot
be reported as that evidence. Use a disposable-copy fault-sensitivity run to
verify that acceptance remains load-bearing after GREEN.

CLI note: exploratory `pnpm ... run test -- <files>` sent a literal `--` through
to Vitest and did not narrow the suite in this environment. That run had 34 new
unit failures + 24 existing API passes, and the integration run had 11 new
failures + 10 existing passes. The explicit `exec vitest ... <files>` commands
above were rerun and verify the honest focused counts (34 and 11).

## Preparation checks actually run

- `pnpm exec prettier --write` on the three new planner test files, before freezing
  their hashes; no pre-existing acceptance file was reformatted.
- `pnpm lint`: PASS; boundary gate scans 56 files.
- `pnpm typecheck`: PASS, including the new tests and all five projects/e2e.
- `pnpm format:check`: PASS.
- Explicit Spec Kit prerequisite check with feature directory and no persistence:
  PASS, returning `specs/002-demo-domain` and `tasks.md`.
- `sha256sum -c docs/handoffs/S-01-tests.sha256`: 11/11 OK.
- `sha256sum -c docs/reviews/S-01-accepted.sha256`: all accepted entries OK.
- `pnpm db:up`: both local PostgreSQL containers healthy.

New acceptance files intentionally make broad API/unit/integration gates RED
until F-01 is implemented. The foundation correction suite's clean-workspace
`pnpm test` check also includes these new domain tests and is therefore expected
to be RED at this prepared checkpoint. Do not weaken that foundation check to
exclude new work. Its full GREEN is required before implementation completion.

## Implementer verification and stop

Use the spec's exact exported/schema/SQL/seed interfaces. Preserve the foundation
table and append a new migration; do not rewrite `0000_stormy_namor.sql` or its
applied history. Keep the original foundation seed adapter and add a separate
domain seed entry/command. Do not fake usable evidence from fixture photo counts.
List all relational fields/FKs/indexes and synthetic-history mapping decisions
in the implementer evidence; request planner correction for any contract conflict.

After focused GREEN: format check → lint → typecheck → root units and real DB
integration → existing browser checks → all affected production builds → tablet
size. Run `pnpm test:foundation`; all 27 cases must pass, including clean-artifact
root unit execution. Expected unchanged browser count remains 7. Root unit count
is at least 74 (existing 40 + new 34), DB count at least 21 (existing 10 + new 11);
report additional meaningful tests honestly.

In a disposable copy, bypass a payload rejection and a relevant SQL uniqueness/
FK constraint; show the specific corresponding acceptance test fails. Restore
and obtain clean results. No acceptance baseline edits or mocks for DB invariants.

Write `docs/handoffs/F-01.md` with exact RED/GREEN counts, migration/seed effects,
failure sensitivity, regression results, unchanged planner hashes and limitations.
Record foundation changes against the existing accepted snapshot; do not replace
its hashes yourself. Tick only F-01 implementation and matching feature tasks
when everything passes. Request independent review and stop before F-02.
