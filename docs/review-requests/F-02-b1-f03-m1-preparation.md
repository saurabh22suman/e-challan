# Preparation confirmation requested: combined B1 + M1 correction batch

Tasks: **F-02** (finding B1, browser acceptance setup) and **F-03** (finding M1,
master-contract kind enforcement). Role of this request: independent **preparation**
confirmation before any production fix. C1 is closed and is not reopened; no other
finding is reopened.

Sources: `docs/reviews/F-02-c1-implementation.md` (B1);
`docs/reviews/F-03.md` (M1).

## What this batch contains

**F-02 B1 — planner-owned acceptance correction, no production change.**

- Both restored-role browser tests now seed the real API-issued token with
  `page.addInitScript` **before the first navigation**, replacing the racy
  `goto → evaluate(setItem) → reload` setup. Role-refusal, protected-content-absence,
  real-token and server-revocation assertions are preserved; no sleeps or retries.
- The unsupported "Chromium propagation" explanation is corrected in
  `docs/handoffs/F-02.md`, `docs/handoffs/F-03.md` and
  `docs/handoffs/F-03-prepared.md`: the pending anonymous `/auth/session` refusal
  cleared the externally seeded token.
- Prepared handoff: revision-5 section of `docs/handoffs/F-02-prepared.md`.
- Baseline: `docs/handoffs/F-02-tests.sha256` **revision 5** (24 entries, 2
  refreshed). Revision 4 archived byte-for-byte at
  `docs/handoffs/F-02-tests-rev4.sha256` (own hash `58794d8f…`, the reviewed value).

**F-03 M1 — acceptance + spec correction, production fix handed to the implementer.**

- The contradictory unit assertion ("a department with severity is valid") is
  replaced by strict kind-specific rejection cases and homogeneous-list rejection,
  with positive coverage for all six legitimate variants.
- `specs/004-master-data/spec.md` states the strict, symmetric kind rules and list
  homogeneity explicitly.
- Prepared handoff: revision-2 section of `docs/handoffs/F-03-prepared.md` with the
  exact implementer instructions (tighten `MasterRecordSchema` and
  `MasterListResponseSchema`; keep legitimate output shapes).
- Baseline: `docs/handoffs/F-03-tests.sha256` **revision 2** (9 entries, 2 refreshed).
  Revision 1 archived byte-for-byte at `docs/handoffs/F-03-tests-rev1.sha256` (own
  hash `2c808615…`, the reviewed value).

## Measured RED (genuine, not route absence)

| Suite | Command | Actual result |
|---|---|---|
| F-03 unit contracts | `pnpm --filter @echallan/api exec vitest run --project unit tests/unit/f03-master-contracts.test.ts` | **2 failed / 14 passed (16)**: a department with `severity` is accepted; a `departments` list containing a gate record is accepted |
| F-03 integration | same file for integration | **12 passed** — legitimate service output is unchanged |
| F-02 tablet restored case | `--repeat-each=10 --workers=1` | **10 passed** |
| F-02 admin restored case | `--repeat-each=10 --workers=1` | **10 passed** |
| Full browser suite | `pnpm run test:e2e` | **17 passed** (45.6 s) |

## Baselines actually verified

| Manifest | Result |
|---|---|
| `docs/handoffs/F-02-tests.sha256` (rev 5) | 24/24 OK |
| `docs/handoffs/F-02-tests-rev4.sha256` (archive) | own hash `58794d8f…`; 22 OK / 2 expected FAILED (the corrected specs) |
| `docs/handoffs/F-03-tests.sha256` (rev 2) | 9/9 OK |
| `docs/handoffs/F-03-tests-rev1.sha256` (archive) | own hash `2c808615…`; 7 OK / 2 expected FAILED (the corrected unit test and spec) |
| `docs/handoffs/S-01-tests.sha256` | 11/11 OK |
| `docs/handoffs/F-01-tests.sha256` | 14/14 OK |
| `docs/handoffs/F-01-corrections-tests.sha256` | 10/10 OK |

Production files are unchanged from the reviewed revisions; no migration, contract
behaviour or runtime change is included in this batch.

## Reviewer checklist

1. Confirm the F-02 browser correction removes the race without sleeps/retries and
   preserves every B1-required assertion, and that the causal correction is accurate.
2. Confirm the F-03 unit correction genuinely fails against the current contracts for
   the stated reasons, that the positive coverage spans all six kinds, and that
   request-schema and real-DB history assertions are preserved.
3. Confirm both archives are byte-identical to the reviewed manifest hashes and that
   no historical baseline was edited.
4. Record PASS / CHANGES_REQUIRED in
   `docs/reviews/F-02-b1-f03-m1-preparation.md`. On PASS, return F-03 M1 to the
   implementer for the contract tightening; B1 requires only the corrected acceptance
   and re-verification. Keep both parent boxes unchecked. F-04 remains blocked.
