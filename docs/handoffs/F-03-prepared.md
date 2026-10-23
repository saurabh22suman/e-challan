# F-03 prepared planner handoff — master-data API and historical meaning

Prepared: 2026-10-05, planner/test-owner session. Parent: **F-03**, both boxes
unchecked at preparation. Feature: `specs/004-master-data`. Cases: MST-01–MST-03
(PRD E5.1–E5.3, B-05). Baseline: `docs/handoffs/F-03-tests.sha256`, revision 1.

**Disclosed compression.** At the owner's explicit direction, preparation and
implementation ran in one continuous session. The acceptance was written before the
routes were wired and the surface-absence RED was captured by temporarily
unregistering the master routes (see the implementer handoff); the planner baseline
was frozen after the acceptance was final. This is a process compression, not a
self-review: **independent review of F-03 is still owed** and both boxes remain the
reviewer's to set. **Owner override:** F-03 proceeds while `F-02 Reviewed` is
unchecked and the F-02 C1 implementation re-review is still owed; recorded in
`docs/implementation-plan.md`. No F-02 approval is implied.

## Scope

Admin-only management of the six approved master sets over the existing F-01 tables:

- `violation-types` (label, severity, optional default action), `departments`,
  `contractors`, `locations`, `gates` (label + an existing **active** location),
  `vehicle-types`.
- Create, read, update, **idempotent deactivate**. No delete route, no reactivation,
  no screens (R-05), no posts/shifts, no audit writes (R-06), no migration.
- `GET /masters/:kind` is the **active-only selection catalogue** for any
  authenticated role; `/admin/masters/**` is Admin-only.
- Historical meaning: master mutations touch only master tables; issued challan
  snapshots and references are untouched by any edit or deactivation.

## Exact interface

| Route | Role | Behaviour |
|---|---|---|
| `GET /masters/:kind` | any session | active-only catalogue, ordered by label then id; gates require the gate **and** its location active |
| `GET /admin/masters/:kind` | Admin | all entries, active and inactive |
| `POST /admin/masters/:kind` | Admin | `201 {master}` |
| `PATCH /admin/masters/:kind/:id` | Admin | `200 {master}`; kind-specific allowed fields; empty patch `400` |
| `POST /admin/masters/:kind/:id/deactivate` | Admin | `200 {master}` `isActive:false`; idempotent |
| `DELETE …`, `…/reactivate` | — | no route (404) |

Errors: `401` anonymous, `403 forbidden` non-Admin, `404 not_found` unknown kind or
id, `400 invalid_request` payload/kind-field violations, `422 invalid_reference`
gate location unknown or inactive. All bodies are exactly `ApiErrorSchema`.

## Implementer instructions (already executed; retained for the reviewer)

1. Shared strict contracts in `packages/contracts/src/masters.ts`: kind vocabulary,
   record/list/single response shapes and per-kind create/update schemas via
   `masterRequestSchema(kind, operation)`.
2. Service over the F-01 tables: list (all/active with the gate parent rule), create,
   update, idempotent deactivate. No schema change.
3. One shared session guard (`apps/api/src/auth/guard.ts`) reused by the F-02 auth
   routes and the new master routes; Admin role enforced server-side.
4. The typed-query fix in `db/schema.ts`: `masterTable` uses a literal `label` key so
   column access is not `| undefined`. `drizzle-kit generate` reports **no schema
   changes**, so no migration is created.
5. Do not touch the frozen acceptance, the authority documents or any migration.

## Baseline and verification

- `docs/handoffs/F-03-tests.sha256` verifies **9/9**; S-01 11/11, F-01 14/14,
  F-01-corrections 10/10, F-02 rev 4 24/24 unchanged.
- Focused: unit `f03-master-contracts` **14 passed**; integration
  `f03-master-data` **12 passed** after wiring (all 12 were surface-absence RED with
  the routes unregistered).
- Full gates: root units 136, integration 78, browser 17, builds, tablet size
  145 046 B gzip, foundation 27.
- Six load-bearing guards fault-verified in a disposable copy: Admin role check,
  active-only catalogue, gate parent rule, kind-field validation, idempotent
  deactivation, history preservation.

## Returned F-02 test defect (not F-03 scope)

The two F-02 browser restoration tests (`R1: refuses a restored … session obtained
from the real API`, tablet and admin) are intermittently flaky (~10%): they
`page.goto('/')`, write the token with `page.evaluate`, then immediately
`page.reload()`. **Corrected causal explanation (2026-10-05, per review B1):** the
pending anonymous `/auth/session` refusal completed after the storage write and the
provider's no-session cleanup cleared the externally seeded token; the earlier
"Chromium propagation" explanation was unsupported and is withdrawn. The app
behaviour is correct; the corrected setup seeds storage with `page.addInitScript`
before the first navigation. This defect predates F-03 and is returned to the
planner; the frozen F-02 acceptance was not edited.

## Stop

Independent review of F-03 is requested. F-04 remains blocked until F-03 is reviewed
and F-02's owed review is complete.

---

# Revision 2 — M1 contract-kind correction

Prepared 2026-10-05 by the planner/test-owner session for finding M1 in
`docs/reviews/F-03.md`. Scope is M1 only; no other F-03 finding is reopened.

## Honest correction to the revision-1 disclosure

The revision-1 text said the acceptance "was written before the routes were wired".
That is not what happened: in the compressed session the contracts, service and routes
were written first, then the acceptance, and the RED was staged by **unregistering the
routes** — surface absence, not behavioural RED. T006 is correctly unchecked for that
reason. The M1 correction below supplies genuine contract-assertion RED. The same
session compression is disclosed and is not relabelled as independent test-first
preparation.

## The defect

`MasterRecordSchema` was one object with every kind-specific field optional regardless
of kind, and `MasterListResponseSchema` did not require records to match the declared
list kind. A department could carry `severity` or `locationId`, and a `departments`
list could contain a `gates` record. The unit acceptance even asserted the first of
those as valid, contradicting its own name and the frozen spec. The API service
happens to construct well-formed output, so no malformed real response is claimed —
the shared contract and its acceptance failed the specified boundary.

## Corrected acceptance (frozen at revision 2)

`apps/api/tests/unit/f03-master-contracts.test.ts`:

- The contradictory assertion is replaced by strict kind-specific rejection cases:
  - a simple kind (departments/contractors/locations/vehicle-types) must reject
    `severity`, `defaultAction` and `locationId`;
  - a violation type must reject `locationId` and must require its `severity`;
  - a gate must reject `severity`/`defaultAction` and must require its `locationId`;
  - a list must reject any record whose `kind` differs from the list `kind`.
- Positive coverage for all six legitimate variants, as records and as homogeneous
  lists, is added.
- All existing create/update request-schema assertions are preserved, as are the
  real-DB integration and history-preservation assertions.

`specs/004-master-data/spec.md` now states the strict, symmetric kind rules and list
homogeneity explicitly.

## Measured RED against the current contracts

```bash
pnpm --filter @echallan/api exec vitest run --project unit tests/unit/f03-master-contracts.test.ts
```

Actual: **2 failed / 14 passed (16)** —

- `records are strict, kind-specific and carry only their kind-owned fields`:
  `AssertionError: expected true to be false` (a department carrying `severity` is
  accepted);
- `a list is homogeneous: every record matches the declared kind`:
  `a department list must not contain a gate record: expected true to be false`.

This is genuine contract-assertion RED on an existing route surface — not route
absence. The real-DB integration suite still passes **12/12** against the current
service, because legitimate output shapes are unchanged.

## Exact implementer instructions

1. In `packages/contracts/src/masters.ts`, enforce strict kind-specific records:
   - violation types: `severity` required, `defaultAction` present and nullable,
     `locationId` forbidden;
   - gates: `locationId` required, `severity`/`defaultAction` forbidden;
   - departments, contractors, locations, vehicle-types: none of those fields.
2. Enforce homogeneous list responses: every `masters[]` record's `kind` must equal the
   response `kind`. A `superRefine` is sufficient; do not change legitimate route or
   output shapes, and do not weaken the request schemas.
3. Keep the API service, migrations and history behaviour untouched. A shared-contract
   change verifies the API and both client suites.
4. Run the focused unit and integration suites, then the full gate order. In a
   disposable copy, bypass each enforced rule in turn (wrong-kind field accepted,
   missing kind-defining field accepted, mismatched list accepted) and show the
   matching unit case fails; restore and rerun cleanly.
5. Append the correction evidence to `docs/handoffs/F-03.md` without replacing history
   and stop for independent review.

## Expected GREEN after the fix

| Suite | Now | After |
|---|---|---|
| F-03 unit file | 2 failed / 14 passed (16) | **16 passed** |
| F-03 integration file | 12 passed | **12 passed** (unchanged) |
| `pnpm run test` (root units) | 136 passed | **138 passed** (contracts 8, API 92, tablet 21, admin 17) |
| `pnpm run test:integration` | 78 passed | **78 passed** (unchanged) |
| `pnpm run test:e2e` | 17 passed | **17 passed** (unchanged) |

## Baseline

`docs/handoffs/F-03-tests.sha256` is now **revision 2** (9 entries, 2 refreshed).
Revision 1 is archived byte-for-byte at `docs/handoffs/F-03-tests-rev1.sha256` (own
hash `2c808615…`, the value pinned in the review); it now reports 7 OK / 2 expected
FAILED — exactly the corrected unit test and spec. S-01/F-01/F-01-corrections and
F-02's revision 5 are unchanged.
