# Final independent confirmation — F-03 M1 / F-02 B1

Date: 2026-10-07. **Result: PASS for F-02 and F-03 in their approved synthetic-demo
scope.** Request: `docs/review-requests/F-02-b1-f03-m1-implementation.md`.

This reviewer did not implement production changes or write the frozen planner
acceptance. This report closes the remaining B1/M1 findings and, together with
the prior inspected code/verification records, supplies independent task
acceptance. Both tasks' implementation/review boxes may be checked. The earlier
CHANGES_REQUIRED reports remain historical evidence and are superseded for the
accepted checkpoint, not rewritten.

## Findings closed

- **F-02 C1:** previously independently closed in
  `docs/reviews/F-02-c1-implementation.md`, including browser reproduction and
  three-fault sensitivity. The four client helper/provider files remain at their
  reviewed hashes. This correction introduces no F-02 runtime change.
- **F-02 B1:** both browser fixtures seed a real API-issued token before first
  navigation through `addInitScript`. Anonymous setup can no longer clear an
  externally seeded token. Role refusal, protected-content absence and server
  revocation assertions are preserved. The independent preparation review ran
  10 clean repeats per client; final full browser regression passes again.
- **F-03 M1:** the single changed production file,
  `packages/contracts/src/masters.ts`, now rejects wrong-kind fields, requires
  violation severity/present nullable defaultAction and gate locationId, and
  enforces list homogeneity. Strict request schemas and legitimate response
  shapes are preserved. Service/routes/guard/history behaviour are unchanged
  from the previously inspected checkpoint.

`superRefine` enforces runtime kind constraints without inventing a new route or
changing the API's legitimate shape. Both client consumers and API typechecks,
tests and production builds pass. No production finding remains open in the
bounded F-02/F-03 scope.

## Commands independently rerun

| Command | Actual result |
|---|---|
| `sha256sum -c docs/handoffs/F-02-tests.sha256` | revision 5, 24/24 OK |
| `sha256sum -c docs/handoffs/F-03-tests.sha256` | revision 2, 9/9 OK |
| `sha256sum -c docs/handoffs/S-01-tests.sha256` | 11/11 OK |
| `sha256sum -c docs/handoffs/F-01-tests.sha256` | 14/14 OK |
| `sha256sum -c docs/handoffs/F-01-corrections-tests.sha256` | 10/10 OK |
| `pnpm run format:check` | PASS |
| `pnpm run lint` | PASS; boundary gate scans 85 files |
| `pnpm run typecheck` | PASS, shared builds, five workspace projects and e2e |
| `pnpm run test` | **138 passed**: contracts 8, API 92, tablet 21, admin 17 |
| `pnpm db:up` | Both PostgreSQL containers healthy |
| `pnpm run test:integration` | **78 passed**, eight files: F-01 42, F-02 24, F-03 12 |
| `pnpm run test:e2e` | **17 passed** in 45.5 s, real review-started API and clients after integration |
| `pnpm run build` | All five workspace artifacts built |
| `pnpm run check:tablet-size` | **145329 B gzip** initial JS, below 250000 B |
| `pnpm run test:foundation` | **27 passed** in 113.743 s, including disposable clean-artifact gates |

Full suites use no narrowed/skipped acceptance to reach GREEN. F-03's focused
contract file contains 16 passing cases within the 92 API units; its 12 real-DB
cases remain green. B1 repeated-run evidence from the independent preparation
review is retained; it was not rerun unnecessarily after this contract-only fix.

## Independent M1 failure sensitivity

Command: `python3 /tmp/opencode/f03-m1-independent-sensitivity.py`.
The script copies source/tests without secrets/generated artifacts, resolves
workspace contracts to the copy, rebuilds only copied contracts, and invokes
the unchanged frozen unit file using the pinned installed Vitest runtime.
All mutations are confined to that disposable copy:

| Rule/control | Actual result |
|---|---|
| Clean copied contracts | 16 unit cases passed |
| Accept wrong-kind fields on simple masters | 1 failed / 15 passed |
| Remove violation severity and defaultAction requirements | 1 failed / 15 passed |
| Remove gate location requirement | 1 failed / 15 passed |
| Remove homogeneous-list requirement | 1 failed / 15 passed |
| Remove severity requirement only | isolated severity-less record accepted; rejection probe fails |
| Remove defaultAction-presence requirement only | isolated missing-action record accepted; rejection probe fails |
| Restore original file | 16 unit cases passed; both isolated invalid records rejected |

The temporary copy is removed automatically. Repository production/test bytes
were never fault-mutated. These are direct regression failures, not missing
imports or build failures.

**Coverage limitation disclosed and accepted:** the frozen negative violation
case omits severity and defaultAction together, so it does not distinguish those
guards alone. Independent isolated probes above verify each rule and its fault
sensitivity. No missing coverage is disguised as a supplied test assertion;
future planner work may add granular assertions without changing this accepted
behaviour. The current acceptance is supported by code inspection, runnable
baseline coverage and the independent isolated checks, not the grouped test alone.

## Task coverage and boundaries

- **F-02 AUTH-01/02:** real env-backed role login, correct-client refusal,
  API role/location/post checks, real logout/revocation and safe error contracts.
- **AUTH-03 scoped:** unknown/expired/revoked tokens and restoration body handling
  are verified. No refresh workflow, disable/reset path or AUTH-06 claim.
- **AUTH-04/05:** controlled-clock tablet idle logout/unsent-state clearing,
  transition ordering, required compatible shift and explicit context selection.
- **F-03 MST-01:** six Admin-managed master sets, strict per-kind requests and
  returned records, idempotent deactivate, no delete/reactivate route and real
  non-admin refusal.
- **MST-02/03:** active-only catalogues including parent-location gate rule,
  management retention, references and immutable issued snapshots through edits
  and deactivation, verified with real PostgreSQL.

The original F-03 route-unregistration RED remains surface absence, not
behavioural evidence. The M1 correction supplies independently reproduced
contract-assertion RED followed by GREEN, completing the returned T006 evidence.
Owner-authorised same-session preparation/implementation and the earlier
dependency override remain disclosed process deviations; they are not
retroactively relabeled independent test-first preparation.

The accepted result is the demo mechanism, not production staff authentication
or issuance acceptance. Master audit enforcement/screens, actual tablet
camera/signature/sleep-wake, trusted HTTPS, hosted CI, deployment and restore
remain their later gates. No device evidence is supplied by desktop Chromium.

## Accepted snapshot and next task

Accepted changed implementation/config/harness/evidence files, both active
baselines and current completion checklists are pinned in
`docs/reviews/F-02-F-03-accepted.sha256`. Individual frozen test/spec/fixture
hashes remain in the F-02 revision-5 and F-03 revision-2 manifests. Historical
S-01/F-01 manifests and F-02/F-03 archives remain unchanged; legitimate later
extensions are not falsely reported byte-identical to their older snapshots.

F-02 and F-03 are independently accepted at this checkpoint. **F-04 is now ready
for bounded planning and acceptance-test preparation**; it is not implemented
by this result. Stop here rather than advancing the backlog automatically.
