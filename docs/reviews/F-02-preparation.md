# F-02 preparation review

Date: 2026-10-03. **Result: CHANGES_REQUIRED before implementation handoff.**
Delivered work is planner preparation only: `F-02-prepared.md`, feature
`specs/003-demo-auth`, a new test baseline and six acceptance files. There is no
`docs/handoffs/F-02.md` implementation record. F-02 implementation/review boxes
correctly remain unchecked. No production or planner-owned file was edited by
this reviewer.

The demo-auth decision itself is approved. These findings concern inconsistent
preparation and verification, not a request for further product decisions.

## P1 — baseline/ownership instructions conflict with mandatory changes

`F-02-tests.sha256` verifies **20/20**, but includes `.env.example` as an immutable
entry while `F-02-prepared.md:125` and `specs/003-demo-auth/plan.md:58–59` require
the implementer to add six empty credential placeholders to that same file.
Completion cannot both make that change and preserve its frozen checksum.

The preparation also claims earlier F-01 records verify unchanged. Actual checks:

- `sha256sum -c docs/handoffs/F-01-tests.sha256`: **13 OK, decisions.md FAILED**.
  Adding the authentication decision reconciliation changed the pinned approval file.
- `sha256sum -c docs/reviews/F-01-accepted.sha256`: **32 OK,
  implementation-plan.md FAILED**. That index was legitimately updated for F-02,
  so this is a planning-document delta, not a backend source regression.

Planner: reconcile the history explicitly. Keep the original approved decision
snapshot immutable and record the auth amendment in a versioned addendum, or
document a controlled baseline/archive revision and obtain reviewer confirmation.
Do not claim old path hashes still match or silently regenerate historical
acceptance records. Define which implementation configuration files are writable;
freeze tests/specifications rather than contradictory before-change hashes.
The earlier F-01 implementation PASS remains historical acceptance of its reviewed
code; the observed metadata deltas are not evidence that backend code broke.

## P2 — anonymous/protected regression preconditions contradict each other

`apps/tablet/src/__tests__/foundation.test.tsx:25–68` and the corresponding admin
suite render `<App />` without an authenticated setup and require the foundation
content immediately. The new F-02 suites render that same App without a session
and require that content to be absent. Old tablet/admin browser journeys and
`tests/e2e/api-proxy.spec.ts:13–18` likewise navigate straight to `/` and access
protected controls without signing in.

Planner: revise only the old suites' setup to establish a valid authenticated
precondition. Preserve every substantive label, touch-target, health-contract,
invalid-payload and route assertion. Browser setup must use genuine authentication
against the API. Document the test revisions and baseline/snapshot effects; do not
add a production/test-mode auth bypass, skip old tests or render protected content
anonymously to make both interpretations appear green.

## P3 — mandatory post selection disagrees with accepted login requests

`specs/003-demo-auth/spec.md:67–69` says Marshals must supply `postId`.
`f02-auth.test.ts:82–97` repeatedly expects Marshal login with only username and
password to return 200, and frontend/browser sign-in helpers do not select a post
or shift. The positive attribution case separately supplies both IDs.

Planner: choose a consistent delegated technical default and specify/test it.
For this seeded demo, automatically selecting the **single** authorised post and
compatible shift when omitted is one workable option; multiple choices must require
an explicit selection rather than a guess. Alternatively, require explicit context
and update all valid helpers to supply/select it. Add a supplied mismatched or
unauthorised shift rejection, not only a wrong-post test. Keep API-bound role,
location and actor attribution intact.

## P4 — two acceptance cases pass while the login route is absent

Actual focused run:

```bash
pnpm --filter @echallan/api exec vitest run --project integration tests/integration/f02-auth.test.ts
```

Actual result: **17 tests: 15 failed, 2 passed**, not 15 executed failures.
The two passes are false-positive acceptance at the current absent-route state:

- Password-leakage check (`:115–121`) does not first require successful login. It
  passes by inspecting a generic 404 body with no password material.
- Unauthorised-post check (`:286–299`) accepts any 4xx, including missing-route
  404. It does not prove the known valid route refused an existing unauthorised post.

Require genuine successful login before checking its response for leakage and
require a specific authorisation refusal for the known seeded other post. Also add
the explicitly required env-account/stored-user role-mismatch rejection: current
positive identities are all correctly matched, so they cannot prove that guard.
Do not count surface absence or arbitrary errors as an enforced permission rule.

## P5 — component mocks do not follow the declared API contract

The new tablet/admin fetch mocks return `{ok:true}` for both session lookup and
logout. The specification requires identity/post/shift for session lookup and a
204 empty response for logout. Login mocks use IDs `u-1`/`p-1`/`s-1` and a
`planner-session-token`, while actual domain IDs are UUIDs and planned tokens are
32 bytes hex-encoded. These fixtures should not force the implementer to abandon
shared contract validation to satisfy UI acceptance.

Use valid synthetic IDs/tokens and canonical login/session responses; model signed
out/invalid sessions as 401 and logout as 204 with no body. Capture request options
and assert the actual POST/logout token request, not just an occurrence of the URL.
Strengthen real-browser logout by checking that the captured session token is
rejected by the API afterward. Strengthen idle-state clearing by re-authenticating
and confirming the typed unsent value is not restored; disappearance from the DOM
alone does not prove state was discarded.

## P6 — browser environment and proxy wiring are unspecified/inconsistent

- Browser specs read `process.env` in the Playwright worker, but the declared
  command does not load root `.env` into that process. API dotenv loading occurs
  in a separate child and does not propagate values back to the parent/worker.
  Saying “set credentials in root .env” alone does not make the command reproducible.
- API injection expects `/api/auth/...`, while both existing Vite proxies strip
  `/api`, so browser requests currently arrive as `/auth/...`. Specify one consistent
  browser→proxy→API path and retain the verified health/readiness compatibility.
- Credential configuration is described as startup-fatal, but existing health-unit
  factories run without these values. Define a test-factory credential injection
  or other explicit supported harness precondition, keeping production startup
  validation and protected-request enforcement real.

Planner: supply a reproducible browser harness/credential-loading strategy and
document mutable config ownership before freezing. Prefer isolated synthetic
test credentials for automated acceptance rather than depending on private operator
credentials; those fixtures must never become runtime demo defaults. Test routing
through the actual Vite proxy. Ensure the same CLI works from a clean checkout/CI
with its declared test environment; no silent skips or fake client auth.

## Count/evidence corrections

- The API integration file has **17** executed cases; current result is
  **15 failed / 2 passed**. After tightening P4 it should have no false-green
  permission/leakage claims against absent routes.
- Existing root units 74 + API config 18 + tablet 7 + admin 4 = **103** before
  any further meaningful added cases, not merely the handoff's 92 calculation.
- Existing integration 42 + current new 17 = **59**, not 57.
- Existing browser 7 + new 5 = 12, before additional revised cases.
- Separate delivered E1.1/idle behaviour from deferred E1.4/E1.5 credential
  management; do not blanket-label all E1.1–E1.5 unsatisfied by the demo.

## Disposition

Return to the planner for **one combined preparation correction**, preserving
substantive existing assertions and documenting revisions. No new user approval
is needed for these routine compatibility/test-integrity fixes. Re-run exact
focused commands, state honest failure reasons/counts, and freeze a consistent
handoff before the implementer starts the full F-02 batch. F-01 does not need
another production-code implementation cycle to correct this preparation.
