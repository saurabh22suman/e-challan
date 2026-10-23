# F-02 prepared planner handoff — REVISION 4 (C1 regression correction)

> **Implementer: start with "Revision 4 — C1 regression handoff" at the end of this
> document.** Everything above it is the historical revision-3 batch, retained for
> audit. C1 is the only open scope; do not reopen Q1-Q4, R1, R3 or R4.

Prepared: 2026-10-04, planner/test-owner session. Parent: **F-02**, both boxes
unchecked (the independent implementation review returned it). Feature:
`specs/003-demo-auth`. Cases: AUTH-01, AUTH-02, AUTH-03 (scoped), AUTH-04, AUTH-05.
**AUTH-06 is out of scope.**

**This record authorises no production change and approves nothing.** It corrects the
acceptance and preparation defects in two independent reviews, records the real RED
against the reviewed implementation, and hands a bounded correction batch to an
implementer session.

- `docs/reviews/F-02-preparation-revision-2.md` — **CHANGES_REQUIRED**, Q1–Q4.
- `docs/reviews/F-02.md` — **CHANGES_REQUIRED**, R1–R5.

No new owner product decision is required. The approved demo-auth scope and the
production deferrals (addendum A §4, B-08) are unchanged.

## Revision history

- **rev 1** (2026-10-03): initial preparation; superseded.
- **rev 2** (2026-10-03): resolved the first preparation review P1–P6. Verified 24/24,
  then implemented; independent implementation review returned CHANGES_REQUIRED.
- **rev 3** (2026-10-04): resolved preparation Q1–Q4 and prepared regression
  acceptance for implementation R1–R4; corrected the spec/plan/acceptance
  inconsistencies and the handoff evidence inaccuracies. Archived byte-for-byte at
  `docs/handoffs/F-02-tests-rev3.sha256`.
- **rev 4** (2026-10-05, this revision): adds the bounded C1 regression acceptance
  for restoration body decoding failures in both clients, after
  `docs/reviews/F-02-correction-implementation.md` returned CHANGES_REQUIRED. Only
  the two client auth suites change; the approved rev-3 checkpoint is preserved.

## Baseline verification actually run

| Manifest | Result |
|---|---|
| `docs/handoffs/S-01-tests.sha256` | **11/11 OK** |
| `docs/handoffs/F-01-tests.sha256` | **14/14 OK** |
| `docs/handoffs/F-01-corrections-tests.sha256` | **10/10 OK** |
| `docs/handoffs/F-02-tests-rev2.sha256` (archived) | **preserved byte-for-byte**; its own SHA-256 `fbfc5c15…` matches the manifest recorded in `docs/reviews/F-02-inspected.sha256`. Running the check now gives 15 OK / 9 FAILED, the nine being exactly the artifacts rev3 corrects |
| `docs/reviews/F-01-accepted.sha256` | **28/33 OK, 5 FAILED** — exactly README, `packages/contracts/src/index.ts`, `apps/api/src/db/schema.ts`, `drizzle/meta/_journal.json`, `docs/implementation-plan.md`: the documented F-02 extensions and planning delta, not a source regression |

The reviewer's `docs/reviews/F-02-inspected.sha256` still matches the current production
files, so this batch builds on exactly the reviewed revision. No historical manifest was
edited or regenerated.

## Q1–Q4 and R1–R4 disposition

| Item | Disposition | Where |
|---|---|---|
| **Q1** factory seam silently read env | Corrected acceptance: every auth app in the integration suite now gets explicitly injected credentials; a new case proves that omitting them fails closed even when `process.env` holds valid values. Spec now forbids an implicit environment fallback in the factory; `server.ts` stays the only strict loader | `f02-auth.test.ts` "Q1", spec §Harness |
| **Q2** foundation suites lacked an authenticated precondition | Both foundation component suites now sign in through the real form against a stub that **requires the issued token** on session lookup, and clear client storage between tests; a new falsifiability case proves an anonymous lookup never yields identity. All substantive assertions kept | both `foundation.test.tsx` |
| **Q3** unknown-ID case could pass on an absent route | Corrected: inject the root-mounted `/challans/:id`, prove a known-record 200 with the same caller and handler first, then require the unknown UUID to be a controlled 404. Passes against the reviewed implementation (strengthening, not RED) | `f02-auth.test.ts` "Q3" |
| **Q4** role-mismatch fixture was also a duplicate-username config | Corrected: three distinct usernames, a valid control that authenticates first, and the refusal asserted as the documented `role_mismatch` code with no token. Passes against the reviewed implementation (strengthening, not RED) | `f02-auth.test.ts` "Q4" |
| **R1** client gates ignored role | Acceptance: fresh-login and restored-session refusal on both clients — visible feedback, no protected content, no retained token, and the refused session revoked. Component (deterministic) + browser (real API token capture) | both `f02-auth.test.tsx`, both `f02-auth.spec.ts` |
| **R2** stale restoration erased a newer login | Acceptance: manually released restoration responses around successful login and after logout, on both clients, with deterministic ordering (no timeouts) | both `f02-auth.test.tsx` |
| **R3** required shift could be omitted; ambiguity had no resolution path | Acceptance: real-DB zero-shift refusal; real-DB ambiguous post **and** shift resolution with stored candidates; explicit selection succeeds; tablet UI must render labelled selects from API options only, preserve credentials and resubmit the chosen ids. New shared contract `AmbiguousContextResponseSchema` specified | `f02-auth.test.ts`, tablet `f02-auth.test.tsx`, spec §Contract/§Client |
| **R4** malformed IDs exposed SQL in a 500 | Acceptance: four malformed ids must return the controlled `404 not_found` body with exactly the contract keys and no SQL/parameters/driver text | `f02-auth.test.ts` "R4" |
| **R5** handoff/documentation inaccuracies | Corrected in the planner addendum of `docs/handoffs/F-02.md`; the ownership/handoff instructions in this document and `plan.md` no longer claim what the implementation did not do | `docs/handoffs/F-02.md` addendum |

## What changed in the planner-owned inputs

| File | Change |
|---|---|
| `apps/api/tests/integration/f02-auth.test.ts` | Q1 explicit credential injection + fail-closed case; Q3 corrected path with control read; Q4 distinct mismatch fixture with control; R3 zero-shift and ambiguity cases with **exact stored candidate sets and explicit exclusions**; R4 malformed-ID case; tightened `forbidden_context` codes. No existing substantive assertion removed |
| `apps/tablet/src/__tests__/foundation.test.tsx` | Q2 authenticated precondition through the form; token required by the session stub; storage isolation; anonymous-lookup falsifiability case |
| `apps/admin/src/__tests__/foundation.test.tsx` | Same, admin accounts |
| `apps/tablet/src/__tests__/f02-auth.test.tsx` | R1 fresh + restored role refusal; R2 stale-response ordering around login and logout; R3 explicit context selection with a selection-consistent fixture, exact option sets, no pre-selection, no extra options and credentials retained on the final retry |
| `apps/admin/src/__tests__/f02-auth.test.tsx` | R1 fresh + restored role refusal; R2 stale-response ordering around login and logout |
| `apps/tablet/e2e/f02-auth.spec.ts` | R1 browser refusal: supervisor fresh login revoked, and a real restored supervisor token refused |
| `apps/admin/e2e/f02-auth.spec.ts` | R1 browser refusal: marshal fresh login revoked, and a real restored marshal token refused |
| `specs/003-demo-auth/spec.md` | `AmbiguousContextResponseSchema`; zero-shift refusal; malformed-ID 404; client role boundary; transition ordering; tablet selection flow; storage seam; factory never reads env |
| `specs/003-demo-auth/plan.md` | Revision-3 correction batch instructions and commands |
| `docs/handoffs/F-02-tests.sha256` | Revision 3 (see below) |

Nothing else. Production code, migrations, the committed fixture, the addendum, the
decision records, `tests/foundation/**` and every historical manifest are untouched.

## Focused commands and measured RED (against the reviewed implementation)

```bash
sha256sum -c docs/handoffs/F-02-tests.sha256   # revision 3, 24/24
sha256sum -c docs/handoffs/S-01-tests.sha256
sha256sum -c docs/handoffs/F-01-tests.sha256
sha256sum -c docs/handoffs/F-01-corrections-tests.sha256
pnpm run build:packages
pnpm db:up
pnpm --filter @echallan/api exec vitest run --project unit tests/unit/f02-auth-config.test.ts
pnpm --filter @echallan/api exec vitest run --project integration tests/integration/f02-auth.test.ts
pnpm --filter @echallan/tablet run test
pnpm --filter @echallan/admin run test
pnpm run test:e2e
```

| Suite | Measured | Failing cases and genuine reason |
|---|---|---|
| API unit `f02-auth-config` | **18 passed** | unchanged contract-level acceptance |
| API integration `f02-auth` | **24 total — 4 failed / 20 passed** | `Q1`: omitted credentials authenticated **200** where fail-closed **401** is required. `R3 zero-shift`: marshal login returned **200 with no shift** where **403** is required. `R3 ambiguity`: the exact authorised candidate set is absent (`expected [] to deeply equal [{id,label} × 2]`). `R4`: `GET /challans/not-a-uuid` returned **500 with the full Drizzle SQL and `params: not-a-uuid,1`** where a controlled **404** is required. Q3, Q4 and the tightened context refusals pass |
| Tablet component | **17 total — 5 failed / 12 passed** | R1 fresh: no refusal alert (`Unable to find role="alert"`); R1 restored: same; R2 after login: the stale 401 **erased the new session** (`Unable to find heading`); R2 after logout: the stale valid identity **signed the operator back in** (`expected document not to contain … <h1`); R3: the 422 response is not understood and no `Post` selector is offered. All 7 original auth cases and the foundation suite pass |
| Admin component | **13 total — 4 failed / 9 passed** | R1 fresh: no refusal alert; R1 restored: same; R2 after login: stale 401 erased the new session; R2 after logout: stale identity resurrected the shell |
| Browser `pnpm run test:e2e` | **17 total — 4 failed / 13 passed** (49.1 s) | R1 tablet fresh + restored and R1 admin fresh + restored: the wrong-role account **reaches the protected heading** (`expect(locator).toBeVisible()` for the refusal alert fails). Every pre-existing journey still passes |

None of these failures is a missing module, an absent route or an infrastructure
failure. The integration and component failures are real assertions on live surfaces;
the browser failures are real wrong-role sessions reaching protected content.

Two corrections are **green immediately** because they strengthen detection rather than
demand new behaviour: Q3 (the reviewed handler already returns 404 for an unknown UUID)
and Q4 (the reviewed guard already returns `role_mismatch`). Their value is that they now
fail when those guards regress; the implementer must keep them green.

`pnpm run test` and `pnpm test:foundation` are therefore **expected RED at this prepared
checkpoint**, because they include the new component acceptance. That is the intended
prepared state, not an environment failure. Do not narrow a check to reach green.

## Review follow-up: candidate filtering and tablet fixture (closed)

Two findings were raised against the first revision-3 draft and are now closed in the
frozen acceptance. Both were test-strength gaps, not production findings.

**1. Candidate filtering was not proven.** The R3 integration case only required
`postOptions` to contain a known post (`length >= 2` + `some(...)`), so an API that also
offered an unauthorised dispatch post or a fabricated option still passed. The case now
derives the **exact** stored option sets from the database and asserts full set equality
(ids and labels), asserts `shiftOptions` is exactly `[]` while the post is ambiguous, and
explicitly excludes the dispatch post and dispatch shift. The spec now states that a
shift is compatible only when it is active at the post's gate and that the two
resolution steps are separate.

*Mutation-verified in a disposable copy.* A minimal candidate implementation was added
to the copy, then faults injected:

| Injected fault | Result |
|---|---|
| Correct candidates (control) | R3 case **passes** |
| Fabricated post + fabricated shift option | **fails**: exact post set `[3] != [2]` |
| Real unauthorised dispatch post + dispatch shift | **fails**: exact post set `[3] != [2]` |
| Fabricated shift option only | **fails**: exact shift set `[3] != [2]` |

**2. Tablet selection fixture was inconsistent and under-asserted.** The success mock
returned `POST_ID`/`SHIFT_ID` while the operator had selected `POST_ALPHA`/`SHIFT_NIGHT`,
and the test did not check option lists, pre-selection or credentials on the final retry.
The mock now echoes the selected context, and the test asserts: exactly the returned
options plus one empty-valued placeholder per selector; no non-empty value pre-selected;
no invented or extra option; credentials preserved on both the first and the final
retry; and the accepted shell showing the chosen post label.

*Mutation-verified in the same disposable copy* with a minimal selection UI:

| Injected fault | Result |
|---|---|
| Correct selection UI (control) | R3 case **passes** |
| Client sends a different post than the operator chose | **fails**: `attempts[2].postId` mismatch |
| First post option pre-selected automatically | **fails**: `no post may be pre-selected` |
| Fabricated extra option rendered | **fails**: option values `['', …3] != ['', …2]` |
| Credentials dropped on the ambiguity retry | **fails**: no shift selector, retry never reaches the API |

The disposable copy was removed; the user's repository was not modified for either
check, and no production code was implemented in this batch.

## Exact implementer instructions

1. **Factory seam (Q1).** Remove the implicit environment fallback from `createApp`:
   omitted `credentials` means no configured accounts, always. Keep the health/readiness
   factory usable without credentials. `server.ts` stays the only
   `loadDemoCredentials(process.env)` caller and keeps failing fast on missing, blank and
   ambiguous configuration. Do not re-add a hidden fallback. If the public option shape
   needs to change, keep it source-compatible for the health-only suites.
2. **Client role boundary (R1).** In each client, after a login response and after a
   session restoration, accept only the roles approved for that surface (tablet:
   Marshal; dashboard: Supervisor, Admin). On refusal: show accessible feedback on the
   login screen, revoke the session the client will not use (POST logout with its token),
   clear the stored token and render no protected content. Server-side scope enforcement
   stays unchanged and independent.
3. **Transition ordering (R2).** Track a monotonic transition identity (or equivalent) so
   a later login/logout wins over an earlier in-flight restoration and a stale
   restoration (refusal or identity) can never overwrite newer state. Treat a rejected or
   malformed restoration body as "no session", never as a crash.
4. **Required and ambiguous context (R3).** A Marshal login must fail closed
   (`403 forbidden_context`, no session) when no compatible active shift exists. When
   omitted context cannot be resolved to one candidate, answer `422 ambiguous_context`
   with `postOptions` and `shiftOptions` arrays built from **stored, active, authorised**
   rows only — no invented values. A supplied authorised selection always succeeds and is
   never re-asked. Add the shared `AmbiguousContextResponseSchema` in
   `packages/contracts` and use it from the API and the tablet client.
5. **Tablet selection UI (R3).** On `ambiguous_context`, the tablet sign-in screen keeps
   the entered credentials and renders a labelled native `<select>` for each non-empty
   option list, offering only the returned options with no pre-selected value. The submit
   control retries the login with the chosen `postId`/`shiftId`; the API's next
   `ambiguous_context` may supply the shift options. Never fabricate or default an
   option.
6. **Malformed IDs (R4).** Validate the `:id` parameter before any database call. A
   malformed or unknown id returns the same controlled `404 not_found` body
   (`{error, message}` only) with no SQL, parameters, driver text or internal detail. An
   unexpected error must never serialise query internals.
7. **Do not touch** the planner-owned files listed below, any migration, or the shared
   contracts' existing shapes. Do not weaken any acceptance assertion.
8. **Evidence.** Follow `specs/003-demo-auth/plan.md` steps 1–12. Append the
   correction-batch evidence to `docs/handoffs/F-02.md` without replacing its history,
   and include the R5 documentation corrections. Tick F-02 implementation only when the
   revision-3 acceptance and every regression gate pass. Stop for independent review.

## Expected counts after the correction

| Suite | Now | After |
|---|---|---|
| API unit (`f02-auth-config`) | 18 passed | 18 passed |
| API integration `f02-auth` file | 4 failed / 20 passed (24) | **24 passed** |
| `pnpm --filter @echallan/tablet run test` | 5 failed / 12 passed (17) | **17 passed** |
| `pnpm --filter @echallan/admin run test` | 4 failed / 9 passed (13) | **13 passed** |
| `pnpm run test` (root units) | RED | **114 passed** (contracts 8, API 76, tablet 17, admin 13) |
| `pnpm run test:integration` | RED | **66 passed** (42 F-01 + 24 F-02) |
| `pnpm run test:e2e` | 4 failed / 13 passed (17) | **17 passed** |
| `pnpm test:foundation` | RED at this checkpoint | **27 passed** |

Report additional meaningful tests honestly.

## Verification commands for the implementer

`format:check` → `lint` → `typecheck` → focused suites → root unit → real-DB integration →
F-01 regressions → browser journeys → affected builds → tablet size → foundation
clean-artifact checks, exactly as in `specs/003-demo-auth/plan.md`.

Disposable-copy fault sensitivity must now also cover the corrected guards: the factory
fail-closed seam, the client role boundary, the restoration ordering, the zero-shift
refusal and the malformed-ID validation, in addition to the original four. Never mutate
the user's repository.

## Ownership for this batch

| Path | Ownership |
|---|---|
| `apps/api/tests/**`, `apps/*/src/__tests__/**`, `apps/*/e2e/**`, `tests/e2e/**`, `tests/fixtures/**` | **Planner-owned, frozen at revision 3.** Do not edit |
| `specs/003-demo-auth/{spec,plan}.md`, `docs/eChallan_replacement_spec*.md`, `docs/handoffs/demo-env-login-decision.md`, `docs/reviews/**`, every `*.sha256` | **Read-only.** Never regenerate to fix a failure |
| `.env.example`, `playwright.config.ts`, `.github/workflows/ci.yml`, root/app `package.json`, `apps/*/vite.config.ts`, `packages/contracts/src/**`, `apps/api/src/**`, `apps/{tablet,admin}/src/**` | **Writable by the implementer** |

## Scope honesty (unchanged)

Delivered: AUTH-01, AUTH-02, AUTH-03 (scoped: no refresh, no disable path), AUTH-04
(tablet, controlled clock, no physical tablet claim), AUTH-05. Not delivered and not
claimed: AUTH-06, production credential management (E1.4/E1.5, B-08), per-person
attribution, SSO, offline issuance, deployment, camera/signature hardware, HTTPS,
backup/restore.

## Stop

Correct, re-verify, then request independent review. Do not advance to F-03.

---

# Revision 4 — C1 regression handoff

Prepared 2026-10-05 by the planner/test-owner session from
`docs/reviews/F-02-correction-implementation.md` (**CHANGES_REQUIRED**, finding C1).
**Scope is C1 only.** Q1–Q4, R1, R3 and R4 are corrected and closed; do not reopen
them. No new product decision or contract change is needed.

## The defect

`fetchSession` in both clients catches a rejected `fetch`, but `await response.json()`
sits outside that catch. A `200 OK` restoration response whose body cannot be decoded
(interrupted body, proxy HTML) therefore rejects the helper. The providers call
`.then(...)` with no rejection handler, so cleanup never runs: the stored token
remains, an unhandled rejection is emitted, and the failure is not treated as
"no session". Decoded invalid-schema JSON is already handled; JSON decoding/body-read
failure is not.

## Acceptance added (frozen at revision 4)

Both `apps/tablet/src/__tests__/f02-auth.test.tsx` and
`apps/admin/src/__tests__/f02-auth.test.tsx` gain a
`C1: restoration body decoding failures are treated as no session` block. The stub
helper gains an additive `sessionJsonThrows` option (a `200` response whose `json()`
rejects); every pre-existing assertion is untouched.

| Case | Requirement |
|---|---|
| Invalid-JSON restoration | Seeded token + a successful session response whose `json()` rejects → **no unhandled rejection**, the token is removed, the login screen is visible, protected content is absent |
| Decoded invalid-schema control | `{}` body still behaves as no session (already green) |
| Valid-restoration control | A valid identity restores the session and keeps the token (already green) |
| Stale decoding failure | A restoration read failure released after a newer successful login must be handled (no unhandled rejection) and must **not** erase the newer login, its token or render an alert |

## Measured RED against the current implementation

```bash
pnpm --filter @echallan/tablet exec vitest run src/__tests__/f02-auth.test.tsx
pnpm --filter @echallan/admin exec vitest run src/__tests__/f02-auth.test.tsx
pnpm --filter @echallan/tablet run test
pnpm --filter @echallan/admin run test
```

| Suite | Result | Failure |
|---|---|---|
| Tablet `f02-auth` file | **2 failed / 14 passed (16)** | `an undecodable restoration body must not reject unhandled: expected [SyntaxError] to deeply equal []`; and the stale-failure equivalent `the stale failure must be handled, not unhandled` |
| Admin `f02-auth` file | **2 failed / 10 passed (12)** | same two assertions |
| Tablet component total | **2 failed / 19 passed (21)** | — |
| Admin component total | **2 failed / 15 passed (17)** | — |

Both controls pass, so the RED is behavioural (a rejected body read escapes cleanup),
not a missing module, an absent route or an infrastructure failure.

## Exact implementer instructions

1. **Decode failures are "no session".** In both `fetchSession` helpers, treat any
   failure while reading/decoding the response body exactly like a refused request:
   the helper must resolve to `null`, never reject. The simplest correct shape is to
   move the body read inside the existing `try` (or add a second `try/catch` around
   it). Keep the decoded invalid-schema path returning `null` as it does today.
2. **Restoration rejections are handled defensively.** The providers must not rely on
   the helper never rejecting: attach a rejection handler (or `await` inside an async
   effect) that treats a failed restoration as "no session" and performs the same
   cleanup (remove the stored token, remain signed out). No unhandled rejection may
   be emitted.
3. **Preserve monotonic transition ordering.** Cleanup from a failed restoration may
   only apply when that restoration is still the current transition. A stale failure
   released after a newer login or logout must not clear the newer session, remove its
   token or render an alert. Apply the same transition check in the failure path that
   the success path already uses.
4. **Do not touch** the frozen acceptance files, the spec, the migration, or any
   closed finding. Do not weaken, skip or narrow an assertion.

## Expected GREEN after the fix

| Suite | Now | After |
|---|---|---|
| Tablet `f02-auth` file | 2 failed / 14 passed (16) | **16 passed** |
| Admin `f02-auth` file | 2 failed / 10 passed (12) | **12 passed** |
| `pnpm --filter @echallan/tablet run test` | 2 failed / 19 passed (21) | **21 passed** |
| `pnpm --filter @echallan/admin run test` | 2 failed / 15 passed (17) | **17 passed** |
| `pnpm run test` (root units) | RED | **122 passed** (contracts 8, API 76, tablet 21, admin 17) |
| `pnpm run test:integration` | 66 passed | **66 passed** (unchanged) |
| `pnpm run test:e2e` | 17 passed | **17 passed** (unchanged) |

## Verification and evidence

Run format check → lint → typecheck → the two focused client files → root units →
real-DB integration → browser journeys → builds → tablet size → foundation
clean-artifact checks. Then, in a disposable copy, bypass each corrected behaviour in
turn and show the matching C1 case fails: (a) let the body read reject unhandled,
(b) swallow the failure but skip cleanup, (c) perform cleanup from a stale failure
without the transition check (the stale-login case must fail). Restore, rerun cleanly,
and never mutate the user's repository.

Append the evidence to `docs/handoffs/F-02.md` as a new dated section without
replacing history: exact RED/GREEN commands and counts, the fault-sensitivity table,
and any limitation. Keep the parent **Implemented and Reviewed unchecked**; this
preparation authorises no tick. Stop before F-03 and request independent preparation
confirmation.

## Baselines

- Active: `docs/handoffs/F-02-tests.sha256` **revision 4**, 24 entries.
- Approved rev-3 checkpoint archived byte-for-byte at
  `docs/handoffs/F-02-tests-rev3.sha256` (own hash `9c46ed06…`); it now reports
  22 OK / 2 expected FAILED, exactly the two C1-extended client files.
- Rev 2 archived at `docs/handoffs/F-02-tests-rev2.sha256` (own hash `fbfc5c15…`).
- S-01 11/11, F-01 14/14, F-01 corrections 10/10 unchanged.

---

# Revision 5 — B1 browser-setup correction

Prepared 2026-10-05 by the planner/test-owner session for finding B1 in
`docs/reviews/F-02-c1-implementation.md` (**C1 is closed**; B1 concerns acceptance
integrity). Scope is B1 only; no other F-02 finding is reopened. **No production
change is indicated or authorised by this revision.**

## The defect and the corrected cause

Both restored-role browser tests seeded storage under a running anonymous page:

```text
page.goto('/')  ->  page.evaluate(localStorage.setItem)  ->  page.reload()
```

The anonymous navigation starts `/auth/session` requests; a pending refusal completes
after the storage write and the provider's no-session cleanup removes the externally
seeded token. The reloaded app then correctly sees no token. The earlier "Chromium
propagation" explanation was unsupported and is withdrawn in the F-02/F-03 handoff
addenda.

## Corrected acceptance (frozen at revision 5)

`apps/tablet/e2e/f02-auth.spec.ts` and `apps/admin/e2e/f02-auth.spec.ts`: the real
API-issued token is now seeded with `page.addInitScript` **before the first
navigation**, so the first document starts with the token already in storage. All
assertions are preserved: real login status 200 and token, role-refusal alert visible,
protected heading absent, and the server rejecting the revoked token (`401` via the
API). No sleeps, retries or conditional skips.

## Commands and results actually run

```bash
pnpm exec playwright test apps/tablet/e2e/f02-auth.spec.ts -g "restored supervisor" --repeat-each=10 --workers=1
pnpm exec playwright test apps/admin/e2e/f02-auth.spec.ts -g "restored marshal" --repeat-each=10 --workers=1
pnpm run test:e2e
```

| Command | Result |
|---|---|
| tablet restored case, 10 repeats | **10 passed** |
| admin restored case, 10 repeats | **10 passed** |
| full browser suite | **17 passed** (45.6 s, clean server start) |

Baseline: `docs/handoffs/F-02-tests.sha256` is now **revision 5** (24 entries, 2
refreshed). Revision 4 is archived byte-for-byte at
`docs/handoffs/F-02-tests-rev4.sha256` (own hash `58794d8f…`, the value pinned in the
review); it now reports 22 OK / 2 expected FAILED — exactly the two corrected specs.
S-01 11/11, F-01 14/14, F-01-corrections 10/10 and F-03's baseline are unchanged.

## Implementer instruction

After independent preparation confirmation: re-run the focused browser cases and the
full gate order against the corrected acceptance, append the result to
`docs/handoffs/F-02.md` without replacing history, and stop for review. No production
fix is requested; if any runtime change is proposed, return to the planner first.
