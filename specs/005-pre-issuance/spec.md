# Pre-issuance batch — shared shells, challan entry and repeat/duplicate preview

Status: planner preparation, 2026-10-07. Tasks: **F-04 + I-01 + I-05** (one bounded
batch). All three parent boxes unchecked. Feature directory: `specs/005-pre-issuance`.

Authority: `docs/eChallan_replacement_spec.md` v0.1 (owner-approved 2026-10-02) as
amended by `docs/eChallan_replacement_spec_v0.2.md` for authentication;
`docs/eChallan_DESIGN.md`; `docs/decisions.md` (B-02 single full-width form →
summary → later signature, D5 counting, B-06 synthetic registry, B-04 attribution);
`docs/eChallan_PRD.md` E2.1–E2.12/E2.17/E5; `docs/test-cases.md` UI-01–UI-03,
ENT-01–ENT-06, REP-01–REP-05. The unavailable Functional Specification v0.2 is not
reconstructed. F-02/F-03 are reviewed PASS
(`docs/reviews/F-03-m1-f02-b1-implementation.md`; accepted snapshot
`docs/reviews/F-02-F-03-accepted.sha256`).

## Outcome

A real authenticated Marshal journey: a full-width entry form with active-master
selection, editable registry autofill and server-authoritative validation, a
plain-language driver summary reached by Back/Next with state preserved, and a
persistent repeat/duplicate notice before signature. Alongside it, the approved
role shells and the shared design foundation (self-hosted fonts, tokens,
primitives) replace the foundation chrome. No evidence capture, signature/refusal,
submission, numbering or review mutation is added.

## Phase ownership

| Phase | Task | Scope |
|---|---|---|
| **A** | F-04 | tokens, self-hosted IBM Plex fonts, identifier typography, shared labelled-field/section/notice/error primitives, tablet and admin shells with real routes, foundation-test reconciliation, UI-01–UI-03 |
| **B** | I-01 | shared entry contracts, scoped registry lookup, authoritative draft validation, tablet entry form/autofill/validation and the summary/Back flow, ENT-01–ENT-06 |
| **C** | I-05 | repeat window, recommendation, duplicate window and preview service, persistent notices and acknowledgement, REP-01–REP-05 |

Phase B consumes A's primitives and shell; phase C consumes B's draft/validate
surfaces. Internal stages may proceed at verified GREEN under the owner's bounded
batch authorisation; independent review is deferred to batch exit only.

## Shared contracts (`packages/contracts/src/preIssuance.ts`, planned exports)

Entry draft — **severity is never a client field**:

```text
EntryDraftSchema = strictObject({
  vehicleRegistration: string,          // raw; normalised + pattern-checked
  gatePassNumber: string,               // trim/uppercase, 1-64 [A-Z0-9/-]
  driverName: string,                   // trimmed 1-120
  vehicleTypeId: uuid,                  // required active master
  departmentId: uuid,                   // required active master
  contractorId: uuid|null,              // optional active master
  violationTypeIds: uuid[],             // 1+, distinct, all active
  remarks: string,                      // trimmed, <=2000
  registry: strictObject({ gatePassRecordId: uuid, driverId: uuid, vehicleId: uuid })|null
})
```

- `RegistryLookupQuerySchema = { field: 'registration'|'gatePassNumber'|'driverName',
  query: string }`; the trimmed query must be at least **3** characters.
- `RegistryMatchSchema = { gatePassRecordId, gatePassNumber, driverId, driverName,
  vehicleId, vehicleRegistrationNumber, vehicleTypeId, vehicleTypeLabel,
  departmentId, departmentLabel, contractorId|null, contractorLabel|null,
  status: 'active'|'expired', validUntil: iso|null }`.
- `RegistryLookupResponseSchema = { matches: RegistryMatchSchema[] }`.
- `DraftFieldErrorSchema = { field: string, code: DraftErrorCode, message: string }`;
  `DraftValidationErrorSchema = { error: 'invalid_draft', message, fields:
  DraftFieldErrorSchema[] }` (422).
- `EntryValidationResponseSchema = { severity: Severity, otherFields:
  ('department'|'vehicleType'|'contractor'|'violationType')[] }` (200).
- `ChallanPreviewRequestSchema = strictObject({ draft: EntryDraftSchema,
  warningAcknowledged: boolean })`.
- `ChallanPreviewResponseSchema = strictObject({ severity: Severity,
  occurrenceNumber: integer >= 1, recommendedAction: ResolutionActionCode,
  duplicateWarning: strictObject({ required: boolean, matchedCount: integer >= 0 }),
  windowDays: literal(90), windowMinutes: literal(15) })`.
- Pure helpers: `isOtherLabel(label)`, `REPEAT_WINDOW_DAYS = 90`,
  `DUPLICATE_WINDOW_MINUTES = 15`, `repeatWindowStart(now)`,
  `duplicateWindowStart(now)`, `isWithinRepeatWindow(issuedAt, now)`,
  `isWithinDuplicateWindow(issuedAt, now)`. The existing
  `deriveChallanSeverity` and `recommendedActionForOccurrence` remain the only
  severity/recommendation mappings. **Both windows include their lower boundary.**

**"Other" representation (delegated technical detail).** Other is the active master
row whose trimmed label is exactly `Other`; the approved fixture configures one for
departments, vehicle types and violation types. Selecting one requires nonblank
remarks. The synthetic fixture has no Other contractor; the rule is exercised by
admin-created Other contractors in tests and is documented as a fixture gap. A
future revision may add an explicit master flag instead of the label convention.

## API surfaces (Marshal-only, session-scoped)

| Route | Behaviour |
|---|---|
| `GET /registry/lookup?field=…&q=…` | suggestions after 3+ trimmed characters, scoped to the session post's location via `gate_pass_locations`; one match per gate-pass record, including vehicles with zero prior challans; expired passes are returned with `status:'expired'`; unknown fields or a short query are `400 invalid_request`; anonymous `401`; non-Marshal `403 forbidden`; a Marshal without a bound post `403 forbidden_context` |
| `POST /challans/validate` | authoritative draft validation: normalisation/format, active existing masters, distinct active violations, Other-remarks coupling, provenance consistency, location from the session (never from the body); `200 EntryValidationResponseSchema` with the derived highest severity, or `422 invalid_draft` with field errors |
| `POST /challans/preview` | validates, then returns `200 ChallanPreviewResponseSchema`: occurrence = prior **non-cancelled** challans with the same normalised gate-pass number in `[T-90d, T)` plus one (Issued/Under Review/Resolved count; Cancelled does not; multi-violation counts once; different passes never merge), the approved recommendation tier for that occurrence, and a duplicate warning when the same normalised registration at the **session location** appears in `[T-15min, T)`. No record is written and no number is reserved |

`createApp` gains an optional `now?: () => Date` clock seam (defaulting to the real
clock) so boundary acceptance is deterministic. A new shared error code
`invalid_draft` is added; the existing `invalid_request`, `forbidden`,
`forbidden_context` and `not_found` codes are reused.

## Client surfaces

Tablet (Marshal, protected shell, idle logout and C1 ordering unchanged):

- `apps/tablet/src/routes/EntryFlow.tsx` — **lazy** route containing the full-width
  single entry form and the plain-language driver summary step; Back returns to the
  form with every value preserved; no durable draft.
- Form: statically labelled fields; active-only master selects from
  `GET /masters/:kind`; distinct multi-select violations; derived severity shown
  read-only; Other selections require nonblank remarks; registration/gate-pass/
  driver-name suggestions after 3 characters with a 300 ms debounce, cancellation of
  obsolete responses and a request-sequence guard so a slow old result cannot
  overwrite a newer query or selection; explicit driver/pass choice for multiple
  matches; known fields filled and still editable; provenance recorded without
  mutating the registry; expired-pass notice; loading, empty, failure and retry
  states; session-bound location shown read-only.
- Summary step: plain-language text, derived severity, persistent repeat notice with
  occurrence number and prescribed action (not a toast), duplicate-warning notice
  requiring explicit acknowledgement before continuing; any material input change or
  re-preview invalidates the acknowledgement and returns to the form.
- Draft state lives in session-scoped memory and is cleared on logout and idle
  expiry (extending the existing unsent-state store).

Admin (Supervisor/Admin): role shell with a lazy `DashboardScreen` that honestly
states the review workflow arrives with R-01; no fake totals, charts or dead links.

## Explicitly not claimed

No evidence/photos, signature/refusal, submission, numbering, idempotency,
transaction finalisation, review mutations, cancellation, filters, export, user
management, master screens, offline queue, dashboard totals, production registry
integration, hardware, HTTPS or deployment. UI-01's commit-size clause and UI-02's
thumbnail-label clause are deferred with I-02/I-06. The preview is not a
reservation: I-06 still owns serialisation and final rechecks.

## Recorded reachability limits (synthetic demo)

1. **Multiple-driver choice in the real browser**: both `MH12RT7306` passes belong
   to `loc-dispatch`, and the approved demo auth model has one Marshal account
   bound to `loc-main`. Covered by component and real-DB acceptance; not reachable
   in the browser with approved credentials.
2. **Duplicate warning in the real browser**: seeded history is at fixed past dates
   and this batch adds no submission endpoint, so no record can fall within 15
   minutes of a real run. Covered by component and real-DB acceptance; the browser
   covers the persistent repeat notice.
3. **Contractor Other**: not configured in the approved fixture; exercised through
   an admin-created Other contractor in tests.
4. **Foundation-test reconciliation**: the new shells replace the S-01 foundation
   screens, so the foundation component/e2e checks and the R4 lazy-route paths are
   revised to the new surfaces; the S-01/F-02 historical baselines will show the
   documented delta and are not regenerated.

## Acceptance and RED honesty

Executable acceptance covers UI-01–UI-03, ENT-01–ENT-06 and REP-01–REP-05 across
shared contracts, API unit/real-DB integration, component and real-browser levels.
New modules/routes/exports are **surface-absence RED** at preparation and are
labelled as such; the implementer must wire the surfaces and then record genuine
behavioural RED (for example a stale lookup overwriting a newer one, an inactive
master accepted, a boundary counted on the wrong side) before completing the rules.
Deterministic clocks and fixtures are used; no test is skipped, weakened or
narrowed. The batch baseline is `docs/handoffs/pre-issuance-tests.sha256`.

---

## Revision note — owner UI revision (B-08/B-09, 2026-10-17)

Recorded by the owner-authorised revision session; supersedes this document
where they conflict, pending independent review:

- The vehicle registration control is now a searchable dropdown listing the
  session location's gate-pass vehicles (`GET /registry/lookup` with an empty
  query; bounded at `REGISTRY_LIST_LIMIT`). One- and two-character input filters
  the loaded list locally and sends no request; three or more characters keep
  the existing debounced search with its cancellation/sequence guards (ENT-02's
  no-request-below-three rule is preserved for searches).
- "Enter a new vehicle" is a one-off manual path: `registry` provenance stays
  null, nothing is written to the registry, the gate pass number remains
  required and occurrence counting is unchanged.
- The client is split into "Vehicle & driver" and "Violation details" sections
  with a three-step progress strip; the summary uses labelled rows and the
  restyle covers all tablet and admin surfaces within the constitution gates.
- Owner decisions: `docs/decisions.md` B-08 and B-09. Revised test baseline:
  `docs/handoffs/owner-ui-revision-tests.sha256`. Handoff:
  `docs/handoffs/owner-ui-revision.md`.
