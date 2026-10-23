# Gate e-Challan implementation checklist

Target: a staff-operated, online P0 pilot at one or two gates, followed by the
PRD's 12-week measurement period. P1/P2 work is outside this checklist.

Sources: `eChallan_PRD.md`, `eChallan_DESIGN.md`; see `decisions.md` for missing
specification/rules. Architecture/tool choices below follow the PRD; exact library
versions are unverified until S-01. Test cases are in `test-cases.md`.

## Checklist semantics

Each task has two boxes: implementation (implementer-owned), then independent
review (reviewer-owned). Both are required before a dependent task starts.
All unchecked boxes are intentional: setup of this workflow is not application
implementation. Acceptance tests must be prepared before each behavioural task.
No feature spec/test execution is implied by this planning document.
Early media/repeat tasks verify their own components/services independently.
I-06 owns the integrated commit checks (SUB-06), so earlier task review does not
claim the final submission journey is already passing.

## Phase 0 — Decisions and test/build foundation

### S-01 — Workspace and verification harness
- [x] Implemented
- [x] Reviewed

Independent correction re-review: PASS on 2026-10-02; findings R1–R4 closed.
Evidence and accepted snapshot: `docs/reviews/S-01.md` and
`docs/reviews/S-01-accepted.sha256`. F-01 retains its domain-decision prerequisites.

Dependencies: none; synthetic data only, no business-rule implementation.
Create pnpm workspace for the three apps/two packages; pin compatible Node,
React/Vite/MUI/Fastify/Drizzle/Zod versions after checking current documentation
and peer dependencies. Establish local PostgreSQL, env examples, isolated test DB,
Vitest, component tests, API integration harness, Playwright and CI. Add format,
lint, typecheck, test and production-build scripts, import-boundary rules and
tablet bundle measurement. No Turborepo. Record exact setup and focused commands.
Acceptance: SET-01–SET-04. Exit: clean setup reproducible and harness independently reviewed.

## Phase 1 — Domain, authentication and shared UI foundation

**Entry-media correction checkpoint (2026-10-16): CHANGES_REQUIRED.**
Latest independent re-review (2026-10-17):
`docs/reviews/entry-media-v1-v6-rereview.md`. F-04, I-01, I-02, I-03 and I-05 retain
both boxes unchecked at the combined checkpoint. Standard gates pass: unit (224),
integration (102), browser (36), foundation (27 on isolated rerun), active
manifests, format, lint (one warning), typecheck, builds and 148915 B gzip JS.
Decoded-image and fault-sensitivity evidence is now supplied. C1 acquired-camera
cancellation and C2 drawing/confirmation invalidation remain unresolved. Physical
device acceptance is separately pending and is not the cause of this rejection.

**C1/C2 correction candidate (2026-10-18, awaiting independent re-review).** The
owner-directed session prepared and implemented the bounded C1/C2 correction per
the re-review disposition: readiness record `docs/handoffs/ux-00-readiness.md`,
preparation `docs/handoffs/entry-media-c1-c2-prepared.md` (baseline rev 2,
rev 1 archived), implementation evidence `docs/handoffs/entry-media-c1-c2.md`,
review request `docs/review-requests/entry-media-c1-c2.md`. Gates on the
candidate: unit (231: 42/101/14/74), integration (103), browser (40), foundation
(27), format/lint/typecheck/build and 149348 B gzip tablet JS; fault sensitivity
recorded in `docs/handoffs/entry-media-c1-c2-fault-sensitivity.{sh,txt}`. This is
**not** acceptance: boxes stay unchecked until the independent re-review passes.

**Inclusive UX revamp batch (2026-10-18, awaiting combined independent review).**
Owner-authorised batch executing UX-01–UX-08 of
`docs/handoffs/inclusive-ux-revamp-plan.md` (owner clarification 2026-10-18 in
`docs/decisions.md`; brief `docs/handoffs/inclusive-ux-batch.md`; feature
`specs/007-inclusive-ux/`). Preparation and baseline revision:
`docs/handoffs/inclusive-ux-prepared.md`; evidence
`docs/handoffs/inclusive-ux.md`; frozen acceptance
`docs/handoffs/inclusive-ux-tests.sha256`; review request
`docs/review-requests/inclusive-ux.md` (it supersedes the interim entry-media
C1/C2 request and folds in the pending owner-ui-revision review). Gates at
batch exit: unit (231), integration (103), browser (52), foundation (27),
format/lint/typecheck/build, 153002 B gzip tablet JS; disposable-copy fault
sensitivity for the focus, picker-keyboard and carried-details guards. UX-08
real-device and representative-user validation is NOT executed and remains
pending (B-03/V-03). No box is ticked: F-04/I-01/I-02/I-03/I-05 stay unchecked
until the independent review passes, after which UX-01–UX-07 enter their
per-unit acceptance evidence (`docs/handoffs/ux-00-readiness.md` holds the
precise gates).

**Inclusive UX correction phase (2026-10-19, awaiting independent re-review).**
The combined review `docs/reviews/inclusive-ux.md` returned CHANGES_REQUIRED
(R1–R7 plus acceptance gaps). The corrections are implemented with the prepared
acceptance packet extended and the manifest revised to revision 2 (rev 1
archived): preparation
`docs/handoffs/inclusive-ux-corrections-prepared.md`, evidence
`docs/handoffs/inclusive-ux-corrections.md`, request
`docs/review-requests/inclusive-ux-corrections.md`. Gates on the corrected
state: unit (231), integration (103), browser (56), foundation (27), and
153070 B gzip tablet JS. Returned task boxes (UX-01/02/03/04/06/08) remain
unchecked; no re-tick is claimed by the implementer.

**Marshal character guidance (2026-10-19, awaiting independent review).**
Bounded feature prepared and implemented on top of the reviewed inclusive-UX
baseline: feature `specs/008-marshal-character/`, preparation
`docs/handoffs/marshal-character-prepared.md`, frozen acceptance
`docs/handoffs/marshal-character-tests.sha256`, evidence
`docs/handoffs/marshal-character.md`, request
`docs/review-requests/marshal-character.md`. Six transparent WebP derivatives
plus one `MarshalCharacter`/`MarshalCallout` primitive; welcome, processing,
validation, connection and local-acknowledgement states only. Gates on the
candidate: unit (236: 42/101/14/79), integration (103), browser (65), foundation
(27), format/lint/typecheck/build and 153081 B gzip initial tablet JS; image
transfer 178140 B total, 35418 B initial. Disposable-copy fault sensitivity for
the validation-vs-connection illustration. No submission/receipt behaviour was
added; the 008 task boxes and review box remain unchecked pending review.

**CHAR-01 correction (2026-10-19, awaiting focused re-review).** Independent
review `docs/reviews/marshal-character.md` returned CHAR-01: catalogue HTTP
500/503 responses were shown as a lost connection. The correction separates
transport rejection from HTTP service errors (concerned illustration, honest
server-error copy and Retry), keeps 401/403 refusal and malformed bodies
distinct, and adds component/browser controls under frozen-manifest revision 2
(revision 1 archived). Evidence
`docs/handoffs/marshal-character-char01.md`, request
`docs/review-requests/marshal-character-char01.md`. Gates: unit (244:
42/101/14/87), integration (103), browser (72), foundation (27),
format/lint/typecheck/build, 153084 B gzip initial JS, classification fault
sensitivity. MC-03/MC-05 re-ticked; focused re-review PASS
(`docs/reviews/marshal-character-char01.md`) closed CHAR-01 and restored the 008
review and 007 combined-review boxes. Combined snapshot:
`docs/reviews/marshal-character-accepted.sha256`.

**Field acceptance pack (2026-10-19, prepared, not executed).** Real-device and
representative-user pack at `docs/handoffs/field-acceptance/`: executable
preflight, device checklist, 10 scenarios for 5–8 representative staff,
observation and results templates, pass/fail rules and the missing owner inputs
(B-03 device details, reading language, trusted-HTTPS deployment,
recruitment/consent). Local preflight executed 2026-10-19 (17 PASS, 1 localhost
WARN); no device or user acceptance is claimed. UX-08 and V-03 remain pending.

### F-01 — Approved contracts and schema
- [x] Implemented
- [x] Reviewed

Implementation evidence: `docs/handoffs/F-01.md` (original plus three dated
correction sections). Independent review requested in
`docs/review-requests/F-01-corrections.md`, which supersedes
`docs/review-requests/F-01.md`.

Findings R1-R3 from `docs/reviews/F-01.md`, then
`docs/reviews/F-01-correction-followup.md` and
`docs/reviews/F-01-latest-correction-review.md`, are corrected: normalised SQL
uniqueness, required approved master severity, persisted post/gate attribution,
refusal of an ambiguous legacy upgrade instead of a guessed gate, removal of the
unapproved one-post-per-gate restriction, and a successful legacy shared-gate
upgrade via a planner-approved compatibility amendment of migrations `0003`/`0005`.
Integrative acceptance is 42 real-PostgreSQL cases.

Implemented against owner-approved replacement specification v0.1
(`docs/eChallan_replacement_spec.md`) and the demo resolutions in
`docs/decisions.md`; the unavailable Functional Specification v0.2 was not
reconstructed. Cases DOM-01-DOM-03.

Preparation and implementation ran in one session at the user's explicit
instruction: a disclosed process deviation that does not substitute for independent
review. Final independent review PASS on 2026-10-03:
`docs/reviews/F-01-final.md`; accepted snapshot `docs/reviews/F-01-accepted.sha256`.
The documented migration compatibility amendment is accepted for the synthetic
demo. F-02 may now be prepared using the env-login decision addendum; production
authentication and deployment retain their separate gates.

### F-02 — Login, roles, shift attribution and idle expiry
- [x] Implemented
- [x] Reviewed

**Current acceptance: independent PASS on 2026-10-07** in
`docs/reviews/F-03-m1-f02-b1-implementation.md`; accepted snapshot
`docs/reviews/F-02-F-03-accepted.sha256`. C1 is verified and B1's browser fixture
race is corrected. Prior unchecked/CHANGES_REQUIRED notes below are historical
checkpoints, superseded by this accepted demo baseline.

Combined B1/M1 preparation confirmation **PASS** on 2026-10-07:
`docs/reviews/F-02-b1-f03-m1-preparation.md`. F-02 revision-5 browser setup is
approved with both restored cases passing 10 repeats; no runtime fix is needed.
Parent acceptance remains pending independent confirmation after re-verification.

Dependencies: F-01 (reviewed PASS). B-04 resolved; **demo** authentication approved
as addendum A v0.2 (`docs/eChallan_replacement_spec_v0.2.md`) with B-07 recorded and
production credential management deferred as **B-08**. Prepared at
`docs/handoffs/F-02-prepared.md` (revision 3), feature `specs/003-demo-auth`, baseline
`docs/handoffs/F-02-tests.sha256` (revision 3, 24 entries; revision 2 archived at
`docs/handoffs/F-02-tests-rev2.sha256`). The first preparation review returned
CHANGES_REQUIRED (`docs/reviews/F-02-preparation.md`, P1-P6, corrected) and the
revision-2 preparation re-review returned CHANGES_REQUIRED
(`docs/reviews/F-02-preparation-revision-2.md`, Q1-Q4, corrected in revision 3).
Implementation evidence: `docs/handoffs/F-02.md` (2026-10-04), with a planner
correction addendum for the review's R5 documentation findings. Its gates passed
(103 unit, 62 real-DB integration, 13 browser at the time, builds, 144280 B gzip,
27 foundation checks) and the S-01/F-01 baselines verified, but the independent
implementation review returned **CHANGES_REQUIRED** (`docs/reviews/F-02.md`, 2026-10-04)
for R1 wrong-role client access, R2 stale session restoration, R3 missing required
shift attribution and context selection, R4 malformed-ID handling, and the unresolved
Q1-Q4 preparation defects. Revision 3 prepared the corrected and regression acceptance
plus the exact implementer instructions (measured RED then: 4 API integration,
5 tablet component, 4 admin component and 4 browser failures). The preparation
checkpoint passed in `docs/reviews/F-02-preparation-revision-3-followup.md`, and the
correction batch is implemented (evidence in `docs/handoffs/F-02.md`): factory
fail-closed seam, client role boundary, session transition ordering, zero-shift
refusal, ambiguous-context candidates with the tablet selection flow, and
malformed-ID handling. Gates after correction: 114 unit, 66 real-DB integration,
17 browser, builds, 144771 B gzip, 27 foundation; nine guards fault-verified in a
disposable copy; frozen revision-3 baseline still 24/24. Independent correction
re-review on 2026-10-05 returned **CHANGES_REQUIRED** in
`docs/reviews/F-02-correction-implementation.md`: one remaining C1 defect,
unhandled JSON decoding/read failure during session restoration in both clients.
Implemented is returned to unchecked; Reviewed remains unchecked. Add bounded
planner regression acceptance, correct production handling and obtain independent
re-review. F-03 remains blocked on F-02 review PASS.

Revision-4 preparation (2026-10-05) adds that bounded C1 acceptance for both
clients: a stored token plus a successful restoration response whose `json()`
rejects must be treated as no session with no unhandled rejection and the token
removed, with valid-restoration and decoded-invalid-schema controls, and a stale
decoding failure must not erase a newer login. Baseline
`docs/handoffs/F-02-tests.sha256` is revision 4 (rev 3 archived byte-for-byte at
`docs/handoffs/F-02-tests-rev3.sha256`). Measured RED: tablet 2 failed / 19 passed
(21), admin 2 failed / 15 passed (17), both on the unhandled-rejection assertion.
Instructions and expected GREEN counts are in `docs/handoffs/F-02-prepared.md`
revision 4. Independent preparation confirmation **PASS** on 2026-10-05:
`docs/reviews/F-02-preparation-revision-4.md`, which pins the approved manifest.
The bounded C1 production fix is implemented (evidence: "C1 regression correction" in
`docs/handoffs/F-02.md`) and independently verified as closed. The review then
returned **B1**: the two restored-role browser tests seeded storage under a running
anonymous page, whose pending refusal cleared the seeded token. Revision 5 corrects
the acceptance (real API token seeded with `page.addInitScript` before the first
navigation, all assertions preserved, no sleeps/retries) and corrects the unsupported
"Chromium propagation" explanation; baseline `docs/handoffs/F-02-tests.sha256` rev 5,
rev 4 archived at `docs/handoffs/F-02-tests-rev4.sha256`. Verified 10/10 per client
and 17/17 full suite. F-02 **Implemented and Reviewed remain unchecked** pending
preparation confirmation.

Independent C1 re-review (2026-10-05): production C1 fix verified and closed,
including independent three-fault sensitivity. Overall F-02 **CHANGES_REQUIRED**
for B1 browser restoration setup in `docs/reviews/F-02-c1-implementation.md`.
Completion is returned to unchecked pending a planner-owned setup correction and
confirmation. No further C1 production fix is requested.

Revision-3 preparation re-review on 2026-10-04: **CHANGES_REQUIRED** in
`docs/reviews/F-02-preparation-revision-3.md`. Q1–Q4 are resolved in preparation;
N1/N2 were then corrected in the documented revision-3 follow-up. Independent
preparation follow-up **PASS**: `docs/reviews/F-02-preparation-revision-3-followup.md`,
which pins the approved active manifest hash. The bounded F-02 implementation
corrections may now resume; implementation/review boxes remain unchecked until
their separate verification and independent implementation review pass.

Env-backed role accounts (Marshal/Supervisor/Admin), opaque server-side sessions with
hashed tokens, API role/location enforcement, stable seeded user/post/shift
attribution, real tablet and admin login screens with protected routes, login errors,
logout, and the 10-minute tablet idle logout clearing unsent state.

Cases: AUTH-01, AUTH-02, AUTH-03 (scoped: no refresh workflow, no disable path),
AUTH-04, AUTH-05. **AUTH-06 is out of scope** — Admin user CRUD and Argon2id hashing
are not built and are not claimed. PRD **E1.1** (username/password login) and **E1.3**
(10-minute idle return) are delivered by this demo mechanism; **E1.2** is satisfied at
the post/shift binding level only; **E1.4** (admin user management) and **E1.5**
(password hashing) remain unsatisfied and deferred as B-08. Production staff
authentication retains its own release gate.

### F-03 — Master-data API and historical meaning
- [x] Implemented
- [x] Reviewed

**Current acceptance: independent PASS on 2026-10-07** in
`docs/reviews/F-03-m1-f02-b1-implementation.md`; accepted snapshot
`docs/reviews/F-02-F-03-accepted.sha256`. M1 contracts and independent fault
sensitivity pass; real-DB master/history checks remain green. Historical returned
statuses below are superseded. F-04 may now be planned/test-prepared.

Combined B1/M1 preparation confirmation **PASS** on 2026-10-07:
`docs/reviews/F-02-b1-f03-m1-preparation.md`. Frozen revision-2 M1 acceptance
records genuine contract RED (2 failed / 14 passed); 12 DB cases remain green.
The bounded response-contract fix may now proceed, then stop for independent
implementation review. F-04 remains blocked.

Dependencies: F-02; B-05 resolved. Manage violations/severity/default action,
departments/contractors, locations/gates and vehicle types; deactivate rather
than delete. Preserve historical meaning after edits/deactivation.
Cases: MST-01–MST-03. PRD E5.1–E5.3.

**Owner override (2026-10-05):** the owner explicitly directed F-03 preparation and
implementation to proceed while F-02's C1 implementation re-review is still owed and
`F-02 Reviewed` remains unchecked. This is a disclosed process deviation from the
"both boxes" dependency gate, recorded so the reviewer sees it rather than infers it.
F-02's independent review obligation is unchanged and still blocks F-02 acceptance;
no F-02 review was fabricated or self-issued. F-03 acceptance likewise remains subject
to its own independent review.

F-03 is implemented (evidence: `docs/handoffs/F-03.md`; preparation:
`docs/handoffs/F-03-prepared.md`; baseline `docs/handoffs/F-03-tests.sha256` rev 1).
Six Admin-managed master sets over the existing F-01 tables with create/read/update
and idempotent deactivate, no delete; an active-only selection catalogue for any
authenticated role; and issued-snapshot preservation proven against real PostgreSQL.
Gates: 136 root units, 78 real-DB integration, 17 browser, builds, 145046 B gzip,
27 foundation; six guards fault-verified in a disposable copy. F-03 **Implemented is
ticked; Reviewed remains unchecked** pending independent review. F-04 remains blocked
until F-03 review and F-02's owed review pass.

Returned F-02 defect (corrected in the combined B1/M1 batch, revision 5): the two
F-02 browser restoration tests wrote localStorage under a running anonymous page and
immediately reloaded; the pending anonymous refusal cleared the seeded token. The
corrected tests seed the real token before the first navigation.

The independent F-03 review returned **M1**: the shared master contracts did not
enforce their kind and the unit acceptance contradicted the spec. Revision 2 corrects
the acceptance and the spec (strict kind-specific records, homogeneous lists,
positive coverage for all six kinds) and hands the contract tightening to the
implementer; measured genuine RED is 2 failed / 14 passed (16). Baseline
`docs/handoffs/F-03-tests.sha256` rev 2, rev 1 archived at
`docs/handoffs/F-03-tests-rev1.sha256`. F-03 **Implemented and Reviewed remain
unchecked** pending preparation confirmation and the contract fix.

Independent F-03 review (2026-10-05): **CHANGES_REQUIRED**, `docs/reviews/F-03.md`.
M1 returns kind-specific response validation and a contradictory unit assertion
to the planner, followed by a bounded shared-contract fix. Implementation is
unchecked; review remains unchecked. Combined gates pass (136 unit, 78 integration,
17 browser, 27 foundation), but response-contract acceptance prevents approval.
F-04 remains blocked.

### F-04 — Shared theme and role-specific shells
- [ ] Implemented
- [ ] Reviewed

**Current acceptance: CHANGES_REQUIRED, 2026-10-16**, independent review
`docs/reviews/entry-media.md` (EM-01/07/09/10). Implementation returned to
unchecked: real entry catalogue loading and UI verification do not pass.
The implementation claims below are historical and do not establish acceptance.

R1–R5 corrections recorded in `docs/handoffs/entry-media.md`; the
combined R1–R5 + I-02 + I-03 batch evidence supersedes the
CHANGES_REQUIRED checkpoint for R4. Prepared as part of the bounded
R1–R5 + I-02 + I-03 entry-media batch
(`docs/handoffs/entry-media-prepared.md`; brief
`docs/handoffs/entry-media-batch.md`; feature
`specs/006-camera-signature`; baseline
`docs/handoffs/entry-media-tests.sha256`).

**Owner override (2026-10-15):** the owner authorised the bounded
implementation run with the same single-planning-pass, implementer
batch, one combined review pattern that the 2026-10-07 pre-issuance
override used. At this moment **no separate independent
preparation-confirmation record exists**; the override is recorded
in `docs/decisions.md` 2026-10-15 and the combined independent review
at batch exit remains required. No self-review and no new business
policy.

Dependencies: F-02/F-03. Implement design tokens, self-hosted fonts, tablet/admin
theme variants, navigation and role-specific routes. No business-rule guessing
from mockup examples. Static labels, tablet touch targets, green-only commit,
outlined status chips, visible focus and responsive layout. Cases: UI-01–UI-03.

Phase exit: approved domain decisions, migrations, authentication and permission
tests pass; reviewer checks both consumers of shared contracts.

## Phase 2 — Complete gate issuance

### I-01 — Entry steps, autocomplete and validation
- [ ] Implemented
- [ ] Reviewed

**Current acceptance: CHANGES_REQUIRED, 2026-10-16**, independent review
`docs/reviews/entry-media.md` (EM-01/02/07/09). Implementation returned to
unchecked for authenticated catalogue loading and stale-response handling.
The implementation claims below are historical and do not establish acceptance.

R1/R2/R5 corrections recorded in `docs/handoffs/entry-media.md`. The
bounded R1–R5 + I-02 + I-03 batch evidence supersedes the
CHANGES_REQUIRED checkpoint. Implementation is ticked on the new
evidence; review stays unchecked until the combined independent review
records its report.

Dependencies: F-04; B-06 resolved for the production lookup source. Implement the approved flow with controlled selections,
editable autocomplete, plate normalisation, multiple violations and derived
severity; remarks required for Other. Prepare summary/signature navigation.
Cover Other for every applicable controlled field, not just violation type.
Vehicle suggestions join gate-pass records to driver/department/contractor/type,
including vehicles with no prior challans; multiple-driver matches require choice.
Cases: ENT-01–ENT-06. PRD E2.1–E2.7 and requested gate-pass lookup extension.

### I-02 — Live camera capture and compression
- [ ] Implemented
- [ ] Reviewed

**Current acceptance: CHANGES_REQUIRED, 2026-10-16**, independent review
`docs/reviews/entry-media.md` (EM-04/05/07/08/09). Implementation returned to
unchecked: live preview, late-stream cleanup, parent evidence state and acceptance
coverage require correction. The delivery claims below are not accepted.

E-02 owner approval 2026-10-15 (RESOLVED FOR PILOT). Live camera preview
with rear-camera preference, 1–4 shots with a blocked fifth,
delete-last-invalidates-evidence, JPEG re-encode under the E-02 limits
(300 KB target, 800 KB hard max, 1920×1440 hard dim, 0.85 → 0.6
quality floor), recoverable states for `permission_denied`,
`insecure_context`, `no_camera`, `camera_busy`, `encoder_failed`,
`oversized_after_retry`, and `cancelled`, and track cleanup on
unmount / route exit / logout. Recorded in
`docs/handoffs/entry-media.md`.

### I-03 — Driver summary, touchscreen signature and refusal
- [ ] Implemented
- [ ] Reviewed

**Current acceptance: CHANGES_REQUIRED, 2026-10-16**, independent review
`docs/reviews/entry-media.md` (EM-03/05/06/07/09). Implementation returned to
unchecked: signature render, resize safety and summary-bound entry acknowledgement
require correction. The delivery claims below are not accepted.

E-03 owner approval 2026-10-15 (RESOLVED FOR PILOT). Plain-language
summary before a `signature_pad`-backed full-width canvas; rotation,
DPR change or window resize >10% invalidates the captured stroke and
forces re-signing; PNG export under the E-03 limits (200 KB target,
500 KB hard max); refusal path requires a non-blank reason plus a
witnessing supervisor name and staff id; signature / refusal are bound
to the canonical summary revision. Recorded in
`docs/handoffs/entry-media.md`.

### I-04 — Evidence storage and authorised retrieval
- [ ] Implemented
- [ ] Reviewed

Dependencies: F-03; E-01/E-02/E-03 agreed. Local disk adapter, DB object keys,
owned uploads, MIME/content/size validation, authorised API reads with audit,
failure handling and orphan cleanup. No public static evidence directory.
Cases: MED-01–MED-04. PRD E6.1, technical storage section.

### I-05 — Repeat checks and recent-duplicate warning
- [ ] Implemented
- [ ] Reviewed

**Current acceptance: CHANGES_REQUIRED, 2026-10-16**, independent review
`docs/reviews/entry-media.md` (EM-02/07/09 and REP coverage). Implementation
returned to unchecked: repeat UI regressions and changed-preview warning gating
remain unresolved. The implementation claims below do not establish acceptance.

R3 re-preview acknowledgement invalidation recorded in
`docs/handoffs/entry-media.md`; the bounded R1–R5 + I-02 + I-03 batch
evidence supersedes the CHANGES_REQUIRED checkpoint. Implementation
ticked on the new evidence; review stays unchecked until the combined
independent review records its report.

Dependencies: I-01; D5 resolved. Gate-pass/90-day occurrences with approved
escalation rules; vehicle/location/15-minute warning, explicit acknowledgement
and server recheck service. Show occurrence number/action before submission.
Cases: REP-01–REP-05. PRD E2.11/E2.17.

### I-06 — Atomic submission, numbering and retry-safe confirmation
- [ ] Implemented
- [ ] Reviewed

**Critical-path slice — 2026-10-21.** The missing commit path is now implemented
for signed and refused submissions: shared commit contract, Marshal-only atomic
`POST /challans`, server number allocation, idempotent operation retry, local
evidence files with DB object keys, snapshot/audit persistence and the tablet
confirmation receipt. Evidence: `docs/handoffs/AUD-01-submission.md`. This is not
yet a full I-06 acceptance: authorised evidence retrieval, server-observed
entry-start timing (SUB-07), deployment and real-device evidence remain
outstanding. Both boxes stay unchecked pending independent review.

Dependencies: I-02/I-03/I-04/I-05. API blocks incomplete evidence or acknowledgement,
finalises owned uploads and immutable data, generates number, audits creation,
and returns confirmation. Handle double tap, lost response and storage/DB failure
according to E-01. Cases: SUB-01–SUB-05. PRD E2.15/E2.16/E3.4/E6.1.
Also own SUB-06 integrated media/acknowledgement/repeat checks and SUB-07 issuance
timing: record server-observed entry start and final submission timestamps for
the PRD's draft-start-to-submit metric, without requiring P1 resumable drafts.

Phase exit: complete signed and refused-signature journeys pass against the real
API/database; permission, evidence and retry failures covered. Conduct an early
tablet hardware check here; final field sign-off remains V-03.

## Phase 3 — Supervisor and admin operations

### R-01 — Location-scoped review and resolution
- [ ] Implemented
- [ ] Reviewed

Dependencies: I-06; D3 resolved. Supervisor list/detail, authenticated photos and
signature, approved Under Review/Resolved transitions, action and performer.
Issued fields remain immutable. Cases: REV-01–REV-03. PRD E3.1–E3.4.

**Tracking slice — 2026-10-21.** `specs/011-profile-tracking` adds the issuer and
the Issued → action history to challan details, plus self-service profiles for
both dashboard roles and Marshals. Evidence/signature history and audit browsing
remain outstanding.

**Bounded slice in progress — 2026-10-21.** Owner-authorised demo slice
(`specs/009-review-admin-basics`, `docs/handoffs/009-review-admin-basics.md`):
scoped list/status filter, detail history, Issued → Under Review → Resolved with
action + mandatory remarks, and Admin reopening. Evidence viewing, cancellation
and concurrency acceptance beyond the transaction guard remain outstanding. The
R-01 box above stays unchecked pending independent review.

### R-02 — Admin-approved cancellation
- [ ] Implemented
- [ ] Reviewed

Dependencies: R-01. Reason, approval and retained record; transitions and metric/
repeat effects follow D3/D5. No replacement-link feature in P0.
Cases: CAN-01–CAN-02. PRD E3.5.

### R-03 — Totals, filtering and paginated detail navigation
- [ ] Implemented
- [ ] Reviewed

Dependencies: R-02. P0 tiles and all E4.2 filters, stable sorting/pagination and
detail navigation; repeat/pending metric definitions follow approved decisions.
Cases: DASH-01–DASH-03. PRD E4.1–E4.3. Charts are P1.

### R-04 — Server-side filtered Excel export
- [ ] Implemented
- [ ] Reviewed

Dependencies: R-03. Export all matching authorised records, every field except
image binaries; audit user/time/filters/count. Cases: EXP-01–EXP-03. PRD E4.4/E4.5.

### V-00 — Demo deployment on the user's VPS
- [ ] Implemented
- [ ] Reviewed

Dependencies: R-04; D8 demo details confirmed, separate from pilot-host approval.
Deploy the reviewed issuance/dashboard/export demo with synthetic data to the
user's VPS using Docker Compose and trusted HTTPS. API container, two static
client bundles, PostgreSQL and persistent evidence storage follow PRD boundaries.
Inspect the existing VPS before making changes; define demo credentials, env,
migration/seed order, health checks, restart persistence and update/rollback steps.
Demo delivery does not require R-05/R-06 or claim pilot readiness; do not bypass
API permissions/audit in the implemented flows. Cases: DEMO-01–DEMO-02.

**Deployment scaffolding — 2026-10-23.** `docker-compose.dokploy.yml`, the API
and Nginx images under `deploy/`, and `docs/deployment/dokploy.md` now define the
Dokploy stack, migration/bootstrap order, env-seeded admin account and volumes.
The V-00 boxes stay unchecked: no VPS deployment, DNS/HTTPS verification,
backup/restore evidence or real-device acceptance has been performed, and R-04/D8
remain dependencies.

### R-05 — User and master-data administration screens
- [ ] Implemented
- [ ] Reviewed

Dependencies: R-03/F-03. Create/disable/reset users and manage/deactivate master
entries; enforce API permissions and preserve history. No self-registration.
Cases: ADM-01–ADM-02. PRD E1.4/E5.1–E5.3.

**User-administration slices in progress — 2026-10-21.** Owner-authorised
`specs/009-review-admin-basics` adds the Admin-only user list, Argon2id reset and
session revocation plus the scoped Admin challan list. `specs/010-user-management`
adds Admin creation for all three roles, deactivation as the approved removal
(E5.3), reactivation and location assignment. Master-data screens remain
outstanding. The R-05 box above stays unchecked pending independent review.

### R-06 — Audit completeness and append-only enforcement
- [ ] Implemented
- [ ] Reviewed

Dependencies: R-04/R-05. Verify create, status, cancellation, evidence-view and
export events across all flows; append-only enforcement for application DB role.
Cases: AUD-01–AUD-02. PRD E6.1/E6.2. Per-challan audit UI is P1.

Phase exit: all P0 operational requirements trace to passing tests and reviewed
code; admin-only bundles cannot leak into tablet imports.

## Phase 4 — Deployment and actual gate readiness

### V-01 — Deployment, trusted HTTPS and operating setup
- [ ] Implemented
- [ ] Reviewed

Dependencies: R-06; D8 resolved. Docker Compose/Caddy for the approved host,
persistent PostgreSQL/evidence volumes, env loading, migration/seed order,
health checks, initial-admin provisioning and operational logs. Confirm TLS is
trusted on tablets; internal-network hosting may require IT-provided certificates.
Cases: OPS-01–OPS-02. Deployment occurs only when explicitly requested.

### V-02 — Backup, restoration and paper fallback
- [ ] Implemented
- [ ] Reviewed

Dependencies: V-01. Back up DB and evidence consistently; restore into a separate
environment, verify records/audit/photos/signatures and document actual commands,
ownership, recovery objectives and fallback/reconciliation process.
Cases: OPS-03–OPS-04. PRD M2/risks.

### V-03 — Tablet acceptance, accessibility and performance
- [ ] Implemented
- [ ] Reviewed

Dependencies: V-02; B-03 resolved. Real tablet, plant Wi-Fi, trusted HTTPS,
sunlight/gloves, touch and keyboard/refusal accessibility, rotation and 200% zoom.
Measure JS budget, interactive time, issue time and upload/submit latency with
documented hardware and samples. Cases: FIELD-01–FIELD-04.

### V-04 — P0 regression, handover and pilot start
- [ ] Implemented
- [ ] Reviewed

Dependencies: V-03. Run full P0 regression; no unresolved release-blocking defects,
confirm operating owner and staff walkthrough. Record release baseline and start
one/two-gate pilot only after user/stakeholder acceptance. Set weekly measurement
for digital issuance, losses, under-three-minute median issuance, report time
and repeat-detection accuracy. Cases: PILOT-01–PILOT-02.

Phase exit: automated regression, restore drill and actual gate/device evidence
pass. A desktop demo or green unit tests alone do not meet this exit.

## Later work, intentionally not included in P0

P1: resumable drafts, cancellation/replacement links, trend charts, dedicated
repeat list, driver merge tooling, Other promotion and audit-trail UI.
P2: offline issuance/sync (D1), SSO and scheduled emailed reports.
