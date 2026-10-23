# Admin user management — create, deactivate and reactivate

Status: planner preparation, 2026-10-21. Bounded slice of **R-05**. Feature:
`specs/010-user-management`. Parent R-05 boxes stay unchecked.

Authority: PRD E1.4 (Admin creates/disables/resets users; no self-registration),
E5.3 (deactivation replaces deletion), `docs/decisions.md` 2026-10-21 owner
authorisation, D3 role vocabulary. The reset/list slice is already recorded in
`specs/009-review-admin-basics`; its behavior is preserved and regression-tested.

## Outcome

An Admin can:

- create a user for **Marshal, Supervisor or Admin** with a unique username, a
  display name, an optional employee ID, assigned locations, and an initial
  password;
- deactivate a user ("remove" in the UI): the account is retained, cannot sign
  in, and all live sessions are revoked;
- reactivate a deactivated user without re-creating the account or resetting the
  password;
- continue to reset any user's password.

No hard delete is offered. Issued records and audit rows keep their user
references, and deactivation is the approved removal model.

## Scope boundary

Included: Admin-only create/deactivate/reactivate API and dialogs, location
assignment, Argon2id initial password, session revocation, audit events, tests.

Not included: hard delete, self-registration, role changes after creation,
password self-service, master-data screens, and the rest of R-05's master UI.
An Admin cannot deactivate their own account (self-lockout guard).

## Contracts (`packages/contracts/src/operations.ts`, additive)

- `CreateUserRequestSchema = strictObject({
    username, displayName, employeeId?, role, locationIds, password
  })`
  - username: trimmed 3–64, `A–Z a–z 0–9 . _ -`;
  - displayName: trimmed 1–120;
  - employeeId: trimmed 1–64 when present;
  - role: approved role enum;
  - locationIds: distinct UUIDs; **Marshal and Supervisor require at least one**;
    Admin may have none;
  - password: same 12–200 rule as reset.
- `AdminUserResponseSchema = strictObject({ user: AdminUser })` for 201.
- `API_ERROR_CODES.conflict = 'conflict'` for a duplicate username (409).
- Existing reset/list contracts are unchanged.

## API

| Route | Behaviour |
|---|---|
| `POST /admin/users` | Admin only; validates role/locations; 409 duplicate username; hashes the initial password; creates user + location assignments + `user.created` audit; returns 201 with the public user shape |
| `POST /admin/users/:id/deactivate` | Admin only; 404 unknown; 400 self-deactivation; idempotent 204 if already inactive; otherwise sets `is_active=false`, revokes all sessions, appends `user.deactivated` |
| `POST /admin/users/:id/reactivate` | Admin only; 404 unknown; idempotent 204 if already active; sets `is_active=true`, appends `user.reactivated` |

Location IDs must reference existing **active** locations. No endpoint returns or
audits password material. Created users authenticate through the stored Argon2id
hash path already delivered with the reset slice.

## Client

Admin dashboard → Users:

- `Create user` dialog: username, display name, employee ID, role, locations,
  initial password + confirmation. Local validation mirrors the contract; server
  errors are shown without clearing the form.
- Row actions: `Reset password`, `Deactivate` (with confirmation) or `Reactivate`.
  The signed-in Admin's own Deactivate control is disabled with an explanation.
- Deactivation/creation success refreshes the list and shows a persistent notice.
- Locations are read from the existing authenticated `GET /masters/locations`
  catalogue (active-only); no new master endpoint.

## Acceptance mapping

- **ADM-01 (create/disable subset), AUTH-02, AUTH-06**: Admin-only mutations,
  duplicate and location validation, Argon2id initial password, disabled user
  cannot sign in, non-Admins refused.
- **R-05**: create/deactivate/reset UI against the real API; deactivation
  preserves the account and history.
- Existing REV-01/REV-02 and 009 reset/list tests remain green.

## Failure paths covered

Duplicate username; unknown/inactive location; missing locations for a
Marshal/Supervisor; invalid role/password; anonymous/non-Admin; self-deactivate;
deactivated login; old session after deactivation; reactivation then login;
idempotent deactivate/reactivate; no password/hash in responses or audits.
