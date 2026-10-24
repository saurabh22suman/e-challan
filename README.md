# e-Challan pilot — foundation (S-01), demo domain (F-01) and demo sign-in (F-02)

Gate e-Challan workspace for the marshal tablet PWA, the Fastify API and the admin
dashboard. The foundation, the synthetic demo domain and **demo authentication**
are implemented. A bounded Supervisor/Admin review slice adds the role-scoped
challan list, scoped detail with history, the approved Under Review/Resolved
transitions, Admin password reset, Admin user creation/deactivation, self-service
profiles and challan tracking history with the issuer. A bounded I-06 slice now
issues signed or refused challans atomically, stores captured evidence as local
files with database object keys, assigns the server number, audits creation and
makes retries idempotent. The Admin dashboard now adds authorised evidence
viewing, reason-required cancellation, server-side reporting totals/filters,
Excel export and master-data management. Deployment configuration now exists, but
there is still no deployed environment, real-device acceptance or offline queue.
Business rules stay undecided until the blockers in `docs/decisions.md` are
resolved (see `docs/eChallan_PRD.md` and the task plan in
`docs/implementation-plan.md`).

Demo sign-in (F-02) bootstraps one username/password account per role from the API
environment with opaque server-side sessions, exactly as approved in
`docs/eChallan_replacement_spec_v0.2.md`. Admin-created users and password resets store an
Argon2id hash in `users.password_hash`, revoke that user's sessions when required
and take precedence over the env credential at sign-in. Deactivation is the
approved removal model: the account and history are retained and all sessions are
revoked. Real-device or production credential operations are **not** built and
are not claimed.

```
apps/api        Fastify API, Drizzle migrations, guarded test database, demo seed
apps/tablet     marshal tablet PWA (sign-in, entry flow, media, submission, profile)
apps/admin      Supervisor/Admin dashboard (reporting, trend chart, review, evidence, users, masters, profile)
packages/contracts  shared Zod health, domain and authentication contracts
packages/theme      shared MUI theme tokens and touch-target constants
tools/           import-boundary and initial-JS budget command-line gates
tests/foundation planner-owned Python acceptance checks + Node API probe (read-only)
tests/e2e        coordinator-owned browser checks
```

## Prerequisites

| Tool   | Version    | Notes                                                |
| ------ | ---------- | ---------------------------------------------------- |
| Node   | 22.23.2    | `engines.node` pins `>=22.23.2 <23`                  |
| pnpm   | 11.22.0    | `packageManager` field; `corepack enable` also works |
| Docker | any recent | runs the two PostgreSQL 16 containers                |
| Python | 3.11+      | stdlib only, for `pnpm run test:foundation`          |

## Setup

```bash
pnpm install                    # workspace install from the committed lockfile
cp .env.example .env            # local values; already ignored by git
pnpm db:up                      # PostgreSQL 16 demo (5432) and test (5433) containers
pnpm db:migrate                 # apply generated migrations to DATABASE_URL
pnpm db:seed:demo               # load docs/demo-data.json (synthetic, repeatable)
pnpm db:seed:domain             # F-01 synthetic domain history (separate, idempotent)
```

Then fill in the six `DEMO_*` values in `.env` (see **Demo sign-in** below). The
API refuses to start while any of them is missing, blank or ambiguous, so
`pnpm dev` and `pnpm run test:e2e` need them.

`db:seed:domain` is deliberately separate from the foundation `db:seed:demo`: it
maps `docs/demo-data.json` onto the approved F-01 demo-domain tables so foreign
keys, uniqueness, snapshots and the 90-day repeat rule can be exercised against
real PostgreSQL. It is guarded against non-demo/test targets and is repeatable.
It seeds **no** evidence or signature rows, because the fixture's photo counts
and signature states are display metadata rather than real media. New tablet
submissions write their own evidence files and rows; seeded statuses, occurrence
numbers and action rows remain clearly marked synthetic history, not operational
issuance.

Stop and remove the containers and their volumes with `pnpm db:down`, and inspect
logs with `pnpm db:logs`.

## Environment

`.env.example` is the documented source of local values; existing process
variables win over the file, so CI overrides it explicitly.

| Variable            | Purpose                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `DATABASE_URL`      | development/demo database (`echallan_demo`)                                                  |
| `TEST_DATABASE_URL` | isolated test database; the integration runner refuses any name that does not end in `_test` |
| `PORT`              | API port (`3001`)                                                                            |
| `HOST`              | API bind address (`127.0.0.1` locally, `0.0.0.0` in containers)                              |
| `API_ORIGIN`        | non-secret API origin used by tooling                                                        |
| `EVIDENCE_ROOT`     | local evidence root for issued photos/signatures; defaults to `./var/evidence`               |
| `VITE_API_ORIGIN`   | non-secret browser-visible API origin; the Vite servers proxy `/api` to it                   |
| `DEMO_*_USERNAME`   | F-02 demo account username per role; **empty placeholders** in `.env.example`                |
| `DEMO_*_PASSWORD`   | F-02 demo account password per role; **empty placeholders** in `.env.example`                |

The API, the migration runner and the integration runner load this environment
explicitly from the workspace root `.env` (`apps/api/src/env.ts`), so `tsx`,
`node dist/server.js` and the test suites all see the same values.

## Demo sign-in (F-02)

One username/password account per approved role — Marshal, Supervisor, Admin —
configured **only** in the API server environment:

```text
DEMO_MARSHAL_USERNAME     DEMO_MARSHAL_PASSWORD
DEMO_SUPERVISOR_USERNAME  DEMO_SUPERVISOR_PASSWORD
DEMO_ADMIN_USERNAME       DEMO_ADMIN_PASSWORD
```

Rules the API enforces, not just the UI:

- Missing, blank or whitespace-only values stop the process at startup. Two roles
  sharing one username is refused as ambiguous. Nothing is ever defaulted.
- Each username must resolve to a seeded `users` row whose stored `role` equals
  the variable's role; a mismatch is refused, so no identity can gain a role.
- No role may be requested by a client, and there is no `VITE_`-prefixed
  credential: those would ship to the browser bundle.
- Passwords are compared in constant time, are never stored or hashed anywhere,
  and never appear in a response, a log line or an error message. An unknown
  username and a wrong password produce one indistinguishable refusal.
- Sessions are opaque 32-byte tokens; the database stores only the SHA-256 hash.
  Idle expiry is 600 s for a Marshal session and 3600 s for Supervisor/Admin, plus
  an absolute expiry. Logout revokes server-side. There is no refresh token.
- `GET /challans/:id` is a read-only scoped read: Admins read across locations,
  Supervisors within their assigned locations, Marshals only their bound post.

`pnpm run test:e2e` does **not** read your `.env` for these values: Playwright
passes the committed synthetic fixture `tests/fixtures/f02-demo-credentials.json`
to the API process, so browser acceptance is reproducible from a clean checkout.
Those values are demo-only and are never a runtime default.

For local development, copy the fixture values into `.env` (it is gitignored).
CI expects the same six values as repository secrets.

## PWA and device use

The whole app is one installable PWA at the root URL: the dashboard is `/` and
the marshal tablet is `/tablet/`, under one manifest and one root service worker.
After sign-in, a phone or tablet shows an **Install e-Challan** banner that opens
the browser install prompt; desktop does not show it. iOS gets Add to Home Screen
instructions instead of a native prompt. API, auth and evidence requests are
never cached; only the app shell is.

## Ports

| Service                | Port        |
| ---------------------- | ----------- |
| API                    | 3001        |
| tablet dev / preview   | 5173 / 4173 |
| admin dev / preview    | 5174 / 4174 |
| PostgreSQL demo / test | 5432 / 5433 |

## Daily commands

```bash
pnpm dev                       # build shared packages, then run API + both frontends
pnpm --filter @echallan/api run dev        # API only (tsx watch)
pnpm --filter @echallan/tablet run dev     # tablet only
pnpm --filter @echallan/admin run dev      # admin only
```

`pnpm dev` leaves all three processes running until you stop them; start the
stack yourself when you need a single service.

## Focused package and test runs

```bash
pnpm --filter @echallan/api run test              # API unit suite only
pnpm --filter @echallan/api run test:integration  # real PostgreSQL, isolated _test database
pnpm --filter @echallan/tablet run test           # tablet component tests
pnpm --filter @echallan/admin run test            # admin component tests
pnpm --filter @echallan/contracts run test        # shared contract tests
pnpm --filter @echallan/tablet run build          # one app build
pnpm run build:packages                           # contracts + theme builds (consumers need it)
```

Workspace gates, in the order CI runs them:

```bash
pnpm test:foundation    # planner-owned SET-01..SET-04 checks (Python stdlib)
pnpm format:check
pnpm lint               # eslint . plus the import-boundary gate
pnpm typecheck           # builds shared packages first, so it works on a clean checkout
pnpm test               # unit suites of every package
pnpm build
pnpm check:tablet-size  # initial-JS gzip budget from the Vite manifest
pnpm test:integration   # requires pnpm db:up
pnpm test:e2e           # browser journeys; requires pnpm db:up
```

## Browser tests

Playwright 1.63 drives chromium against the real API and database; there are no
recorded or mocked server responses.

```bash
pnpm exec playwright install chromium        # browser binaries
pnpm exec playwright install --with-deps chromium   # also installs system libraries (needs sudo)
pnpm run test:e2e
```

`pnpm run test:e2e` starts the API and both Vite dev servers itself. Locally it
reuses servers that are already listening; in CI (`CI=true`) it always starts
fresh ones and fails fast if a port is busy.

If `playwright install --with-deps` cannot run because `sudo` is unavailable, the
missing packages are fonts and `xvfb` only — headless chromium still runs, as
shown by `pnpm exec playwright install-deps --dry-run chromium`.

## Guardrails

- `pnpm run check:boundaries` scans every workspace source file and fails on
  app-to-app imports, MUI barrel imports and admin-only MUI X widgets in tablet
  or shared code. It runs as part of `pnpm run lint`.
- `pnpm run check:tablet-size` reads `apps/tablet/dist/.vite/manifest.json`,
  follows the static import graph of the initial entry, gzips every unique
  initial chunk and fails at 250000 bytes or more. Lazy routes are excluded.

## Deploying with Dokploy

`docker-compose.dokploy.yml` defines PostgreSQL, the API, and Nginx-served admin
and tablet bundles under one public origin: `/` is the dashboard/sign-in and
`/tablet/` is the marshal app. The admin container reverse-proxies the tablet
container; the tablet is not separately exposed. The username selects the account
and role, then a one-time handoff sends a Marshal to `/tablet/` while
Supervisor/Admin stay on the dashboard. Admin credentials come from
`DEMO_ADMIN_USERNAME` / `DEMO_ADMIN_PASSWORD`; the first API start applies
migrations and creates the matching `users` row before the server listens. Set
`PUBLIC_APP_ORIGIN` to the one HTTPS origin. Set `SEED_DEMO_DATA=true` on the
first deploy to load realistic-looking locations, posts, shifts, drivers, gate
passes and challans and give the env Marshal/Supervisor a demo location. See
`docs/deployment/dokploy.md` for service, environment, domain and backup steps.

## Continuous integration

`.github/workflows/ci.yml` runs every gate above on Node 22 with pnpm
`--frozen-lockfile`, two PostgreSQL 16 services (demo and `_test`), provisioned
browser dependencies, and no `continue-on-error`.

## Where to look next

`docs/development-workflow.md` describes the task/test/review loop,
`docs/handoffs/` holds preparation and implementation evidence, and
`docs/test-cases.md` is the acceptance-case catalogue. Business-rule decisions
are recorded in `docs/decisions.md`; nothing in this repository may invent them.
