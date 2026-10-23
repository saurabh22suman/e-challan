# Inclusive UX revamp: implementation and review handoff

Date: 2026-10-18. Planning author: UI/UX audit session.

**Status: detailed implementation proposal, not executable-test preparation or review approval.**

## 1. Outcome and owner direction

The owner requested a detailed revamp plan to hand to another agent, then clarified:

> “the idea is to make this app user friendly, even for less educated people.”

Design for people with limited reading confidence or digital experience, including
staff working outdoors under pressure. Do not equate education with intelligence,
domain knowledge, disability, or language preference. Use adult, respectful language.

Success means an operator can answer these questions without assistance:

1. What do I do now?
2. What information does this field need?
3. What went wrong, and how do I fix it?
4. Has my work only been captured here, or has a challan actually been issued?

This is a task-usability revamp, not a decorative reskin. Keep the current visual
identity unless a measured readability or interaction problem justifies a change.

## 2. Authority, prerequisites, and scope

### Read these first

- `AGENTS.md`, `docs/development-workflow.md`, `.specify/memory/constitution.md`.
- `docs/implementation-plan.md`, `docs/test-cases.md`, `docs/decisions.md`.
- `docs/eChallan_replacement_spec.md` and authentication addendum
  `docs/eChallan_replacement_spec_v0.2.md`.
- `docs/eChallan_PRD.md` and `docs/eChallan_DESIGN.md`, interpreted through the
  later approved decisions.
- `docs/handoffs/owner-ui-revision.md`, its active test manifest and review request.
- `docs/reviews/entry-media-v1-v6-rereview.md` and any newer independent disposition.

### Existing decisions the revamp must respect

| Decision | Implementation constraint |
| --- | --- |
| B-02, 2026-10-02 | One full-width scrolling entry form, then driver summary, then evidence/signature or refusal. Do not replace it with a wizard without a new owner decision. |
| B-08 vehicle interaction, 2026-10-17 | Searchable location-scoped vehicle dropdown; autofilled values remain editable; manual entry writes nothing to registry; gate pass remains required. |
| B-09, 2026-10-17 | Visual restyle is permitted, but static labels, touch targets, contrast, package boundaries and green-only commit remain binding. |
| E-02 | Live camera only; 1–4 photos; approved JPEG compression/size limits; recoverable failures and correct teardown. No gallery upload. |
| E-03 | Signature/refusal binds to the canonical summary revision. Rotation, DPR change or window resize >10% invalidates signature. Preserve this policy. |
| Authentication addendum | Marshal inactivity expiry is 600 seconds; unsent state is cleared. No offline queue or persistent draft recovery. |
| D3/D5 and approved domain spec | Preserve severity, repeat counting, duplicate acknowledgement, role/location scope, immutable issued records and audit rules. |

**Identifier collision:** older authentication documents use B-08 for deferred
production credential management, while the 2026-10-17 register uses B-08 for
vehicle interaction. Always cite the date and subject, not just “B-08.”

### Baseline readiness

At planning time, the cross-feature checklist keeps F-04, I-01, I-02, I-03 and
I-05 unchecked at the combined checkpoint. The independent 2026-10-17 entry-media
review reports CHANGES_REQUIRED:

- **C1:** Cancel during acquired-stream / pending `video.play()` does not stop
  tracks immediately.
- **C2:** Drawing after confirmation does not invalidate the previously confirmed
  PNG; pending hydration can overwrite a new stroke.

The owner UI revision also requests independent review and baseline confirmation.
Do not infer acceptance from its recorded green test counts. Recheck for newer
reports before starting. Existing batch overrides do not automatically authorise
this new revamp batch.

Planning can proceed now. Production implementation starts only after UX-00
establishes the appropriate reviewed baseline and each task has planner-prepared
acceptance. C1/C2 correction belongs to the existing correction process, with new
planner acceptance where required, rather than a cosmetic change hiding the defect.

### In scope

- Both login screens, conditional post/shift selection, protected shells.
- The existing entry form, lookup, manual-entry mode and conditional remarks.
- Validation, focus, progress guidance and in-memory correction navigation.
- Driver summary, repeat and recent-duplicate guidance.
- Camera/photo presentation, signature/refusal feedback and local-only ending.
- Honest admin/supervisor placeholder content.
- Responsive behaviour, accessible semantics and representative-user validation.

### Separately gated work

I-04 uploads/storage, I-06 submission/numbering/receipt, R-series operational
dashboard/review/reporting, production authentication, deployment and offline work
retain their existing tasks and approvals. This plan must not create pretend
submission, pretend dashboard totals or dead navigation to unavailable features.

Local-language support is a conditional workstream. Establish actual languages,
reading preference, approved terminology and translation ownership before building
it. English simplification alone does not establish accessibility for non-English
readers. Speech input, audio prompts and video tutorials are not defaults.

## 3. Evidence and interpretation

Playwright MCP inspected the running tablet at port 5173 and admin at port 5174 on
2026-10-18, including marshal/admin/supervisor sign-in. Evidence screenshots are
under `.playwright-mcp/ux-*.png`; retain them if available, but this document is
self-contained if tooling artifacts are absent from the next checkout.

| Finding | Evidence / consequence | Planned treatment |
| --- | --- | --- |
| Conflicting steps | Top strip calls summary Step 2; entry's violations card also says Step 2. | Keep three stages and remove section step badges. |
| Long entry page | Populated 768px-wide tablet document measured about 1,946px tall. | Remove empty helper gaps, improve grouping and expose a stable next action. Do not shrink touch targets to chase a height target. |
| Difficult validation recovery | Empty Review leaves focus on the action; errors appear above it. | Linked, focused error summary plus persistent field errors. |
| Narrow overflow | At 390px viewport, document scroll width was 598px; header and progress strip overflow. | Reflow header and compact progress indicator. |
| Manual mode contradiction | Switching from a selected registered vehicle retains its plate but says “Not in the registry.” | Describe the entry mode, not an unverified registry fact. |
| Signature contradiction | After Confirm, local acknowledgement appears while badge still says “confirm to apply.” | Separate provisional, confirmed and invalidated states. |
| Repeated photo guidance | Requirement appears in warning, heading and count. | One persistent count/instruction; errors only for an actual failed action/state. |
| Developer copy | R-01, I-06, API environment and summary revision IDs appear in visible text. | Plain task language with honest availability. |
| Admin is placeholder | Both roles see a review workspace with no operational list. | Improve clarity without inventing dashboard functionality. |

These are observations, not a full accessibility certification or proof of field
usability. Camera-success inspection used a labelled synthetic browser frame;
signature inspection used synthetic mouse strokes. A full-page screenshot also
showed resize invalidation, so do not use that image alone as proof of final
signature state. Recent-duplicate and all network failures were not exhaustively
triggered in that audit; prepare deterministic tests for them.

## 4. Inclusive interaction contract

### Language and visual guidance

- Prefer short, direct instructions: “Choose the vehicle,” “Select at least one
  violation,” “Check these details with the driver.” One instruction per sentence.
- Use familiar local workplace terms, confirmed with staff. Retain “challan” if
  that is the recognised word. Do not simplify away a legal or safety distinction.
- Pair meaningful icons with text. Never require an operator to infer a camera,
  warning, back or confirmation action from an unfamiliar icon alone.
- Keep required labels visible. Show format examples before an error, not just
  placeholders that disappear. Mark optional fields “(optional).”
- “Other” makes Remarks required according to the existing rules. Explain why
  beside Remarks; validate every applicable Other field, not only violations.
- Use one dominant next action per task area. Separate navigation, correction,
  capture and confirmation. Reserve solid green for actual challan commit, which
  this build does not provide.
- Never refer to an operator's education level in the product interface.

### Geometry and accessibility

- Tablet inputs and option rows: at least 56px high. Icon buttons: at least
  56×56px. Secondary actions: at least 56px. Primary tablet actions: 64px.
  Adjacent controls: at least 12px separation.
- Preserve the project's body-text contrast target of at least 7:1 (UI-02),
  alongside applicable WCAG AA requirements for other text and UI states. Do not
  lower existing contrast requirements to a generic 4.5:1 baseline.
- Keep identifiers monospaced and fonts self-hosted. Keep standard readable body
  type; do not reduce it to fit more content.
- Use headings, associated labels, fieldsets/legends, semantic descriptions and
  text status labels. Colour is supplementary.
- Each stage change moves focus to its heading. Validation moves focus to the
  error summary. Return from a corrective edit restores a meaningful location.
- For a long form, an error summary lists every actionable error and links to
  its field. Inline and summary wording match. Fixing one field must not erase
  unrelated unresolved errors.
- Sticky actions must not cover focused inputs, errors, thumbnails or keyboard
  content. Use safe-area padding and a normal-flow fallback where needed.
- Honour reduced motion; no decorative loading sequence. Loading announcements
  must be concise and must not read the entire context strip repeatedly.

### State and trust

- Retain entered values during in-flow corrections and recoverable failures.
  Do not add persistence across logout, expiry or sessions.
- Invalidate preview/duplicate acknowledgement/signature/refusal at the existing
  canonical boundaries. A shorter form must not weaken these safeguards.
- Treat “photo captured,” “signature confirmed,” “recorded on this device” and
  “challan issued” as different states. Only a future successful server commit
  can claim issuance or display a server challan number.
- Refusal is a truthful witnessed business event, not an accessibility shortcut
  for a consenting driver unable to draw. A separate non-drawing consent mechanism
  would require owner policy and test preparation.

## 5. Target screens and interaction details

### A. Marshal and dashboard sign-in

- Titles: “e-Challan marshal sign-in” and “e-Challan dashboard sign-in.”
- Retain Username unless staff confirm another accurate term. Do not call it
  “Staff ID” if the account model is not an individual staff identity.
- Add a labelled Show/Hide password button; preserve input value, focus,
  autocomplete and masking defaults. Password is masked on initial load.
- Use `autocomplete="username"` and `autocomplete="current-password"`; no role
  picker, bundled credentials or invented reset flow.
- Replace API-environment copy with “Use the account given by your supervisor.”
  Help text must name an actual support route once the owner supplies it.
- Make failed-login feedback generic for unknown user and wrong password, and
  keep the same denial semantics. Distinguish connectivity failure if supported
  by an actual error classification.
- Conditional post/shift selection stays visible, labelled and keyboard usable.
  Bind only a valid authorised context; never invent a default where ambiguous.
- Both pages have one `h1`, one main landmark, and visible submit progress.

### B. Tablet shell and progress

- One compact context area shows the authorised post and shift; user/role is
  secondary. Avoid repeating the same identity block in multiple prominent rows.
- Three stages: **1. Enter details → 2. Check details → 3. Photos and signature**.
  Refusal is a branch of stage 3. Finished stages have a text-accessible state.
- On narrow widths, show “Step 1 of 3: Enter details” instead of three
  non-wrapping pills. Stages are not fake clickable navigation.
- Header wraps or reorganises without pushing Log out off-screen.
- Preserve real inactivity policy. A proposed 60-second advance warning needs
  deterministic timer acceptance: “You will be signed out in 1 minute. Unsent
  details will be cleared.” “Keep working” is an actual permitted user activity,
  not an automatic refresh loop. No warning changes server expiry/absolute expiry.
- If an explicit logout-discard confirmation is included, show it only for
  meaningful unsent work. Inactivity expiry must never wait for that dialogue.

### C. Single entry form

Use two named sections, without numbered “Step” badges:

1. **Vehicle and driver**: registry search, visible manual-entry action, gate pass,
   driver, department, contractor and vehicle type.
2. **Violation details**: multi-selection, derived severity and conditional Remarks.

Default to a clear vertical sequence. Pair short related fields on wider tablet
layouts only when reading/tab order stays obvious; long names, search and errors
keep full width. Do not introduce collapsible required sections in the first pass.

- Put “Search registered vehicles” and a visible “Enter details manually” action
  near the plate field. Search results emphasise plate, driver, then gate pass.
- On selection, show “Details filled from registry. Check and change if needed.”
  All populated fields remain editable. Do not label editable data “verified.”
- Search opening lists scoped records. One/two typed characters filter locally;
  three or more use existing debounced lookup. Preserve cancellation/stale guards.
- Implement an accessible combobox/listbox pattern: announced expansion, active
  option, selected state, Up/Down, Enter and Escape, and touch selection. Manual
  entry remains a separate labelled action.
- Show loading, no results and failure differently. No results offers manual
  entry; failure offers Retry without wiping data. If a bounded list is incomplete,
  instruct the user to type to search, never imply all location vehicles are shown.
- Manual banner: “Manual entry. These details apply only to this challan.” If
  switching from a selected record preserves values, say “Existing details kept.
  Check them before continuing.” Never claim absence from registry without proof.
- Give blank selects a visible “Choose department” style prompt. Contractor's
  optional label must follow the approved schema, not an assumption from this plan.
- Violation choices are full labelled touch rows with a clear checked state.
  Keep official master wording; use approved helper wording where needed. Put
  Other last in display order without mutating IDs or business semantics.
- Remarks helper says why it is required when Other applies. Otherwise label it
  optional if the approved schema permits. Add a character counter using the
  actual shared limit, never a separately invented limit.
- A tablet action area exposes **Check details**. It validates on activation;
  do not leave it silently disabled because fields are missing. On failure,
  focus the linked summary and retain all values. During a request, prevent
  duplicate concurrent reviews and communicate progress.

### D. Driver check screen and repeat/duplicate notices

- Title: “Check details with the driver.” Include plate, driver, gate pass,
  department, contractor when present, vehicle type, all violations, remarks,
  severity, location and shift.
- Use a definition-list or other valid label/value structure. Fix existing
  block-element-inside-paragraph nesting around severity.
- “Change details” returns to the same form with values retained and focuses the
  relevant field/section. Re-run validation/preview before advancing again. A
  focused Change link needs an accessible name such as “Change driver name.”
- Action: **Continue to photos**, with secondary **Change details**.
- Repeat notice remains persistent: explain the occurrence and 90-day context
  using the API's approved meaning. Recommended action remains a recommendation,
  not an action already performed. Do not locally recalculate domain counts.
- Duplicate notice explains that a challan for the same vehicle/location was
  recently recorded. Show supplied record/time context, an explicit labelled
  acknowledgement and a clear return path. Do not precheck it or bypass the
  existing generation-bound gate. A changed preview requires fresh acknowledgement.

### E. Photos

- One persistent instruction: “Take 1–4 photos. At least one is required.”
- Brief task help, validated with staff: “Make sure the vehicle and violation
  can be seen clearly.” Avoid promising a photo proves facts it cannot show.
- Distinguish camera off, requesting permission, preparing preview, ready,
  capturing/encoding, captured, stopped, unavailable and failed states.
- Before frames are ready, do not enable Take photo. Permission acquisition can
  be cancelled, and cancellation must release an already acquired stream too.
- After a capture, prioritise the thumbnail and “1 of 4 photos” state. Reduce the
  inactive placeholder; keep Add photo, Retake and any existing approved Remove
  action clear. Preview enlargement uses local evidence only and is dismissible
  by keyboard. Compression metadata is secondary, not a primary instruction.
- Distinguish permission denial, missing/busy camera, insecure connection and
  processing failure. Provide an appropriate next action instead of repeating
  Start camera indefinitely. Do not add a file/gallery fallback.
- Keep a visible route to the signature area while explaining the photo
  prerequisite. Refusal must still be recordable only under approved requirements;
  a missing-photo state offers **Back to photos**.

### F. Signature and local-only completion

- Show compact plate/driver context and a clear signing instruction.
- Canvas has an accessible name and associated instructions. Contain touch-scroll
  suppression to the canvas, not the whole page.
- States: empty → drawn, not confirmed → confirmed; any new stroke begins a new
  provisional state and invalidates parent confirmation immediately. Clear,
  material summary changes and E-03 resize rules also invalidate acknowledgement.
- New drawing invalidates pending image hydration so stale decode cannot replace
  it. Preserve existing stable canvas lifetime and actual rendered-stroke checks.
- Use **Clear signature** and **Confirm signature**, physically separated. A
  confirmed signature shows **Signature confirmed** and a clearly labelled
  **Sign again** control. No stale “confirm to apply” badge remains.
- If resize invalidates it, say “The screen size changed. Ask the driver to sign
  again.” Do not silently preserve confirmation against the approved policy.
- Existing build endpoint: “Signature captured on this device. No challan has
  been submitted.” Keep this status near the confirmation action. It is not a
  receipt and must not fabricate a Generate/Submit action.
- Later I-06 integration replaces this endpoint only through its own reviewed
  task, with actual server confirmation and receipt acceptance.

### G. Refusal

- Title: “Record refusal to sign.” Explain that a supervisor must witness it.
- Keep the three required fields: reason, witnessing supervisor name, staff ID.
  Use no prefilled witness or made-up identity directory.
- Example errors: “Enter why the driver refused to sign,” “Enter the witnessing
  supervisor's name,” “Enter the witnessing supervisor's staff ID.”
- Show actual reason limit as helper/counter, with linked errors and focus.
- Back navigation retains unconfirmed in-flow inputs where consistent with
  summary binding; entering text does not itself confirm a refusal.
- On Confirm, show plain witness confirmation without revision/hash diagnostics;
  explicitly explain local-only state. Editing confirmed values invalidates it.
- If the driver now agrees, switching back to signature must not keep a conflicting
  confirmed refusal. Preserve the existing mutually exclusive acknowledgement rule.

### H. Admin/supervisor workspace

- Keep the existing shell and honest availability message; use “Demo review
  workspace” and “Reviewing challans is not available in this demo yet.”
- State the signed-in role and authorised scope only from actual session data.
  Avoid implying demo role accounts provide individual staff attribution.
- No task IDs, technical API copy, fake metrics, non-functional filters or dead
  buttons. Operational queue, filtering, exports and review actions remain R-series.

## 6. Execution units and dependency gates

The UX IDs below are local planning IDs, not replacements for the canonical
F/I/R tasks. After preparation, link them from a new bounded Spec Kit feature
(suggested `specs/007-inclusive-ux/`, subject to normal feature creation) and the
cross-feature index through a controlled planner revision. Do not edit a frozen
spec or manifest merely to add a link.

| Unit | Scope and likely files | Depends on | Exit evidence |
| --- | --- | --- | --- |
| UX-00 | Readiness, requirement reconciliation, language/device questions, acceptance preparation; no UI implementation | None for planning | Reviewed source baseline or explicit documented owner override; active manifests verified; each next task has owned tests and handoff |
| UX-01 | Shared ErrorSummary, action area, progress and shell reflow; `packages/theme/src/`, both `App.tsx`, EntryFlow presentation | UX-00 and appropriate reviewed foundation | UXA-01–05; browser widths/zoom; both consumers; no bundle regression |
| UX-02 | Both logins, context selection, plain copy, Show password | UX-01 | UXA-06–08; AUTH role/restoration regressions |
| UX-03 | Entry grouping, picker keyboard/touch, manual mode, conditional hints and validation | UX-01; reviewed I-01 base | UXA-09–15; ENT/UI and stale lookup regressions |
| UX-04 | Complete summary, correction focus and repeat/duplicate wording | UX-03; reviewed I-05 base | UXA-16–19; actual preview binding/race coverage |
| UX-05 | Camera/thumbnail presentation and recovery | UX-04; existing C1 independently closed and I-02 readiness established | UXA-20–22; CAM teardown/encoder regressions |
| UX-06 | Provisional/confirmed signature, refusal, honest endpoint | UX-05; existing C2 independently closed and I-03 readiness established | UXA-23–27; decoded PNG and acknowledgement binding regressions |
| UX-07 | Honest admin workspace copy/semantics | UX-02 | UXA-28; both role views and wrong-role denial |
| UX-08 | Cross-screen accessibility, representative-user/device validation and release recommendation | UX-01–07 implementation plus independent review | UXA-29–32, full affected regression evidence and usability report |

Run the one-task implementation/review loop from `docs/development-workflow.md`.
Do not run this entire table unattended without an explicit new bounded-batch
authorisation. Preparation can cover the roadmap, but each implementation task
stops for independent review. If a required parent remains unreviewed, report the
precise gate and prepare rather than silently proceeding.

### Implementation boundaries

- Reuse existing React 18.3.1, MUI 9.4.0, Vite and signature_pad dependencies;
  these are observed package versions, not an upgrade request. Do not follow stale
  React 19 comments over the actual lockfile.
- Presentation extraction is encouraged when needed: local entry sections,
  summary rows and acknowledgement status. Keep draft, lookup and revision
  ownership explicit; avoid a broad state-library or routing rewrite.
- Apps import shared packages, never another app's internals. Shared theme
  components must not import tablet domain/auth state or admin-only widgets.
- Preserve lazy camera/signature imports and initial JS <250,000 bytes gzip.
  Avoid new heavy form, animation, translation or icon libraries by default.
- Keep API/contracts unchanged for presentation work. If a task actually needs
  a response-contract revision, return it to planner preparation and verify all
  consumers plus real DB/API tests; do not invent a client-only substitute.
- No migrations or stored-data changes are expected for the base revamp.

## 7. Acceptance catalogue to prepare before implementation

**All cases below are NOT RUN.** These are behaviour specifications to translate
into planner-owned executable tests. Existing acceptance cannot be removed or
weakened. One case can require several parameterised assertions; no passing counts
are promised by this plan.

| ID | Level | Observable acceptance | Existing trace |
| --- | --- | --- | --- |
| UXA-01 | UI/E2E | Progress labels match actual three stages, no competing section step numbers; current stage is exposed programmatically; stage heading receives focus. | UI-03, ENT-05 |
| UXA-02 | E2E | At 390×844, 768×1024, 1024×768 and 1280×900, header, progress and form have no horizontal document overflow; controls remain reachable. | UI-03, FIELD-02 |
| UXA-03 | UI/E2E/Device | Target dimensions/gaps meet project tablet minimums; sticky action area does not cover fields/errors at zoom or on-screen-keyboard states. | UI-01, FIELD-01/02 |
| UXA-04 | UI/E2E | Invalid Check details focuses a summary listing all errors; links focus matching controls; matching inline descriptions/invalid states exist; values retained; fixing one field leaves other unresolved errors visible. | ENT-01/03/04, UI-01 |
| UXA-05 | UI/E2E | Inactivity warning resets only through allowed user activity; unchanged 600-second expiry clears draft/media; server refusal still wins; logout confirmation, if present, cannot postpone expiry. | AUTH-03/04, FIELD-04 |
| UXA-06 | UI/E2E | Password toggles without value loss; accessible Show/Hide names and masking defaults; submit keyboard flow and autocomplete work on both login pages. | AUTH-01, UI-01 |
| UXA-07 | UI/E2E | Wrong credentials give generic actionable refusal; no protected content leaks; pending feedback resolves on success/failure; stale restoration cannot overwrite newer login. | AUTH-01/02/03 |
| UXA-08 | UI/E2E | Required post/shift context is understandable and selectable; ambiguous/no-context paths fail correctly; no client role selection or guessed attribution. | AUTH-05 |
| UXA-09 | UI/E2E | Picker offers scoped list, local 1–2 char filter, debounced 3+ search; keyboard active/selected options and Escape/Enter match touch behaviour. | ENT-02/06 |
| UXA-10 | UI/E2E/API | Selecting a zero-history or multi-driver record fills the chosen record only, all fields editable; location stays session-bound; no registry writes. | ENT-06, AUTH-05 |
| UXA-11 | UI/E2E | List/search error has Retry; no results offers manual entry; retries preserve query kind; stale/late result cannot replace newer input or selection. | ENT-02/06 |
| UXA-12 | UI/E2E | Switching selected→manual retains/discloses carried values without falsely asserting absence; manual→registry works; gate pass stays required and nothing is persisted to registry. | B-08 vehicle decision, ENT-06 |
| UXA-13 | UI/API | Other in every applicable controlled field explains and enforces Remarks; non-Other optionality follows schema; blank/stale/forged masters still rejected. | ENT-03/04 |
| UXA-14 | UI/E2E | Violation touch rows toggle only their own options; multi-select/severity/Other-last display does not change stored IDs or official labels. | ENT-04, UI-01/02 |
| UXA-15 | UI/E2E | Repeated Check while pending cannot race to a stale summary; edit/back/logout invalidate old response and preserve correct current state. | ENT-05, REP-04 |
| UXA-16 | UI/E2E | Check screen contains all submitted summary-affecting fields; Change focuses correct field with values retained; revalidation required before advancing. | ENT-05, SIG-01/05 |
| UXA-17 | UI/E2E | Persistent repeat text reflects API occurrence/recommendation and approved 90-day meaning, without implying action already performed. | REP-01/02/05 |
| UXA-18 | UI/E2E/API | Real seeded recent duplicate requires explicit acknowledgement; absent/different-location duplicate does not; changed generation invalidates old acknowledgement. | REP-03/04 |
| UXA-19 | UI/E2E | Valid semantic summary has no div-inside-p nesting; warnings/statuses have correct roles and readable labels. | UI-01/02 |
| UXA-20 | UI/E2E | Single photo instruction/count; frame readiness gates capture; 1 and 4 photos work, fifth blocked; retake/remove/preview agree with parent state and existing limits. | CAM-01/02/03 |
| UXA-21 | UI/E2E | Permission denied, ignored request/cancel, busy/missing camera, insecure context and encode failure expose distinct recovery; no false photo; no gallery fallback. | CAM-04 |
| UXA-22 | UI/E2E | Cancel during acquired-but-pending-play immediately stops tracks; late play/encode cannot disturb newer capture; leave/logout release stream and URLs. | C1, CAM-05 |
| UXA-23 | UI/E2E | Draw→Confirm shows confirmed badge; draw again immediately invalidates parent before reconfirmation; delayed image decode cannot overwrite new strokes; decoded PNG contains expected multi-stroke content. | C2, SIG-01/02 |
| UXA-24 | UI/E2E/Device | Clear is separated and labelled; E-03 resize/DPR/material-summary changes require re-sign; no blank PNG or old signature is reported confirmed. | SIG-02/03/05 |
| UXA-25 | UI/E2E | Refusal requires reason/name/ID with linked plain errors; missing photo offers return to photos; no fake witness; edit/new summary invalidates confirmation. | SIG-04/05, CAM-02 |
| UXA-26 | UI/E2E | Signature/refusal are mutually exclusive across navigation; returning without reconfirming cannot restore superseded evidence. | SIG-04/05 |
| UXA-27 | UI/E2E | Local-only endpoint explicitly says no submission; no server number, green commit or receipt is shown; user-facing copy excludes task IDs/hashes/revisions. | SUB-05 boundary, UI-02 |
| UXA-28 | UI/E2E | Both admin roles see honest unavailable workspace; real identity/scope only; no fake totals/dead actions; anonymous/wrong role stays denied. | AUTH-01/02, UI-03 |
| UXA-29 | UI/E2E/Manual | Visible/associated labels, keyboard order, focus, live status, contrast, reduced motion and 200% zoom pass across all screens; drawing has named instructions and truthful refusal route. | UI-01/02/03, FIELD-02 |
| UXA-30 | Build/Device | Initial JS <250,000 B gzip; lazy media remains lazy; representative target-tablet performance/legibility recorded. | SET-03/04, FIELD-03 |
| UXA-31 | Usability/Device | Representative operators perform scenarios below; completion, errors, help and comprehension reported without generalising beyond the sample. | FIELD-01/04 |
| UXA-32 | Conditional Usability/UI | If local language is required, approved translations fit all states, labels and errors; language selection preserves in-session values and does not alter canonical IDs or semantics. Otherwise record deferred decision, not PASS. | Owner language decision |

### Suggested new test locations

Planner chooses final paths after inspecting active test ownership:

- `apps/tablet/src/__tests__/inclusive-ux-entry.test.tsx`
- `apps/tablet/src/__tests__/inclusive-ux-media.test.tsx`
- `apps/tablet/src/__tests__/inclusive-ux-session.test.tsx`
- `apps/admin/src/__tests__/inclusive-ux.test.tsx`
- `apps/tablet/e2e/inclusive-ux.spec.ts`
- `apps/admin/e2e/inclusive-ux.spec.ts`
- Shared primitive tests in the existing theme test convention after inspection.

Use role/name queries and observable outcomes rather than snapshot-only proof or
exact incidental whitespace. Preserve canonical field associations. Test copy
needed for comprehension, not implementation internals. Existing frozen tests
with old exact labels require a documented planner revision and reviewer
confirmation; the implementer must not rewrite them just to obtain GREEN.

Use held promises/responses and deterministic clocks for races/timers, not sleeps
or increased timeouts. Keep real API/PostgreSQL coverage for scoping, validation
and repeat rules. Deliberately fake only browser hardware/failure seams and label
the evidence accordingly.

## 8. Verification commands and evidence

These commands are present in the inspected workspace. **They were not executed
as part of writing this plan.** The next session records actual counts/results.

### Baseline verification before edits

```bash
sha256sum -c docs/handoffs/entry-media-tests.sha256
sha256sum -c docs/handoffs/pre-issuance-tests.sha256
sha256sum -c docs/handoffs/owner-ui-revision-tests.sha256
```

Read the ownership and revision records first. If active manifests conflict or
fail, identify the exact paths and obtain a planner correction/reviewer
confirmation. Do not regenerate hashes to conceal a mismatch.

### Existing focused regression entry points

```bash
pnpm run build:packages
pnpm --filter @echallan/tablet run test
pnpm --filter @echallan/admin run test
pnpm exec playwright test --project=tablet
pnpm exec playwright test --project=admin
```

### Proposed focused commands after the named new files exist

```bash
pnpm --filter @echallan/tablet exec vitest run src/__tests__/inclusive-ux-entry.test.tsx src/__tests__/inclusive-ux-media.test.tsx src/__tests__/inclusive-ux-session.test.tsx
pnpm --filter @echallan/admin exec vitest run src/__tests__/inclusive-ux.test.tsx
pnpm exec playwright test apps/tablet/e2e/inclusive-ux.spec.ts --project=tablet
pnpm exec playwright test apps/admin/e2e/inclusive-ux.spec.ts --project=admin
```

### Affected-work gate sequence after GREEN

```bash
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm db:up
pnpm run test:integration
pnpm run test:e2e
pnpm run build
pnpm run check:tablet-size
pnpm run test:foundation
```

Run sequentially where they share state/resources. The existing foundation suite
has a disclosed contention timeout history; preserve failures and reasons in the
record. Do not silently increase timeouts or describe a rerun as the only result.
The browser harness reuses local servers; verify credentials, code revision and
database alignment, or start a separate controlled stack without killing an
unrelated user's process. Missing services are BLOCKED, not passing checks.

Per task, the planner supplies `<ux-task>-prepared.md` and a SHA-256 acceptance
manifest; implementer evidence goes to `docs/handoffs/<ux-task>.md`; independent
review goes to `docs/reviews/<ux-task>.md`. Record source baseline, changed files,
RED assertion, GREEN counts, regression/build evidence, screenshots, device
checks, issues and review request. Prove key safeguards in a disposable copy by
breaking the relevant behaviour and observing acceptance fail, then restore and
rerun. Do not mutate user work for fault sensitivity.

No implementation/review checkboxes are changed by this plan. New edits invalidate
affected earlier approvals and need a fresh independent review of that scope.

## 9. Representative-user and real-device validation

### Participants and setup

Proposed first formative round: 5–8 representative operators, including people
with limited reading/digital confidence, experienced marshals and at least one
supervisor. This is a practical discovery sample, not statistical certification.
Recruit by work experience and comfort, not by labelling people “uneducated.”

Use synthetic records on the actual target tablet, with trusted HTTPS, normal
orientation, realistic lighting and gloves/stylus where applicable. Record the
device/browser/network. Ask the owner for preferred reading language before the
round. If participants cannot read the interface language, address that barrier
before claiming success from a different sample.

Read scenario instructions aloud if preferred; do not read interface answers or
coach during the measured task. Let participants explain what they think happened.
Use consenting role-play for signatures/refusal, not disciplinary data or events.

### Scenarios

1. Sign in and choose the correct authorised post/shift when prompted.
2. Find a registered vehicle, check autofill, correct one field, choose a violation.
3. Enter a vehicle manually and explain whether it was added to the registry.
4. Choose Other, understand why Remarks is needed, and recover from missing input.
5. Check a repeat/recent-duplicate notice and explain what must happen next.
6. Capture and retake a photo, recover from a denied permission where practical.
7. Check details with the driver, draw, confirm, correct and re-sign when required.
8. Record a witnessed refusal, fix a missing witness field, and return to photos.
9. Explain whether a challan has been issued at the current local-only endpoint.
10. Recover from inactivity expiry without expecting the next operator to see data.

### Measures and proposed acceptance targets

Record per scenario: unassisted completion, completion with help, abandonment,
time, incorrect record/selection, mis-taps, backtracks, validation recovery and
participant's own explanation. Separate active work time from setup and permission
delays. Compare entry/check times with a measured current-build baseline; do not
claim an improvement from screenshot height alone.

- Suggested formative target: at least 80% unassisted completion on core scenarios;
  publish numerator/denominator, not just percentages. Owner confirms release target.
- Every participant correctly distinguishes local capture from actual issuance.
- No wrong-driver confirmation, false submission belief or cross-session data leak
  is accepted; any instance triggers a correction and another focused round.
- No blocking usability failure remains unresolved. Record smaller issues and
  their follow-up owner rather than calling the whole UI “passed.”
- The PRD under-3-minute issuance median applies to the future full server-backed
  journey. Do not claim it from today's incomplete capture-only flow.

## 10. Open decisions and deferrals

| Item | Needed from | Safe work while unanswered |
| --- | --- | --- |
| Actual reading languages, literacy comfort and terminology | Owner + representative staff | Plain-English copy and structural improvements; no claim of non-English readiness |
| Target tablet, orientation, browser, gloves/stylus policy | B-03 owner | Responsive browser acceptance; real-device sign-off remains pending |
| Actual help contact/support route | Owner/operations | Generic supervisor-help wording, no invented phone/link |
| Entry stages changed to a wizard? | Explicit owner decision amending B-02 | Keep the approved single entry form |
| Alternate consent for driver unable to draw but not refusing | Owner/business policy | Do not misuse refusal or accept typed name as signature |
| Translated content and ownership | Owner + fluent reviewer | No machine-translated legal/safety terms shipped unchecked |
| Operational dashboard and final receipt | Existing R-series / I-06 tasks | Improve honest current placeholders only |

## 11. Completion and handover checklist

- [ ] UX-00 reconciles active reviewed baseline and unresolved findings.
- [ ] Each unit has planner-owned acceptance, hashes and genuine RED evidence.
- [ ] Implementer stays within one authorised unit/batch and records GREEN.
- [ ] Independent reviewer checks changed source, tests and preserved rules.
- [ ] Every current screen has desktop/tablet/narrow and key-state evidence.
- [ ] Representative-user findings and actual-device checks are documented.
- [ ] No false local/server success, unresolved blocking issue or leaked session data.
- [ ] Bundle/architecture/contrast/touch targets remain within project gates.
- [ ] Conditional language/device work is marked complete or explicitly pending.
- [ ] Existing canonical implementation/review boxes advance only under their
      respective verification and independent review rules.

## 12. Reference basis

Research used in the preceding UI audit:

- W3C Forms Tutorial: https://www.w3.org/WAI/tutorials/forms/
- W3C Multi-page Forms: https://www.w3.org/WAI/tutorials/forms/multi-page/
- GOV.UK Question Pages: https://design-system.service.gov.uk/patterns/question-pages/
- GOV.UK Error Summary: https://design-system.service.gov.uk/components/error-summary/
- GOV.UK Error Message: https://design-system.service.gov.uk/components/error-message/
- W3C Target Size Minimum: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

These support logical grouping, persistent labels, concise instructions, explicit
progress and recoverable validation. They do not override this project's approved
single-form flow or establish that a particular layout suits local users without
testing.
