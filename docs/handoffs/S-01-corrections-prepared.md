# S-01 review-correction preparation (planner-owned)

Prepared by the planner/test-owner session, 2026-10-02, after the independent
review `docs/reviews/S-01.md` returned **CHANGES_REQUIRED** with findings R1–R4.
Parent task: **S-01** (still `Implemented` unchecked, `Reviewed` unchecked).
Feature: `specs/001-foundation`.

This record authorises **no production change and no approval**. It adds the
executable acceptance checks the review asked for, records their current RED
results, and hands R1–R4 back to an implementer session.

## What changed in planner-owned files

| Path | Change |
|---|---|
| `tests/foundation/test_review_corrections.py` | **New.** 11 test methods (13 subtests) covering R1–R4. Read-only: it never writes to the repository. |
| `docs/handoffs/S-01-tests.sha256` | **One line appended** for the new test file. The 10 pre-existing lines are byte-identical and still verify. |
| `docs/handoffs/S-01-corrections-prepared.md` | **New.** This record. |
| `docs/handoffs/S-01-prepared.md`, `tests/foundation/test_workspace.py`, `tests/foundation/test_guards.py`, `tests/foundation/probe-api.mjs`, `docs/handoffs/foundation-batch.md`, `specs/001-foundation/{spec,plan,research}.md`, `docs/test-cases.md`, `docs/demo-data.json` | **Unchanged.** Verified by hash. |

Baseline revision, as required before any implementer starts:

```text
old baseline file sha256: fe050361e22b6605882b2d7abf301af3bb6f039fef1ce094b15c7cd383832868
new baseline file sha256: e460d2aa4b560d5262efccd3cb3f6e897d11cdbf7dec58c17716fc8805304092
appended entry: 5f84ea8f3e0a6d7ad65b16b34719b5b06153eef62f74b7a96eaf4868fee0ec10  tests/foundation/test_review_corrections.py
sha256sum -c docs/handoffs/S-01-tests.sha256   -> 11/11 OK
```

No existing assertion was weakened, relaxed or deleted; no `.skip` was added.
Preparation history (`S-01-prepared.md`) and implementation history
(`S-01.md`) are untouched.

## Focused commands and expected counts

Run from the repository root with Python 3.11+ and a warm pnpm store. R1 and R4
create a disposable workspace copy under the system temporary directory with
`shutil.copytree` (excluding `node_modules`, `dist`, `.env`, `*.tsbuildinfo`),
run a real `pnpm install --frozen-lockfile` inside it (offline first, network as
fallback) and delete it afterwards. They never write into the repository.

| Finding | Focused command | Cases | Expected after the fix | Actual now |
|---|---|---|---|---|
| R1 | `python3 -m unittest tests.foundation.test_review_corrections.R1CleanArtifactGateOrder -v` | 2 | 2 pass | **1 FAIL** (`typecheck`), 1 pass (`test`) |
| R2 | `python3 -m unittest tests.foundation.test_review_corrections.R2AppPackageSubpathBoundaries -v` | 3 methods / 11 subtests | all pass | **6 subtest FAIL**, 2 methods pass |
| R3 | `python3 -m unittest tests.foundation.test_review_corrections.R3SurfaceSpecificWidgetRestrictions -v` | 3 methods / 15 subtests | all pass | **6 subtest FAIL** (admin), 2 methods pass |
| R4 | `python3 -m unittest tests.foundation.test_review_corrections.R4LazyRouteCodeSplitting -v` | 3 methods / 6 subtests | all pass | 3 pass (current source is genuinely lazy); the evidence claim was false — see below |
| all | `pnpm test:foundation` | 27 tests | 27 pass, 0 failures | **13 failures** (R1 1, R2 6, R3 6), 95 s |

Regression gates the implementer must also rerun: `pnpm format:check`,
`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm check:tablet-size`,
`pnpm db:up && pnpm db:migrate && pnpm db:seed:demo && pnpm test:integration`,
`pnpm test:e2e`.

## The checks, and the failure each one detects

### R1 — `R1CleanArtifactGateOrder`

Copies the workspace without any generated artifact, asserts that no `dist/`,
`.env` or `*.tsbuildinfo` exists, installs from the committed lockfile and then
runs the documented gates.

- `test_documented_typecheck_gate_succeeds_without_generated_artifacts` — currently
  RED with the reviewer's exact failure:

  ```text
  src/App.tsx(8,43): error TS2307: Cannot find module '@echallan/theme' or its
      corresponding type declarations.
  src/routes/FoundationScreen.tsx(8,37): error TS2307: Cannot find module
      '@echallan/contracts' ...
  src/app.ts(8,8): error TS2307: Cannot find module '@echallan/contracts' ...
  [ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] @echallan/admin@0.1.0 typecheck ... Exit status 2
  ```

  The check does not prescribe a fix shape: any arrangement that makes
  `pnpm typecheck` self-sufficient from a clean checkout (build prerequisite in
  the root script, a `pretypecheck` hook, or gate reordering in CI *and* the root
  script) satisfies it.
- `test_documented_unit_test_gate_succeeds_without_generated_artifacts` — currently
  green (`pnpm test` already builds shared packages first); it guards that gate.

### R2 — `R2AppPackageSubpathBoundaries`

Temporary fixture workspace, `pnpm run check:boundaries --root <fixture>`.
Requires rejection of app packages both bare and as slash-delimited subpaths,
across static imports, re-exports and literal dynamic imports:
`@echallan/admin/src/App`, `@echallan/api/dist/server.js`,
`@echallan/tablet/e2e/foundation.spec`, `export { x } from '@echallan/api/src/app.js'`,
`import('@echallan/tablet/src/App')`, `export * from '@echallan/admin/src/index'`.
Bare-name cases stay rejected, and bare `@echallan/contracts` / `@echallan/theme`
stay accepted (shared subpath depth is explicitly *not* asserted here; it is an
export-map concern for F-01). Currently 6 of these 11 subtests FAIL because
`APP_PACKAGES.includes(specifier)` only matches the exact name.

### R3 — `R3SurfaceSpecificWidgetRestrictions`

Same fixture mechanism. `@mui/x-data-grid`, `@mui/x-charts` and
`@mui/x-date-pickers` (bare and with a subpath) must be **accepted inside
`apps/admin`** and still **rejected in `apps/tablet`, `packages/theme` and
`packages/contracts`**. Currently the 6 admin subtests FAIL; the 6 tablet/shared
subtests pass.

### R4 — `R4LazyRouteCodeSplitting`

Builds both production apps inside a disposable workspace and inspects the real
Vite manifest instead of trusting component behaviour:

- the route module (`src/routes/FieldNotesScreen.tsx`,
  `src/routes/ContractNotesScreen.tsx`) appears in the initial entry's
  `dynamicImports`, has its own manifest entry with `isDynamicEntry: true`, has a
  file different from the entry chunk, and that file exists on disk;
- the route module never appears in the initial entry's recursive **static**
  import graph;
- the app shell loads it through a literal `import('./routes/<Route>')`.

Sensitivity demonstration (disposable copy, not this repository):

```bash
cd /tmp/opencode/r4mut   # rsync copy without node_modules/dist, then pnpm install --offline
pnpm build:packages
# eager-import mutation in apps/tablet/src/App.tsx: drop `lazy` from the react
# import, add a static `import FieldNotesScreen from './routes/FieldNotesScreen';`,
# remove `const FieldNotesScreen = lazy(() => import('./routes/FieldNotesScreen'));`
pnpm --filter @echallan/tablet run build      # -> manifest has no dynamicImports
python3 -m unittest tests.foundation.test_review_corrections.R4LazyRouteCodeSplitting -v
```

Actual results in that mutated copy:

```text
pnpm --filter @echallan/tablet run test
  Test Files  1 passed (1)   Tests  4 passed (4)      <- app suite is blind to the mutation
python3 -m unittest ...R4LazyRouteCodeSplitting
  AssertionError: 'src/routes/FieldNotesScreen.tsx' not found in [] : tablet: the initial
      entry does not dynamically import src/routes/FieldNotesScreen.tsx; the route is
      bundled into the initial payload (R4)
  AssertionError: ... App.tsx does not load ./routes/FieldNotesScreen through a literal
      dynamic import, so the route cannot be code-split (R4)
  Ran 3 tests ... FAILED (failures=2)               <- the check detects the mutation
```

That is exactly the review's R4 point: conditional rendering alone proves
nothing, and the handoff's earlier claim that an eager-import mutation broke both
component suites is not reproducible. The implementer must correct
`docs/handoffs/S-01.md` (dated correction section; the original text stays) and
record this sensitivity run.

## Boundaries for the implementer

- S-01 scope only: build prerequisites/gate order, the boundary CLI, and the
  verification evidence. No domain feature, schema, decision, Git commit,
  deployment or F-01 work.
- Do not edit `tests/foundation/**`, `docs/handoffs/S-01-tests.sha256` or this
  record. A further test defect returns to the planner with a documented
  correction and reviewer confirmation.
- Keep `pnpm run check:boundaries` inside `pnpm run lint`, keep the tablet budget
  at 250000 gzip bytes, and keep the existing 27-test counts honest: report the
  real numbers, never a skipped or narrowed check.

## Reviewer note

The next independent review should re-run the clean-artifact sequence, the
boundary positive/negative fixtures and the R4 mutation demonstration, and should
treat the corrected R4 evidence in `docs/handoffs/S-01.md` as part of the
acceptance surface.
