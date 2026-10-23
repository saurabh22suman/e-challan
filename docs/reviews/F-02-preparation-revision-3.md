# F-02 revision 3 independent preparation review

Date: 2026-10-04. **Result: CHANGES_REQUIRED — bounded R3 acceptance correction.**
Feature: `specs/003-demo-auth`. Request:
`docs/review-requests/F-02-corrections.md`. This is preparation review, not
implementation approval. No production file, frozen acceptance or existing
manifest was edited by this reviewer. Both F-02 parent boxes remain unchecked.

## Resolved preparation findings

- **Q1:** auth factories now receive explicit credentials. The added omitted-
  credentials case produces genuine behavioural RED against the env fallback.
- **Q2:** both foundation component suites sign in through the form with valid
  response fixtures, require the issued token in session mocks, clear storage
  and preserve the substantive foundation assertions.
- **Q3:** the known-record control and root-mounted unknown-record request now
  exercise the actual protected handler; the corrected case passes.
- **Q4:** the mismatch fixture has distinct usernames, a working control and an
  exact 403 `role_mismatch` assertion without a token; the corrected case passes.

R1 acceptance covers fresh/restored wrong-role refusal and real browser
revocation. R2 uses deferred responses and `act` to reproduce newer-login loss
and stale-identity resurrection after logout. R4 verifies controlled 404 bodies
for four malformed inputs. These are substantive improvements. Remaining
findings concern R3's newly specified candidate disclosure and selection contract.

## Verification actually rerun

| Command | Actual result |
|---|---|
| `sha256sum -c docs/handoffs/F-02-tests.sha256` | revision 3, 24/24 OK |
| `sha256sum docs/handoffs/F-02-tests-rev2.sha256` | `fbfc5c159a8aa3b93a5a6cd7648081b5c885ac1962225279e4977b9e75299c89`, matching reviewed revision 2 |
| `sha256sum -c docs/handoffs/F-02-tests-rev2.sha256` | 15 OK / 9 expected mismatches, exactly the revised planner artifacts |
| `sha256sum -c docs/handoffs/S-01-tests.sha256` | 11/11 OK |
| `sha256sum -c docs/handoffs/F-01-tests.sha256` | 14/14 OK |
| `sha256sum -c docs/handoffs/F-01-corrections-tests.sha256` | 10/10 OK |
| `sha256sum -c docs/reviews/F-01-accepted.sha256` | 28/33 OK, exactly the five documented F-02/planning deltas |
| `sha256sum -c docs/reviews/F-02-inspected.sha256` | all ten recorded production entries OK; manifest and handoff entries differ because revision 3 and its planner addendum supersede them |
| `pnpm run format:check` | PASS |
| `pnpm run lint` | PASS; boundary gate scans 79 files |
| `pnpm run typecheck` | PASS |
| `pnpm db:up` | Both PostgreSQL containers healthy |
| `pnpm --filter @echallan/api exec vitest run --project unit tests/unit/f02-auth-config.test.ts` | 18 passed |
| `pnpm --filter @echallan/api exec vitest run --project integration tests/integration/f02-auth.test.ts` | 4 failed / 20 passed, 24 total |
| `pnpm --filter @echallan/tablet run test` | 5 failed / 12 passed, 17 total |
| `pnpm --filter @echallan/admin run test` | 4 failed / 9 passed, 13 total |
| `pnpm run test:e2e` | 4 failed / 13 passed, 17 total, 57.4 s |

The failures match the planner's recorded behavioural RED: factory fallback,
zero-shift login, missing candidate arrays, SQL-bearing malformed-ID response;
client role refusal, stale restoration and missing selection UI. Browser tests
used the real API/proxy with locally reused servers. No missing-module or
infrastructure failure is counted as behavioural RED. Full root regression,
production builds, foundation clean-artifact suite and real-device checks were
not repeated for this test-preparation review and are not claimed GREEN here.

## N1 — High: ambiguity acceptance allows unauthorised and invented options

References: `apps/api/tests/integration/f02-auth.test.ts:516–557`;
`specs/003-demo-auth/spec.md:39–46`.

The first response only needs at least two posts and inclusion of the seeded
post; the second only needs at least two shifts and inclusion of the seeded
shift. Extra cross-location, inactive or invented entries are not rejected.
Labels and the complete approved candidate sets are not asserted. This does
not prove the claim that the API offers only stored, active, authorised,
compatible candidates.

**Independently demonstrated:**
`python3 /tmp/opencode/f02-rev3-candidate-sensitivity.py` copied the workspace
without secrets/generated artifacts and changed only the copy's ambiguity
response handling. It used the unchanged planner acceptance with
`-t 'R3: refuses ambiguous context'`, against the guarded test database:

1. Filtered stored options: **1 passed**, 23 non-selected cases skipped by the
   focused filter.
2. Fault: append the stored dispatch post/shift outside the Marshal's assigned
   location, plus fabricated UUID/label options: **1 passed**, 23 non-selected.
3. Restore filtered options: **1 passed**, 23 non-selected.

The temporary copy was removed. User repository source/tests were not mutated.
This is a demonstrated false-green candidate-disclosure invariant, not a
production fix or implementation acceptance. The probe uses existing installed
dependencies read-only. Its initial pnpm launcher was refused by pnpm's external
module-directory guard before testing; the successful runs invoked Vitest via
Node in the disposable API directory.

Planner correction: assert independently defined exact id/label sets (sorting
if order is unspecified) for both selection stages. Include active out-of-scope
posts, inactive authorised posts/shifts and shifts at another gate as exclusion
controls; prove fabricated/extra options are rejected by the acceptance. Check
the options are absent for invalid credentials and the 422 does not issue a
token. Preserve explicit valid selection and refusal assertions.

## N2 — Medium: tablet selection fixture is inconsistent and its claims are unasserted

References: `apps/tablet/src/__tests__/f02-auth.test.tsx:407–451,465–491`;
`specs/003-demo-auth/spec.md:116–123`.

The operator selects `POST_ALPHA` and `SHIFT_NIGHT`, but the final mock returns
the generic `LOGIN_BODY` containing unrelated `POST_ID`/`SHIFT_ID`. A client that
checks returned attribution against its explicit request could correctly refuse
that response and still fail this test. The final retry also does not assert
that its password/username were retained.

The comment says nothing is invented or pre-selected, yet the assertions check
only that the named options exist. A selector containing extra choices, or one
that defaults to the first option, can satisfy these assertions after
`selectOptions` is called.

Planner correction: return a valid success body bound to the actually selected
post/shift, assert credentials and selected IDs on the final attempt, check the
complete offered option sets and an empty/unselected value before each new
choice. Verify continuing without the required selection cannot silently choose
an option. Preserve the existing successful retry journey.

## Evidence and disposition

Inspected revision-3 manifest SHA-256:
`97854bfab4218502e8e8ac944e5cb34a671ba35750feefd95506d23534c7d8c7`.
Prepared handoff SHA-256:
`84db425aa3dc0a17a6dbcc7bb5faabb2e4f45de310be053c1a33addc5fa8022c`.
All revised acceptance/spec/plan hashes are recorded in that verified manifest.
Historical baselines remain intact. Production snapshot entries still verify.

Return **only this bounded R3 preparation correction** to the planner; Q1–Q4
need no further rework. Preserve revision 3 immutably and document the next
numbered baseline, updating measured evidence and counts as needed. Correct the
handoff's "Nothing else" file-change summary to include the already documented
planner addendum, CI comment and planning/review-request records. No owner
business decision is required. Obtain preparation confirmation before starting
production corrections; F-03 remains blocked on eventual F-02 implementation
review PASS.
