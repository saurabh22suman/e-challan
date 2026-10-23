# Demo hosting target

The user selected **their VPS** for the demo. Deployment is task V-00 in
`implementation-plan.md`, after the reviewed issuance/dashboard/export demo is
available. No deployed endpoint exists yet.

## Planned deployment

The deployment path is now a Dokploy Docker Compose stack
(`docker-compose.dokploy.yml`, see `docs/deployment/dokploy.md`). Dokploy's
Traefik provides domains and certificates; Nginx containers serve the separate
tablet/admin static bundles and proxy API requests.

- Docker Compose: API service, PostgreSQL, persistent evidence storage and Nginx
  serving separate tablet/admin static bundles and proxying API requests.
- Trusted HTTPS with a domain/certificate arrangement supported by the VPS and
  tablet browser. Camera capture on a tablet cannot rely on plain HTTP to a VPS IP.
- Isolated demo DB seeded from `demo-data.json` through the approved schema adapter.
  Metadata photo counts/signature states are not real evidence assets.
- Real role-based login with demo credentials supplied separately; no credentials
  committed or embedded in frontend bundles.
- Migration-before-start ordering, persistent volumes, health checks and documented
  restart/update/rollback procedure. Inspect existing host services/ports first.

## Details needed before V-00

Confirm VPS hostname/IP, SSH user and approved access method, OS/resources, existing
services, demo domain/DNS and certificate setup. Do not send private keys/passwords
in chat; use the configured SSH access/secret store when deployment is requested.

Demo hosting does not settle plant network access, pilot host ownership, backup/
restore targets or staff field acceptance. Those remain V-01–V-04/D8 work.
