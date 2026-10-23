# F-03 — Master-data API and historical meaning

Status: planner preparation, 2026-10-05. Parent task: F-03, both boxes unchecked.
Authoritative sources: `docs/eChallan_replacement_spec.md` v0.1 (owner-approved
2026-10-02) for master fields and the B-05 historical-meaning policy, as recorded in
`docs/decisions.md`; `docs/eChallan_PRD.md` E5.1–E5.3; `docs/test-cases.md`
MST-01–MST-03. The unavailable Functional Specification v0.2 is not reconstructed.

Dependencies: F-01 (reviewed PASS) supplies the master tables, their `is_active`
columns and the immutable issued snapshots. F-02 (implemented; independent review still
owed) supplies authentication and the Admin role boundary. **Owner override
2026-10-05:** F-03 proceeds while `F-02 Reviewed` is unchecked, at the owner's explicit
direction; this is a disclosed deviation, not an F-02 approval.

## Outcome

An Admin-only HTTP API manages the six approved master sets, deactivates rather than
deletes, and can never change the meaning of an already-issued challan. Every
authenticated role can read the active-only selection catalogue that future issuance
will consume. Non-admin attempts are refused server-side with no side effects.

## Master sets and fields

| Kind (URL segment) | Table | Create | Update | Notes |
|---|---|---|---|---|
| `violation-types` | `violation_types` | `label`, `severity` (Minor/Major/Critical), optional `defaultAction` (approved code or explicit null) | any subset of `label`, `severity`, `defaultAction` | one severity per violation type (spec §5); `defaultAction` is a separate reference, never the issuance recommendation |
| `departments` | `departments` | `label` | `label` | |
| `contractors` | `contractors` | `label` | `label` | |
| `locations` | `locations` | `label` | `label` | |
| `gates` | `gates` | `label`, `locationId` of an existing **active** location | `label` only | moving a gate between locations is not an approved operation and is rejected |
| `vehicle-types` | `vehicle_types` | `label` | `label` | |

`label` is trimmed, 1–120 characters and non-blank. Payloads are strict: an unknown
field, a missing required field, a blank label, an unknown severity or an unknown
action code is `400 invalid_request`. Master labels are **not** unique in the approved
schema, so duplicates are permitted and no uniqueness rule is invented.

## Routes

Mounted at the root beside `/health` and the F-02 auth routes, so the verified Vite
`/api` proxy keeps working unchanged (browser calls `/api/...`, Fastify `inject` calls
`/...`).

| Route | Role | Behaviour |
|---|---|---|
| `GET /masters/:kind` | any authenticated session | **Selection catalogue**: active entries only, ordered by label then id. For `gates`, a gate is listed only when its own row **and** its location are active. `{kind, masters}` |
| `GET /admin/masters/:kind` | Admin | Management list: every entry, active and inactive, same shape and order |
| `POST /admin/masters/:kind` | Admin | Create; `201 {master}` |
| `PATCH /admin/masters/:kind/:id` | Admin | Update the allowed fields; `200 {master}`. An empty patch is `400` |
| `POST /admin/masters/:kind/:id/deactivate` | Admin | Deactivate; `200 {master}` with `isActive:false`; repeating it is idempotent |
| `DELETE …` | — | **No delete route exists.** Deletion is not an approved operation |

Refusals: `401` anonymous; `403` authenticated non-Admin on `/admin/masters/**`
(`forbidden`); `404` unknown kind or unknown id (`not_found`); `400` payload or
kind-field violations (`invalid_request`); `422` a gate whose `locationId` is unknown
or inactive (`invalid_reference`). Error bodies are exactly `ApiErrorSchema`.

`MasterRecord` shape: `{id, kind, label, isActive, severity?, defaultAction?,
locationId?}`; the kind-specific fields are present **only** for the kinds that own
them. **Kind enforcement is strict and symmetric:** a violation-type record always
carries `severity` (and `defaultAction`, nullable) and never a `locationId`; a gate
record always carries `locationId` and never `severity` or `defaultAction`; a
department, contractor, location or vehicle-type record carries none of those fields.
A list response is **homogeneous**: every record's `kind` equals the response `kind`.
Shared validation rejects any wrong-kind field and any mismatched list, while
legitimate route and output shapes stay unchanged.

## Historical meaning (B-05, MST-02/MST-03)

- Master mutations touch **only** the master tables. They never update `challans`,
  `challan_violations`, `evidence`, `signatures`, `refusals`, `challan_actions` or
  `audit_events`.
- Issued snapshots (`department_label_snapshot`, `contractor_label_snapshot`,
  `vehicle_type_label_snapshot`, and each `challan_violations` label/severity/default
  action snapshot) remain exactly as issued after any edit or deactivation, and the
  master reference ids remain unchanged for provenance.
- A deactivated master disappears from the selection catalogue but is still readable
  in the management list and still resolves on historical records.
- Deletion remains impossible: the API exposes no delete route, and every
  history-referencing foreign key refuses a database delete of a referenced master.
  (F-01 already enforces the FK side; F-03 acceptance proves it.)

## Explicitly not claimed

- No admin screens (R-05), no user management (E1.4/AUTH-06), no "Other" promotion
  (E5.4, P1), no posts/shifts management, no master audit-event writes (R-06 owns
  audit enforcement), no reactivation workflow, no deletion, no bulk import/export.
- No challan issuance: F-03 proves the active-only selection rule at the catalogue
  boundary; the issuance API that consumes it arrives with I-01 and must re-validate
  active ids server-side.
- No production readiness, hardware, HTTPS, deployment or backup claim.

## Acceptance and RED honesty

Planner acceptance is executable before handoff and is expected to fail with genuine
behavioural RED (the routes do not exist yet). Missing routes and modules are labelled
as surface-absence RED and are not evidence of a business-rule defect; after wiring,
the same unchanged tests must pass. No test may be skipped, weakened or narrowed.
F-03 completion needs format/lint/typecheck, the focused unit and real-DB suites, all
F-01/F-02/foundation regressions, both client builds, the tablet size budget, untouched
planner hashes and a separate independent review.
