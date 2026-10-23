# Large pre-issuance batch — delegation brief

Prepared: 2026-10-07. Proposed batch: **F-04 + I-01 + I-05**.
Status: scope/delegation brief, **not** a frozen acceptance handoff or permission
to start unprepared production changes. The owner requested a substantial batch
for the other agent rather than small task-by-task exchanges.

## Milestone

Deliver a real authenticated Marshal journey from a full-width entry form through
editable registry autofill and master validation to a plain-language driver
summary showing current repeat occurrence/recommendation and duplicate warning.
Build the shared design foundation and role-specific client shells alongside it.
The journey uses the real Fastify API, synthetic registry and PostgreSQL.

This batch ends before evidence capture, acknowledgement and challan commitment.
Those remain I-02/I-03/I-04/I-06; detailed E-01/E-02/E-03 contracts are still proposed.
No issued record/number, camera/signature, offline queue, review mutations, export,
administration CRUD screens or deployment is added by this scope.

## Authority and dependencies

- F-02/F-03 reviewed PASS: `docs/reviews/F-03-m1-f02-b1-implementation.md`.
- Accepted snapshot: `docs/reviews/F-02-F-03-accepted.sha256`; active acceptance
  manifests and historical archives remain intact. Document legitimate planning
  deltas rather than regenerate previous snapshots to claim unchanged bytes.
- Read PRD, design, approved replacement v0.1, auth addendum v0.2, decisions and
  test catalogue. B-02's full-width single-form → summary → later acknowledgement
  supersedes the PRD's older stepped-entry depiction.
- B-06 is resolved for the synthetic local demo, not production integration.
- Normal dependencies are F-04 → I-01 → I-05. A single implementation run across
  those tasks needs the owner's **explicit bounded batch authorisation**, carried
  by the implementation prompt after preparation confirmation: internal stages
  may proceed at verified GREEN, with independent review deferred to batch exit.
  This exception applies only to these three tasks; it supplies no self-review,
  new business policy or permission to continue the backlog.

## Workstream A — F-04 design foundation and shells

- Complete role-specific shared tokens/theme, self-hosted IBM Plex fonts and
  identifier typography. Verify against installed pinned MUI versions.
- Use static visible labels, tablet input/option targets ≥56 px, secondary
  controls ≥56 px, icon controls ≥56×56 px and target gaps ≥12 px. Reserve the
  solid-green action for final challan commitment, which is outside this batch.
- Provide visible focus, outlined status chips, labelled severity and readable
  disabled/read-only values, reduced-motion handling and responsive layouts.
- Build reusable labelled field, section, validation/error and notice primitives
  needed by this journey. Keep contracts/theme shared; apps never import another
  app's internals. Do not add an unsolicited UI framework or duplicate design system.
- Replace foundation-style chrome with the approved role shells and real
  supported routes. Preserve login/logout, role boundaries, context attribution,
  idle expiry and C1 ordering/error handling. No fake dashboard totals or dead links
  presented as completed features.
- Route-split substantial screens, use exact-path MUI/icon imports, keep admin-only
  widgets out of tablet/shared client code and measure the initial JS budget.

## Workstream B — I-01 entry, master selection and registry lookup

- Full-width single entry form; dashboard content separate. Server numbering/date
  attribution are not editable inputs; number remains assigned on future submission.
- Vehicle/pass normalisation and approved formats; trimmed names/remarks;
  required master IDs and distinct multi-violation selections; non-editable derived
  highest severity. Applicable Other selections require remarks, including contractor
  Other when selected. Actual location/gate/post remain session-bound/read-only.
- Consume F-03 active master catalogues; do not silently retain inactive choices.
  API validation remains authoritative. Define and test bounded validation/lookup
  surfaces without creating an issuance/submission endpoint prematurely.
- Suggestions after three characters for plate/pass/name, sourced from registry/pass
  records, not just historical challans. Marshal scope follows current authorised
  location. Cover GJ05JP6207's zero-history match and MH12RT7306's multiple drivers.
- Explicit driver/pass choice; populate known fields but keep approved edits possible.
  Preserve provenance versus issued descriptions; no silent registry mutation or
  identity merge. Expired/manual/unknown matches follow the approved demo rules.
- Debounce/cancel obsolete lookup responses; a slow old result must not overwrite a
  newer query/selection. Cover genuine loading, empty, failure and retry states.
- Keep in-memory values through entry → summary → Back; clear state on logout/idle
  expiry. No durable draft persistence is added. Use approved plain-language summary.

## Workstream C — I-05 repeat and duplicate preview

- API service calculates gate-pass-keyed prior non-cancelled challans in elapsed
  `[T − 90 days, T)` and returns prospective occurrence = prior count + one.
  Multi-violation challans count once; names/vehicles do not become repeat identity.
- Approved recommendation tiers: first Warning issued; second Safety counselling;
  third+ Referred to department/contractor. Actual follow-up remains separate.
- Same normalised vehicle/actual location in `[T − 15 minutes, T)` triggers the
  duplicate warning; other vehicles/locations do not. Require explicit warning
  acknowledgement in pre-issuance state; acknowledgement permits continuation.
- Show persistent notices before driver summary, not transient toasts. Changed
  relevant inputs/preview invalidate stale warning acknowledgement and summary
  state. Cover updated history after a prior preview and deterministic boundary tests.
- Server clock/context is authoritative. Define preview visibility under role/scope
  rules without leaking unauthorised record details. Preview is not a reservation:
  I-06 still owns transaction serialization, final rechecks, acknowledgement binding
  and retry-safe issuance. Do not claim those are implemented by this batch.

## Preparation packet — one complete planner run

Prepare the entire three-task packet without returning after each minor artifact:

1. One bounded feature directory with spec/plan/tasks and exact shared/API contracts,
   field/response dictionaries, supported client routes and internal phase ownership.
   Preserve Spec Kit feature selection behaviour and historical specs.
2. Executable mapped acceptance for **UI-01–UI-03, ENT-01–ENT-06, REP-01–REP-05**:
   shared/domain contracts, real-DB API rules, component interactions and real-browser
   entry/autofill/summary/Back/repeat/duplicate journeys. No placeholder/skipped tests.
3. Deterministic fixtures/clock seams for active/inactive/Other, zero-history/shared
   vehicles, expired/manual passes, scoped suggestions and exact time boundaries.
4. Clearly distinguish substantive behavioural RED from absent surfaces. Specify
   the implementer's staged behavioural RED and disposable-copy fault checks where
   new route/module surfaces must first be wired.
5. Reconcile existing tests' preconditions without weakening meaningful assertions.
   Define writable implementation config versus frozen test/spec/fixture ownership.
6. Freeze a **new** batch manifest; do not overwrite earlier baselines. Record exact
   commands, measured counts, unresolved blockers and any synthetic-media/device limits.
7. Return once for independent preparation confirmation; keep parent task boxes
   unchecked. Production implementation uses that confirmed packet in a fresh session.

## Implementation run and review exit

After explicit owner batch authorisation and preparation confirmation, implement
A → B → C continuously, using GREEN internal prerequisites rather than pausing
for intermediate task reviews. Preserve planner-owned acceptance. Root/shared
ownership stays with one coordinator; workers are optional only if separately
authorised, with disjoint writes and no shared DB resets concurrently.

Run format → lint → typecheck → focused/unit → real-DB → browser → affected
production builds → tablet budget and affected foundation regressions. Use the
actual verified root commands, not guesses. Demonstrate faults in disposable
copies and restore/rerun clean. Bundle must remain below 250000 gzip bytes.

Create batch implementation evidence with changed files, migrations (additive only
if approved), RED/GREEN, real counts, sensitivity, regressions/build/budget results
and device checks still pending. Tick implementation only after complete evidence;
leave all review boxes unchecked. Return **one combined independent review request**
covering F-04/I-01/I-05 and stop before media/submission or any other task.
