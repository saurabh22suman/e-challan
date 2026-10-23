# Independent review requested: F-04 + I-01 + I-05 pre-issuance batch

Tasks: **F-04, I-01, I-05** as one bounded batch. Feature:
`specs/005-pre-issuance`; brief `docs/handoffs/pre-issuance-batch.md`.
Evidence: `docs/handoffs/pre-issuance.md`. Baseline:
`docs/handoffs/pre-issuance-tests.sha256` **revision 2** (rev 1 archived at
`docs/handoffs/pre-issuance-tests-rev1.sha256`).

**Disclosed owner override:** the owner authorised the bounded implementation run
while **no independent preparation-confirmation record existed**
(`docs/reviews/pre-issuance-preparation.md` is absent; the request is
`docs/review-requests/pre-issuance-preparation.md`). This is recorded in
`docs/implementation-plan.md` and the handoff; it is not fabricated and supplies no
review approval. Implementation boxes are ticked; every review box is unchecked.

## What to review

- **F-04:** self-hosted IBM Plex fonts, tokens/primitives, role shells with lazy
  `EntryFlow`/`DashboardScreen`, reconciled foundation suites and R4 lazy-route
  paths, the honest admin empty state, and the preserved F-02 auth/idle/C1
  behaviour.
- **I-01:** `packages/contracts/src/preIssuance.ts`; Marshal-only scoped
  `GET /registry/lookup`; authoritative `POST /challans/validate` with
  `422 invalid_draft`; the tablet entry flow (debounce/cancel/sequence guard,
  multiple-driver choice, editable autofill, Other-remarks coupling, derived
  severity, summary/Back, session-scoped clearing).
- **I-05:** `POST /challans/preview` with the injected clock, inclusive lower
  boundaries and `T` excluded, cancellation exclusion, multi-violation single
  count, duplicate vehicle+session-location independence, no writes; persistent
  notices and acknowledgement invalidation.

Key hashes are listed in `docs/handoffs/pre-issuance.md`.

## Evidence summary

- Final GREEN: contracts 25, API 101, tablet 38, admin 14 → root units **178**;
  real-DB integration **102**; browser **25**; builds PASS; tablet **147 603 B
  gzip**; foundation **27**; format/lint/typecheck PASS.
- F-02/F-03 behaviour preserved at the reconciled shell; their historical baselines
  show only the documented test-file deltas (F-02 rev 5 15/24, S-01 10/11) and were
  not regenerated.
- Disposable-copy sensitivity caught seven faults; the stale-lookup guard is
  implemented but **not distinguishable by the frozen test** — recorded honestly.
- Seven planner test corrections are listed in baseline revision 2's header and the
  handoff; **the reviewer must confirm each as an acceptable correction**, not a
  weakened assertion.

## Reviewer checklist

1. Verify the revision-2 baseline and the archived rev 1; confirm no historical
   manifest was regenerated.
2. Confirm the owner override is disclosed and that no preparation-confirmation
   record was fabricated.
3. Inspect the contracts, services, routes and the entry flow; rerun the focused
   unit, real-DB, component and browser suites and the regression gates.
4. Confirm every planner test correction in revision 2 is a genuine defect fix
   (no assertion weakened, skipped or narrowed).
5. Repeat the disposable-copy fault sensitivity independently, including the
   boundary, cancellation, scope, inactive-master and Other cases; assess whether
   the stale-response guard needs a stronger acceptance.
6. Record PASS / CHANGES_REQUIRED in
   `docs/reviews/F-04-I-01-I-05.md`; only on PASS may the review boxes be ticked.
   Camera/signature/storage/submission (I-02/I-03/I-04/I-06) remain the next
   milestone and are not claimed here.
