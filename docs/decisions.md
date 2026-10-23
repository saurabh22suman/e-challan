# Decisions required for the gate pilot

Open items are not implementation permission. Record the owner's answer, date,
source and affected cases when resolving one. Proposed engineering choices are
labelled separately from existing PRD requirements.

| ID | Status | Decision needed | Blocks |
|---|---|---|---|
| B-01 | RESOLVED FOR DEMO — 2026-10-02 | Owner approved replacement specification v0.1, `docs/eChallan_replacement_spec.md`, including delegated field/rule defaults. Original Functional Specification v0.2 remains unavailable; production use requires a separate approved handoff. | F-01 demo specification prerequisite resolved |
| B-02 | RESOLVED — 2026-10-02 | Owner chose single-form entry, followed by driver summary and signature/refusal. This supersedes PRD E2.1's stepped-entry requirement for the pilot; retain summary-before-signature and other field-usability constraints. See dated owner clarification below. | F-01, I-01 flow decision resolved |
| D3 | RESOLVED — 2026-10-02 | Owner approved resolution/action requirements, location-scoped review permissions, mandatory Issued → Under Review → Resolved sequence, Admin-only reopening and direct cancellation, terminal Cancelled status, and Pending = Issued + Under Review. See dated owner clarifications below. | F-01, R-01, R-02, R-03 decision resolved; D5 counting effects remain open |
| D5 | RESOLVED FOR DEMO — 2026-10-02 | Owner approved replacement specification v0.1: gate-pass-keyed elapsed 90-day window with inclusive lower boundary, one occurrence per non-cancelled challan, serialised concurrent issuance and approved recommendation tiers. | F-01, I-05, R-03 demo counting prerequisite resolved |
| D1 | OPEN; P2 | Offline decision remains open. Current P0 plan is online issuance with paper fallback, no offline queue. Confirm gate connectivity is adequate for this scope. | Offline implementation; pilot readiness if connectivity is inadequate |
| D8 | PARTIAL | User selected their VPS for the demo. Still confirm VPS address/access, OS/resources, demo domain/trusted HTTPS, network reachability, operating owner and backup location. Pilot hosting/restore ownership remains unconfirmed. | V-00 demo deployment; V-01, V-02 pilot operations |
| B-03 | OPEN | Target tablet model, OS/browser, orientation and device policy; confirm rear-camera permission, network and stylus availability. | Hardware sign-off V-03 |
| B-04 | RESOLVED FOR DEMO — 2026-10-02 | Approved specification v0.1 uses individually named accounts with post/shift-bound marshal sessions; idle logout clears unsent state and shift/post changes end the current issuance session. | F-02, I-01 demo attribution prerequisite resolved |
| B-05 | RESOLVED FOR DEMO — 2026-10-02 | Approved specification v0.1 retains master references and immutable issued snapshots of labels/severity/default actions. Later master edits/deactivation do not change historical meaning. | F-03, F-04 demo history prerequisite resolved |
| B-06 | DEMO RESOLVED; PRODUCTION OPEN — 2026-10-02 | Approved specification v0.1 uses the synthetic local registry with zero-history lookup, post-bound location and expiry notices. Production source, refresh and ownership require a later handoff; no external integration is assumed. | F-01/I-01 demo prerequisite resolved; production integration remains blocked |
| E-01 | PROPOSED | Idempotent submission retries; unique server numbering and all-or-nothing finalisation with owned uploads. Stage uploads before commit; clean abandoned uploads after an agreed TTL. | I-04, I-06 acceptance approval |
| E-02 | RESOLVED FOR PILOT — 2026-10-15 | Live getUserMedia camera capture. Client limits: target ~300 KB JPEG; hard maximum 800 KB OR 1920×1440 px (whichever hits first); initial encode quality 0.85; on overflow downscale by 0.85 and re-encode down to a quality floor of 0.6; after that, fail with a recoverable error and do not claim capture. Server hard enforcement (MIME, byte, dimension) is separately gated under I-04/MED-02 against recorded limits. | I-02 final media contract |
| E-03 | RESOLVED FOR PILOT — 2026-10-15 | signature_pad, full-width touch canvas, PNG export. Client limits: target ≤200 KB PNG, hard maximum 500 KB. Canvas backing pixels scaled to devicePixelRatio at mount and on every resize; rotation, DPR change, or window resize >10% invalidates the signature and requires re-signing. Acknowledgement (signature or refusal) is bound to the canonical summary revision: any change to a draft field that affects the driver summary OR a changed re-preview (different occurrence/recommendedAction/duplicate information) invalidates both signature and refusal state. Refusal path: non-blank reason + witnessing supervisor name + supervisor staff ID, all required. Uploads and server binding remain I-04/I-06. | I-03 final signature contract |
| B-08 | RESOLVED FOR PILOT — 2026-10-17 | Owner chose a searchable vehicle dropdown for the entry form: it lists the session post's location vehicles (gate-pass records, B-06 scoping retained), typing filters it, and selecting fills the known fields, all still editable (E2.4). A "new vehicle" item switches to one-off manual entry: nothing is written to the registry, and the gate pass number stays required so D5 counting still keys on it. See dated owner clarification below. | I-01 interaction revision; ENT-01/02/06, UI-01–UI-03 |
| B-09 | RESOLVED FOR PILOT — 2026-10-17 | Owner authorised a full visual restyle of all pages (tablet and admin) beyond `docs/eChallan_DESIGN.md`'s specific visual treatment, which is superseded where in conflict for the pilot. Constitution-level gates remain in force: tablet initial JS under 250 KB gzipped, exact-path MUI/icon imports, no admin-only widgets in tablet, static labels above inputs, touch targets, contrast and the green-only commit action. See dated owner clarification below. | UI-01–UI-03 extension to all pages |

Independent S-01 infrastructure preparation can proceed with synthetic fixtures.
Production domain behaviour is not ready for implementation until its decisions
are resolved. The PRD explicitly names D3 as a build blocker; infrastructure work
does not establish readiness to release or invent resolution behaviour.

F-01 decision preparation: `docs/F-01-decision-worksheet.md` (2026-10-02).
Planner worksheet for B-01, B-02, D3, D5 and B-06 with labelled, unapproved
proposals and owner questions. It resolves nothing; every row above stays OPEN
until an answer is recorded here with its source and date.

## Owner clarification — 2026-10-02

**B-01, drafting authorisation only.** Source: user answers in the reviewer chat.
The owner confirmed that Functional Specification v0.2 is unavailable and
authorised drafting a replacement pilot specification from the existing PRD,
with missing business rules submitted to the owner for approval before
implementation. This authorises preparation, not the contents of the replacement
or domain implementation. B-01 remains OPEN until the completed field/rule
specification is explicitly approved. Affected cases: DOM-01–DOM-03.

**B-02, approved pilot entry flow.** Source: user selected option 2 in the
reviewer chat on 2026-10-02. Most challan details are entered on one scrolling
form, followed by driver summary and signature/refusal. This explicitly resolves
the conflict in favour of single-form entry and supersedes PRD E2.1's
one-task-per-screen entry requirement for the pilot. It does not remove E2.12's
summary-before-signature requirement, evidence/acknowledgement submission gates,
static labels, touch targets or the green-only commit action. Exact field layout
and remaining business rules still require the replacement specification.
Affected cases: DOM-01 request shape, ENT-05, UI-01–UI-03; later signature and
submission journeys must follow this approved flow.

**B-02, approved tablet layout clarification.** Source: user selected option 1
in the reviewer chat on 2026-10-02 after inspection of
`docs/e_Challan_Concept_Proposal.pptx`. The marshal's single-form entry uses the
full available screen width; dashboard content belongs on a separate screen,
not beside the entry form as pictured in the concept mockup. Retain the approved
subsequent driver summary and signature/refusal flow. This layout decision does
not approve additional dashboard features, charts, permissions or changes to the
separate tablet/admin app architecture. Affected cases: ENT-05, UI-01–UI-03.

**D3, approved meaning of Resolved (partial clarification).** Source: user
confirmed the proposed definition in the reviewer chat on 2026-10-02. A challan
is Resolved when a supervisor has completed the required follow-up and recorded
what action was taken and who performed it. Issuance or collecting the driver's
signature alone does not resolve it. D3 remains OPEN pending approval of the
required follow-up/action data, transition rules, cancellation rules, role scope
and pending-count semantics. Affected cases: DOM-01, REV-02, DASH-01, CAN-01–CAN-02.

**D3, approved action-entry format (partial clarification).** Source: user
selected option 1 in the reviewer chat on 2026-10-02. To record the action taken,
the supervisor selects an action from a controlled list and supplies mandatory
remarks. The action-list values and whether actions apply per challan or per
violation remain undecided; no values are approved by this format decision.
D3 remains OPEN for its outstanding rules. Affected cases: DOM-01, REV-02.

**D3, approved initial action-list values (partial clarification).** Source:
user approved the suggested actions and requested a custom option in the
reviewer chat on 2026-10-02. Initial controlled choices are:

- Warning issued
- Safety counselling completed
- Referred to department/contractor
- Custom

Mandatory remarks remain required for every choice under the previous approval.
How the custom action is described, whether actions apply per challan or per
violation, and whether referral alone satisfies completed follow-up remain to
be clarified. These are resolution action choices, not an approved D5 escalation
matrix. D3 remains OPEN for its outstanding rules. Affected cases: DOM-01, REV-02.

**D3, approved Custom action capture (partial clarification).** Source: user
confirmed in the reviewer chat on 2026-10-02 that remarks suffice for Custom.
Selecting Custom requires the same mandatory remarks field to describe the
action; no separate custom action-name field is required. This resolves the
custom-description question above. D3 remains OPEN for its other outstanding
rules. Affected cases: DOM-01, REV-02.

**D3, approved action scope (partial clarification).** Source: user selected
option 1 in the reviewer chat on 2026-10-02. Resolution records one selected
action and mandatory remarks for the whole challan, including when it contains
multiple violations; separate per-violation action entries are not required.
This resolves the action-scope question. D3 remains OPEN pending its remaining
transition, cancellation, permission, referral-completion and pending-count
rules. Affected cases: DOM-01, REV-02.

**D3, approved referral completion rule (partial clarification).** Source: user
confirmed in the reviewer chat on 2026-10-02 that selecting Referred to
department/contractor allows the challan to be marked Resolved immediately,
with mandatory remarks and recorded performer. For this action, completing the
referral satisfies the supervisor's required follow-up; completion of the
receiving department/contractor's subsequent work is not a resolution prerequisite.
This clarifies the previously approved meaning of Resolved. D3 remains OPEN
pending transition, cancellation, permission and pending-count rules.
Affected cases: DOM-01, REV-02, DASH-01.

**D3, approved resolution sequence (partial clarification).** Source: user
confirmed in the reviewer chat on 2026-10-02 that resolution must go through
all three statuses: Issued → Under Review → Resolved. Direct Issued → Resolved
is not permitted. This approves the forward resolution sequence only;
cancellation and reopening/backward-transition rules remain undecided.
D3 remains OPEN for its remaining rules. Affected cases: DOM-01, REV-02.

**D3, approved review/resolution role scope (partial clarification).** Source:
user selected option 1 in the reviewer chat on 2026-10-02. Supervisors may review
and resolve challans only for their assigned locations; Admins may review and
resolve challans for any location. Both roles must follow the approved Issued →
Under Review → Resolved sequence and record the selected action, mandatory
remarks and performer. This permission decision does not approve cancellation
or reopening rules. D3 remains OPEN for its remaining rules.
Affected cases: DOM-01, AUTH-02, REV-01–REV-02.

**D3, approved reopening rule (partial clarification).** Source: user selected
option 2 in the reviewer chat on 2026-10-02. Only an Admin may reopen a Resolved
challan, transitioning it to Under Review with a mandatory reason. Supervisors
may not reopen it. Reopening is a separate audited transition; issued fields,
evidence and previous action/history records remain unchanged. Subsequent
resolution follows the approved Under Review → Resolved action requirements.
D3 remains OPEN pending cancellation and pending-count rules.
Affected cases: DOM-01, AUTH-02, REV-02, AUD-01.

**D3, approved cancellation authorisation workflow (partial clarification).**
Source: user selected option 1 in the reviewer chat on 2026-10-02. An Admin
cancels a challan directly with a mandatory reason; the Admin's cancellation
action records approval and performer, without a separate supervisor request
or second-person approval step. The cancelled record and its history are retained
and the transition is audited. This approves who cancels and how approval is
recorded, not which starting statuses permit cancellation or whether Cancelled
is terminal. D3 remains OPEN for those rules and pending-count semantics.
Affected cases: DOM-01, AUTH-02, CAN-01–CAN-02, AUD-01.

**D3, approved cancellation starting statuses (partial clarification).** Source:
user selected option 2 in the reviewer chat on 2026-10-02. An Admin may cancel
a challan from Issued, Under Review or Resolved, using the approved mandatory
reason, recorded approval/performer and audited transition. Cancellation from
Resolved does not require reopening first. Whether Cancelled is terminal and
the pending-count definition remain undecided; D3 remains OPEN for those rules.
Affected cases: DOM-01, CAN-01–CAN-02, AUD-01.

**D3, approved terminal cancellation rule (partial clarification).** Source:
user selected option 1 in the reviewer chat on 2026-10-02. Cancelled is terminal:
a cancelled challan cannot be restored or reopened by any role. The record and
its history remain retained. D3 remains OPEN pending the dashboard pending-count
definition; cancellation effects on repeat counting remain a separate D5 decision.
Affected cases: DOM-01, CAN-01–CAN-02.

**D3, approved pending-count semantics and decision closure.** Source: user
answered Yes in the reviewer chat on 2026-10-02. Pending includes all challans
currently in Issued or Under Review and excludes Resolved and Cancelled. A
reopened challan in Under Review therefore contributes to Pending. Together
with the preceding owner approvals, this resolves D3's review, resolution,
action, permission and cancellation rules. The pilot status set is Issued,
Under Review, Resolved and Cancelled, as used in the approved transitions.
Issued fields/evidence remain immutable and action/transition history is retained
and audited under the constitution. Repeat-count effects remain a separate D5
decision; D3 closure does not resolve D5 or authorise blocked domain implementation.
Affected cases: DOM-01, REV-01–REV-02, CAN-01–CAN-02, DASH-01, AUTH-02, AUD-01.

**Decision-preparation delegation — 2026-10-02.** Source: user requested that
the agent ask only major decisions and work out the remainder. The agent may
draft routine engineering/product defaults consistent with the PRD and owner
approvals, documenting them together in the replacement pilot specification
rather than asking a separate question for every detail. Major business-policy,
scope and external-source decisions still go to the owner. This delegation does
not by itself approve a D5 escalation matrix or the completed B-01 specification;
the drafted specification must distinguish approved rules from delegated defaults
and be presented for consolidated approval before blocked domain implementation.

**D5, approved repeat-action tiers (partial clarification).** Source: user
approved the proposed policy in the reviewer chat on 2026-10-02. Within the
90-day occurrence window, the system recommends Warning issued for the first
occurrence, Safety counselling for the second, and Referred to
department/contractor for the third or later. These are displayed recommended
actions; the supervisor records the actual action taken using the approved D3
action list and mandatory remarks. No automatic resolution or execution of an
external disciplinary process is implied. This approval does not establish
different tiers by violation type or severity. The counting key, boundary,
cancellation and concurrency details will be drafted as documented defaults
under the owner's delegation and included in the consolidated specification
approval. D5 remains OPEN pending that complete counting policy.
Affected cases: DOM-01, REP-01–REP-05, REV-02, DASH-01.

**B-06, approved demo lookup source — 2026-10-02.** Source: user requested
"for now, lets have a demo database" in the reviewer chat. The current demo
uses a local database populated with synthetic vehicle, driver and gate-pass
records, starting from `docs/demo-data.json`; no production registry, live
external-system integration or real field data is required for this stage.
Gate-pass lookup must also find drivers with no prior challans, as already
required by B-06/ENT-06. F-01 may specify this demo-source contract in the
replacement specification, subject to its consolidated approval; this is not
permission to begin domain implementation yet. Production lookup sourcing,
refresh and ownership remain OPEN for a later production/pilot handoff.
Affected cases: DOM-02–DOM-03, ENT-02, ENT-06.

**Replacement draft prepared — 2026-10-02.**
`docs/eChallan_replacement_spec.md`, version 0.1, assembles existing requirements,
owner-approved rules and labelled defaults drafted under the owner's delegation.
It targets the synthetic-data demo and is awaiting consolidated owner approval.
B-01 and the remaining D5/demo-source details are not marked resolved by drafting
the document. No domain schema, contract, migration or feature implementation
was created as part of this preparation.

**Consolidated replacement specification approval — 2026-10-02.** Source: user
answered Yes to approval of `docs/eChallan_replacement_spec.md` v0.1 and its
labelled delegated defaults for the demo, so the planner can prepare F-01's
contracts/schema specification and acceptance tests. Approval covers the entire
presented version, including the counting, severity, field/numbering, historical
snapshot, demo lookup and session-attribution defaults; earlier draft notes are
historical and superseded where resolved by this approval. B-01/D5 and the demo
B-04/B-05/B-06 prerequisites are resolved as summarised in the register. B-02/D3
remain resolved by their direct approvals. No implementation checkbox is ticked
by this approval; implementation still requires the bounded planner-owned
test-first handoff and subsequent independent review. Production integration,
hosting, real-device acceptance and E-01–E-03 detailed media contracts retain
their separate gates. Affected cases: DOM-01–DOM-03 and the downstream cases
identified in the approved specification.
**E-02 / E-03 owner approval — 2026-10-15.** Source: user answers in the planner
session on 2026-10-15. Resolves E-02 and E-03 with the limits recorded in the
table above for the P0 client implementation of I-02 and I-03. Server-side
hard enforcement (MIME/byte/dimension validation and signed-acknowledgement
binding) remains separately gated under MED-02 (E-02 limits) and SUB-06/SUB-01
(E-03 binding). The signature canvas invalidate-on-resize rule is the
explicit owner choice; preserve-strokes behaviour remains a later option if
subsequent hardware testing shows it can be reliably implemented. Affected
cases: CAM-01–CAM-05 and SIG-01–SIG-05, plus the related R1–R5 corrections to
the existing entry flow that depend on the same shared contracts and
acknowledgement binding semantics.

**Bounded entry-media batch preparation authorisation — 2026-10-15.** Source:
user request in the planner session on 2026-10-15, carried by
docs/handoffs/entry-media-batch.md. Authorised the single planning pass,
implementer batch and one combined review at batch exit pattern that mirrors
the disclosed pre-issuance override; no separate preparation confirmation
record is produced because the planner and implementer share the same
authorised session. The owner further confirmed the bounded scope fence: no
I-04 storage, no I-06 submission, no API/media routes and no migrations are
added by this batch. This authorisation authorises preparation and bounded
production implementation of R1–R5 plus I-02/I-03 only; it does not extend
self-review, no acceptance-test ownership transfer, and no approval of any
later business-rule decision. Affected cases: UI-01–UI-03, ENT-01–ENT-06,
REP-01–REP-05, CAM-01–CAM-05, SIG-01–SIG-05.

## Owner clarification — 2026-10-17

**B-08, approved vehicle selection interaction.** Source: owner selected options
in the planner session chat on 2026-10-17. The entry form's vehicle control
becomes a searchable dropdown: opening it lists the vehicles with gate-pass
records at the session post's location (the B-06 scoping rule is retained); typing
filters the list; selecting a vehicle fills driver, gate pass, department,
contractor and vehicle type, and every filled field remains editable (PRD E2.4).
This supersedes, for the pilot, the typeahead-suggestions presentation recorded
in the pre-issuance specification (`specs/005-pre-issuance/spec.md`, client
surfaces). Registry lookup keeps its debounce, cancellation and request-sequence
guards; the dropdown additionally needs a list mode for the currently scoped
vehicles, which is a bounded API/contract revision of `GET /registry/lookup`.
An explicit "new vehicle" choice switches the form to one-off manual entry for a
vehicle that has no registry record: the typed details apply to this challan
only, nothing is written back to the registry or master data, and the gate pass
number remains required so the approved D5 counting key is unchanged. An unknown
gate pass simply has no prior challans, so the occurrence is 1. Affected cases:
ENT-01, ENT-02, ENT-06, UI-01–UI-03, and the pre-issuance browser journey.

**B-09, approved visual restyle.** Source: owner selected the full restyle
option in the planner session chat on 2026-10-17. The owner authorised a full
visual restyle of all tablet and admin pages, informed by external UX
references, going beyond `docs/eChallan_DESIGN.md`'s specific visual treatment.
That document's visual tokens are superseded for the pilot where they conflict
with the restyle; its functional rationale (monospaced identifiers for
read-back disambiguation, readable contrast) is retained unless the restyle
demonstrably improves it. Constitution-level constraints remain in force and are
not waived: tablet initial JS under 250 KB gzipped, exact-path MUI/icon imports,
no admin-only MUI X widgets in tablet or shared code, static labels above
inputs, large gloved-hand touch targets, and the green filled action reserved
for committing a challan. This authorisation covers the bounded revision
prepared and implemented with its own test-baseline revision; independent
review of this revision is still required and no review box is ticked by this
decision. Affected cases: UI-01–UI-03 plus the login and shell surfaces that
were previously only foundation smoke checks.

## Owner clarification — 2026-10-18

**Bounded inclusive-UX revamp batch authorisation.** Source: owner instruction in
the revamp session chat on 2026-10-18: "please complete all the tasks and then
come for review in the end." This extends the 2026-10-18 UX-00 direction to the
whole prepared revamp table (`docs/handoffs/inclusive-ux-revamp-plan.md`,
UX-01–UX-08) under the same single-planning-pass, implementer-batch, one combined
independent review pattern used by the 2026-10-07 pre-issuance and 2026-10-15
entry-media overrides: the per-unit review stops are replaced by one batch-exit
review, which is still mandatory and may not be self-issued. UX-05/UX-06 may
proceed on the implemented-but-not-yet-re-reviewed C1/C2 correction because the
batch-exit review covers C1/C2 together with the UX units. Scope fences: no
storage/submission/receipt, no operational dashboard, no production auth, no
deployment and no offline work; preserve B-02 single-form flow, B-08 vehicle
interaction, B-09 restyle constraints, E-02/E-03 media contracts, D3/D5 domain
rules and the 600-second inactivity policy. Copy/layout changes required by the
plan may revise frozen exact-label test selectors only through a documented
planner baseline revision in the batch records; no behavioural assertion may be
weakened. UX-08 representative-user and real-device validation remains manual,
separately gated and cannot be claimed by this batch. No review box is ticked by
this authorisation.

## Owner authorisation — 2026-10-21

**Bounded review and user-administration slice.** Source: owner request in the
implementation session: "there is nothing for admin and supervisor role. lets
plan and implement basic functions for these roles - admin should be able to
reset the password's of the users, and also see the list of chalans. supervisor
can see the chalan and update with their remarks." The owner authorised a
bounded, test-first slice of R-01/R-03/R-05 for the synthetic demo:

- role-scoped challan list and detail with status filtering;
- D3 review transitions Issued → Under Review → Resolved with action and
  mandatory remarks, plus Admin-only reopening with a reason; no Admin
  cancellation in this slice (R-02 remains separate);
- Admin user list and password reset with Argon2id storage and session
  revocation. Create/disable users, totals/pagination/export and audit UI remain
  out of scope.

Dependencies I-06, R-02 and the remainder of R-03/R-05 are not ticked by this
authorisation. This is a disclosed owner override of the dependency gate for a
demo slice, not acceptance of those tasks. Existing F-02 env credentials remain
the bootstrap; a stored reset hash takes precedence for that user. Independent
review at slice exit is mandatory and may not be self-issued. Affected cases:
REV-01, REV-02, ADM-01 (reset subset), AUTH-02, AUTH-06 (hash/reset subset).

**Admin user management completion — 2026-10-21.** Source: owner instruction
"lets impelment all" following the bounded review/reset slice. The owner
authorised the remaining R-05 user-administration scope for the synthetic demo:
Admin creation of Marshals, Supervisors and Admins with an initial password and
location assignments; deactivation as the approved "removal" (E5.3), with session
revocation and reactivation; password reset remains available. Hard deletion,
self-registration, role changes and master-data screens remain out of scope.
Deactivation preserves the account and its historical references. Self-
deactivation is refused to avoid locking the sole operator out. Existing
session, role and location rules are unchanged; independent review at slice exit
is required and may not be self-issued. Affected cases: ADM-01, AUTH-02,
AUTH-06, R-05.

**Self-service profile and challan tracking — 2026-10-21.** Source: owner
request "show users their login details /profile as well" and "did you added the
challan history/track details". The owner authorised a read-only profile for each
signed-in user (own username, display name, employee ID, role, active state,
locations and current session context) and the issuer plus full append-only
status history in challan details. No profile editing, password self-service,
cross-user profile access, evidence-history UI or public tracking URL is
authorised. No password/hash may be returned. Affected cases: AUTH-01/AUTH-02,
REV-01/REV-02, UI-03; independent review remains required.

## Owner decision — 2026-10-24

**Single sign-in page with role handoff.** Source: owner request "i want the
same login page, the username will decide the account, so same login should work
with all 3 roles", followed by the owner selecting "One login, redirect by role".

- The admin domain is the single sign-in page. The API still resolves the role
  from the username; no client may request a role.
- A Marshal is handed to the tablet; Supervisor/Admin remain on the dashboard.
- The handoff is a short-lived, signed, single-use code carried in the URL
  fragment. It is not a session token, is never accepted as one, and revokes the
  source session when exchanged. Tokens remain opaque and server-side.
- In the deployed tablet build, anonymous visits redirect to the admin sign-in
  page. Local development and component tests retain the tablet form.
- This intentionally supersedes the earlier R1 expectation that the admin and
  tablet surfaces refuse and revoke the other role's session. Acceptance tests
  were revised for the new owner-approved behaviour; no other authentication rule
  was weakened.
- Deployment must set the two public HTTPS origins before building, and the
  compose stack keeps one API replica because the handoff signing key is
  process-local.

Affected cases: AUTH-01, AUTH-02, F-02 login surfaces. Independent review remains
required.
