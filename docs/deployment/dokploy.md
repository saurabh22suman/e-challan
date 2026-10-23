# Deploying the demo with Dokploy

Dokploy runs the stack from `docker-compose.dokploy.yml`: PostgreSQL, the Fastify
API, and two Nginx containers serving the admin and tablet bundles. Nginx proxies
each SPA's same-origin `/api/...` calls to the API over a private Compose network,
so the API needs no public domain and there is no CORS configuration.

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

The admin dashboard sign-in is:

```text
DEMO_ADMIN_USERNAME
DEMO_ADMIN_PASSWORD
```

The API also requires distinct Marshal and Supervisor credentials at startup,
even when only the dashboard is being demonstrated.

## 3. Add the domains

Add two domains in Dokploy, both with HTTPS enabled:

| Service | Container port | Example host            |
| ------- | -------------- | ----------------------- |
| `admin` | `80`           | `admin.example.com`     |
| `tablet`| `80`           | `tablet.example.com`    |

Leave `api` and `db` without domains. Dokploy attaches the web services to
`dokploy-network`; the stack already declares that network as external.

HTTPS is not optional for real tablet use: camera capture and service-worker
installation require a trusted secure context.

## 4. Deploy

Dokploy builds the three images and starts the stack in this order:

1. PostgreSQL becomes healthy.
2. The API runs `deploy-start`: Drizzle migrations, environment-account
   bootstrap, then the Fastify server.
3. The admin and tablet Nginx containers start once the API health check passes.

Open the admin domain and sign in with `DEMO_ADMIN_USERNAME` /
`DEMO_ADMIN_PASSWORD`.

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
active shift. A fresh deployment has no master data or shift rows, so the
dashboard is the immediately usable role.

## Optional synthetic demo history

With `POSTGRES_DB=echallan_demo`, the reviewed synthetic fixture can be loaded
after the stack is healthy:

```bash
docker compose -f docker-compose.dokploy.yml exec api \
  node apps/api/dist/db/seed-domain-demo.js
```

This adds locations, posts, shifts and synthetic challan history. It is refused
for any database name other than `echallan_demo` or `echallan_test`. To use the
fixture's own Marshal/Supervisor accounts, set the env usernames to
`DEMO-EMP-004` and `DEMO-EMP-002`; a custom admin username continues to work.

## Local smoke test

```bash
docker network create dokploy-network 2>/dev/null || true
cp .env.dokploy.example .env.dokploy   # fill in the placeholders
docker compose -f docker-compose.dokploy.yml --env-file .env.dokploy up --build -d
docker compose -f docker-compose.dokploy.yml --env-file .env.dokploy port admin 80
```

Open the printed host port for the admin UI. Check API readiness through either
web container:

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

## Scope

This is deployment scaffolding for the demo, not field acceptance or a production
credential/backup procedure. Real-device camera and signature checks, backup and
restore evidence, and the remaining business-rule decisions in
`docs/decisions.md` are still required before staff use.
