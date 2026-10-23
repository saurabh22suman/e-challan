# Pre-issuance batch prepared planner handoff — F-04 + I-01 + I-05

Prepared: 2026-10-07, planner/test-owner session. Feature:
`specs/005-pre-issuance`; brief: `docs/handoffs/pre-issuance-batch.md`. Baseline:
`docs/handoffs/pre-issuance-tests.sha256` revision 1 (30 entries).

**This record authorises no production change and approves nothing.** All three
parent boxes are unchecked. Dependencies are reviewed PASS (F-02/F-03; accepted
snapshot `docs/reviews/F-02-F-03-accepted.sha256`). The owner-authorised batch
exception allows internal phases A→B→C to run continuously at verified GREEN, with
independent review deferred to batch exit; it supplies no self-review and no new
business policy. Implementation starts only after independent preparation
confirmation.

## Scope

F-04 replaces the foundation chrome with the approved role shells and the shared
design foundation; I-01 delivers the full-width entry form, scoped registry lookup,
authoritative draft validation and the summary/Back flow; I-05 delivers the
repeat/duplicate preview service and its persistent notices. Evidence, signature,
submission, numbering, review mutations, exports, screens and deployment remain out
of scope (I-02/I-03/I-04/I-06/R-01–R-06/V-*).

## Exact interfaces

The full field dictionary, shared contracts, routes, semantics and reachability
limits are in `specs/005-pre-issuance/spec.md`. Summary:

- Shared (`packages/contracts/src/preIssuance.ts`): `EntryDraftSchema`,
  `RegistryLookupQuerySchema`, `RegistryMatchSchema`,
  `RegistryLookupResponseSchema`, `DraftValidationErrorSchema` (422
  `invalid_draft`), `EntryValidationResponseSchema`, `ChallanPreviewRequestSchema`,
  `ChallanPreviewResponseSchema`, `isOtherLabel`, `REPEAT_WINDOW_DAYS = 90`,
  `DUPLICATE_WINDOW_MINUTES = 15`, `repeatWindowStart`, `duplicateWindowStart`,
  `isWithinRepeatWindow`, `isWithinDuplicateWindow`. `deriveChallanSeverity` and
  `recommendedActionForOccurrence` remain the only severity/recommendation
  mappings. Both windows include their lower boundary and exclude `T`.
- API pure rules (`apps/api/src/preIssuance/rules.ts`): `occurrenceFromPriorCount`,
  `duplicateWarningFromCount`, `otherFieldsFromSelections`.
- API routes (Marshal-only, post-scoped): `GET /registry/lookup`,
  `POST /challans/validate`, `POST /challans/preview`; new shared error code
  `invalid_draft`; `createApp` gains `now?: () => Date`.
- Clients: tablet lazy `src/routes/EntryFlow.tsx` (form + summary step) under the
  shell heading `Create New Safety Violation`; admin lazy
  `src/routes/DashboardScreen.tsx` under `e-Challan Dashboard` with an honest
  empty state. Identifier fields use IBM Plex Mono; body text uses IBM Plex Sans,
  self-hosted via pinned `@fontsource/ibm-plex-sans` and
  `@fontsource/ibm-plex-mono` (5.3.0 at preparation).

## Phase ownership

| Phase | Tasks | Internal exit |
|---|---|---|
| A (F-04) | T101–T106 | UI-01–UI-03 green; revised foundation suites green; budget and foundation gates |
| B (I-01) | T201–T206 | ENT-01–ENT-06 green at contracts, API, component and browser levels |
| C (I-05) | T301–T303 | REP-01–REP-05 green, including exact real-DB boundaries |
| Batch | T304–T306 | fault sensitivity, full gates, evidence and one combined review request |

## Measured RED at this checkpoint (surface absence, labelled as such)

Commands and actual results:

| Command | Actual result |
|---|---|
| `pnpm --filter @echallan/contracts exec vitest run test/pre-issuance.test.ts` | **17 failed (17)** — the planned exports are `undefined` (surface absence) |
| `pnpm --filter @echallan/api exec vitest run --project unit tests/unit/pre-issuance-rules.test.ts` | file fails: `Cannot find module '../../src/preIssuance/rules.js'` (no tests) |
| `pnpm --filter @echallan/api exec vitest run --project integration tests/integration/pre-issuance.test.ts` | **24 failed (24)** — the three routes are absent (404s) |
| `pnpm --filter @echallan/tablet run test` | **31 failed / 7 passed (38)** — revised shell headings and new screens absent |
| `pnpm --filter @echallan/admin run test` | **8 failed / 6 passed (14)** — dashboard shell absent |
| `pnpm run test:e2e` | **18 failed / 7 passed (25)** — new/revised browser journeys against the old shell |
| `pnpm run typecheck` | **12 errors** — planned exports/modules not yet implemented |

None of this is behavioural evidence. The implementer must first wire the surfaces,
then record genuine behavioural RED for each phase before completing the rules:
for example a stale lookup overwriting a newer result, an inactive master accepted,
Other without remarks accepted, a 90-day or 15-minute boundary counted on the wrong
side, a cancelled record counted, or a duplicate at another location warning.
Disposable-copy faults must show each acceptance case is load-bearing.

## Exact implementer instructions

1. Verify this manifest and the S-01/F-01/F-02/F-03 baselines; inspect the accepted
   F-02/F-03 snapshot. Do not edit the frozen acceptance.
2. **Phase A:** install the two pinned font packages; extend
   `packages/theme` (tokens, identifier mono, focus, disabled text) and add the
   shared primitives; build the tablet and admin shells and lazy screens; rewrite
   nothing else in the frozen files. Then reconcile: the revised foundation
   component/browser suites, the F-02 shell headings and idle field, the api-proxy
   health check and the R4 lazy-route paths are already in the baseline — make them
   pass. Record the S-01/F-02 historical-baseline delta honestly.
3. **Phase B:** implement the contracts exactly; implement the lookup and validation
   services/routes with session-bound location and `422 invalid_draft` field codes
   (`required`, `format`, `inactive_master`, `unknown_master`, `not_distinct`,
   `other_remarks_required`, `provenance_mismatch`, `too_long`, `too_short`); build
   the entry flow with the 300 ms debounce, cancellation, request-sequence guard,
   multiple-driver choice, expiry notice, loading/empty/failure/retry states and
   session-scoped draft clearing. Advance to the summary only after validation and
   the required acknowledgements.
4. **Phase C:** implement the preview service over `challans` with the injected
   clock, exact inclusive lower bounds, cancellation exclusion and no writes; add
   the persistent repeat notice and duplicate acknowledgement; invalidate the
   acknowledgement and summary on material change or a changed re-preview.
5. Run the gate order below; demonstrate the disposable-copy faults; restore and
   rerun clean; never mutate the user's repository.
6. Write `docs/handoffs/pre-issuance.md` with changed files, migration effects
   (expected none), RED/GREEN, real counts, sensitivity, regression/build/budget
   results and pending device checks. Tick implementation only after complete
   evidence; leave every review box unchecked; request one combined review and stop.

## Verification commands

```bash
sha256sum -c docs/handoffs/pre-issuance-tests.sha256
sha256sum -c docs/handoffs/F-02-tests.sha256
sha256sum -c docs/handoffs/F-03-tests.sha256
pnpm run format:check && pnpm run lint && pnpm run typecheck
pnpm db:up
pnpm run build:packages
pnpm --filter @echallan/contracts exec vitest run test/pre-issuance.test.ts
pnpm --filter @echallan/api exec vitest run --project unit tests/unit/pre-issuance-rules.test.ts
pnpm --filter @echallan/api exec vitest run --project integration tests/integration/pre-issuance.test.ts
pnpm --filter @echallan/tablet run test
pnpm --filter @echallan/admin run test
pnpm run test
pnpm run test:integration
pnpm run test:e2e
pnpm run build
pnpm run check:tablet-size
pnpm run test:foundation
```

Expected final GREEN (report actual): contracts 25, API unit 101, tablet component
39, admin component 14, root units 179, real-DB integration 102, browser 25,
foundation 27, tablet initial JS below 250 000 gzip bytes.

## Ownership

- **Frozen** by the batch baseline: every acceptance file listed above, the feature
  spec/plan, the authority documents and the harness configs. Return test defects to
  the planner; never weaken or skip an assertion.
- **Writable by the implementer:** `packages/contracts/src/**`,
  `packages/theme/src/**`, `apps/api/src/**`, `apps/{tablet,admin}/src/**` (frozen
  tests excluded), `package.json`/`pnpm-lock.yaml` for the two pinned font packages,
  `.env.example`, `playwright.config.ts`, `.github/workflows/ci.yml`.
- **Read-only:** `docs/decisions.md`, `docs/eChallan_replacement_spec*.md`,
  `docs/reviews/**`, every historical `*.sha256` manifest. Additive migrations only
  if genuinely required; none is planned.

## Known limitations (recorded, not hidden)

1. Multiple-driver choice and the expired-pass case are loc-dispatch-only and the
   single demo marshal is loc-main: covered by component + real-DB acceptance, not
   reachable in the browser with approved credentials.
2. The duplicate warning cannot occur within 15 minutes of a real browser run
   because the seeded history is fixed and no submission endpoint exists in this
   batch: covered by component + real-DB acceptance; the browser covers the
   persistent repeat notice.
3. Contractor Other is not configured in the synthetic fixture: exercised through
   an admin-created Other contractor in tests.
4. UI-01's commit-size clause and UI-02's thumbnail-label clause are deferred with
   I-02/I-06; this batch asserts no solid-green action exists.
5. The F-04 shell replaces the S-01 foundation screens, so the historical
   baselines report this documented delta: **S-01 10 OK / 1 FAILED**
   (`tests/foundation/test_review_corrections.py`, R4 lazy-route paths) and
   **F-02 rev 5 15 OK / 9 FAILED** (the four F-02 auth suites, the four foundation
   suites and `tests/e2e/api-proxy.spec.ts`). F-01, F-01-corrections and F-03 are
   unchanged. No historical manifest is regenerated. Foundation gate at preparation:
   **27 ran / 6 failed** (2 R1 clean-artifact gates because the new acceptance is
   RED, 4 R4 lazy-route checks because the shells are not implemented yet).
6. Fonts add no JavaScript; the tablet budget still applies to the JS chunks.
7. The accepted F-02/F-03 production snapshot
   (`docs/reviews/F-02-F-03-accepted.sha256`) reports **40/41 OK** after this
   preparation: only `docs/implementation-plan.md` diverges, because the planning
   index was advanced to register this batch. Every production file still matches;
   this is a planning-document delta, not a source regression, and the snapshot is
   not regenerated.

## Stop

Independent preparation confirmation is requested at
`docs/review-requests/pre-issuance-preparation.md`. Do not implement before that
PASS. Keep F-04/I-01/I-05 implementation and review boxes unchecked.
