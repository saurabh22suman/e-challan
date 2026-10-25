# Deploying the demo with Dokploy

Dokploy runs the stack from `docker-compose.dokploy.yml`: PostgreSQL, the Fastify
API, and two Nginx containers. The admin container is the single public gateway:
it serves the dashboard at `/` and reverse-proxies the internal tablet container
at `/tablet/`. Both call the same-origin `/api/...` through the gateway, so the
API needs no public domain and there is no CORS configuration.

Dokploy derives Traefik routing from the domains entered in its UI. The compose
file intentionally contains no Traefik labels and no `container_name`.

## 1. Create the Dokploy service

1. Create a project, then add a **Docker Compose** service.
2. Connect the repository and branch to deploy.
3. Set **Compose path** to `docker-compose.dokploy.yml`.
4. Leave the build context as the repository root; the images use
   `deploy/docker/api.Dockerfile` and `deploy/docker/web.Dockerfile`.

Do not use Docker Stack mode: it does not support the `build` keys this stack
needs.

## 2. Add the environment

Copy `.env.dokploy.example` into the Dokploy **Environment** editor and replace
every placeholder. The API refuses to start when any `DEMO_*` value is missing or
blank.

`POSTGRES_PASSWORD` is embedded in `DATABASE_URL`, so use a URL-safe value
(letters, digits, `-`, `_`). Avoid `@`, `:`, `/`, `?`, `#` and `$`; they need URL
encoding or are treated specially by Compose's environment interpolation.

The single sign-in page is the one public URL. The username decides the account
and role; the API refuses to trust a role supplied by the client.

```text
DEMO_ADMIN_USERNAME
DEMO_ADMIN_PASSWORD
```

The API also requires distinct Marshal and Supervisor credentials at startup.
After a successful login, a Marshal is redirected to `/tablet/` with a one-time
handoff code; Supervisor/Admin continue to the dashboard. Set the one public
origin before building:

```text
PUBLIC_APP_ORIGIN=https://e-challan.thedutchrabbit.com
```

## 3. Add the domain

Add one domain in Dokploy with HTTPS enabled:

| Service | Container port | Host                              |
| ------- | -------------- | --------------------------------- |
| `admin` | `80`           | `e-challan.thedutchrabbit.com`    |

Leave `api`, `db` and `tablet` without domains. Dokploy attaches `admin` to
`dokploy-network`; the stack declares that network as external. The tablet is
reachable only through the admin gateway on the private network.

The hostname must match `PUBLIC_APP_ORIGIN`. The whole app is one installable PWA
at that origin: `/` is the dashboard/sign-in and `/tablet/` is the marshal app.
After sign-in, a phone or tablet shows the in-app **Install e-Challan** banner;
desktop does not. iOS shows Add to Home Screen instructions. HTTPS is not optional
for real tablet use: camera capture, service-worker installation and the install
prompt require a trusted secure context.

## 4. Deploy

Dokploy builds the three images and starts the stack in this order:

1. PostgreSQL becomes healthy.
2. The API runs `deploy-start`: Drizzle migrations, environment-account
   bootstrap, then the Fastify server.
3. The admin and tablet Nginx containers start once the API health check passes.

Open the public origin and sign in with any approved account. A Marshal lands on
`/tablet/` at the assigned post; Supervisor/Admin land on the dashboard. The
one-time handoff expires after 60 seconds, is single-use, and revokes the session
it came from. The handoff signing key is process-local, so keep this stack at one
API replica; a restart or a second replica simply asks the user to sign in again.

## How the environment accounts are seeded

`apps/api/src/db/seed-env-users.ts` inserts a missing `users` row for each of the
three configured usernames. The row gets the matching role and a `NULL`
`password_hash`, so the environment password remains the credential authority at
sign-in. No plaintext or hash is written by this bootstrap.

Existing rows are left untouched. A deactivated account stays deactivated, and a
username already held by another role stops startup with an explanatory error
rather than being reassigned. An Admin password reset later writes an Argon2id
hash, which then takes precedence over the environment password.

Because the bootstrap is insert-if-absent, changing `DEMO_ADMIN_PASSWORD` in
Dokploy and redeploying changes the sign-in password while the stored hash is
still `NULL`. After an in-app reset, use the reset password or reset it again.

The Marshal account can sign in only after it has an authorised post and an
active shift. A fresh deployment has no master data or shift rows, so enable the
demo seed below or add masters and assignments through the dashboard first.

## Seeding the demo domain

Set `SEED_DEMO_DATA=true` in the Dokploy environment on the first deployment.
`deploy-start` then loads the deployment fixture: fictional but realistic-looking
locations, gates, posts, shifts, staff, drivers, gate passes, contractors,
departments, vehicles and a **100-record synthetic historical challan history**.
It gives the env Marshal/Supervisor a
demo location when they have none. The selected location has exactly one active
post and one active shift, so Marshal login resolves its context without an
ambiguity prompt. The example env usernames (`EMP-1042`, `EMP-3106`, `EMP-2217`)
reuse the seeded profiles, so the UI shows the matching real-looking names.
Custom usernames also work; the seed assigns a location to a custom
Marshal/Supervisor.

The deployment fixture currently contains 100 historical challans (June–October
2026), 5 staff accounts, 2 posts and 2 shifts. The smaller `docs/demo-data.json`
fixture remains the deterministic 14-record test fixture. The seed is
insert-if-absent and safe to run repeatedly. It is refused for any
database name other than `echallan_demo` or `echallan_test`. If an older demo
seed already populated the same database, reset the demo database/volume before
enabling this fixture: existing rows are not rewritten, and issued challan rows
must not be mutated.

If the stack is already running with `SEED_DEMO_DATA=false`, run the same seed
manually:

```bash
docker compose -f docker-compose.dokploy.yml exec api \
  node apps/api/dist/db/seed-demo-deploy.js
```

The command prints each role's assignment reason. `already-assigned` means the
account already had a location; `assigned` means the demo location was added.

## Local smoke test

```bash
docker network create dokploy-network 2>/dev/null || true
cp .env.dokploy.example .env.dokploy   # fill in the placeholders
docker compose -f docker-compose.dokploy.yml --env-file .env.dokploy up --build -d
docker compose -f docker-compose.dokploy.yml --env-file .env.dokploy port admin 80
```

For a local handoff test, set `PUBLIC_APP_ORIGIN` to the printed host origin and
rebuild the web images; the deployed host must be the real HTTPS origin. Open the
printed host port and use `/` for the dashboard and `/tablet/` for the field app.
Check API readiness through either web container:

```bash
docker compose -f docker-compose.dokploy.yml --env-file .env.dokploy \
  exec admin wget -qO- http://api:3001/health/ready
```

## Persistence and backup

| Volume              | Contents                                  |
| ------------------- | ----------------------------------------- |
| `echallan-db-data`  | PostgreSQL data                           |
| `echallan-evidence` | issued photo/signature evidence (`/data/evidence`) |

Back up both volumes together. Restoring only the database leaves evidence object
keys pointing at missing files. Redeploying does not delete either volume.

Captured photos and signatures are files under `/data/evidence`
(`EVIDENCE_ROOT`). The database stores object keys and metadata, never the binary
bytes; the API serves them through authenticated, audited evidence routes. This
is local-disk storage, not S3/MinIO or another object store.

## Scope

This is deployment scaffolding for the demo, not field acceptance or a production
credential/backup procedure. Real-device camera and signature checks, backup and
restore evidence, and the remaining business-rule decisions in
`docs/decisions.md` are still required before staff use.
