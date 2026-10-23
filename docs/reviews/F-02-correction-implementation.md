# F-02 correction implementation independent re-review

Date: 2026-10-05. **Result: CHANGES_REQUIRED — one remaining restoration defect.**
Feature: `specs/003-demo-auth`. Reviewed the correction section in
`docs/handoffs/F-02.md` against the preparation checkpoint in
`docs/reviews/F-02-preparation-revision-3-followup.md`.

This reviewer did not implement the corrections or change production/frozen
acceptance. Q1, R1, R3 and R4 are corrected; R2 transition ordering is corrected,
but R2's required malformed-response handling remains incomplete. The supplied
acceptance is GREEN. Additional independent Chromium evidence prevents acceptance.
Parent Implemented and affected completion tasks are returned to unchecked;
Reviewed stays unchecked. F-03 remains blocked.

## Verification actually rerun

| Command | Actual result |
|---|---|
| `sha256sum -c docs/handoffs/F-02-tests.sha256` | 24/24 OK; approved manifest hash `9c46ed067212f826e9721a87bdc1d7ab3959ed33ea31db9572383b1f49ac79fc` |
| `sha256sum -c docs/handoffs/S-01-tests.sha256` | 11/11 OK |
| `sha256sum -c docs/handoffs/F-01-tests.sha256` | 14/14 OK |
| `sha256sum -c docs/handoffs/F-01-corrections-tests.sha256` | 10/10 OK |
| `sha256sum -c docs/reviews/F-01-accepted.sha256` | 28/33 OK; exactly the five documented F-02/planning extensions diverge |
| `pnpm run format:check` | PASS |
| `pnpm run lint` | PASS, boundary gate scans 79 files |
| `pnpm run typecheck` | PASS |
| `pnpm run test` | 114 passed: contracts 8, API 76, tablet 17, admin 13 |
| `pnpm db:up` | Both PostgreSQL containers healthy |
| `pnpm run test:integration` | 66 passed, seven files, real PostgreSQL |
| `pnpm run test:e2e` | 17 passed in 34.8 s, review-started API and clients, run after integration |
| `pnpm run build` | All five workspace artifacts built |
| `pnpm run check:tablet-size` | 144771 B gzip initial JS, below 250000 B |
| `pnpm run test:foundation` | 27 passed in 78.586 s, including disposable clean-artifact gates |

The previously reported browser timeout did not reproduce in this serial full
run. No test was skipped or narrowed for these gates. Historical F-01 migrations
and acceptance remain unchanged. No new migration/seed changes were introduced
by the correction batch. The shared ambiguity contract and both consumers were
inspected and checked.

## C1 — Medium, blocking: invalid JSON restoration rejects without cleanup

References:

- `apps/tablet/src/auth/api.ts:132–144`.
- `apps/admin/src/auth/api.ts:94–106`.
- `apps/tablet/src/auth/session.tsx:87–116`.
- `apps/admin/src/auth/session.tsx:84–113`.
- `specs/003-demo-auth/spec.md`, Client behaviour: rejected/malformed
  restoration bodies must be treated as no session, not strand the screen.
- Prepared handoff R2 instructions: malformed/refused restoration is no session.

Both `fetchSession` helpers catch a rejected `fetch`, but call
`await response.json()` outside that catch. A 200 response containing invalid
JSON (including an interrupted JSON body or proxy HTML) rejects the helper.
Both providers call `.then(...)` without a rejection handler. Cleanup never
runs: the stored token remains and an unhandled promise rejection is emitted.
The code handles decoded invalid-schema JSON, but not JSON decoding/read failure.
The handoff's claim that malformed restoration bodies are handled is therefore
broader than the delivered behaviour.

### Independent reproduction

Command:
`python3 /tmp/opencode/f02-review-browser-launch.py /tmp/opencode/f02-restoration-body-review.py`.

The helper starts the actual API and both Vite clients with synthetic credentials.
The Chromium probe seeds a synthetic client token and intercepts only session
restoration to simulate a malformed success body, without mutating application
source. It compares a decoded-invalid-schema control with invalid JSON:

| Client / restoration body | Page errors | Token retained | Login visible |
|---|---|---|---|
| Tablet / `{}` control | none | no | yes |
| Tablet / invalid JSON (HTML) | two unhandled `Unexpected token '<'` errors | yes | yes |
| Admin / `{}` control | none | no | yes |
| Admin / invalid JSON (HTML) | two unhandled `Unexpected token '<'` errors | yes | yes |

Development StrictMode issues two restoration requests, hence two errors. This
finding does not claim protected content is rendered or that the login form
crashes; it proves missing no-session cleanup and unhandled rejection. Servers
started by the helper are stopped afterward.

### Return path

Planner/test owner: add meaningful component acceptance for both clients with
a stored token and a successful response whose `json()` rejects. Assert no
unhandled rejection, token removal, login visible and protected content absent;
retain a valid restoration control and the decoded-invalid-schema control.
Cover rejected body reading as the same failure boundary. Freeze a documented
numbered baseline revision, preserving revision 3 and substantive assertions.
No new product decision or contract change is needed.

After preparation confirmation, implementer: handle response decoding/read
failure as no session in both helpers and ensure restoration rejections are
handled defensively. Preserve monotonic transition ordering: obsolete failures
must not clear a newer login. Append actual RED/GREEN, affected regressions and
failure-sensitivity evidence, then stop for independent re-review.

## Coverage and inspected checkpoint

- **AUTH-01/02:** role-specific login/restoration refusal, server role mapping,
  scoped reads and correct-route unknown/malformed IDs pass the frozen suite.
- **AUTH-03 scoped:** revocation, idle/absolute expiry pass; disabled-account and
  refresh behaviour remain expressly deferred. C1 concerns client restoration.
- **AUTH-04:** controlled-clock idle logout and unsent-state clearing pass.
- **AUTH-05:** required active shift, authorised exact ambiguity candidates and
  tablet explicit selection pass. Candidate queries explicitly filter active
  rows and compatible gates; authority is checked before options are disclosed.

Inspected: shared auth contract; factory/error handler; credential configuration;
API service/routes and unchanged session store; both client providers/API helpers/
login screens; correction handoff and frozen preparation. Relevant current hashes:

```text
bbd3477eb319e0cfc3494315627eb0a1498fd662e240c016266445d93fb264b6  apps/tablet/src/auth/api.ts
9b8e6fb828e882a6302581680fdc55841cba9a8e4f37cd51db91f7974efff5b6  apps/admin/src/auth/api.ts
7190ca7a06512d0bf3aec3788ca694a9c935211cab29cf1d90c9f50799ecf9bb  apps/tablet/src/auth/session.tsx
9d4785f43d933c656780c600d74964abd947685d25fcc1732c1a518c5932259d  apps/admin/src/auth/session.tsx
```

These are inspected hashes, **not an accepted snapshot**. Implementer-reported
nine-guard fault sensitivity was inspected, not independently repeated in this
blocked re-review. The independent malformed-body probe supplies direct failure
evidence. New fault sensitivity and a clean rerun are required after C1 is fixed.
No hardware, camera/signature, trusted HTTPS, deployment, backup/restore or hosted
CI approval is provided. The reviewed boundary remains the synthetic demo.
