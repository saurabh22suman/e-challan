# F-02 — Demo authentication, sessions and role/location enforcement

Status: planner preparation, 2026-10-03. Parent task: F-02, both boxes unchecked.
Authoritative sources: `docs/eChallan_replacement_spec.md` v0.1 **as amended by**
`docs/eChallan_replacement_spec_v0.2.md` (addendum A), and
`docs/handoffs/demo-env-login-decision.md`. The unavailable Functional Specification
v0.2 is not reconstructed anywhere.

Dependencies: reviewed F-01 (`docs/reviews/F-01-final.md`, PASS) supplies users,
roles, locations, posts, shifts, location assignments and the seeded synthetic
identities this feature binds to. F-01 history and both of its baselines are
preserved.

Acceptance: **AUTH-01, AUTH-02, AUTH-03 (scoped), AUTH-04, AUTH-05**. **AUTH-06 is
out of scope** — see the deferred-requirements table in addendum A §4.

## Outcome

Three env-backed role accounts can log in against the real API, receive a real
server-side session, and reach only what their role and location allow. Both clients
show real login screens, protect their routes, report login errors, support logout,
and the tablet returns to login after 10 idle minutes with unsent state cleared.
Issuance, review mutations, media and export remain out of scope.

## Contract interface (planner-chosen wiring)

`packages/contracts` adds strict shared schemas so the clients and API cannot drift:

1. `LoginRequestSchema` — `{username, password, postId?, shiftId?}`. **No role
   field**: authorisation may never be requested.
2. `LoginResponseSchema` — `{token, expiresAt, user:{id,username,role},
   post:{id,label}|null, shift:{id,label}|null}`. Contains **no password and no
   password hash**.
3. `SessionResponseSchema` — the current identity, same `user`/`post`/`shift` shape
   without a token.
4. `ApiErrorSchema` — `{error: string, message: string}` with a stable `error` code
   so the UI branches on a code rather than on prose. Every refusal that is not an
   ambiguous-context refusal uses **exactly** this shape.
5. `AmbiguousContextResponseSchema` — the one richer refusal, used only when omitted
   `postId`/`shiftId` cannot be resolved to a single candidate:
   `{error:'ambiguous_context', message, postOptions:[{id,label}], shiftOptions:[{id,label}]}`.
   Both option arrays are always present. The API returns only **stored,
   authorised, active** candidates, and the sets are exact: nothing fabricated,
   nothing inactive, nothing from an unauthorised location, and no shift that is not
   compatible with the post. A **shift is compatible with a post when it is active and
   runs at the post's gate**. Candidates are disclosed only to a caller who has already
   presented valid credentials for the role account. This is what makes explicit
   selection possible without guessing.

   **The two steps are separate.** When more than one post is a candidate,
   `postOptions` lists those posts and `shiftOptions` is **empty**: a shift set cannot
   be determined before the post is chosen, and offering a cross-post union would be a
   guess. Once a single post is determined, `postOptions` is exactly that one post and
   `shiftOptions` is exactly its compatible active shifts (or the empty list when the
   step is not ambiguous).

**Error codes that acceptance relies on:** `invalid_credentials` (401, one
indistinguishable refusal for unknown username and wrong password), `unauthenticated`
(401), `invalid_request` (400), `ambiguous_context` (422, with candidates),
`forbidden_context` (403, a supplied or required context the caller may not use or
that does not exist), `role_mismatch` (403, configured role differs from the stored
user's role), `forbidden` (403, record outside scope), `not_found` (404, unknown or
malformed record id).

Env configuration (`apps/api/src/auth/config.ts`):

- `loadDemoCredentials(source?)` returns
  `{marshal:{username,password}, supervisor:{...}, admin:{...}}`.
- It **throws** when a variable is missing or blank, when two role usernames are
  equal (ambiguous match), or when a value is empty after trimming.
- Passwords are returned to the server only; nothing here is logged or serialised
  into a response.

Session store (`apps/api/src/auth/session.ts`), over real PostgreSQL:

- `createSession(db, {userId, role, postId, shiftId, idleSeconds})` returns
  `{token, session}`. The token is 32 random bytes hex-encoded; only
  `sha256(token)` is stored in a unique `token_hash` column.
- `resolveSession(db, token, now)` returns the session or `null`, and is the single
  place that enforces: unknown token, revoked, absolute expiry, and the idle window
  (`now - last_seen_at >= idleSeconds` is idle). On success it refreshes `last_seen_at`.
- `revokeSession(db, token)` marks the session revoked so an old token cannot return.

API routes are mounted **at the root**, beside the existing `/health` and
`/health/ready`, so the already-verified Vite proxy behaviour (browser calls
`/api/...`, the proxy strips the `/api` prefix) keeps working unchanged and the
verified health/readiness compatibility is retained. The browser and the injected
tests therefore use different paths on purpose:

| Caller | Path used |
|---|---|
| Browser (tablet/admin via the Vite proxy) | `/api/auth/login`, `/api/challans/:id` |
| Fastify inject (API/database acceptance) | `/auth/login`, `/challans/:id` |

Registered by the existing app:

| Route | Behaviour |
|---|---|
| `POST /auth/login` | Validates the instance's configured credentials in constant time, resolves the seeded user, validates a supplied `postId`/`shiftId` against the user's authorisation, creates the session. `200` `LoginResponseSchema`; `401` `invalid_credentials` with one indistinguishable code for unknown user and wrong password; `403` `role_mismatch` when the matched credential's role differs from the stored user's role; `403` `forbidden_context` for a supplied unauthorised post/shift or when a Marshal has no usable post/shift; `422` `ambiguous_context` (with candidates) when omitted context cannot be resolved to one candidate. **Never 500 for client input** |
| `POST /auth/logout` | Requires a valid session, revokes it, `204`. Repeating it is not an error path that grants anything |
| `GET /auth/session` | Requires a valid session, `200` `SessionResponseSchema`, else `401` |
| `GET /challans/:id` | **Read-only scoped read.** `200` within the caller's authorised locations, `403` for a valid caller outside them, `401` anonymous, `404` for an unknown **or malformed** id. The 404 body is exactly `ApiErrorSchema`; it never contains SQL, query parameters, driver text or any other internal detail |

**Post/shift binding default (delegated technical decision, recorded here so it is
tested rather than guessed):** `postId` and `shiftId` are **optional** at login. When
omitted, the API resolves them from stored data:

- if the user is authorised for **exactly one** active post, that post is selected and
  **exactly one** compatible active shift is selected with it;
- if **more than one** candidate exists at a step, the API **refuses** the ambiguous
  login with `422 ambiguous_context` carrying the candidate options rather than
  guessing;
- **a Marshal needs a usable post *and* shift**: if exactly one post resolves but it has
  **zero** compatible active shifts, the login is refused `403 forbidden_context` and
  no session is created — a Marshal session must never succeed with `shift: null`;
- Supervisors and Admins do not require a post, so they resolve to `null` unless one is
  supplied (a supplied one is still checked).

A **supplied** `postId` or `shiftId` that the user may not use, or that does not exist,
is rejected with `forbidden_context`; the session may only bind an authorised post and a
shift that is actually compatible with that post. Nothing is ever inferred from a request
field. A supplied selection that is valid always wins over ambiguity: the caller is
never asked to disambiguate what they already chose.

**Ambiguous-context resolution flow (the tablet contract):** the sign-in screen sends
credentials without context first. On `422` it renders a labelled **native `<select>`**
for each non-empty option list, whose options are **exactly** the returned candidates —
in the returned order, with no extra entry beyond one empty-valued placeholder. The
placeholder is the initial value, so the selector starts with **nothing selected**; a
value is only ever chosen by the operator. The screen keeps the entered credentials and
resubmits with the chosen `postId`/`shiftId`. Because shift options depend on the chosen
post, the API may answer the post-selection attempt with a further `ambiguous_context`
whose `shiftOptions` are compatible with that post; the screen renders those next. The
screen never fabricates an option, never pre-selects a non-empty value, never adds an
option the API did not return, and never sends a post or shift that the API did not
offer. The login response the client accepts must bind the context it actually sent.

Relational interface, one new **additive** migration after the accepted F-01
migrations (no applied migration is edited; the historical `0003`/`0005` compatibility
amendments stay as reviewed):

- `sessions`: `id` UUID PK, `user_id` FK `users` (restrict), `token_hash` text
  **unique**, `role` constrained to the approved vocabulary, `post_id` FK `posts`
  nullable, `shift_id` FK `shifts` nullable, `created_at`, `last_seen_at`,
  `idle_timeout_seconds`, `absolute_expires_at`, `revoked_at` nullable.
- No password column anywhere. `users` keeps its existing shape.

Client behaviour:

- `apps/tablet/src/routes/LoginScreen.tsx` and `apps/admin/src/routes/LoginScreen.tsx`
  — statically labelled username/password, submit control, and visible error feedback.
  The tablet additionally renders `Post` and `Shift` selection controls (labelled
  native selects) from `AmbiguousContextResponseSchema` options only.
- `apps/tablet/src/auth/session.tsx` and `apps/admin/src/auth/session.tsx` — session
  storage for the client, a `useIdleLogout` hook on tablet (600 000 ms), and logout.
- Each `App` renders the login screen when no session exists and protected content
  otherwise. Protected content must not be present in the DOM before login.
- **Role boundary.** The marshal tablet admits **Marshal** sessions only; the admin
  dashboard admits **Supervisor** and **Admin** sessions only. The boundary applies to
  a fresh login **and to a restored session**, from the `user.role` in the server's
  own answer, and a session the client refuses is revoked. The refusal shows visible,
  accessible feedback on the login screen; protected content is never rendered. This
  is a client-side interface boundary on top of — never instead of — the API's own
  role and scope enforcement.
- **Session ordering.** The client tracks which transition is current. A delayed
  `/auth/session` restoration response, a delayed login response or a delayed logout
  response must never overwrite a newer session state: a stale anonymous restoration
  cannot erase a newer successful login, and a stale valid restoration cannot
  resurrect protected content after logout. Rejected or malformed restoration bodies
  are handled as "no session", not as an error that strands the screen.
- **Storage seam.** Each client keeps its opaque token in `localStorage` under
  `echallan.tablet.session-token` or `echallan.admin.session-token`. That key is the
  documented supported seam acceptance may seed, and it is cleared whenever the client
  refuses a session or signs out. Storage access is failure-tolerant: unavailable
  storage behaves as signed out, never as an exception.

## Harness preconditions and writable configuration

Two preconditions must be explicit, because F-02 adds authentication to a harness that
previously had none.

**Production startup stays strict.** `server.ts` is the **only** caller of
`loadDemoCredentials(process.env)` and fails fast on a missing, blank or ambiguous
configuration. That validation is never bypassed in production.

**Test factories inject credentials and never read the environment.** `createApp` gains
an optional `credentials?: DemoCredentials` option. The factory has **no implicit
environment fallback**: when `credentials` is omitted the instance has no configured
demo accounts, whatever `process.env`, the root `.env` or a stray shell variable happens
to contain. Suites that exercise liveness/readiness may omit it and are unaffected; a
suite that exercises an **auth-protected** route must supply explicitly constructed
credentials, including any deliberately mismatched configuration. Any protected route on
an instance without credentials fails closed (login `401 invalid_credentials`, logged
configuration error) rather than allowing access. This is a test seam, not a bypass: no
production route skips enforcement, and there is no test-mode flag that disables
authentication. A hidden environment fallback would make the seam untestable and is
therefore forbidden, not merely discouraged.

**Browser credential harness (reproducible, no private operator values).** Automated
browser acceptance must not depend on an operator's private credentials. The
implementation commits one synthetic, demo-only credential fixture and uses it from both
ends of the same command:

- `tests/fixtures/f02-demo-credentials.json` holds synthetic usernames/passwords for the
  three seeded demo accounts. It is committed, demo-only and clearly marked as never
  becoming a runtime demo default or a real secret.
- `playwright.config.ts` passes those values to the API `webServer` entry through its
  `env` option, so the browser, the API process and the specs all agree from a clean
  checkout with no dependence on the operator's root `.env`. **Those fixture values are
  acceptance wiring, not runtime secrets**: a developer's `.env` and the CI repository
  secrets are separate concerns, and the browser command must not require either.
- The Playwright specs read the same fixture. App-level specs read it at runtime
  (`readFileSync` + `JSON.parse`) because the boundary gate forbids an app package from
  importing outside its own package; `tests/e2e/api-proxy.spec.ts` may import it
  statically. Either way there is one source of truth.

Browser requests are asserted **through the real Vite proxy**, so the `/api` →
root-mount rewrite is genuinely exercised rather than bypassed.

### Configuration ownership for this feature

| Path | Ownership |
|---|---|
| `apps/api/tests/**`, `apps/*/src/__tests__/**`, `apps/*/e2e/**`, `tests/e2e/**`, `tests/fixtures/**` | **Planner-owned and frozen** by `docs/handoffs/F-02-tests.sha256`. Do not edit |
| `specs/003-demo-auth/{spec,plan}.md`, `docs/eChallan_replacement_spec*.md`, `docs/handoffs/demo-env-login-decision.md`, `docs/reviews/**` | **Read-only.** Do not edit |
| Every `docs/handoffs/*.sha256` manifest | **Read-only.** Never regenerate to fix a failure |
| `.env.example`, `playwright.config.ts`, `.github/workflows/ci.yml`, root and app `package.json`, `apps/*/vite.config.ts` | **Writable by the implementer.** These are configuration, not frozen acceptance. `.env.example` gains empty `DEMO_*` placeholders only, and never a working secret |

## What is explicitly not claimed

- No challan issuance, driver summary, signature/refusal, camera/evidence upload,
  duplicate/repeat preview, review mutation, cancellation, dashboard filter or Excel
  export.
- No Admin user-management screen, no password hashing, no refresh-token workflow, no
  SSO. **AUTH-06 is not reproduced.**
- No individual staff attribution: activity attributes to the role account, per
  addendum A §2.3.
- No production readiness, hardware, camera, signature feel, trusted HTTPS, deployment
  or backup/restore claim.

## Acceptance and RED honesty

Planner tests are executable before handoff. Missing modules, routes, exports or the
`sessions` table are **surface-absence RED** and are labelled as such; they are not
evidence of a behavioural defect. After the implementer wires those surfaces, the same
unchanged tests must be rerun to record genuine behavioural RED (for example: a
role/location bypass that currently succeeds, or an idle session that is wrongly
accepted) before the remaining enforcement is completed. Sensitivity of the key
rejection and enforcement cases must be demonstrated in a disposable copy. No test may
be skipped, weakened or narrowed to reach green.

F-02 completion needs format/lint/typecheck, the focused API/database/component/
browser suites, all F-01 and foundation regressions, both client builds, tablet size,
untouched planner hashes, failure-sensitivity evidence for the corrected guards (the
factory fail-closed seam, the client role boundary, the restoration ordering, the
zero-shift refusal and the malformed-ID handler), and a separate independent review.
Do not advance to F-03 automatically.
