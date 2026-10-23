# Handoff — Admin user management (create/deactivate/reactivate), 2026-10-21

Task/feature: bounded owner-authorised slice of **R-05**. Feature:
`specs/010-user-management`. Parent R-05 boxes remain unchecked.

PRD/cases: E1.4, E5.3, ADM-01 (create/disable subset), AUTH-02, AUTH-06.
Owner authorisation is recorded in `docs/decisions.md` under 2026-10-21. This is
additive to the review-pending 009 reset/list/review slice.

## Scope delivered

- Admin-only `POST /admin/users` for **Marshal, Supervisor and Admin** with a
  unique username, display name, optional employee ID, location assignments and
  an Argon2id initial password.
- Admin-only `POST /admin/users/:id/deactivate`: the account is retained
  (`is_active=false`), all live sessions are revoked and history is untouched.
  Self-deactivation is refused. Repeated deactivation is idempotent.
- Admin-only `POST /admin/users/:id/reactivate`: restores sign-in with the
  existing/reset password. Repeated reactivation is idempotent.
- Dashboard: Create-user dialog (role, locations, password confirmation),
  Deactivate confirmation, Reactivate row action, self-deactivation disabled
  with an explanation. Password reset from 009 is preserved.
- Audit events: `user.created`, `user.deactivated`, `user.reactivated`; payloads
  carry ids/usernames/roles/locations only, never passwords or hashes.

No migration: the existing `users` columns, unique username constraint and
`user_locations` table were sufficient.

## Files changed

Production:
- `packages/contracts/src/operations.ts`, `src/auth.ts`
- `apps/api/src/admin/routes.ts`
- `apps/admin/src/api/operations.ts`
- `apps/admin/src/features/users/UserAdminPanel.tsx`
- `apps/admin/src/features/users/CreateUserDialog.tsx` (new)

Tests/planning/docs:
- `packages/contracts/test/user-management.test.ts`
- `apps/api/tests/integration/admin-user-management.test.ts`
- `apps/admin/src/__tests__/user-management.test.tsx`
- `apps/admin/e2e/user-management.spec.ts`
- `specs/010-user-management/{spec,plan,tasks}.md`
- `docs/decisions.md`, `docs/implementation-plan.md`, `README.md`
- `docs/handoffs/010-user-management-tests.sha256` (rev 2); rev 1 archived at
  `docs/handoffs/010-user-management-tests-rev1.sha256`
- `docs/handoffs/010-user-management.md` (this record), `...-files.sha256`

## Planner baseline corrections (rev 2)

- The 204 action helper no longer tries to decode an empty response body.
- The component validation assertion matches the error punctuation (`Choose a
  role.`) now that the select also displays its placeholder.
- Formatting only.

No acceptance condition was removed or weakened.

## RED evidence

| Surface | Command | Result |
|---|---|---|
| Contracts | `pnpm --filter @echallan/contracts exec vitest run test/user-management.test.ts` | 7/7 failed; new exports missing |
| API integration | `... vitest run --project integration tests/integration/admin-user-management.test.ts` | 7/7 failed; routes missing |
| Admin components | `... vitest run src/__tests__/user-management.test.tsx` | 4/4 failed; Create/Deactivate UI absent |

## GREEN evidence

| Check | Result |
|---|---|
| `sha256sum -c docs/handoffs/010-user-management-tests.sha256` | 7/7 OK |
| `pnpm run format:check` | pass |
| `pnpm run lint` | pass (one pre-existing unused-disable warning in `SignaturePad.tsx`) |
| `pnpm run typecheck` | pass, including e2e tsconfig |
| `pnpm --filter @echallan/contracts run test` | 5 files / 57 tests pass |
| `pnpm --filter @echallan/api run test` | 11 files / 104 tests pass |
| `pnpm --filter @echallan/api run test:integration` | 11 files / 127 tests pass |
| focused `admin-user-management.test.ts` | 7/7 pass |
| `pnpm --filter @echallan/admin run test` | 4 files / 24 tests pass |
| `pnpm --filter @echallan/tablet run test` | 11 files / 87 tests pass |
| `pnpm run build` | pass |
| `pnpm run test:e2e` | **76/76 pass** (tablet + admin + api-proxy) |

## Failure sensitivity (disposable copy)

| Fault | Observed failure |
|---|---|
| Self-deactivation guard removed | expected 400, received 204 (admin deactivated) |
| Session revocation removed on deactivate | old session expected 401, received 200 |
| Marshal/Supervisor location requirement removed | missing-location create expected 400, received 201 |
| Restored copy | focused suite 7/7 pass |

The copy was removed; the workspace was never mutated for this check.

## Browser/UI evidence

Playwright MCP and the new browser journey exercise: Admin sign-in → Users →
Create Supervisor with role/location/password through the real UI → real login →
Deactivate with confirmation → login refused → Reactivate → login accepted. The
synthetic account is left inactive at the end so repeated runs do not add an
active account.

The visual audit found and fixed the empty role/location select placeholders
(`displayEmpty` / `renderValue`) and confirmed the shared blue CardHeader,
static labels, theme tokens and desktop container. The 009 Playwright UX check
still passes. There is no screenshot-diff visual-regression baseline.

## Known limitations / non-claims

- “Remove” is deactivation, not hard delete, per PRD E5.3. No delete endpoint
  exists.
- Role changes after creation, password self-service, master-data screens and the
  rest of R-05 remain out of scope.
- Each browser run leaves one inactive `E2E-SUP-*` synthetic user in the demo
  database; this is intentional so the run is repeatable without a delete path.
- No real-device or production credential-management evidence is claimed.
- Combined independent review with the 009 slice is required; all review boxes
  remain unchecked.

## Review request

Fresh reviewer session/model, please check: Admin-only authorization on every
mutation; duplicate/location validation and race handling; Argon2id initial
password and no credential leakage; deactivation retaining history while
revoking sessions; self-lockout guard; reactivation; and the create/deactivate UI
failure states.


## Dialog chrome correction — 2026-10-21

Owner feedback: the Create-user popup lacked the app styling and the action
confirmation popup looked generic. Corrected:

- shared `MuiDialog`/`MuiDialogTitle`/`MuiDialogContent`/`MuiDialogActions`
  overrides now give every modal the same blue header, surface border and action
  bar as the existing cards;
- the Create-user form is a responsive two-column grid with the Locations row
  spanning both columns, reducing height and making the fields scannable;
- the browser journey asserts the Create and Deactivate dialog headers use the
  same computed background and text colour as the page card header.

Re-verified: admin 26/26, tablet 88/88, full e2e 78/78, typecheck/lint/format
pass. The 010 browser spec changed; its baseline is rev 3.
