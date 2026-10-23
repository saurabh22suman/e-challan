# e-Challan replacement specification — demo draft

Version: 0.1. Prepared and owner-approved: 2026-10-02.
**Status: OWNER-APPROVED FOR THE SYNTHETIC DEMO. F-01 planning/test preparation authorised.**

Approval source: user answered Yes in the reviewer/planner chat to consolidated
approval of this specification and its delegated defaults. See the dated approval
in `docs/decisions.md`. “Draft default” labels retained below describe how the
rules originated; all defaults in this approved version now apply to the demo.
Future implementation still requires prepared tests and independent review.

## 1. Authority and purpose

Functional Specification v0.2 is unavailable. The owner authorised drafting a
replacement from the PRD, approved the major workflow decisions in
`docs/decisions.md`, and delegated remaining routine defaults to the agent.
This draft assembles those rules for an online, synthetic-data demo. It does not
claim to reproduce the missing specification or approve production rollout.

Labels used below:

- **Existing requirement:** from `docs/eChallan_PRD.md`, the constitution or the
  acceptance catalogue; applies unless explicitly superseded by an owner decision.
- **Owner-approved:** directly confirmed in the dated decision register.
- **Draft default:** proposed under the owner's delegation; takes effect only
  after this version receives consolidated approval (received on 2026-10-02).

Sources: PRD E1–E6; `docs/eChallan_DESIGN.md` for visual constraints;
`docs/e_Challan_Concept_Proposal.pptx` for visual reference;
`docs/decisions.md` for owner decisions; `docs/test-cases.md` for acceptance.
The decision register takes precedence over older contradictory worksheet
proposals. The concept deck's sample values are not business rules.

## 2. Scope and delivery boundary

**Owner-approved:** use a local demo database with synthetic driver, vehicle and
gate-pass records, starting from `docs/demo-data.json`. No production data,
external gate-pass integration or operational admission control is included.

**Existing requirement:** API, tablet and admin remain separate deployables.
The demo target includes issuance, review, dashboard filtering and server-side
Excel export. Implementation proceeds task by task with planner-owned tests and
independent review. F-01 establishes contracts/schema/fixtures; it does not
implement all of those journeys at once.

Charts, persistent/resumable drafts, driver merging, offline issuance, corporate
SSO and scheduled emails remain P1/P2. The concept deck's bar chart does not
promote charts to P0. Deployment remains a separately requested task.

## 3. Approved interaction

**Owner-approved, B-02:** a full-width single challan-entry form on the tablet;
dashboard content appears separately. This supersedes PRD E2.1's stepped-entry
requirement. After entry, show a plain-language driver summary, then full-width
signature/refusal, then submission confirmation.

**Draft default:** vehicle/driver, master selections, violations, remarks and
photo capture occupy the entry form. Preserve values when navigating between
form, summary and signature within the current session. No durable draft or
offline queue is implied. A material change after acknowledgement clears the
signature/refusal acknowledgement and requires renewed summary/acknowledgement.

**Existing requirement:** static labels, visible focus, large touch targets,
outlined status chips, exact-path MUI/icon imports and route splitting. Initial
tablet JS stays below 250000 gzip bytes. Only final challan commitment uses a
solid-green action. Admin-only grids/charts/date pickers stay out of tablet/shared
client code. Date/time and assigned challan number are not editable inputs.

## 4. Field dictionary and validation defaults

All lengths and formats in this section are **draft defaults**. Mandatory media,
signature/refusal, Other remarks, master selections and non-editable severity
originate in PRD E2. Server contracts enforce the same rules as the clients.

| Field | Issuance requirement | Representation/rule |
|---|---|---|
| Internal challan ID | Server assigned | Opaque UUID; independent of display number |
| Challan number | Server assigned on commit | `DEMO/YYYY/MM/NNNN`, monthly sequence, at least four sequence digits |
| Vehicle registration | Required | Uppercase; remove whitespace; validate supported Indian patterns below |
| Gate-pass number | Required | Uppercase and trim; 1–64 ASCII letters/digits/hyphens/slashes; no internal whitespace |
| Driver name | Required | Trimmed Unicode text, 1–120 characters; never an identity key |
| Driver/gate-pass registry IDs | Optional provenance | Selecting a demo match supplies IDs; manual entry is allowed |
| Department | Required | Active master ID, including explicit Other if configured |
| Contractor | Optional | Active master ID when selected; explicit Other requires remarks |
| Vehicle type | Required | Active master ID, including explicit Other if configured |
| Location/gate/post | Required attribution | Authorised current post determines actual issuance location/gate |
| Marshal and shift | Required attribution | Server-bound actor/session/shift IDs; reject forged attribution |
| Violations | Required | One or more distinct active violation IDs; duplicate selections rejected |
| Severity | Server derived | Per-violation Minor/Major/Critical; displayed challan severity is highest selected severity |
| Remarks | Conditional | Trimmed Unicode text up to 2000 characters; nonblank if any applicable controlled choice is Other |
| Photos | Required | 1–4 owned camera-captured evidence objects; metadata counts are not evidence |
| Driver acknowledgement | Required | Signature or refusal, mutually exclusive |
| Refusal reason | Required when refused | Nonblank text up to 2000 characters |
| Witnessing supervisor name / staff ID | Both required when refused | Supervisor name 1–120 characters; staff ID 1–64 characters; retain E2.14's supervisor qualification |
| Entry-start / issued timestamps | Server assigned | Start records timing; issued-at is the successful commit instant |
| Duplicate-warning acknowledgement | Conditional | Required when the server's final same-vehicle/location check finds a match |
| Idempotency key | Required on submission | Client operation UUID reused for retries of the same submission |

Supported demo registration patterns after normalisation:

- Conventional: two state letters, one or two district digits, one to three
  series letters, one to four terminal digits.
- BH: two year digits, `BH`, four digits and one or two trailing letters.
- Reject punctuation and registrations outside these shapes with an explanatory
  validation error. This is format checking, not government-registration verification.
  Production exceptions require a later approved field-specification revision.

Challan numbers are globally unique within the demo site. Sequence allocation is
atomic; width expands beyond 9999. Cancelled numbers are never reused. Gaps are
acceptable; no gapless-numbering requirement is introduced. The visible number
does not exist before successful submission; show “Assigned on submission”.

Manual entry creates immutable issued descriptions; it does not silently create
or edit a registry identity. If selected registry details are edited, the issued
values and their provenance remain distinguishable. Master choices remain IDs,
not arbitrary typed replacements; Other is a real controlled option.

## 5. Time, repeat counting and severity

The following counting details are **draft defaults** under D5 delegation:

- Store server-observed instants in UTC; display dates/times in `Asia/Kolkata`.
  Site-day/month filters use Kolkata calendar boundaries. PostgreSQL timestamps
  preserve instants; do not claim they preserve an original textual UTC offset.
- The 90-day repeat window uses elapsed time, not working days. For commit time
  `T`, count previous non-cancelled challans with
  `T - 90 days <= issuedAt < T`. Exactly 90 days old is included.
- Key repeat history on normalised gate-pass number across demo locations,
  following E2.11. Never merge by driver name or vehicle alone. Multiple drivers
  may share a vehicle. Different passes do not combine into one identity.
- One challan counts as one occurrence even if it contains multiple violations.
  Issued, Under Review and Resolved all count; Cancelled does not.
- Current occurrence number is matching prior count plus one. Cancellation
  affects future checks and current metrics, without rewriting the stored
  occurrence/recommendation shown when earlier records were issued.
- Concurrent issuances for the same normalised pass are serialised through commit
  so they receive consecutive occurrence numbers. A final API check refreshes
  preview results; if occurrence/recommended action changed, require renewed
  driver summary/acknowledgement before commitment. Retries preserve the same
  operation rather than issuing a second challan.
- Each violation has one master severity. Highest-of-set is the displayed/filter
  severity for a multi-violation challan; no weighted severity or special severity
  override is proposed for this demo.

**Owner-approved recommendation tiers:**

| Current occurrence | System recommendation |
|---|---|
| 1 | Warning issued |
| 2 | Safety counselling |
| 3 or more | Referred to department/contractor |

These are recommendations, not automatic resolution, enforced penalties or a
requirement that the reviewer select the same actual action. The matrix applies
uniformly in this demo. Store the issuance recommendation with the issued record;
the violation master's default action remains a separate reference field.

**Existing requirement plus draft boundary default:** the duplicate warning uses
normalised vehicle + actual location, independently of repeat identity. At `T`,
check non-cancelled records in `T - 15 minutes <= issuedAt < T`. Exactly 15
minutes old is included. The warning permits explicit acknowledgement and
continuation; it is not an unconditional rejection.

## 6. Approved review, resolution and cancellation

All policy choices in this section are **owner-approved, D3**. Issued fields and
evidence remain immutable. Review actions and transitions are separate retained,
audited records; they do not overwrite previous actions.

| From | To | Permission and requirement |
|---|---|---|
| Issued | Under Review | Assigned-location Supervisor or any-location Admin |
| Under Review | Resolved | Same role scope; completed follow-up, one selected action, mandatory remarks and recorded performer |
| Resolved | Under Review | Admin only; mandatory reopening reason |
| Issued / Under Review / Resolved | Cancelled | Admin only; direct cancellation records approval, performer and mandatory reason |

No direct Issued → Resolved transition. Cancelled is terminal and cannot be
restored. There is no separate supervisor cancellation request or second-person
approval workflow. Subsequent resolution after reopening creates a new action
record and retains earlier history.

Resolution action choices:

- Warning issued
- Safety counselling completed
- Referred to department/contractor
- Custom

Every choice needs mandatory remarks. Custom is described in those remarks,
with no extra custom action-name field. One action applies to the whole challan,
not one action per violation. Completing referral permits resolution immediately;
the receiving department's later work is not a prerequisite. Issuance or driver
signature alone never resolves a record.

Pending = current Issued + Under Review. Resolved and Cancelled are excluded;
an Admin-reopened record contributes to Pending.

## 7. Demo lookup and history defaults

**Owner-approved source:** synthetic local database only. **Existing requirement:**
lookup works for passes with zero prior challans and handles shared vehicles with
an explicit driver/pass choice. Never assume a matching name proves identity.

**Draft defaults:**

- Trigger authorised suggestions after three characters for registration,
  gate-pass number or driver name. Fill registration, driver, pass, department,
  contractor and vehicle type; never fill violations, remarks, evidence or signature.
- Actual issuance location stays bound to the current post, not copied from the
  pass. Only records visible to the current location may appear to a marshal.
  Proposed E2.5 interaction clarification: location remains a master reference,
  selected through authorised post/session setup rather than changed independently
  on the challan form. The entry form displays it read-only. This timing/binding
  choice is a draft default for consolidated approval, not an already approved
  consequence of choosing a single-form layout.
- Unknown registrations/passes may be entered manually; this product records
  violations rather than granting admission. An expired pass may be displayed
  and used for a challan with an explicit expiry notice; this grants no gate access.
- If autofill references inactive masters, require active replacements or Other;
  do not silently select inactive options.
- One registry gate-pass ID has one unique normalised pass number and one driver/
  vehicle association. Multiple pass records can reference the same vehicle or
  driver. Changing registry links does not alter issued records.
- Seed/reset is an explicitly invoked demo/test operation, repeatable and guarded
  against production targets. No import-management UI or external sync is added
  to the demo requirement by choosing a demo database.
- **B-05 draft default:** retain master IDs for provenance and snapshot the issued
  labels, severity and default-action values at issuance. Later master edits or
  deactivation do not change their issued meaning. Snapshots and references coexist;
  a reference to a mutable master alone is insufficient.

The fixture contains historical display statuses and media counts, not validated
production transitions or media files. F-01 planning must explicitly define a
synthetic history adapter and its provenance rather than pretend those fields
prove real issuance. Browser issuance checks use actual generated/captured test
blobs. Original fixtures remain unchanged unless the planner documents a revision.

## 8. Identity, permissions and attribution defaults

**Existing requirements:** username/password login; Admin-created users only;
Argon2id password hashing; API authorisation; 10-minute tablet idle return to
login; post/shift attribution and append-only audit.

**B-04 draft defaults:** each logged-in account identifies a named person. A
marshal session is bound to a configured tablet post and selected active shift;
per-shift tablet use does not replace the individual audit identity. Shift/post
changes require ending the current issuance session. Idle logout clears unsent
in-memory form/signature state; show an earlier expiry warning. No resumable
draft persistence is added. Use independently attributed synthetic demo users,
with credentials provisioned outside fixture source and no production secrets.

Supervisors may view authorised-location records/evidence and review/resolve
them. Admins may act across locations and manage users/masters. Marshals issue
only at their authorised posts; **draft default:** their own issued-record
confirmation/detail is available, without general cross-location browsing or
review privileges. Evidence reads enforce the same record scope and are logged.
Session/token lifetimes beyond tablet idle behaviour remain F-02 technical-plan
choices; refresh/logout/disabled-account behaviour must satisfy AUTH-03.

## 9. Dashboard, exports and integrity

**Existing requirements:** authorised filters, stable sortable pagination,
detail/evidence views, server-generated Excel export of all matching authorised
rows, and audit of exports and evidence access.

**Draft defaults:** Total includes retained Cancelled records; Issued today
counts records committed on the site-local day, including records later cancelled.
Resolved counts only current Resolved status. Repeat offenders in the last 90
days counts distinct authorised gate-pass numbers with at least two non-cancelled
challans in that window; it is not a count of violations or duplicate names.
Historical audit events do not disappear when a record is cancelled or reopened.

Exports include issued fields, status, occurrence/recommendation, selected latest
review action/remarks/performer and related identifiers, excluding image binaries.
The feature plan must enumerate exact columns and representations and preserve
authorised scope; exports are not produced from only the current table page.

API validation rejects forged attribution/severity, invalid references, stale
masters, missing evidence/acknowledgement and illegal status transitions. Creation,
status changes, cancellation, reopening, evidence views and exports are audited.
No silent partial issuance on DB/storage failure; submission retries are idempotent.

## 10. F-01 planning and approval exit

After this draft is approved, the planner prepares the bounded F-01 Spec Kit
feature, explicit entity/field dictionary and independently owned DOM-01–DOM-03
tests: shared/API validation agreement, repeatable synthetic seeds, empty/upgrade
migrations, FK/unique constraints and rollback. Reopening extends later review
acceptance; the planner must document that extension rather than silently change
an existing baseline. No implementation box is ticked by specification approval.

Detailed camera compression/signature file limits, storage ownership/cleanup,
token configuration and exact export columns belong to their prepared feature
handoffs. The existing E-01–E-03 proposals are not blanket-approved by this draft.
F-01 may model relationships without asserting unresolved binary limits or
claiming implementation of later tasks.

**Consolidated approval received on 2026-10-02:** the owner accepted the labelled
draft defaults in this version for the synthetic demo, including field rules, numbering, counting,
highest-of-set severity, lookup expiry handling, issued-value snapshots and
session attribution. B-01/D5 and the demo B-04/B-05/B-06 decisions are recorded
with this version as source. Production lookup sourcing,
hosting/ownership, backup/restore and actual device acceptance remain later gates.
No demo-only decision or synthetic fixture constitutes production staff-use approval.
