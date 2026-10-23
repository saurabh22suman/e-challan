# Profile and challan tracking history

Status: planner preparation, 2026-10-21. Owner-authorised follow-up to the
review/reset and user-management slices. Feature: `specs/011-profile-tracking`.

## Outcome

- Every signed-in user can see their own login/profile details: username,
  display name, employee ID, role, active state, assigned locations and the
  current session context (post, shift, expiry). No password or hash is ever
  shown.
- Supervisors and Admins get a **Profile** tab in the dashboard. Marshals get a
  **Profile** dialog in the tablet toolbar.
- Challan detail gains the **issuer** and a **Tracking history** view: issuance
  plus every appended review/cancellation action, with timestamp, status,
  action, remarks/reason and performer. This is read-only; issued fields remain
  immutable.

## Scope boundary

Included: `GET /profile`, admin Profile tab, tablet Profile dialog, issuer on
challan detail, issuance entry in the tracking history, tests and browser
evidence.

Not included: editing profile fields, password self-service, viewing another
user's profile, evidence/photo/signature history, audit-event browsing UI,
filtering by actor, or a separate public tracking URL. Admin user management
still shows other users' administrative details.

## Contracts (`packages/contracts/src/profile.ts`, additive)

```text
ProfileUserSchema = strictObject({
  id: uuid, username, displayName, employeeId: string|null,
  role: Role, isActive: boolean, locationLabels: string[]
})
ProfileSessionSchema = strictObject({
  expiresAt: iso.datetime,
  post: SessionContextRef|null,
  shift: SessionContextRef|null
})
ProfileResponseSchema = strictObject({ user: ProfileUserSchema, session: ProfileSessionSchema })
```

`ChallanDetailResponseSchema` gains:

```text
issuedBy: strictObject({ id: uuid, username, displayName })
```

The existing `actions` array remains the status history source; no new timeline
table is introduced.

## API

- `GET /profile` — any valid session. Identity comes from the session; display
  name/employee ID/locations from stored rows. 401 for anonymous/invalid.
- `GET /challans/:id` — joins the issuing user and returns `issuedBy` alongside
  the current detail/actions.

## Client

- Admin dashboard: tabs become **Challans / Users (Admin only) / Profile**.
  Profile uses the shared blue card, static labels and theme tokens; loading and
  failure states are explicit.
- Tablet toolbar: a **Profile** button opens a dialog with the same details.
  The existing Log out and session context remain.
- Challan detail: an **Issued by** field and a **Tracking history** list whose
  first entry is `Issued` with the issued timestamp and issuer. Subsequent
  entries are the existing action rows (Under Review, Resolved, Cancelled,
  reopening reason).

## Acceptance

- Profile: each role sees only its own details; no password/hash; Marshal has a
  bound post/shift; Supervisor/Admin show no post; locations match assignments.
- Tracking: issuer present; history shows issuance plus ordered actions; a
  newly started/resolved review appears without rewriting issued fields.
- Existing 009/010 review/list/reset/user-management behavior remains green.
- Browser: Admin/Supervisor Profile tab, Marshal Profile dialog, and challan
  tracking visible in the detail dialog.
