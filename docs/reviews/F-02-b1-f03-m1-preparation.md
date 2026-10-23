# Independent preparation confirmation — F-02 B1 / F-03 M1

Date: 2026-10-07. **Result: PASS for the bounded correction handoff.**
Request: `docs/review-requests/F-02-b1-f03-m1-preparation.md`.
Features: `specs/003-demo-auth` and `specs/004-master-data`.

This confirms planner-owned acceptance/spec corrections. It does not approve
F-03's unfixed production contracts or tick either parent's implementation/review
boxes. F-02 C1 remains closed; F-04 remains blocked. This reviewer changed no
production file, frozen acceptance, specification or baseline manifest.

## B1 preparation confirmed

Both restored-role browser tests obtain a real API-issued token, then use
`page.addInitScript` before the first navigation. The first app document therefore
starts with its token present and cannot perform the previous anonymous lookup
before test seeding. The racy `goto → evaluate → reload` setup is removed.
Real login, visible refusal, protected heading absence and server-side revocation
assertions remain intact. No arbitrary sleeps, retries, skips or auth bypass were
introduced. The causal descriptions in the handoffs now describe pending
anonymous cleanup rather than unsupported Chromium storage propagation.

## M1 preparation confirmed

The contradictory department-with-severity assertion is corrected. New negative
checks exercise wrong-kind fields on simple/violation/gate records, missing
kind-defining fields and list-kind/record-kind mismatch. Positive record/list
coverage includes all six approved kinds and valid nullable/default-action data.
Existing request-validation cases and real-DB/history tests are preserved.

The revised spec and handoff explicitly define symmetric strict record variants
and homogeneous lists. Legitimate service output already satisfies that shape;
the proposed change is bounded shared response validation, not a new business
workflow. In particular, violations require severity and a present nullable
defaultAction; gates require locationId; unrelated fields are forbidden.
Implementer must preserve request schemas and current API output/route names.

## Verification independently performed

| Command | Actual result |
|---|---|
| `sha256sum -c docs/handoffs/F-02-tests.sha256` | revision 5, 24/24 OK |
| `sha256sum -c docs/handoffs/F-03-tests.sha256` | revision 2, 9/9 OK |
| `sha256sum -c docs/handoffs/S-01-tests.sha256` | 11/11 OK |
| `sha256sum -c docs/handoffs/F-01-tests.sha256` | 14/14 OK |
| `sha256sum -c docs/handoffs/F-01-corrections-tests.sha256` | 10/10 OK |
| `sha256sum -c docs/handoffs/F-02-tests-rev4.sha256` | 22 OK / 2 expected mismatches: corrected browser specs |
| `sha256sum -c docs/handoffs/F-03-tests-rev1.sha256` | 7 OK / 2 expected mismatches: corrected unit file and feature spec |
| `pnpm run format:check` | PASS |
| `pnpm run lint` | PASS; boundary gate scans 85 files |
| `pnpm run typecheck` | PASS |
| `pnpm db:up` | Both PostgreSQL containers healthy |
| `pnpm --filter @echallan/api exec vitest run --project unit tests/unit/f03-master-contracts.test.ts` | 2 failed / 14 passed, 16 total |
| `pnpm --filter @echallan/api exec vitest run --project integration tests/integration/f03-master-data.test.ts` | 12 passed, real PostgreSQL |
| `pnpm exec playwright test apps/tablet/e2e/f02-auth.spec.ts -g "restored supervisor" --repeat-each=10 --workers=1` | 10 passed in 36.4 s |
| `pnpm exec playwright test apps/admin/e2e/f02-auth.spec.ts -g "restored marshal" --repeat-each=10 --workers=1` | 10 passed in 35.3 s |
| `pnpm run test:e2e` | 17 passed in 45.5 s |

M1 RED is exactly the intended live assertion failure: department severity is
accepted where false is required, and a department list accepts a gate record.
It is not route/module absence. All six positive response variants pass and
legitimate API/database behaviour remains green. Repeated browser runs are
stability evidence for the fixed test precondition, not retries after failure;
no failed run was discarded to obtain these counts.

Full root unit/regression builds and foundation checks were not repeated for
preparation. They are required after the production contract fix. The old
`136 passed` root count in the handoff's “Now” column is the pre-extension
checkpoint, not current GREEN: added tests make the current root suite expected
RED. Expected final GREEN is **138 root units**, **78 integration**, **17 browser**,
plus build/bundle/foundation gates; report any additional real cases accurately.

## Preserved and approved checkpoints

- F-02 revision-4 archive:
  `58794d8f905cee66b9514ebc3d8efd7d05120145c7cd71640c15e4f24510032e`,
  exactly the previously reviewed manifest.
- F-03 revision-1 archive:
  `2c808615aba136d01cce28cca430ca742c97eba9df03c46aea770de7e3a33a54`,
  exactly the previously reviewed manifest.
- **Approved active F-02 revision-5 manifest:**
  `ded602a67603b7ab91d9cf9a35a437718b04780772436b8634d56634009bada6`.
- **Approved active F-03 revision-2 manifest:**
  `d8f1b1d36c16584359fd0359100df93312f83586d1be0204f031e44cfc1755c2`.

Only the documented two entries per active baseline changed. Historical
manifests were not regenerated. Production master contracts remain at inspected
hash `5a50f66cc0d4a379dfcdd89a13d4b79e5abd8c4f4f43d387029ebade8d76b38a`.
The four F-02 client helper/provider hashes still match the C1 implementation
review. This preparation adds no runtime/migration change.

## Implementer handoff and stop

A fresh implementer may now execute **F-03 M1 only**, following
`docs/handoffs/F-03-prepared.md` → “Revision 2 — M1 contract-kind correction”.
Tighten returned record/list contracts, keep the service/migrations/history
behaviour intact and preserve both frozen test baselines. Obtain GREEN, check
API and both clients, run the prescribed affected/full gates and disposable-copy
fault sensitivity for kind-field and homogeneous-list enforcement, then restore
and rerun cleanly.

F-02 B1 needs no production edit: append corrected acceptance re-verification
to `docs/handoffs/F-02.md`; append M1 correction evidence to `docs/handoffs/F-03.md`.
Do not reopen C1 or other closed findings. Keep both parent review boxes
unchecked and stop for independent implementation/acceptance confirmation
before F-04. This preparation report itself authorises no completion tick.
