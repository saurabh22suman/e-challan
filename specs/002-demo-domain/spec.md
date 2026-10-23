# F-01 — Approved demo contracts and relational schema

Status: planner preparation, 2026-10-02. Parent task: F-01.
Authoritative replacement: `docs/eChallan_replacement_spec.md` v0.1, approved
by the owner on 2026-10-02. Acceptance catalogue: DOM-01–DOM-03.
Dependencies: reviewed S-01; B-01/B-02/D3/D5 and demo B-04/B-05/B-06 resolved in
`docs/decisions.md`. Production lookup remains outside this feature.

## Outcome

Shared, strict demo-domain contracts; an API-side validation adapter consuming
those contracts; incremental PostgreSQL migrations; a guarded synthetic domain
seed adapter. Client consumers and compiled API continue consuming shared package
exports successfully. This task defines foundations for later features; it does
not expose public issuance, authentication, review, media or export routes.

## Boundaries

- Keep existing liveness/readiness and the S-01 harness table/tests functional.
  Add domain migrations after the existing migration; do not delete/rewrite it.
- No login UI, JWT implementation, camera/signature UI, issuance transaction or
  numbering allocator, repeat-query service, review mutation endpoint, import UI,
  deployment or external integration. Pure shared contract validation is in scope.
- No weakening or editing planner-owned tests, approved spec or source fixture.
- Model evidence references without claiming validated live blobs, media budgets
  or real device acceptance. Those arrive with I-02–I-06.

## Contract interface (planner-chosen wiring)

`packages/contracts` exports strict Zod schemas:

1. `ChallanSubmissionSchema`: structurally complete client request; fields are
   `operationId`, `vehicleNumber`, `gatePassNumber`, `driverName`, `departmentId`,
   optional `contractorId`, `vehicleTypeId`, distinct nonempty `violationIds`,
   optional `remarks`, `photoIds` (1–4 distinct UUIDs), and `acknowledgement`.
   `acknowledgement` is either `{kind:'signed',signatureId:UUID}` or
   `{kind:'refused',reason,witnessName,witnessStaffId}`. Refusal witness is a
   supervisor under E2.14; structural shape does not itself prove their role.
   IDs/operation key are UUIDs. No actor, post, shift, location, status, severity,
   number, timestamp or recommendation may be supplied as a request authority.
   Normalise registration to uppercase/remove whitespace, normalise gate pass
   uppercase/trim, and trim user text under the approved field rules.
2. `ResolutionActionSchema`: `{action,remarks}`; action values
   `warning_issued`, `safety_counselling_completed`,
   `referred_to_department_contractor`, `custom`; remarks required for all.
   No separate custom name, performer or per-violation action field.
3. `ReviewTransitionSchema`: discriminated request types
   `{to:'Under Review'}`, `{to:'Resolved',action,remarks}` and
   `{to:'Cancelled',reason}`. Reopening uses `{to:'Under Review',reason}`.
   Contextual role/current-state requirements belong to later review features;
   this schema does not pretend to authorise a transition by itself.
4. `SeveritySchema`, `ChallanStatusSchema`, `RoleSchema`:
   Minor/Major/Critical; Issued/Under Review/Resolved/Cancelled;
   Marshal/Supervisor/Admin. UI labels are distinct from stable action codes.

Pure helpers `deriveChallanSeverity(severities)` and
`recommendedActionForOccurrence(positiveInteger)` implement only the approved
highest-of-set and 1/2/3+ recommendation mappings. They are not repeat-counting
queries or issuance services.

API adapter: `apps/api/src/domain/validation.ts` exports
`validateChallanSubmission(input)` with exactly the shared schema's parse result:
canonical object returned on success, validation error thrown on failure.
It is internal plumbing, not an unauthenticated validation/issuance endpoint.
Active master IDs, Other selection, ownership, witness roles and current
duplicate/repeat acknowledgements need real API/domain context in their later
tasks and must not be claimed as enforced by this structural adapter.

## Relational interface for acceptance

Use UUID primary keys and preserve synthetic fixture IDs via explicit
`demo_source_id` mappings; do not treat fixture IDs as approved UUIDs.
Minimal public tables required:

- `users`, `locations`, `gates`, `posts`, `shifts`, `user_locations`;
- `departments`, `contractors`, `vehicle_types`, `violation_types`;
- `drivers`, `vehicles`, `gate_pass_records`, `gate_pass_locations`;
- `challans`, `challan_violations`, `evidence`, `signatures`, `refusals`;
- `challan_actions`, `audit_events`.

SQL fields explicitly exercised by acceptance:

| Table | Required fields and constraints |
|---|---|
| users | `id` UUID PK; `username` unique; `role`; active/deactivated indicator; no cleartext password column |
| locations | `id` UUID PK, `label`, active indicator |
| departments | `id` UUID PK, `label`, active indicator |
| vehicle_types | `id` UUID PK, `label`, active indicator |
| violation_types | `id` UUID PK, `label`, `severity` constrained to approved values, `default_action`, active indicator |
| drivers | `id` UUID PK, `name` (not unique) |
| vehicles | `id` UUID PK, `registration_number` unique normalised value |
| gate_pass_records | `id` UUID PK, `gate_pass_number` unique normalised value, `driver_id` FK, `vehicle_id` FK |
| challans | `id` UUID PK, unique `challan_number`, `gate_pass_number` issued snapshot, `status` constrained to approved values; retain issued references and snapshots defined by the field dictionary |
| challan_violations | `challan_id` FK, `violation_type_id` FK, unique pair, `label_snapshot`, `severity_snapshot`, `default_action_snapshot` |

Remaining fields and composite FK/index design must be enumerated in the
implementer plan before migrations: actor/post/shift/gate/location consistency,
optional registry provenance versus manually issued values, timestamps,
recommendation snapshots, object keys, signature/refusal, per-challan action
history, cancellation/reopening reasons and audit source. No unsupported
business rule should be added in a database convenience constraint.

Master references must restrict deletion rather than cascade away historical
challans. Names may duplicate. A vehicle may have several driver/pass records.
Normalised vehicle/pass uniqueness and the violation pair must be enforced in
PostgreSQL, not merely Zod. Transaction rollback must leave no partial insert.

## Seed interface

`apps/api/src/db/seed-domain-demo.ts` exports
`seedDomainDemoDatabase(connectionString)`. Validate the target before any write,
preserve the original `seedDemoDatabase` foundation adapter, and use the existing
`docs/demo-data.json` fixture with explicit ID mapping and fixed timestamps.
Expose a separate documented domain seed command; do not silently replace the
foundation seed command or reset production/user-owned data.

Repeat invocation does not duplicate rows or change registry/challan identities.
The historical fixture may populate a clearly tagged synthetic-history adapter;
metadata counts do not manufacture real media/signature evidence. Document
how history/actions/attribution satisfy constraints without claiming actual
operational issuance. Live issued entities arrive through later validated services.

## Acceptance and RED honesty

Planner tests are executable before handoff. Missing contract exports or domain
tables are **surface-absence RED**, not proof of a behavioural defect. Once the
implementer wires the surfaces, rerun the unchanged tests and record failing
validation/constraint assertions before enforcing behaviour. Mutation tests in a
disposable copy must prove rejection tests fail when validation/constraints are
bypassed. No skipped tests or mock substitutes for PostgreSQL are permitted.

F-01 completion needs format/lint/typecheck, focused contracts/API/DB tests,
foundation regressions, both client builds and API build, untouched planner
hashes, and a separate independent review. Do not advance to F-02 automatically.
