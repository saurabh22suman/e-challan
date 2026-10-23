# Review and user administration — bounded demo slice

Status: planner preparation, 2026-10-21. Owner-authorised slice of **R-01**,
**R-03** and **R-05**. Parent boxes stay unchecked; this feature does not claim
those tasks are complete. Feature directory: `specs/009-review-admin-basics`.

Authority: `docs/eChallan_PRD.md` E1.4/E1.5/E3.1–E3.3/E4.1; approved replacement
specification v0.1 and auth addendum v0.2; D3 decision record (status set,
Issued → Under Review → Resolved, location-scoped Supervisor review, mandatory
action + remarks, Admin reopening, immutable issued fields, audited history);
`docs/test-cases.md` REV-01, REV-02, ADM-01 (reset subset), AUTH-02, AUTH-06
(reset/hash subset); `docs/decisions.md` owner authorisation recorded 2026-10-21.

## Outcome

Signed-in Supervisors and Admins get a real review workspace instead of the F-04
empty state:

- a role-scoped challan list with a status filter;
- a detail view containing the issued fields, violations and append-only review
  history;
- the approved review transitions: Issued → Under Review, Under Review →
  Resolved with a controlled action and mandatory remarks, and Admin-only
  reopening of a Resolved record with a mandatory reason;
- an Admin-only user list and password reset. A reset stores an Argon2id hash,
  revokes that user's live sessions and takes effect on the next sign-in.

The signed-in user is always the recorded performer. Issued fields, evidence
references and earlier history rows are never rewritten.

## Scope boundary

Included:

- `GET /challans` — Supervisor (assigned locations) and Admin (all locations);
  optional exact status filter; newest issued first; capped list for the demo.
- `GET /challans/:id` — existing read, extended with location/gate labels,
  violation snapshots and append-only action history. Existing Marshal scoping
  is unchanged.
- `POST /challans/:id/review` — approved transition subset:
  - `Issued → Under Review` (Supervisor/Admin, scoped; optional reason);
  - `Under Review → Resolved` (Supervisor/Admin, scoped; action + remarks);
  - `Resolved → Under Review` (Admin only; mandatory reopening reason);
  - `Cancelled` is terminal and every other transition is refused.
- `GET /admin/users` — Admin only; no password material.
- `POST /admin/users/:id/reset-password` — Admin only; Argon2id hash; all live
  sessions for that user revoked; audited.
- Admin dashboard UI for the list/detail/review and user reset flows.

Not included, and not claimed:

- Create/disable users (E1.4 remainder), Admin cancellation (R-02), totals,
  pagination, search, export (R-03/R-04), dashboard charts, evidence viewing,
  audit-trail UI (R-06), deletion of anything.
- Issuance submission (I-06) remains unaccepted; this slice reviews the seeded
  synthetic records and any later records created by I-06.
- Browser transition acceptance is not automated against the persistent demo
  database because each review mutates seeded status. Real-DB integration and
  component tests cover transitions; the browser journey covers list, detail and
  password reset. This limitation is recorded, not hidden.

## Contracts (`packages/contracts/src/operations.ts`)

- `ChallanListQuerySchema = strictObject({ status?: ChallanStatus })`.
- `ChallanSummarySchema = strictObject({ id, challanNumber, status, severity,
  occurrenceNumber, recommendedAction, gatePassNumber,
  vehicleRegistrationNumber, driverName, locationId, locationLabel, issuedAt })`.
- `ChallanListResponseSchema = strictObject({ items: ChallanSummary[] })`.
- `ChallanActionRecordSchema = strictObject({ id, toStatus, action|null,
  remarks|null, reason|null, performerUserId, performerUsername,
  performerDisplayName, createdAt })`.
- `ChallanDetailResponseSchema` = summary fields plus `departmentLabel`,
  `contractorLabel|null`, `vehicleTypeLabel`, `gateLabel`, `remarks|null`,
  `violations: {label, severity}[]`, `actions: ChallanActionRecord[]`,
  `reopenedAt|null`, `reopenedByUserId|null`, `reopeningReason|null`,
  `cancellationReason|null`.
- `AdminUserSchema = strictObject({ id, username, displayName, role, isActive,
  locationLabels: string[] })`; `AdminUserListResponseSchema = { users: [...] }`.
- `ResetPasswordRequestSchema = strictObject({ password: string })`; the trimmed
  password must be 12–200 characters. The password is hashed byte-for-byte as
  supplied, never trimmed into the hash.
- `RESOLUTION_ACTION_LABELS` maps every stable action code to its approved
  display label.
- New error code `invalid_transition` (409) for an illegal current-state
  transition. Existing `invalid_request`, `forbidden`, `not_found` and
  `unauthenticated` codes are reused.

## Authentication and password rules

- The three demo env accounts remain the bootstrap and the API still refuses to
  start without all six `DEMO_*` values. This slice does not weaken F-02.
- `users.password_hash` is nullable. A non-null value is an Argon2id hash set by
  an Admin reset and takes precedence at sign-in; a null value keeps the
  existing env-backed demo behaviour. This is what lets a reset user sign in
  without a `DEMO_*` entry while preserving existing F-02 acceptance.
- An instance constructed without credentials still fails every login closed.
- Unknown username and wrong password remain one indistinguishable refusal.
- No endpoint returns a password, a hash, or the hash algorithm's parameters.
  The audit payload for a reset carries only the target user id and username.
- A reset revokes every live session for that user. If an Admin resets their own
  password, the client signs out after the successful reset.

## Authorisation

| Surface | Marshal | Supervisor | Admin |
|---|---|---|---|
| `GET /challans` | 403 | assigned locations | all locations |
| `GET /challans/:id` | own post (unchanged) | assigned locations | all |
| `POST /challans/:id/review` | 403 | assigned locations, Issued/Under Review transitions | all locations, plus reopening |
| `GET /admin/users` | 403 | 403 | 200 |
| `POST /admin/users/:id/reset-password` | 403 | 403 | 204 |

Authorization is enforced in the API from the session and stored assignments,
never from a request field or a hidden UI control.

## Review semantics

- Resolving requires one approved action for the whole challan, mandatory
  remarks and the session user as performer.
- The seeded Under Review records have no synthetic "started review" action; they
  are display states. A newly started review always appends its action row.
- A review response includes the updated detail, so the client can replace the
  row without a second authoritative read.
- Concurrent status changes are guarded by an update conditional on the status
  read inside the transaction; a lost race is `409 invalid_transition` rather
  than a silent overwrite.
- Every accepted transition appends `challan_actions` and
  `audit_events` (`challan.status_changed`) in one transaction.

## UI (admin dashboard, Supervisor/Admin only)

- Keep the heading `Demo review workspace` and the `Signed in as …` line so the
  existing F-02/inclusive-UX contracts keep their meaning.
- Tabs: `Challans` for both roles; `Users` for Admin only.
- Challan list: static filter label, status select, accessible table, loading,
  empty, failure/retry states, and a row `Open` action.
- Detail: labelled issued fields, severity/status chips, violation list, issued
  remarks, cancellation/reopening context, and the append-only history.
- Issued: `Start review`. Under Review: action select + remarks + `Resolve
  challan`; blank remarks are refused locally and by the API. Resolved: Admin
  gets `Reopen challan` with a mandatory reason.
- Users: list username, name, role, active state and locations; reset dialog with
  new password + confirmation, minimum length stated, mismatch refused locally,
  success/failure feedback. No password is echoed.
- List load failures use a persistent status notice rather than an alert so the
  existing "no alert after a successful login" F-02 assertion remains true even
  when an older test double does not know the new endpoint.

## Acceptance mapping

- REV-01: scoped list, filter, detail fields/history, cross-location refusal.
- REV-02: approved transition order, mandatory action/remarks, performer,
  immutable issued fields, audit rows, invalid order refusal.
- ADM-01 (reset subset): Admin-only user list and reset, disabled user remains
  unable to sign in until separately re-enabled, non-Admins refused.
- AUTH-02: role and location scope on every new route.
- AUTH-06 (hash/reset subset): Argon2id storage, no plaintext/hash in responses,
  reset revokes sessions. User create/disable stay out of scope.
