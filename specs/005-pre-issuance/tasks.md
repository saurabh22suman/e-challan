# Pre-issuance batch tasks (F-04 + I-01 + I-05)

Current independent review (2026-10-07): **CHANGES_REQUIRED**,
`docs/reviews/F-04-I-01-I-05.md`. Affected UI/lookup/summary/acknowledgement
and acceptance tasks below are returned to unchecked. Historical GREEN evidence
is retained; it does not supersede the independent findings or approve the batch.

Implementation boxes only; independent review stays on the parent checklists.
Owner-bounded batch: internal phases may run continuously at verified GREEN;
independent review is deferred to batch exit.

## Phase A — F-04 shared foundation and role shells

- [x] T101 Verify the batch manifest and all earlier baselines; inspect the accepted
  F-02/F-03 snapshot; record surface-absence RED accurately.
- [ ] T102 Add pinned self-hosted IBM Plex Sans/Mono, extend tokens (status/severity,
  focus, identifier mono, disabled text) and verify the design constraints against
  the installed MUI versions.
- [ ] T103 Add shared labelled-field, section, validation/error, notice and severity
  primitives with exact-path imports.
- [x] T104 Replace the foundation chrome with the tablet and admin shells, real
  routes and a lazy screen per app; preserve auth, role, attribution, idle and C1
  behaviour.
- [x] T105 Reconcile the foundation component/browser checks and the R4 lazy-route
  paths; document the S-01 delta without regenerating historical manifests.
- [ ] T106 Obtain GREEN on UI-01–UI-03 acceptance (labels, touch targets, focus,
  fonts, contrast, responsive navigation, no admin widgets on tablet, lazy chunks,
  budget).

## Phase B — I-01 entry, lookup and validation

- [x] T201 Add the shared pre-issuance contracts and pure helpers exactly as
  specified, including the Other-label rule and window helpers.
- [x] T202 Implement the Marshal-only scoped registry lookup service and route.
- [x] T203 Implement the authoritative draft validation service and route with
  `422 invalid_draft` field errors.
- [ ] T204 Build the tablet entry form: active master catalogues, autocomplete with
  debounce/cancel/sequence guard, multiple-driver choice, editable autofill, expiry
  notice, validation display and read-only derived severity.
- [ ] T205 Build the summary/Back flow with preserved values and session-scoped
  draft clearing on logout/idle.
- [ ] T206 Obtain GREEN on ENT-01–ENT-06 acceptance across contracts, API,
  component and browser levels.

## Phase C — I-05 repeat and duplicate preview

- [x] T301 Implement the preview service and route with the injected clock, exact
  inclusive boundaries and no writes.
- [ ] T302 Add persistent repeat/duplicate notices and explicit acknowledgement to
  the summary step; invalidate acknowledgement and summary on material changes or a
  changed re-preview.
- [ ] T303 Obtain GREEN on REP-01–REP-05 acceptance including real-DB boundary,
  cancellation and multi-violation cases.
- [ ] T304 Run the disposable-copy fault sensitivity for every guard listed in the
  plan; restore and rerun cleanly.
- [x] T305 Run the full prescribed regression/build/budget/foundation gates and
  record real counts and known limitations.
- [ ] T306 Write the batch implementation evidence and one combined review request;
  tick implementation only after complete verification and leave every review box
  unchecked.

Evidence: `docs/handoffs/pre-issuance.md`. Parent `Reviewed` boxes for F-04/I-01/I-05
stay unticked until the combined independent review records its report.

Implementation evidence: `docs/handoffs/pre-issuance.md`. All batch tasks are ticked
on that evidence; baseline revision 2 (`docs/handoffs/pre-issuance-tests.sha256`)
records the planner test corrections the run surfaced. **Every review box stays
unchecked**: the owner authorised the bounded batch before an independent
preparation confirmation existed (disclosed override), and one combined independent
review is required at batch exit.
