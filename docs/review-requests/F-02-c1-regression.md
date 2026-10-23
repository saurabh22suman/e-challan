# Preparation confirmation requested: F-02 C1 regression (revision 4)

Task: **F-02 — Login, roles, shift attribution and idle expiry**, feature
`specs/003-demo-auth`. Role of this request: independent **preparation** confirmation
before the bounded C1 production fix resumes. **No production code was changed in this
preparation.**

Source finding: `docs/reviews/F-02-correction-implementation.md` (CHANGES_REQUIRED,
**C1 only**). Q1–Q4, R1, R3 and R4 are closed and are not reopened. The parent
`Implemented` and `Reviewed` boxes remain unchecked.

## What this preparation contains

- `apps/tablet/src/__tests__/f02-auth.test.tsx` and
  `apps/admin/src/__tests__/f02-auth.test.tsx` each gain a
  `C1: restoration body decoding failures are treated as no session` block:
  - a seeded token plus a `200 OK` restoration response whose `json()` rejects must
    yield **no unhandled rejection**, token removal, the login screen visible and
    protected content absent;
  - a decoded invalid-schema control (`{}`) and a valid-restoration control are kept;
  - a stale decoding/read failure released after a newer successful login must be
    handled and must not erase the newer login, its token or render an alert.
  - the shared stub gains an additive `sessionJsonThrows` option; every pre-existing
    assertion is preserved.
- `docs/handoffs/F-02-prepared.md` **revision 4** with the exact implementer
  instructions (decode failure = no session; handle restoration rejections
  defensively; preserve monotonic transition ordering).
- `docs/handoffs/F-02-tests.sha256` **revision 4** (24 entries, 2 refreshed). The
  approved rev-3 checkpoint is archived byte-for-byte at
  `docs/handoffs/F-02-tests-rev3.sha256`; its own SHA-256 is
  `9c46ed067212f826e9721a87bdc1d7ab3959ed33ea31db9572383b1f49ac79fc`, exactly the
  approved value pinned in `docs/reviews/F-02-preparation-revision-3-followup.md`.
- `docs/implementation-plan.md` and `specs/003-demo-auth/tasks.md` notes updated; no
  checkbox was ticked.

## Measured RED against the current implementation

```bash
pnpm --filter @echallan/tablet exec vitest run src/__tests__/f02-auth.test.tsx
pnpm --filter @echallan/admin exec vitest run src/__tests__/f02-auth.test.tsx
pnpm --filter @echallan/tablet run test
pnpm --filter @echallan/admin run test
```

| Suite | Actual result | Failure |
|---|---|---|
| Tablet `f02-auth` file | 2 failed / 14 passed (16) | `an undecodable restoration body must not reject unhandled: expected [SyntaxError] to deeply equal []`; stale case: `the stale failure must be handled, not unhandled` |
| Admin `f02-auth` file | 2 failed / 10 passed (12) | same two assertions |
| Tablet component total | 2 failed / 19 passed (21) | — |
| Admin component total | 2 failed / 15 passed (17) | — |

Both controls pass, so the RED is behavioural (a rejected body read escapes cleanup),
not a missing module, an absent route or an infrastructure failure.

## Baselines actually verified

| Manifest | Result |
|---|---|
| `docs/handoffs/F-02-tests.sha256` (rev 4) | 24/24 OK |
| `docs/handoffs/F-02-tests-rev3.sha256` (archive) | own hash `9c46ed06…` matches the approved checkpoint; 22 OK / 2 expected FAILED (the two C1-extended files) |
| `docs/handoffs/F-02-tests-rev2.sha256` (archive) | own hash `fbfc5c15…` unchanged |
| `docs/handoffs/S-01-tests.sha256` | 11/11 OK |
| `docs/handoffs/F-01-tests.sha256` | 14/14 OK |
| `docs/handoffs/F-01-corrections-tests.sha256` | 10/10 OK |

Production files are untouched from the correction review: tablet `api.ts`
`bbd3477e…`, admin `api.ts` `9b8e6fb8…`, tablet `session.tsx` `7190ca7a…`, admin
`session.tsx` `9d4785f4…`.

## Reviewer checklist

1. Confirm the C1 acceptance is meaningful for **both** clients and that the controls
   and stale-ordering case are deterministic (no sleeps beyond a two-tick settle).
2. Confirm the failure mode captured is the unhandled rejection and the missing
   no-session cleanup, not a fixture artefact.
3. Confirm the rev-3 archive is byte-identical to the approved checkpoint and that no
   historical manifest or frozen assertion was altered.
4. Record PASS / CHANGES_REQUIRED in
   `docs/reviews/F-02-preparation-revision-4.md`, then return the batch to the
   implementer for the bounded C1 production fix and independent implementation
   re-review. F-03 remains blocked on F-02 review PASS.
