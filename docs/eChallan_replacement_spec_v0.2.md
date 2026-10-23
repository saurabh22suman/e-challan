# e-Challan replacement specification — addendum A, version 0.2

Version: **0.2** (addendum). Amends and extends
`docs/eChallan_replacement_spec.md` **v0.1** (owner-approved 2026-10-02). Prepared
and owner-directed: 2026-10-03. Scope: **F-02 demo authentication only.**

**v0.1 remains in force in full.** This document changes only the authentication and
session provisions listed below; every other v0.1 rule, field, boundary, recommendation
tier and attribution rule is unchanged and continues to apply. Where this addendum and
v0.1 conflict on an authentication matter, this addendum wins.

Approval source: the owner's decision in `docs/handoffs/demo-env-login-decision.md`
("lets have a simple login mechanism for now, will have env file based login for each
role"), reconciled at the F-01 review checkpoint as instructed by
`docs/reviews/F-01-final.md`. Reconciled into `docs/decisions.md` with a dated entry.

## 1. Why this addendum exists

v0.1 section 8 assumed username/password login with **Admin-created users** and
Argon2id **database-backed** password hashing, following PRD E1.4/E1.5. For the
current synthetic demo the owner has chosen a deliberately smaller mechanism: one
account per role, with credentials held in the API's server-side environment.

This is a **demo-scope substitution**, not a relaxation of the production
requirement. Nothing here authorises staff use, and the release gates in the PRD and
constitution are unchanged.

## 2. Approved demo mechanism

### 2.1 Credentials

Exactly one username/password account per existing role: **Marshal, Supervisor,
Admin**. Values come from the API's server-side environment only:

```text
DEMO_MARSHAL_USERNAME     DEMO_MARSHAL_PASSWORD
DEMO_SUPERVISOR_USERNAME  DEMO_SUPERVISOR_PASSWORD
DEMO_ADMIN_USERNAME       DEMO_ADMIN_PASSWORD
```

Binding requirements:

- **No role picker, no client-supplied role.** Authorisation comes from the matched
  credential and the stored user's role, never from a request field.
- **No client-visible secrets.** These variables must never use a `VITE_` prefix, must
  never be exposed to the browser bundle, and passwords must never appear in any API
  response body, log line or error message.
- **`.env.example` carries empty/operator-supplied placeholders only.** No working
  secret is committed.
- **Configuration is validated at load and fails loudly.** Missing, blank or
  non-unique role usernames are a startup/configuration error, not a silent
  fallback. No account may be matched ambiguously.
- Each configured username must resolve to an existing synthetic `users` row whose
  `role` equals the variable's role. A mismatch is a configuration error: an
  authenticated identity must not be able to gain another role.

### 2.2 Sessions

Bounded F-02 decision (the amendment left transport/expiry/logout to F-02):

- **Opaque server-side session tokens.** The client receives a random token; the
  database stores only its **SHA-256** hash, so a database dump does not yield usable
  sessions. The raw token is never persisted.
- A session binds `user_id`, the resolved `role`, and — where applicable — the
  authorised `post_id` and `shift_id`. This is what makes issuance attribution stable
  and prevents a client from re-pointing a session at another post or shift.
- **Idle expiry: 600 seconds (10 minutes)** for a Marshal/tablet session, matching
  v0.1 section 8 and PRD E1.3. Supervisor and Admin desktop sessions use a longer idle
  window (**3600 seconds**). Every accepted request refreshes `last_seen_at`.
- **Absolute expiry** also applies, so a session cannot live indefinitely.
- **Logout revokes server-side.** A revoked, expired or unknown token is rejected;
  it must not be able to regain access.
- **Refresh tokens are out of scope for this demo.** No refresh workflow is built and
  none is claimed (see section 4).

### 2.3 Retained authorisation and attribution

Unchanged from v0.1 and the PRD, and still enforced **on the API**:

- Supervisors may read/review within their assigned locations; Admins act across
  locations; Marshals issue only at their authorised posts.
- Anonymous and wrong-role callers cannot reach protected data, and a Supervisor
  cannot fetch another location's challan by a guessed identifier.
- Issued fields and evidence remain immutable; review actions remain separate,
  retained, audited records.
- Role attribution records the **demo account** for that role, not an individually
  authenticated staff member. The amendment states this explicitly and F-02 must not
  imply per-person attribution.

### 2.4 Client behaviour

- Real login screens in **both** tablet and admin, with statically labelled fields and
  visible error feedback on bad credentials. Protected content is not rendered before
  a session exists.
- Logout is available and returns the client to the login screen.
- The tablet returns to login after **10 minutes of inactivity** and **clears unsent
  in-memory state**. Allowed activity resets the idle timer.
- Session transport to the API and proxying follow the existing `/api` prefix; no
  client-side authentication stub is acceptable.

## 3. F-02 scope boundary

**In scope:** env-backed role credentials and their validation; server-side sessions
with hashed tokens; login/logout/session endpoints; API role and location
enforcement; stable demo-user/post/shift attribution; tablet and admin login screens;
route protection; login error feedback; logout; the 10-minute tablet idle logout.

**Explicitly out of scope:** challan issuance, the driver summary, signature or
refusal capture, camera/evidence upload, duplicate/repeat preview, review mutations,
cancellation, dashboard filters, Excel export, the Admin user-management screens, the
refresh-token workflow, SSO (PRD E1.6, P2), offline issuance, and deployment.

## 4. Deferred production requirements — explicitly NOT satisfied by F-02

These are **not** delivered by this demo mechanism and must not be reported as
verified. They remain required for staff use.

| Requirement | Source | Why not satisfied by env-backed demo accounts | Later gate |
|---|---|---|---|
| Admin creates, disables and resets users | PRD E1.4 | No user-management screens or API; accounts come from environment variables | Production credential management |
| Passwords stored with a modern hash (Argon2id), never recoverable, only resettable | PRD E1.5 | Demo passwords are compared in memory against environment values; **no password is stored or hashed anywhere**, so there is nothing to hash | Production credential management |
| Refresh-token workflow | v0.1 §8 / AUTH-03 | Not built; demo sessions are re-established by logging in again | AUTH-03 production scope |
| Individual staff accounts and per-person audit attribution | PRD E6.1 intent, v0.1 §8 | One account per role, so issuance/review/audit rows attribute to the role account | Production credential management |
| Per-shift tablet sessions bound to posts with named actors | PRD E1.2 | Sessions bind a post and shift, but the actor is the shared role account | Production credential management |
| Corporate SSO | PRD E1.6 (P2) | Out of scope entirely | P2 |
| Idle/refresh/logout hardening against a disabled or removed account | AUTH-03 | No disable/reset path exists, so this cannot be exercised | Production credential management |

`docs/test-cases.md` **AUTH-06** (Admin user CRUD, Argon2id hashing) is therefore
**out of F-02 scope** and its assertions are *not* reproduced here. The F-02 acceptance
suite covers AUTH-01, AUTH-02, AUTH-03 (scoped), AUTH-04 and AUTH-05, with AUTH-03
explicitly scoped to invalid/expired/revoked session handling **without** a refresh
workflow. A reviewer must be able to see which cases were deliberately narrowed and
why.

## 5. Security floor for the demo

Even though this is a synthetic demo, the following are required, not optional:

- Passwords never returned, logged, or bundled into client assets.
- Session tokens stored hashed; the raw token is returned to the client exactly once.
- Constant-time credential comparison to avoid trivial timing leakage.
- Login failures return one indistinguishable error for unknown username and wrong
  password, so the endpoint does not confirm which usernames exist.
- Authenticated identity and role come from stored data, never from the request body.
- Unauthorised access is denied server-side; hiding UI controls is not enforcement.

## 5a. Decision-register entry (recorded here, not in `docs/decisions.md`)

`docs/decisions.md` is pinned by the **F-01 approval baseline**
(`docs/handoffs/F-01-tests.sha256`, 14 entries) and is therefore immutable during F-02
planning. An earlier attempt to append the register rows there broke that baseline; the
edit has been reverted and the rows are recorded here instead, with the register to be
amended only under a controlled, reviewer-confirmed revision.

| ID | Status | Decision | Blocks |
|---|---|---|---|
| B-07 | RESOLVED FOR DEMO — 2026-10-03 | Owner-directed demo authentication: one env-backed username/password account per role (Marshal, Supervisor, Admin) from the API server environment, with opaque server-side sessions whose tokens are stored hashed. Source: `docs/handoffs/demo-env-login-decision.md`. | F-02 |
| B-08 | OPEN; deferred to production | Production credential management remains unbuilt and unclaimed by F-02: Admin user create/disable/reset (PRD E1.4), Argon2id database-backed hashing (PRD E1.5), refresh-token workflow, per-person staff attribution, and disabled-account session invalidation. PRD E1.4/E1.5 and AUTH-06 are **not** satisfied by env-backed demo accounts. | Production staff authentication; AUTH-06; release gates |

## 6. Exit criteria

F-02 is complete when: the demo credential configuration is validated and documented;
login/logout/session and the scoped protected read are enforced on the API against a
real database; attribution resolves to a stable seeded user, post and shift; both
clients show real login screens with route protection, error feedback and logout; the
tablet idle-logout behaviour is verified under a controlled clock; all F-01 acceptance
and foundation regressions still pass; and an independent review records
`docs/reviews/F-02.md`. Deployment, hardware, camera/signature, HTTPS and backup gates
are unaffected and remain open.
