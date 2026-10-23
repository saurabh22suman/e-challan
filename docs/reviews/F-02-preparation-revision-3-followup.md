# F-02 revision 3 preparation follow-up

Date: 2026-10-04. **Result: PASS for the bounded implementation correction handoff.**
Feature: `specs/003-demo-auth`. This supersedes the preparation-only
CHANGES_REQUIRED result in `F-02-preparation-revision-3.md` for N1/N2. The
implementation review in `docs/reviews/F-02.md` remains CHANGES_REQUIRED:
production corrections and independent implementation re-review are still owed.
Both F-02 parent boxes stay unchecked. This reviewer changed no production code,
acceptance test or planner manifest.

## Findings closed

- **N1:** `apps/api/tests/integration/f02-auth.test.ts:516–592` now compares exact
  expected id/label sets, independently selected by fixture IDs, for both posts
  and shifts; requires no shift options before post selection; echoes exactly
  the chosen post; and explicitly excludes the dispatch post/shift. Extra
  fabricated/cross-location options no longer satisfy the assertions.
- **N2:** `apps/tablet/src/__tests__/f02-auth.test.tsx:451–534` returns the selected
  Post Alpha/Night shift in its success response. It checks exact option values
  and labels, empty placeholders, no preselected value, retained credentials on
  both retries, final requested IDs and the chosen post label in the shell.
  The previously contradictory fixture is corrected.

Q1–Q4 preparation corrections and R1/R2/R4 acceptance already inspected in the
previous review remain intact. The current spec/plan's two-stage ambiguity
contract agrees with these assertions. Production must still enforce active
candidate filtering, input/selection validation and required context; this
preparation PASS does not claim those are implemented or that every edge case
has already been executed against corrected production code.

## Commands independently rerun

| Command | Actual result |
|---|---|
| `sha256sum -c docs/handoffs/F-02-tests.sha256` | 24/24 OK at start |
| `sha256sum -c docs/handoffs/S-01-tests.sha256` | 11/11 OK |
| `sha256sum -c docs/handoffs/F-01-tests.sha256` | 14/14 OK |
| `sha256sum -c docs/handoffs/F-01-corrections-tests.sha256` | 10/10 OK |
| `sha256sum -c docs/reviews/F-02-inspected.sha256` | all ten recorded production entries OK; manifest/handoff entries differ for the documented preparation revision and planner addendum |
| `sha256sum docs/handoffs/F-02-tests-rev2.sha256` | original reviewed revision-2 hash unchanged |
| `pnpm run format:check` | PASS |
| `pnpm run lint` | PASS; boundary gate scans 79 files |
| `pnpm run typecheck` | PASS |
| `pnpm db:up` | Both PostgreSQL containers healthy |
| `pnpm --filter @echallan/api exec vitest run --project integration tests/integration/f02-auth.test.ts` | 4 failed / 20 passed, 24 total; expected behavioural RED |
| `pnpm --filter @echallan/tablet exec vitest run src/__tests__/f02-auth.test.tsx -t 'offers the API candidates'` | 1 failed / 11 non-selected cases skipped; expected RED because the current UI does not handle ambiguity |

API failures remain factory-env fallback, zero-shift login, absent exact
candidate sets and SQL-bearing malformed-ID errors. Q3/Q4 controls pass.
The focused tablet test fails on generic sign-in error instead of selection
feedback, not on a missing module or invalid fixture.

Unchanged admin/browser/unit suites were not rerun in this bounded follow-up;
their independently measured results remain in the previous preparation review.
No full-regression or implementation GREEN is claimed here.

## Independently repeated candidate sensitivity

Command: `python3 /tmp/opencode/f02-rev3-candidate-sensitivity.py`.
The script copies the workspace without secrets/generated artifacts, uses
installed dependencies read-only and runs the unchanged R3 integration case
against the guarded test DB. All source mutations are confined to the copy:

| Disposable-copy response behaviour | Actual focused result |
|---|---|
| Filtered stored options, control | 1 passed |
| Add unauthorised dispatch and invented post/shift options | 1 failed on exact post-set comparison |
| Add an invented shift only | 1 failed on exact shift-set comparison |
| Restore filtered options | 1 passed |

Each targeted run leaves 23 unrelated tests non-selected by the explicit filter;
this is sensitivity evidence for one relevant case, not a full-suite pass.
The copy is removed automatically. User source/tests were not mutated. This
closes the demonstrated false green from the previous review. The planner's
additional UI mutation table was inspected, not independently repeated here;
the strengthened direct UI assertions and consistent response fixture were
reviewed. Final implementation must supply its own required sensitivity evidence.

## Exact approved preparation checkpoint

The planner kept the revision number as **revision 3 follow-up** rather than
calling it revision 4. The manifest header and prepared handoff explicitly
document the additional test/spec/plan changes. This report confirms this
specific corrected draft; it does not retroactively approve the earlier draft.
The earlier failed review remains unchanged.

- Active manifest SHA-256:
  `9c46ed067212f826e9721a87bdc1d7ab3959ed33ea31db9572383b1f49ac79fc`.
- Prepared handoff SHA-256:
  `da5570b3556b0a6e242cc2ef5de2a2b8410cb5fc658dc618ec68fe83786995ee`.
- Preserved revision-2 manifest SHA-256:
  `fbfc5c159a8aa3b93a5a6cd7648081b5c885ac1962225279e4977b9e75299c89`.

All 24 test/spec/fixture/config hashes are pinned in the verified active
manifest. Freeze this checkpoint for implementation; any further acceptance
change requires a documented planner revision and reviewer confirmation.

## Handoff

A fresh implementer session may run **`/pilot.implement F-02`** against this
approved preparation checkpoint. Complete only the bounded corrections in
`docs/handoffs/F-02-prepared.md` and `specs/003-demo-auth/plan.md`, preserve the
frozen tests, obtain GREEN, run prescribed regressions and fault sensitivity,
append correction evidence to `docs/handoffs/F-02.md`, and stop for independent
implementation re-review. F-03 remains blocked until F-02 receives that PASS.
