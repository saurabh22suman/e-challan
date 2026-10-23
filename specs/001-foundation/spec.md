# S-01 — Executable development foundation

Status: prepared for implementation, 2026-10-01. Parent task: S-01.
Sources: PRD technical design, SET-01–SET-04 and project constitution.

## Outcome

A new developer can install a pinned workspace, start isolated PostgreSQL,
build three deployables, run meaningful tests and use browser/API development
servers through documented commands. The long-running implementer completes the
six phases in tasks.md, optionally using disjoint parallel workers, then stops
for this session's independent review. No domain or operational readiness is implied.

## Acceptance contracts

- Five private packages: @echallan/api, @echallan/tablet, @echallan/admin,
  @echallan/contracts and @echallan/theme in the PRD locations. Use workspace
  dependencies, strict TypeScript and independent build artifacts.
- Exact root command interface: dev, format:check, lint, typecheck, test,
  test:integration, test:e2e, test:foundation, build, check:boundaries,
  check:tablet-size, db:up, db:down, db:migrate and db:seed:demo. Commands execute
  real tools and propagate failure; no placeholder success scripts or zero-test passes.
- Root .env.example defines DATABASE_URL, TEST_DATABASE_URL, PORT=3001 and
  API_ORIGIN=http://127.0.0.1:3001. Explicitly load the env in API, migrations and
  integration runner. Distinct local dev/test DBs; test runner refuses non-_test DBs.
  No production credentials. Frontends proxy /api or use an explicit nonsecret
  VITE_API_ORIGIN; ensure the two dev origins can reach the API without wildcard
  production CORS assumptions.
- API: createApp factory usable with Fastify inject, separate executable entry;
  GET /health returns 200 {status:'ok'} without a DB dependency. GET /health/ready
  queries actual PostgreSQL and returns 200 {status:'ok',database:'ok'} or 503
  on connection failure; do not fake database readiness.
- Shared contracts exports the health schemas. Shared theme exports a minimal
  createAppTheme compatible with tablet/admin; full design-system implementation
  remains F-04. Each Vite app renders a clearly labelled foundation screen, imports
  shared contracts/theme, and has at least one lazy route. No login or challan form.
- PostgreSQL 16 local container(s) with named volumes and health checks. Demo/dev
  database is separate from test database. Drizzle migration/seed harness can use
  a clearly labelled foundation demo-fixture table holding the synthetic JSON;
  this is harness plumbing, not an approved production domain schema. Store no
  invented domain business rules. Seed imports existing docs/demo-data.json,
  is repeatable and refuses targets not explicitly configured as local demo/test.
- Tests: actual shared-schema unit test, actual React component interaction test
  per app, Fastify response checks, real PostgreSQL insert/read/cleanup and a
  browser check per frontend. Assert meaningfully; prove intentionally altered
  response/expectation fails. No production data, blanket mocks or committed skips.
- Boundary command accepts --root <workspace>, default current repo. Inspect
  import/export/dynamic-import string literals and reject app-to-app imports,
  MUI/icon barrels in tablet/shared client code, and tablet admin-only widgets.
  Accept shared imports and exact component paths. CLI fixture mode is dev tooling,
  not application behaviour. SET-03 negative tests use temporary fixtures.
  Root lint invokes the boundary gate; a standalone unused checker is insufficient.
- Size command accepts --dist <directory>, default apps/tablet/dist. Read Vite
  .vite/manifest.json, select initial entry, traverse static imports, gzip and sum
  unique initial JS files; exclude lazy dynamic routes. Fail at >=250000 bytes,
  missing/malformed manifest or missing asset; report initial bytes and threshold.
  Enable manifest generation in tablet's production Vite build.
- CI with pnpm frozen lockfile, Node22, PostgreSQL service, browser provisioning,
  and all relevant gates including planner-owned foundation checks. Initial CI
  can run full workspace; affected-package optimisation is not necessary here.

## Exclusions and unresolved decisions

No auth, issued records, escalation, final master-data schema, offline syncing,
production deployment or VPS access. B-01/B-02/D3/D5/B-04/B-05/B-06 remain open.
These do not block the explicitly infrastructure-only S-01 scope.

## Planner-owned verification

`tests/foundation/test_workspace.py`, `test_guards.py` and `probe-api.mjs` are
read-only acceptance inputs to the implementer. Hash baseline lives in
docs/handoffs/S-01-tests.sha256. If a test is defective, report it here; do not
weaken the assertion or regenerate the baseline. Root test:foundation executes
both Python suites with Python3.11+.

Smoke checks validate scaffolding; they do not claim TDD RED for domain behaviour.
The implementer additionally writes executable test-harness samples before their
implementation and records meaningful RED/GREEN and failure sensitivity.
