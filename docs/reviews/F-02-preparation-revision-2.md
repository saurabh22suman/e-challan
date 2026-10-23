# F-02 revision 2 preparation re-review

Date: 2026-10-04. **Result: CHANGES_REQUIRED before implementation handoff.**
Role: independent preparation reviewer. No production code, acceptance test,
specification or baseline was changed in this review. F-02 implementation and
review remain unchecked. F-01's historical implementation PASS remains intact.

## Verification actually rerun

| Command | Result |
|---|---|
| `sha256sum -c docs/handoffs/F-02-tests.sha256` | 24/24 OK |
| `sha256sum -c docs/handoffs/S-01-tests.sha256` | 11/11 OK |
| `sha256sum -c docs/handoffs/F-01-tests.sha256` | 14/14 OK |
| `sha256sum -c docs/handoffs/F-01-corrections-tests.sha256` | 10/10 OK |
| `sha256sum -c docs/reviews/F-01-accepted.sha256` | 32/33 OK; only `docs/implementation-plan.md` diverges, as documented |
| `pnpm run format:check` | PASS |
| `pnpm run lint` | PASS; boundary gate scans 67 files |
| `pnpm run typecheck` | PASS; shared builds, five package checks and e2e check |

Inspected revision 2 manifest and prepared handoff; feature spec/plan; auth
addendum and decision; API credential and integration acceptance; both foundation
component suites; tablet auth component acceptance; and both auth browser suites.
The planner's recorded RED counts were read, not independently rerun in this
re-review. No browser, database or behavioural acceptance PASS is claimed.

The configuration ownership conflict and historical baseline divergence are
reconciled. The tightened successful-login leakage/post-refusal assertions,
contract-shaped auth component mocks, re-authentication state-clearing check,
browser logout revocation assertion and committed browser credential fixture
are substantive improvements. The following remaining defects prevent release
of this preparation to an implementer.

## Q1 — High: integration setup contradicts the credential injection seam

References: `apps/api/tests/integration/f02-auth.test.ts:20–29,51–61,362–378`;
`specs/003-demo-auth/spec.md:118–128`.

The specification says auth-protected test factories must supply
`createApp({credentials})`; omission means no configured demo accounts and must
fail closed. The integration suite instead sets process environment values and
constructs both servers with `createApp({db})`. An implementation following the
declared seam cannot satisfy the positive login cases. The role-mismatch case
likewise depends on an unspecified environment reread by the factory.

Planner correction: pass explicit validated synthetic credentials to each auth
factory, including an explicitly constructed mismatched configuration. Keep the
production startup loader strict and retain the health-only factory behaviour.
Do not tell the implementer to read env implicitly to satisfy conflicting tests.

## Q2 — High: revised foundation component suites still lack an authenticated client precondition

References: `apps/tablet/src/__tests__/foundation.test.tsx:19–65,73–78`;
`apps/admin/src/__tests__/foundation.test.tsx:19–39,48–53`;
`apps/tablet/src/__tests__/f02-auth.test.tsx:108–118`.

The foundation helpers stub a successful session lookup, but neither signs in
nor seeds a client token/session. They render the same bare `<App />` that the
new auth suite requires to show login. A token-based client is entitled to avoid
requesting `/auth/session` when it holds no token; it then correctly stays signed
out and fails the foundation assertions. Returning identity from a mock on an
anonymous lookup is not an established authenticated precondition. These suites
also do not clear client storage during cleanup.

Planner correction: establish a contract-valid client session through explicit
login interaction (preferred), or a documented supported storage seam with a
token. Require the token on mocked session lookup and clear storage between
tests. Keep every existing health/readiness, label and lazy-route assertion.

## Q3 — Medium: unknown-ID case can pass on an absent route

Reference: `apps/api/tests/integration/f02-auth.test.ts:465–472`;
`specs/003-demo-auth/spec.md:58–67`.

This one inject request still targets `/api/challans/...`, although the API is
mounted at `/challans/...` and only the browser uses `/api`. Its expected 404
can therefore be Fastify's missing-route response rather than an unknown-record
response from the protected read handler.

Planner correction: inject the root-mounted path and establish a successful
known-record read with that authenticated caller before asserting the unknown
UUID returns 404. Preserve the unknown-record assertion.

## Q4 — Medium: role-mismatch fixture also creates a duplicate-username configuration

Reference: `apps/api/tests/integration/f02-auth.test.ts:353–383`;
`apps/api/tests/unit/f02-auth-config.test.ts:80–85`.

Changing the Marshal username to `DEMO-EMP-001` leaves the Admin username at
that same value. The intended stored-role mismatch is confounded with the
required duplicate-username configuration rejection. A strict loader can throw
before `ready()` or `inject()`, outside the assertions; a generic 500 can also
meet the current assertion without proving the stored-role guard.

Planner correction: construct three distinct configured usernames, with one
matched to an existing user of the wrong stored role. First prove the equivalent
valid configuration authenticates. Assert the documented mismatch refusal at
the appropriate configuration/login boundary, without accepting an unrelated
failure as evidence of the role guard. Coordinate this with Q1's explicit
credential injection.

## Disposition

Return Q1–Q4 to the planner in one bounded correction. No new owner product
decision is required. Preserve production code and all substantive acceptance
assertions. Document a numbered acceptance-baseline revision and refresh only
legitimately corrected planner artifacts, leaving historical manifests intact.
Rerun affected focused checks, record honest RED counts, then request preparation
confirmation before `/pilot.implement F-02`. No F-02 implementation approval is
given by this report.
