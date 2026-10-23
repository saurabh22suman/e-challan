# Foundation implementation plan

Parent task S-01; scope and CLI contracts are in spec.md. Follow the exact
candidate pins and quirks in research.md, verifying with installation/builds.

## Wiring

- API: src/app.ts factory, src/server.ts process entry, db/migration plumbing,
  local environment bootstrap and /health plus /health/ready only.
- Frontends: React/Vite TypeScript entrypoints, exact-path MUI imports, shared theme,
  /api proxy, lazy foundation route. No reliance on any other app's source.
- Contracts: strict Zod health response contract; source/built package exports must
  work in both Vite and compiled Node API. Build packages before dependent apps,
  or configure a verified source-consumption development strategy.
- Database: PostgreSQL16 named dev/test DBs, guarded test reset/cleanup, isolated
  fixture migration. Existing Indian demo JSON is not a production-schema mandate.
- Tooling: root ESLint/formatter/TS config, workspace build ordering, boundary and
  manifest-based budget CLIs, separate unit/integration/browser suites and CI.

## Verification order

1. `sha256sum -c docs/handoffs/S-01-tests.sha256`
2. `python3 -m unittest discover -s tests/foundation -p 'test_workspace.py' -v`
3. Once installed: `pnpm test:foundation` (all 16 planner checks, plus subcases).
4. `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`
5. `pnpm db:up && pnpm db:migrate && pnpm db:seed:demo && pnpm test:integration`
6. Provision Playwright browser/system dependencies as documented; `pnpm test:e2e`.
7. `pnpm build && pnpm check:tablet-size`
8. Start `pnpm dev` on 127.0.0.1; run `node tests/foundation/probe-api.mjs`.
9. Prove readiness returns 503 with unavailable DB, invalid shared-schema payload
   rejected, isolated test-DB guard works, and test repeat run leaves no contamination.
10. Rerun baseline hashes, record commands/counts/RED/GREEN and finish S-01 only.

Commands in steps 3 onward are the required interface to implement, not commands
that currently exist. CI service env can override local defaults explicitly.

## Parallel ownership

Coordinator owns root configs/lockfile/scripts, Compose, CI, installation, evidence
and final integration. After root contracts are established, delegate:
- Backend worker: apps/api and DB plumbing, excluding root dependency edits.
- Frontend worker: apps/tablet, apps/admin, packages/theme.
- Contracts/verification worker: packages/contracts and additional application
  tests; never planner-owned tests/foundation inputs.

Each worker returns file list, commands and blockers. Disjoint writes only;
coordinate any shared-package interface before consumers start. Do not let workers
run independent pnpm installs or change the lockfile. Coordinator integrates and
runs full gates; internal worker review is not this session's independent approval.
