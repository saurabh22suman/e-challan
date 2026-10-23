# Handoff — review and user-administration slice (2026-10-21)

Task/feature: bounded owner-authorised slice of **R-01 + R-03 + R-05**.
Feature: `specs/009-review-admin-basics`. Parent boxes remain unchecked; this
handoff does not claim R-01/R-03/R-05 complete.

PRD/cases: E1.4/E1.5 (reset/hash subset), E3.1–E3.3, E4.1; **REV-01, REV-02,
ADM-01 (reset subset), AUTH-02, AUTH-06 (hash/reset subset)**. D3 is resolved;
D5 counting is not touched. Owner authorisation is recorded in
`docs/decisions.md` under 2026-10-21. Dependencies I-06/R-02/remaining
R-03/R-05 are disclosed as an owner override for this demo slice, not accepted.

## Scope delivered

- Role-scoped `GET /challans` with exact status filter; Supervisor assigned
  locations, Admin all locations; Marshal refused.
- Extended `GET /challans/:id` with location/gate labels, violation snapshots
  and append-only action history. Existing Marshal scoping and error codes kept.
- `POST /challans/:id/review`:
  - Issued → Under Review (Supervisor/Admin, scoped);
  - Under Review → Resolved with approved action + mandatory remarks;
  - Resolved → Under Review (Admin only, mandatory reason);
  - Cancelled terminal; cancellation and all other targets `409 invalid_transition`.
- Transactional status guard, `challan_actions` append and
  `audit_events` (`challan.status_changed`) per accepted transition.
- Admin-only `GET /admin/users` (no password material) and
  `POST /admin/users/:id/reset-password` with pinned `@node-rs/argon2` 2.2.2,
  Argon2id storage, all live target sessions revoked and
  `user.password_reset` audit.
- Admin dashboard: role-aware tabs, list/filter/detail/history, review forms,
  Admin reopen, Admin user list and reset dialog.

## Files changed

Production:
- `packages/contracts/src/operations.ts` (new), `src/index.ts`, `src/auth.ts`
- `apps/api/src/auth/password.ts` (new), `auth/service.ts`, `auth/config.ts`,
  `auth/routes.ts`
- `apps/api/src/challans/service.ts` (new), `challans/routes.ts` (new),
  `apps/api/src/admin/routes.ts` (new), `apps/api/src/app.ts`
- `apps/api/src/db/schema.ts`, `db/seed-domain-demo.ts`
- `apps/api/drizzle/0007_typical_la_nuit.sql`, `drizzle/meta/_journal.json`,
  `drizzle/meta/0007_snapshot.json`
- `apps/api/package.json`, `pnpm-lock.yaml`
- `apps/admin/src/auth/session.tsx`, `src/api/operations.ts` (new)
- `apps/admin/src/features/challans/ChallanReviewPanel.tsx` (new),
  `ChallanDetailDialog.tsx` (new)
- `apps/admin/src/features/users/UserAdminPanel.tsx` (new)
- `apps/admin/src/routes/DashboardScreen.tsx`

Tests and planning:
- `packages/contracts/test/operations.test.ts`
- `apps/api/tests/unit/password.test.ts`
- `apps/api/tests/integration/challan-review.test.ts`
- `apps/admin/src/__tests__/operations.test.tsx`
- `apps/admin/e2e/review-admin.spec.ts`
- F-04 surface reconciliation: `apps/admin/src/__tests__/foundation.test.tsx`,
  `apps/admin/e2e/foundation.spec.ts`, `apps/admin/e2e/inclusive-ux.spec.ts`
- `specs/009-review-admin-basics/{spec,plan,tasks}.md`
- `docs/decisions.md`, `docs/implementation-plan.md`, `README.md`
- `docs/handoffs/009-review-admin-basics-tests.sha256` (rev 2); rev 1 archived at
  `docs/handoffs/009-review-admin-basics-tests-rev1.sha256`

Migration effect: one additive nullable `users.password_hash text`. No historical
migration was edited. Demo database was migrated; the integration suite recreates
and migrates the test database on every run.

## Planner baseline corrections (rev 2)

The rev-2 manifest records selector/copy corrections surfaced by the real seeded
data and MUI accessible names: actual seeded location label; required-field
asterisk matching; combined violation text node; exact browser password-field
names; real list-failure message; F-04 assertions moved from the removed empty
state to the real list/empty surface. No security, scope or transition assertion
was removed or weakened. Rev 1 remains archived unchanged.

Historical F-02 manifests are not regenerated. They will show a documented delta
for `apps/admin/src/__tests__/foundation.test.tsx` and
`apps/admin/e2e/foundation.spec.ts`, whose old empty-state assertions were
replaced by the real review surface. That delta is expected and is part of this
slice, not a silent baseline refresh.

## RED evidence

| Surface | Command | Result |
|---|---|---|
| Contracts | `pnpm --filter @echallan/contracts run test` | 7 failed / 43 passed; new exports undefined |
| Password unit | `pnpm --filter @echallan/api exec vitest run --project unit tests/unit/password.test.ts` | suite failed importing missing `src/auth/password.js` |
| API integration | `pnpm --filter @echallan/api exec vitest run --project integration tests/integration/challan-review.test.ts` | 16 failed / 1 passed; new routes 404, `password_hash` absent |
| Admin components | `pnpm --filter @echallan/admin run test` | 5 failed / 15 passed; Users tab/list/reset absent |

These were surface-absence RED, not behavioural RED. Behavioural meaning is shown
separately by the failure-sensitivity faults below.

## GREEN evidence

| Check | Result |
|---|---|
| `sha256sum -c docs/handoffs/009-review-admin-basics-tests.sha256` | 11/11 OK |
| `pnpm run format:check` | pass |
| `pnpm run lint` | pass (one pre-existing unused-disable warning in `SignaturePad.tsx`) |
| `pnpm run typecheck` | pass, including e2e tsconfig |
| `pnpm --filter @echallan/contracts run test` | 4 files / 50 tests pass |
| `pnpm --filter @echallan/api run test` | 11 files / 104 tests pass |
| `pnpm --filter @echallan/api run test:integration` | 10 files / 120 tests pass |
| focused `challan-review.test.ts` | 17/17 pass |
| `pnpm --filter @echallan/admin run test` | 3 files / 20 tests pass |
| `pnpm --filter @echallan/tablet run test` | 11 files / 87 tests pass (no regression) |
| `pnpm run build` | pass (API, contracts, theme, tablet, admin) |
| `pnpm run test:e2e` | **75/75 pass** (tablet + admin + api-proxy) |

## Failure sensitivity (disposable copy)

Copied the workspace to `/tmp/echallan-fault`, mutated, ran the focused real-DB
suite, restored, reran, then removed the copy. The workspace was never mutated
for this check.

| Fault | Observed failure |
|---|---|
| Supervisor location scope removed from list | expected 8 rows, received 14 (cross-location leak) |
| Blank resolution remarks accepted | expected 400, received 200 (blank remarks resolved) |
| Stored-hash verification bypassed | old password expected 401, received 200 |
| Restored copy | focused suite 17/17 pass |

## Manual/browser and UI/UX evidence

Playwright MCP against the running dev stack (Supervisor): list rendered 8
main-location records, status filter present, detail dialog showed issued fields,
violations, issued remarks and empty review history, `Start review` present.
Admin: Users tab visible, five seeded users listed with roles/locations, reset
dialog reachable. E2E also exercises a real Argon2id reset of DEMO-EMP-003 and a
subsequent real login. No transition was driven in the browser to keep the seeded
demo statuses repeatable.

A visual audit against the existing admin/theme surfaces found and corrected:

- **Card header subheader contrast**: the shared `MuiCardHeader` override coloured
  the title but left the subheader dark on the blue header. Added a shared
  translucent-white subheader token; both the workspace and Users cards are now
  readable.
- **Blank status filter**: an empty-string select value rendered no label. Replaced
  the sentinel with an explicit `All statuses` option, which the new browser check
  asserts.
- **Cramped table**: the dashboard container was `maxWidth="md"`, which wrapped a
  seven-column table. The authenticated dashboard shell now uses `maxWidth="lg"`;
  the login page is unchanged.
- **Minor wrapping**: issued dates and the reset action keep their text on one line.

A new Playwright UX assertion in `review-admin.spec.ts` checks the labelled filter
and its `All statuses` value, the Challans table, no horizontal overflow at
1280 px, and that the detail dialog stays within the viewport. The existing
admin foundation/inclusive-UX browser checks continue to pass. There is still **no
screenshot-diff/visual-regression baseline**, and the admin surface is not subject
to the tablet touch/budget gate; this is stated as a limitation rather than a
visual pixel-parity claim.

## Known limitations / explicit non-claims

- Admin cancellation (R-02), user create/disable (E1.4 remainder), evidence/photos/
  signature display, dashboard totals, pagination, search and export are not built.
- The review browser journey does not mutate status; transitions are covered by
  real-DB integration and component tests.
- Seeded Under Review records have no synthetic "started review" action; they are
  display states. New reviews always append history.
- `DEMO-EMP-003` now has an Argon2id credential from the e2e reset
  (`e2e-dispatch-supervisor-reset-2026`, demo-only). It is not env-configured and
  can be reset again by an Admin.
- No real-device or production credential-management evidence is claimed.
- Mutation accepts the owner override of the un-ticked dependency gate; this is
  not R-01/R-03/R-05 acceptance.

## Review request

Independent review is requested in a fresh session/model. Please check especially:
transactional transition legality and concurrency, location scoping on list/detail/
review, no password material in responses or audits, reset session revocation,
Argon2id precedence with the preserved F-02 env path, and the dashboard's failure/
empty states. All review boxes remain unchecked.


## Update — 2026-10-21

User creation/deactivation/reactivation (the R-05 remainder discussed in the
limitations above) is delivered in `specs/010-user-management` and
`docs/handoffs/010-user-management.md`. The 009 snapshot remains the record for
the review/reset slice; the combined review should inspect both.


## Follow-up — 2026-10-21

Challan detail now includes the issuer and a Tracking history; self-service
profiles are delivered in `specs/011-profile-tracking` and
`docs/handoffs/011-profile-tracking.md`. The 009 baseline is revised to rev 3 for
the additive contract and heading.
