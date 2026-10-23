# Preparation confirmation requested: F-04 + I-01 + I-05 pre-issuance batch

Tasks: **F-04, I-01, I-05** as one bounded batch. Brief:
`docs/handoffs/pre-issuance-batch.md`. Prepared handoff:
`docs/handoffs/pre-issuance-prepared.md`. Feature: `specs/005-pre-issuance`.
Baseline: `docs/handoffs/pre-issuance-tests.sha256` revision 1 (30 entries).

F-02/F-03 are reviewed PASS (`docs/reviews/F-03-m1-f02-b1-implementation.md`;
accepted snapshot `docs/reviews/F-02-F-03-accepted.sha256`). All parent boxes for
this batch are unchecked; no production change was made during preparation.

## Packet contents

1. `specs/005-pre-issuance/{spec,plan,tasks}.md`: one bounded feature with exact
   shared/API contracts, field dictionary, routes, phase ownership (A = F-04,
   B = I-01, C = I-05) and the recorded reachability limits.
2. Executable acceptance for **UI-01–UI-03, ENT-01–ENT-06, REP-01–REP-05**:
   - contracts: `packages/contracts/test/pre-issuance.test.ts`
   - API pure rules: `apps/api/tests/unit/pre-issuance-rules.test.ts`
   - real PostgreSQL: `apps/api/tests/integration/pre-issuance.test.ts`
   - component: `apps/tablet/src/__tests__/pre-issuance-{entry,repeat}.test.tsx`
   - browser: `apps/tablet/e2e/pre-issuance.spec.ts`
   - shells: revised `apps/{tablet,admin}/src/__tests__/foundation.test.tsx`,
     revised `apps/{tablet,admin}/e2e/foundation.spec.ts` (UI-01/02 measurements,
     responsive navigation, no admin widgets)
3. Deterministic fixtures and a `createApp({ now })` clock seam; exact 90-day and
   15-minute boundary cases insert synthetic records relative to the fixed clock.
4. Reconciliation of the existing suites that the new shells replace: the four F-02
   auth suites (shell headings, idle field), the four foundation suites, the
   api-proxy health check and the R4 lazy-route paths. Historical baselines report
   the documented delta: S-01 10/1, F-02 rev 5 15/9; F-01/F-01-corrections/F-03
   unchanged. No historical manifest is regenerated. The accepted F-02/F-03
   production snapshot reports 40/41 OK: only `docs/implementation-plan.md`
   diverges (planning index advanced for this batch); all production files match.

## Measured RED (surface absence, labelled)

| Command | Actual result |
|---|---|
| contracts `pre-issuance.test.ts` | 17 failed (17) — planned exports absent |
| API unit `pre-issuance-rules.test.ts` | file fails, no tests — module absent |
| API integration `pre-issuance.test.ts` | 24 failed (24) — routes absent |
| tablet component suites | 31 failed / 7 passed (38) |
| admin component suites | 8 failed / 6 passed (14) |
| `pnpm run test:e2e` | 18 failed / 7 passed (25) |
| `pnpm run typecheck` | 12 errors — planned exports/modules absent |
| `pnpm run test:foundation` | 27 ran / 6 failed (2 R1, 4 R4) |

The implementer must wire the surfaces, then record genuine behavioural RED for each
phase and disposable-copy fault sensitivity before GREEN.

## Reviewer checklist

1. Verify the batch manifest (30/30) and the historical baselines; confirm the
   documented deltas are exactly the reconciled suites.
2. Confirm the acceptance is executable, mapped to every required case, free of
   placeholders/skips, and that surface absence is not presented as behavioural
   evidence.
3. Confirm the contracts/routes/field dictionary are unambiguous and consistent
   with the approved specification, D5/B-06 and the design constraints.
4. Confirm deterministic clocks/fixtures make the boundary cases exact.
5. Confirm the recorded reachability limits are genuine and honestly scoped.
6. Record PASS / CHANGES_REQUIRED in
   `docs/reviews/pre-issuance-preparation.md`. On PASS, the owner may authorise the
   bounded implementation run; all boxes stay unchecked until then.

F-04 remains blocked until this confirmation; I-01/I-05 remain blocked on their
prerequisites.
