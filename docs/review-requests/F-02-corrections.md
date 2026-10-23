# Preparation re-review requested: F-02 combined correction batch (revision 3)

Task: **F-02 — Login, roles, shift attribution and idle expiry**, feature
`specs/003-demo-auth`. Role of this request: independent **preparation** review before
`/pilot.implement F-02` resumes. No production code, migration or contract was changed
in this batch.

Supersedes: `docs/reviews/F-02-preparation-revision-2.md` (Q1–Q4) and responds to
`docs/reviews/F-02.md` (R1–R5). The implementation is **unchecked**; the parent
`Reviewed` box is untouched.

## What this batch contains

- `docs/handoffs/F-02-prepared.md` **revision 3** — Q1–Q4 and R1–R4 disposition, exact
  implementer instructions, measured RED, ownership, expected counts.
- `docs/handoffs/F-02-tests.sha256` **revision 3** (24 entries, 9 refreshed). Revision 2
  is archived byte-for-byte at `docs/handoffs/F-02-tests-rev2.sha256`; the archive's own
  SHA-256 `fbfc5c15…` is exactly the value `docs/reviews/F-02-inspected.sha256` recorded
  for the active manifest, so the archive is provably the reviewed revision.
- Corrected acceptance in both API integration cases and both client component suites
  plus two browser journeys (see the prepared handoff table).
- Reconciled `specs/003-demo-auth/spec.md` (ambiguous-context contract, zero-shift
  refusal, malformed-ID 404, client role boundary, transition ordering, tablet selection
  flow, storage seam, factory-never-reads-env) and refreshed `plan.md`.
- `docs/handoffs/F-02.md` planner addendum correcting the four R5 documentation
  inaccuracies; `.github/workflows/ci.yml` comment corrected to separate runtime secrets
  from acceptance wiring.
- `docs/implementation-plan.md` F-02 section updated; `Implemented`/`Reviewed` remain
  unchecked.

## Follow-up closed before this request

Two test-strength findings raised against the first revision-3 draft were closed and
mutation-verified in a disposable copy: R3 candidates are now asserted as exact stored
sets with exclusions (fabricated, unauthorised-dispatch and fabricated-shift faults all
fail), and the tablet R3 fixture now echoes the selected context with no-pre-selection,
no-extra-option and credentials-retained assertions (wrong-id, pre-selection,
extra-option and credential-drop faults all fail). Details and the mutation tables are in
`docs/handoffs/F-02-prepared.md` §"Review follow-up".

## Baselines actually verified

| Manifest | Result |
|---|---|
| `docs/handoffs/S-01-tests.sha256` | 11/11 OK |
| `docs/handoffs/F-01-tests.sha256` | 14/14 OK |
| `docs/handoffs/F-01-corrections-tests.sha256` | 10/10 OK |
| `docs/handoffs/F-02-tests.sha256` (rev 3) | 24/24 OK |
| `docs/handoffs/F-02-tests-rev2.sha256` (archive) | preserved; 15 OK / 9 expected FAILED (the nine rev-3 corrections) |
| `docs/reviews/F-01-accepted.sha256` | 28/33 OK; exactly the five documented F-02 extensions |

## Measured RED against the reviewed implementation (not missing modules or routes)

| Suite | Result | Failures |
|---|---|---|
| API unit `f02-auth-config` | 18 passed | — |
| API integration `f02-auth` | 4 failed / 20 passed (24) | Q1 fail-closed, R3 zero-shift, R3 ambiguity candidates, R4 malformed-ID 500-with-SQL |
| Tablet component | 5 failed / 12 passed (17) | R1 ×2, R2 ×2, R3 selection UI |
| Admin component | 4 failed / 9 passed (13) | R1 ×2, R2 ×2 |
| Browser `test:e2e` | 4 failed / 13 passed (17) | R1 wrong-role access ×2 per client; every pre-existing journey passes |

Q3 (root path, known-record control) and Q4 (distinct mismatch fixture, required
`role_mismatch`) are already green and must stay green — they strengthen regression
detection rather than demand new behaviour.

## Reviewer checklist

1. Verify the rev-3 manifest and confirm Q1–Q4 and R1–R4 are actually addressed by the
   frozen acceptance rather than re-described.
2. Confirm the revised foundation suites now establish an authenticated precondition
   through the form, require the token on session lookup, and clear client storage,
   with every previous substantive assertion preserved.
3. Confirm the new R2 cases are deterministic (manually released responses, no sleeps)
   and would fail against the reviewed implementation for the stated reasons.
4. Confirm the `AmbiguousContextResponseSchema` contract is workable, uses stored
   candidates only, and does not invent or default a post/shift.
5. Confirm the R4 case asserts the controlled body and no internal detail.
6. Confirm revision 2 is preserved immutably and that no historical manifest was
   edited.
7. Record a PASS / CHANGES_REQUIRED / BLOCKED disposition in
   `docs/reviews/F-02-preparation-revision-3.md`, then return the batch to the
   implementer for `/pilot.implement F-02`.

No new owner business decision was required for this batch. F-03 remains blocked on F-02
review PASS.
