# F-02 C1 revision-4 independent preparation confirmation

Date: 2026-10-05. **Result: PASS — bounded C1 implementation handoff approved.**
Feature: `specs/003-demo-auth`. Request:
`docs/review-requests/F-02-c1-regression.md`. Source finding:
`docs/reviews/F-02-correction-implementation.md`, C1.

This is preparation confirmation, not implementation acceptance. Both F-02 parent
boxes remain unchecked and F-03 remains blocked. This reviewer did not change
production, frozen tests or planner manifests. Closed Q1–Q4/R1/R3/R4 findings
are not reopened.

## Test-integrity inspection

Both client auth suites add the same four meaningful C1 cases:

- A stored token with a 200 response whose body reader rejects requires no
  unhandled rejection, token removal, login visible and protected content absent.
- Decoded invalid-schema JSON remains a no-session control.
- A valid identity remains a successful-restoration control, retaining its token.
- A manually deferred body-read failure released after successful login must
  remain handled without erasing the new identity/token or showing an alert.

The rejection tracker adds/removes only its own process listener. It does not
remove the test runner's listeners or suppress errors; the collected errors are
explicitly asserted empty. `finally` removes the listener and suite cleanup
clears client storage. Two zero-delay event-loop turns settle rejection handling;
the stale-response order is controlled by a deferred promise and `act`, not
elapsed-time races. The response stub's rejected `json()` models the independently
observed decoding/read failure. Existing assertions are preserved.

The no-session case correctly remains RED before reaching its later cleanup
assertions because the unhandled rejection is already a meaningful violation.
Both controls pass. Required production handling is consistent with the existing
spec: helper returns null on decoding/read failure, providers handle rejection
defensively, and stale cleanup remains guarded by the transition identity.

## Commands independently rerun

| Command | Actual result |
|---|---|
| `sha256sum -c docs/handoffs/F-02-tests.sha256` | revision 4, 24/24 OK |
| `sha256sum -c docs/handoffs/S-01-tests.sha256` | 11/11 OK |
| `sha256sum -c docs/handoffs/F-01-tests.sha256` | 14/14 OK |
| `sha256sum -c docs/handoffs/F-01-corrections-tests.sha256` | 10/10 OK |
| `sha256sum docs/handoffs/F-02-tests-rev3.sha256` | approved revision-3 hash unchanged |
| `sha256sum -c docs/handoffs/F-02-tests-rev3.sha256` | 22 OK / 2 expected mismatches, exactly the C1-extended auth suites |
| `sha256sum docs/handoffs/F-02-tests-rev2.sha256` | original revision-2 hash unchanged |
| `pnpm --filter @echallan/tablet run test` | 2 failed / 19 passed, 21 total; auth file 2 failed / 14 passed |
| `pnpm --filter @echallan/admin run test` | 2 failed / 15 passed, 17 total; auth file 2 failed / 10 passed |
| `pnpm run format:check` | PASS |
| `pnpm run lint` | PASS; boundary gate scans 79 files |
| `pnpm run typecheck` | PASS |

The two failures per client are precisely the expected C1 no-unhandled-rejection
assertions, collecting the undecodable-body `SyntaxError`. This reproduces the
planner's measured behavioural RED; no missing module, route or infrastructure
failure is substituted. API/database/browser suites and production builds were
not rerun in this client-test preparation confirmation and are not claimed as
new passing evidence.

## Approved checkpoint

- Active revision-4 manifest hash:
  `58794d8f905cee66b9514ebc3d8efd7d05120145c7cd71640c15e4f24510032e`.
- Archived revision-3 manifest hash:
  `9c46ed067212f826e9721a87bdc1d7ab3959ed33ea31db9572383b1f49ac79fc`.
- Archived revision-2 manifest hash:
  `fbfc5c159a8aa3b93a5a6cd7648081b5c885ac1962225279e4977b9e75299c89`.

The active manifest changes only the two auth-suite entries; the other 22 match
the archived approved checkpoint. The four affected production files still match
the correction review:

```text
bbd3477eb319e0cfc3494315627eb0a1498fd662e240c016266445d93fb264b6  apps/tablet/src/auth/api.ts
9b8e6fb828e882a6302581680fdc55841cba9a8e4f37cd51db91f7974efff5b6  apps/admin/src/auth/api.ts
7190ca7a06512d0bf3aec3788ca694a9c935211cab29cf1d90c9f50799ecf9bb  apps/tablet/src/auth/session.tsx
9d4785f43d933c656780c600d74964abd947685d25fcc1732c1a518c5932259d  apps/admin/src/auth/session.tsx
```

## Implementer disposition

A fresh implementer session may now execute **C1 only**, starting at
`docs/handoffs/F-02-prepared.md` → “Revision 4 — C1 regression handoff”. Preserve
the frozen acceptance, spec/contracts, migration and closed findings. Record
RED, implement body-read failure handling and defensive guarded provider cleanup,
obtain GREEN, run the handoff's prescribed regressions and disposable-copy
sensitivity, append dated evidence to `docs/handoffs/F-02.md`, then request
independent implementation re-review and stop before F-03.

The handoff's closing instruction to keep boxes unchecked and request preparation
confirmation describes the preparation checkpoint. This report supplies that
confirmation. After actual complete GREEN verification, the implementer may tick
only Implemented and matching implementation tasks under the standard workflow;
Reviewed remains reviewer-owned and unchecked until independent acceptance.
Expected GREEN: tablet 21, admin 17, root units 122, integration 66, browser 17,
plus builds/bundle/foundation gates. No production approval is supplied here.
