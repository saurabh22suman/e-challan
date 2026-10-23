# Demo authentication amendment — env-backed role accounts

Date: 2026-10-02. Status: owner-approved demo mechanism; F-02 test preparation
and implementation remain separate. Source: user request in the reviewer/planner
chat: “lets have a simple login mechanism for now, will have env file based login
for each role”.

## Approved change

For the current synthetic demo, provide one username/password login account for
each existing role: Marshal, Supervisor and Admin. Credential values come from
the API's server-side `.env`/process environment rather than database password
management. No role picker or client-supplied role determines authorisation.

Planned non-public variable names:

```text
DEMO_MARSHAL_USERNAME
DEMO_MARSHAL_PASSWORD
DEMO_SUPERVISOR_USERNAME
DEMO_SUPERVISOR_PASSWORD
DEMO_ADMIN_USERNAME
DEMO_ADMIN_PASSWORD
```

The API validates credentials, establishes the session and returns the verified
role/identity for routing. Passwords are never returned to the client, shipped
in the Vite bundle or configured with `VITE_` names. Future `.env.example`
entries use empty/operator-supplied placeholders, not committed working secrets.
Missing, blank or ambiguous role credentials must fail auth configuration checks;
an arbitrary authenticated identity cannot gain another role by request fields.

## Retained behaviour

- API role and location authorisation still applies to real demo requests.
- Marshal uses the tablet; Supervisor and Admin use their authorised admin views.
- Each configured role account maps to a stable, correctly typed synthetic user
  identity. Issuance/review/action/audit rows retain user/post/shift relationships.
  Using one role account attributes activity to that demo account, not to
  individually authenticated staff members.
- Existing assigned-location Supervisor restrictions, Admin cross-location rights,
  resolution/cancellation rules and immutable issued records remain intact.
- Tablet idle logout remains 10 minutes; unsent state clears under the approved
  demo policy. Logout, invalid session handling and login error feedback still
  require acceptance tests.
- Keep credentials on the API; session transport, expiry and logout enforcement
  are bounded F-02 planner/implementer decisions, not client-side auth stubs.

## Superseded demo scope and later gates

This replaces the demo's individual-account credential-management assumption.
Database-backed password hashing/provisioning, Admin create/disable/reset-user
screens and a full refresh-token workflow are not required merely to demonstrate
the env-backed login. Do not claim the original AUTH-03/AUTH-06 requirements are
fully verified by static env accounts. The F-02 planner must record their scoped
demo replacements/deferred portions and prepare meaningful login/session/role/
location/attribution checks. Production staff authentication remains a later
explicitly approved scope; this amendment does not change staff-use release gates.

## Active F-01 handoff boundary

The other implementer is currently executing F-01 against a frozen planner
baseline. This amendment is intentionally additive: it does not edit
`docs/decisions.md`, the approved replacement v0.1, F-01 tests/spec/plan or their
hash manifest mid-task. F-01 still needs users/roles, location assignments,
posts/shifts and attribution FKs; this decision does not require removing them
or building auth inside F-01. F-01 has no password-login implementation in scope.

At F-01 review/next planning checkpoint, reconcile this amendment into a dated
replacement-spec/decision-register revision and the bounded F-02 preparation.
Preserve the original baseline history. The owner request is the source for the
demo scope change; no additional product-approval question is required for it.
