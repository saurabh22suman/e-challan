# Independent implementation confirmation requested: F-03 M1 + F-02 B1

Tasks: **F-03** (finding M1, response-contract kind enforcement) and **F-02**
(finding B1, browser acceptance re-verification). Preparation PASS:
`docs/reviews/F-02-b1-f03-m1-preparation.md`. C1 and other closed findings were not
reopened.

Evidence: "M1 response-contract correction" in `docs/handoffs/F-03.md`; "B1
acceptance re-verification" in `docs/handoffs/F-02.md`. **No completion box was
ticked**: the preparation review reserves implementation/review ticks for this
independent confirmation.

## F-03 M1 — one bounded production change

`packages/contracts/src/masters.ts` (`5a50f66c…` → `6d6bcf7f…`):

- `MasterRecordSchema` now enforces strict, symmetric kind-specific records:
  violation types require `severity` and a present nullable `defaultAction` and forbid
  `locationId`; gates require `locationId` and forbid severity/action; departments,
  contractors, locations and vehicle-types carry only `id`, `kind`, `label`,
  `isActive`.
- `MasterListResponseSchema` now requires every record's `kind` to equal the declared
  list `kind`.
- Request schemas, service, routes, migrations and history behaviour are untouched.

RED before: F-03 unit **2 failed / 14 passed (16)** on the frozen rev-2 acceptance;
integration **12 passed** (legitimate output already valid).

GREEN after (serial): F-03 unit **16**, F-03 integration **12**, API unit **92**,
root units **138** (contracts 8, API 92, tablet 21, admin 17), real-DB integration
**78**, browser **17**, builds PASS, tablet **145 329 B gzip**, foundation **27**.
Frozen baselines unchanged: F-03 9/9, F-02 24/24, S-01 11/11, F-01 14/14,
F-01-corrections 10/10.

Disposable-copy sensitivity: wrong-kind fields, missing severity+defaultAction,
missing gate `locationId` and list/record kind mismatch each fail the matching frozen
case; severity and `defaultAction`-presence were isolated with schema probes. Clean
rerun after restore: unit 16, integration 12. Copy removed.

**Disclosed limitation:** the frozen rev-2 acceptance's negative violation record
omits both `severity` and `defaultAction`, so it cannot distinguish the two rules.
Both are implemented as instructed and probe-verified; a future revision could add
direct assertions. No frozen test was changed here.

## F-02 B1 — re-verification only, no production change

| Command | Result |
|---|---|
| tablet restored case, 10 repeats | 10 passed |
| admin restored case, 10 repeats | 10 passed |
| `pnpm run test:e2e` | 17 passed |

The corrected `addInitScript` seeding ran with no sleeps/retries and all role-refusal,
protected-content-absence and server-revocation assertions executed.

## Reviewer checklist

1. Verify the active manifests (`F-03` rev 2 `d8f1b1d3…`, `F-02` rev 5 `ded602a6…`)
   and the archives, and confirm no historical manifest was edited.
2. Inspect the single changed contract file; confirm request schemas, service,
   routes, migrations and history behaviour are untouched.
3. Rerun the focused unit/integration suites and the regression gates.
4. Repeat the kind-field and homogeneity fault sensitivity independently, including
   the isolated `severity` / `defaultAction`-presence probes.
5. Confirm the B1 browser cases are deterministic and every required assertion ran.
6. Record PASS / CHANGES_REQUIRED in `docs/reviews/F-03-m1-f02-b1-implementation.md`;
   only on PASS may the implementation/review boxes be ticked. F-04 remains blocked.
