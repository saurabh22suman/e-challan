# F-01 decision worksheet

**Status: DECISION PREPARATION ONLY. No item below is approved.**

Prepared by the planner session, 2026-10-02, after S-01 passed independent
review (`docs/reviews/S-01.md`, "Final correction re-review — 2026-10-02" = PASS
for SET-01–SET-04). This worksheet exists to unblock F-01 — *Approved contracts
and schema*, which the implementation plan gates on "B-01/B-02/D3/D5 decisions
resolved before domain build" (`docs/implementation-plan.md:46`).

Read this before writing any schema. **Nothing here is implementation
permission**, and no proposal in this document may be implemented, encoded into a
Zod schema or migration, or treated as a domain rule until the owner answers and
the answer is recorded in `docs/decisions.md` with its source and date.

Two standing constraints, restated because they bound every item:

- **Functional Specification v0.2 is unavailable.** The PRD names it
  authoritative for business rules, data fields and open decisions
  (`docs/eChallan_PRD.md:4`) and cites its Section 11 for decisions
  (`:233`). Its contents are **not inferred anywhere in this document**. Where a
  rule is only known to exist there, that is stated as an open gap, not guessed.
- **`docs/demo-data.json` is a synthetic fixture, not a specification.** It is
  explicitly "not production seed payloads", and its metadata states that demo
  IDs, severities, statuses and masters "do not approve unresolved production
  formats, master data, escalation or resolution rules"
  (`docs/demo-data.json`, `metadata.notes[3]`). Its values are used below only as
  *evidence that a case exists*, never as the rule.

---

## Summary: what actually blocks F-01

| Item | Blocks F-01? | Blocks only later work? | Unblockable from documents alone? |
|---|---|---|---|
| **B-01** field/rule specification | **Yes — hard** | — | No. Needs v0.2 or an owner-approved replacement. |
| **D3** meaning of Resolved + transitions | **Yes — hard** | — | Partly; PRD gives transitions and roles, not the action vocabulary. |
| **D5** escalation + 90-day counting | **Yes — hard** | — | No. No document contains a matrix. |
| **B-02** stepped vs single form | **Yes — contract-level** | — | Yes, owner picks between two depicted flows. |
| **B-06** gate-pass source contract | **Yes — schema-level** | — | Yes, owner names the source. |
| B-04 session/shift attribution | No | F-02, I-01 | Yes (F-02) |
| B-05 master history policy | No (schema must merely allow it) | F-03, F-04 | Yes (F-03) |
| B-03 device/OS/policy | No | V-03 | Yes (V-03) |
| D1 offline issuance | No — P2 | Offline only | Yes, later |
| D8 hosting/ownership | No | V-00, V-01, V-02 | Yes, later |
| E-01/E-02/E-03 media & submission contracts | No | I-02–I-06 | Yes, at those tasks |

B-01, D3 and D5 are the PRD's own named build blockers: "D3 and D5 block the most,
because E2.11 and E3.3 cannot be specified without them"
(`docs/eChallan_PRD.md:233`), and the risk table lists "Resolved never gets
defined, so status data is meaningless" as *"Blocking decision D3 — build does
not start without it"* (`:230`).

---

## B-01 — Field and rule specification (replacement for Functional Spec v0.2)

**1. Existing requirement and source.** The PRD declares Functional
Specification v0.2 as its companion document and "authoritative for business
rules, data fields and open decisions" (`:4`, `:233`). F-01 is defined as
"field dictionary, permissions and transition contracts, explicit
timezone/boundary policy, Zod schemas, Drizzle migrations and synthetic seeds"
(`docs/implementation-plan.md:47–50`), and its acceptance case DOM-01 requires
"approved required fields, formats, enums and invalid payloads" to agree between
shared schemas and API (`docs/test-cases.md:22`). That file is not in this
repository.

**2. Missing or conflicting rule.** There is no authoritative statement of: which
fields are required versus optional; the challan-number format and its
uniqueness scope; date/timezone and boundary policy for the 90-day and 15-minute
rules; and the authoritative master lists. Individual requirements exist in
isolation — E2.16 "the server assigns the challan number and returns it for
display", E2.2 registration validation, E2.5 masters "selected from master
lists, never typed" — but nothing assembles them into one field dictionary.

**3. Proposals (NOT approved).**

- **Proposal B-01.a** — Obtain Functional Specification v0.2 and treat it as
  authoritative. *No engineering work until it is in hand.* If it cannot be
  obtained before the pilot build starts, an owner-approved replacement
  specification becomes mandatory rather than optional.
- **Proposal B-01.b** — If v0.2 is unavailable, approve a **minimal pilot field
  dictionary** limited to what DOM-01–DOM-03 and I-01 need, and explicitly
  defer everything else. F-01 then covers only: challan identity/number,
  vehicle, gate pass, driver, department/contractor/vehicle type/violation type
  references, issued instant, location/gate/shift/marshal attribution,
  violations, evidence, signature/refusal, status, action and audit.
- **Proposal B-01.c (timezone/boundary default, needs approval)** — store
  instants in UTC with the original offset preserved; display in `Asia/Kolkata`;
  evaluate both the 90-day and 15-minute windows in **site local time**, with an
  **inclusive** lower bound and an **exclusive** upper bound at exactly N units.
  This matches the fixture's `displayTimezone: Asia/Kolkata` and
  `referenceNow: 2026-10-01T12:00:00+05:30` (`docs/demo-data.json`), but the
  fixture does **not** approve it — `docs/demo-data.md:77` states "exact
  90-day/15-minute boundaries ... remain separate acceptance-test fixtures".
- **Proposal B-01.d (numbering, needs approval)** — server-assigned, unique per
  site, formatted `<SITE>/<YYYY>/<MM>/<NNNN>` with a per-month sequence. Note the
  conflict to settle: the fixture uses `DEMO/2026/06/0001`
  (`docs/demo-data.json`), the design document's dashboard shows
  `DMD/2025/08/001` (`docs/eChallan_DESIGN.md:225`). Neither is approved.

**4. Questions the owner must answer.**

1. Can Functional Specification v0.2 be provided? If yes, by when, and does it
   supersede this worksheet entirely?
2. If not, do you approve a replacement field specification as a bounded
   deliverable (Proposal B-01.b), and who owns writing it?
3. Which fields are **mandatory** at issuance, and which may be blank until
   review? Specifically: is remarks mandatory only when "Other" is selected
   (E2.6), or more broadly?
4. Challan number: confirm format, the sequence scope (per site? per month?
   continuous?), and whether a cancelled or voided number is ever reused
   (E3.5 retention implies it should not be).
5. Approve or replace Proposal B-01.c: UTC storage with preserved offset,
   `Asia/Kolkata` display, site-local window evaluation, inclusive lower bound?
6. Are 90 days and 15 minutes measured on **issued-at**, on **submitted-at**, or
   on a business-day calendar? Working days would change both rules materially.
7. Which master lists are authoritative at issuance, and who may add entries to
   each (Admin per E5.2, but is any list read-only to marshals)?

**5. What depends on it.**

- **Contracts** (`packages/contracts`): the entire challan, violation, evidence,
  signature/refusal, action and audit Zod surface; every enum; the shared
  error/field vocabulary.
- **Schema fields**: challan identity and number, issued instant, vehicle and
  gate-pass references, driver reference, master references, location/gate/shift/
  marshal attribution, timestamps, and the boundary-relevant instants used by the
  90-day and 15-minute queries.
- **Cases**: **DOM-01** (approved required fields, formats, enums, invalid
  payloads) is unrunnable without this. **DOM-02** (repeatable seeds) and
  **DOM-03** (FK and uniqueness constraints) depend on the approved keys from
  B-01.d. Downstream: DOM-01 also feeds AUTH-01, MST-01–MST-03, and every
  issuance case from I-01 onward.

---

## B-02 — Stepped entry versus single form

**1. Existing requirement and source.** PRD E2.1 (P0): "Marshal creates a
challan through a stepped flow, **one task per screen**"
(`docs/eChallan_PRD.md:67`). The design document §6.2 depicts a single
full-width card with a two-column field grid, remarks full width, photo capture
and signature side by side, and one green full-width "Generate challan" button
(`docs/eChallan_DESIGN.md:160–186`). `docs/development-workflow.md` records the
conflict explicitly and states neither depiction is implemented behaviour. E2.12
also requires "a plain-language summary of the violation before the signature
screen" (`:78`), which implies at least a signature step separate from entry.

**2. Missing or conflicting rule.** Two P0-level depictions contradict each other,
and one design consequence is unresolved: in the stepped reading, the repeat
offender notice "appears as a full-width amber banner directly above the commit
button" (`docs/eChallan_DESIGN.md:190`) — but on which screen is that button,
given E2.11 requires the occurrence number and prescribed action **before
submission**?

**3. Proposals (NOT approved).**

- **Proposal B-02.a (matches the existing recommendation in
  `docs/decisions.md:10`)** — Stepped entry. Suggested steps, each one task:
  (1) vehicle/gate-pass/driver with autocomplete and master selection;
  (2) violation multi-select + remarks + repeat-offender notice; (3) photos;
  (4) driver summary then full-width signature/refusal; (5) commit. Reuse the
  design document's tokens, field order, icon pairing and the green
  commit treatment unchanged, and keep the amber notice immediately above the
  commit control. Reconciles E2.1 (one task per screen) with E2.12 (summary
  before signature) and E2.15 (submission gate) without discarding the design.
- **Proposal B-02.b** — Single form per the design document, treating E2.1 as
  superseded. Cheaper to build; weaker fit to E2.1's stated intent and to a
  gloved marshal outdoors in sunlight (PRD §3).
- **Proposal B-02.c** — Hybrid: one scrolling screen for steps 1–2, then the
  existing signature panel. Least code change, but keeps the sun-readability risk
  and still does not honour "one task per screen".

**4. Questions the owner must answer.**

1. Which depiction wins for the pilot: E2.1 stepped, or the design document's
   single form? This is a product decision, not an engineering preference.
2. Is E2.1 P0 wording "one task per screen" firm, or may it be relaxed to "one
   task per section" to match the design?
3. How many steps, and what is the exact step boundary? (Proposal B-02.a suggests
   five.)
4. Where does the amber repeat-offender banner live: on the violation step, or
   above the final commit control as the design document shows?
5. Does the driver see the summary on its own screen before signing, and is the
   marshal present on it (affects E2.12/E2.14 refusal capture)?
6. Does B-02 affect the tablet bundle budget? The stepped option adds
   route-level chunks; the 250 000 B initial-JS budget
   (`docs/eChallan_PRD.md:197`) must still hold. Current measured baseline is
   134 282 B gzip (S-01 evidence), so headroom exists, but this is an
   implementation-time measurement, not a decision.

**5. What depends on it.**

- **Contracts**: the draft/submit request shapes and any client-side step state
  machine; whether E2.18 draft-resume (P1) is per-step or whole-form.
- **Schema fields**: none strictly required — this is primarily a UI contract —
  but a saved draft representation is implied if E2.18 is kept.
- **Cases**: **DOM-01** indirectly (request shape); then the UI/E2E issuance
  cases I-01–I-06, UI-01/UI-02 (touch targets, static labels, green-only commit)
  and UI-03 (route splitting). F-04 shell work depends on the step list.

---

## D3 — Meaning of Resolved, actions and allowed transitions

**1. Existing requirement and source.** PRD E3.3: "Supervisor moves a challan to
Under Review and then to Resolved, **recording the action taken and who
performed it**" (`:93`). E3.4: "Issued challans cannot be edited by anyone, in any
role" (`:94`). E3.5: "Cancellation requires a reason and Admin approval; the
record is retained, never deleted" (`:95`). E4.1 has a "pending" summary tile
(`:102`) whose membership is never defined. E3.1 lets a supervisor filter by
status (`:91`). The risk table makes D3 a hard build blocker (`:230`).
Constitution §4 reinforces immutability and separate review transitions.

**2. Missing or conflicting rule.** No document says what "Resolved" *means*,
what a valid "action taken" is (free text? a controlled list? per violation? per
challan?), who may record it beyond "Supervisor", what "pending" counts, or which
transitions are legal from which starting status — including whether Issued →
Resolved directly is allowed, and what "Under Review" is when a supervisor has
only opened a record.

**3. Proposals (NOT approved).**

- **Proposal D3.a (status model)** — Four statuses, matching the four
  `demoStatus` values present in the fixture (Issued, Under Review, Resolved,
  Cancelled). Legal transitions: `Issued → Under Review → Resolved`;
  `Issued → Under Review → Cancelled`; `Issued → Cancelled` only with Admin
  approval. No backward transitions and no Resolved → anything. Note this uses
  the fixture's *value set* as a candidate, which is explicitly **not** an
  approval source.
- **Proposal D3.b (pending semantics)** — "Pending" = Issued + Under Review
  (i.e. everything not Resolved and not Cancelled). This makes E4.1's tile
  well-defined and matches the ordinary reading of "outstanding".
- **Proposal D3.c (action data)** — A structured `action` recorded at
  Under Review → Resolved, with: a controlled action type from an owner-approved
  list, mandatory free-text detail, the acting user and timestamp, and an
  optional reference to the specific violation(s) it addresses. Stored as a
  separate append-only record, never as an edit of the issued challan (E3.4).
  Alternative if a controlled list is not wanted: free text only, minimum
  length, with no enumeration — weaker for reporting.
- **Proposal D3.d (roles)** — Supervisor may record review actions for their own
  location (E3.1); Admin may do so for any location; marshals may not. Role
  enforcement on the API, not only in the UI (constitution §4).
- **Proposal D3.e (cancellation)** — Cancellation is Admin-only, requires a
  mandatory reason, is a distinct transition (not an edit), and **retains** the
  record per E3.5. Whether a cancelled challan still counts toward repeat
  counting is a **D5** question, deliberately left open here.

**4. Questions the owner must answer.**

1. What must be true for a challan to be Resolved? Is closing the loop the only
   criterion, or is a supervisor attestation, a driver response or an external
   process step also required?
2. Approve or replace the four-value status set (Proposal D3.a). Are additional
   statuses needed — e.g. Rejected, Disputed, Appealed, Withdrawn?
3. Is "action taken" a controlled list, free text, or both? If a list, approve the
   initial values; if per-violation, confirm it is per-violation rather than per
   challan when E2.7 allows multi-select.
4. Who may record a review action — Supervisor only, or Admin too? Can a
   Supervisor act on another location's challan (E3.1 says "their location")?
5. Confirm the pending definition (Proposal D3.b) for the E4.1 tile and the E3.1
   status filter.
6. Is a direct Issued → Resolved path allowed, or must Under Review always occur
   first (E3.3's wording says "and then")?
7. For cancellation: is Admin approval a separate step by a second person, or
   approval recorded by the Admin who performs it? Must the issuing marshal be
   notified/consulted?
8. Does a cancelled challan count as an occurrence for D5, and does it appear in
   the resolved/pending tiles? (Bridge to D5.)
9. Are actions themselves auditable separately (E6.1 already requires status
   changes to be logged) — is one audit row per transition sufficient?

**5. What depends on it.**

- **Contracts**: the status enum, the action payload, the transition request and
  its validation, and the permission matrix fragment consumed by both clients.
- **Schema fields**: challan `status`; an append-only action/review table
  (action type, detail, actor, timestamp, optional per-violation reference);
  cancellation reason and approver; audit rows for each transition.
- **Cases**: **DOM-01** (enum and payload agreement), **DOM-03** (transition
  validity as a constraint). Downstream: E3.1–E3.6 and R-01/R-02/R-03 review and
  reporting cases; MST-02/MST-03 are adjacent; AUTH-02/AUTH-05 depend on the
  permission matrix.

---

## D5 — Escalation matrix and 90-day occurrence counting

**1. Existing requirement and source.** E2.11: "If the gate pass number matches
prior challans within 90 days, the **occurrence number and prescribed action** are
shown before submission" (`:77`). E2.7: violation multi-select and "severity is
derived from the master and is not editable by the marshal" (`:73`). E5.1: Admin
manages violation types **with severity and default action** (`:116`). E4.1 has a
"repeat offenders in the last 90 days" tile (`:102`); E4.7 has a repeat-offender
list (`:108`, P1). The PRD's headline success metric is "repeat offenders
correctly flagged at issue — above 90%" (`:36`), and §1 calls repeat visibility
the point of the product (`:18`). The design document requires plain-language
wording such as "This is your second recorded violation in 90 days"
(`docs/eChallan_DESIGN.md:450`).

**2. Missing or conflicting rule.** No document contains an escalation matrix at
all. Open sub-rules: whether the 90-day count is inclusive at the boundary;
whether **cancelled** records count (the fixture has one and says "approval/metric
policy remains undecided"); how **multi-violation** challans count (one
occurrence, or one per violation); whether **aggregate severity** across multiple
violations is a real concept — `docs/demo-data.md` and the fixture both state it
is *not* defined, and F-01 is explicitly told to "confirm scalar versus aggregate
severity"; what "occurrence" is keyed on (gate pass number? driver? vehicle? all
three?); and how **concurrent issuance** by two marshals should behave.

**3. Proposals (NOT approved).**

- **Proposal D5.a (counting key)** — Occurrence is counted per **gate pass
  number** within the 90-day window, as E2.11 literally states, using the
  driver identity behind that pass for display. Vehicle number alone is
  **insufficient**: the fixture deliberately shows one truck shared by two
  drivers with different passes (`docs/demo-data.json`, `demoScenarios.shared-vehicle`
  and `demo-challan-008`: "Same truck … but a different driver and gate pass; do
  not infer identity from vehicle"), and two different people share the name
  "Ramesh Kumar" (`same-name`). This proposal follows the fixture's *test
  intent*, not any approved rule.
- **Proposal D5.b (window boundary)** — Inclusive lower bound, exclusive upper
  bound at exactly 90 days, evaluated in site local time; a challan issued at
  exactly the 90-day boundary is therefore **outside** the window. Requires
  explicit approval; it is a boundary the fixture deliberately does not settle
  (`docs/demo-data.md:77`).
- **Proposal D5.c (multi-violation)** — One challan = **one occurrence** regardless
  of how many violations it carries; the occurrence number counts challans, and a
  per-violation count is displayed separately if useful. Keeps E2.11's wording
  ("the occurrence number") coherent.
- **Proposal D5.d (severity)** — Severity stays **scalar per violation**, sourced
  from the master and never editable by the marshal (E2.7). A challan's
  displayed severity is the maximum of its violation severities (Critical >
  Major > Minor). This answers F-01's "scalar versus aggregate" question without
  inventing an aggregate *rule*; a weighted or bespoke aggregate is explicitly
  **not** proposed, and the fixture warns against one
  (`demo-challan-004`: "aggregate severity policy is not defined here").
- **Proposal D5.e (cancelled records)** — Cancelled challans are **excluded**
  from occurrence counting and from the repeat-offender tile, because E3.5 retains
  them only for audit history. Alternative: include them and flag them. This
  needs an explicit answer; it changes pilot numbers either way.
- **Proposal D5.f (escalation shape)** — Prescribed action is derived from the
  **violation type's** master default action (E5.1), escalated by occurrence
  number over the 90-day window. A minimal 3-tier shape (first occurrence /
  repeat / third or later occurrence) with owner-supplied action text per tier
  would satisfy E2.11, E4.7 and the >90% flagging metric. **No concrete action
  wording is proposed** — the actions themselves are HR/contractor process
  outcomes the PRD calls a non-goal (`:26`).
- **Proposal D5.g (concurrency)** — The occurrence number is computed inside the
  same transaction that issues the challan, against a row-locked or serialised
  per-gate-pass scope, so two marshals issuing simultaneously for the same pass
  cannot both receive the same occurrence number. Either both commit with
  distinct consecutive numbers, or the second sees the committed count. The
  second may still proceed after acknowledgement (E2.17 is a warning, not a block).
- **Proposal D5.h (15-minute rule is separate)** — E2.17's same-vehicle,
  same-location 15-minute warning is a **different** rule from 90-day occurrence
  counting and should be modelled separately: it compares vehicle + location +
  issued-at, is a warning the marshal acknowledges and proceeds past, and never
  blocks or changes the occurrence number.

**4. Questions the owner must answer.**

1. Approve or replace the escalation tiers in Proposal D5.f. What are the actual
   prescribed actions, who approves them, and may they differ per violation type,
   per severity, or per occurrence count?
2. Approve or replace Proposal D5.a: is occurrence keyed on gate pass number,
   driver identity, vehicle, or a combination? What is the identity rule when a
   vehicle is shared by two drivers?
3. Approve Proposal D5.b's inclusive/exclusive boundary and the site-local
   timezone basis. Is 90 days calendar days or working days?
4. Approve Proposal D5.c: does a multi-violation challan count once or once per
   violation?
5. Approve Proposal D5.d: is scalar-per-violation with max-of-set correct, or do
   you require a real aggregate severity rule? If aggregate, define it exactly —
   DOM-01 asserts it.
6. Approve Proposal D5.e: do cancelled challans count toward 90-day occurrences
   and the repeat-offender tile?
7. Are Under Review and Resolved records counted the same as Issued for this
   purpose? (Bridges D3.)
8. Approve Proposal D5.g's concurrency behaviour: is it acceptable for two
   simultaneous issuances for the same gate pass to receive consecutive
   occurrence numbers, or must the second be blocked?
9. Confirm Proposal D5.h: the 15-minute same-vehicle/same-location warning is
   independent of occurrence counting and never blocks issuance.
10. Who owns the escalation matrix data — hard-coded, master-configured (E5.1),
    or a separate admin-managed table? This changes F-01's schema.

**5. What depends on it.**

- **Contracts**: the repeat/occurrence response contract returned before
  submission (occurrence number, prescribed action, warning payload),
  acknowledgement payload (E2.17), the severity enum and ordering, and the
  violation-type default-action field.
- **Schema fields**: occurrence-related query indexes over (gate pass, issued-at)
  and (vehicle, location, issued-at); master severity and default-action columns
  on violation type; severity on each challan violation row if stored.
- **Cases**: **DOM-01** explicitly asserts "multi-violation/aggregate severity
  follows approved policy", so this is a hard DOM-01 blocker. Downstream: I-05
  and repeat metrics in R-03, E4.1/E4.7 tiles and lists, E2.11/E2.17 acceptance,
  and the driver's plain-language summary (design §11).

---

## B-06 — Gate-pass and vehicle-number lookup source

**1. Existing requirement and source.** E2.2 vehicle number auto-uppercases,
strips spaces and validates Indian registration format (`:68`); E2.3 offers
autocomplete from **prior records** after 3 characters (`:69`); E2.4 selecting a
suggestion fills known fields, all still editable (`:70`). B-06 in
`docs/decisions.md:18` records the user's request that autofill also cover drivers
with no prior challan, and notes the demo linked records exist while "no external
integration is assumed". The reviewer's next steps require clarifying "the
production gate-pass lookup source contract for F-01; the synthetic demo registry
does not establish an external integration"
(`docs/reviews/S-01.md`, Next steps item 5).

**2. Missing or conflicting rule.** Whether the pilot's gate-pass source is a
locally maintained registry, a bulk import, or an existing gate-pass system is
undecided. Consequently undecided: refresh cadence, which locations a pass is
visible at, whether an expired pass is selectable for issuance, how corrections
are handled, and whether a pass may exist with **no** challan history (the fixture
and `docs/demo-data.md:52–54` require lookup to work in that case, and treat the
expired pass as "a status-display fixture, not an approved admission or issuance
rule").

**3. Proposals (NOT approved).**

- **Proposal B-06.a** — For the pilot, a **maintained local registry** inside the
  API's own database, seeded/imported from an operator-supplied file, with no
  external integration. This matches the single-VM Docker Compose deployment
  target (`docs/eChallan_PRD.md:148`) and avoids an undeliverable dependency.
- **Proposal B-06.b** — F-01 ships the **lookup contract and the storage shape
  only**, behind an adapter interface (mirroring the PRD's `StorageAdapter`
  pattern at `:187`), with the registry as the first implementation. An external
  gate-pass system then slots in later without a schema change. Note the lookup is
  read-only for this product: it does **not** own gate-pass issuance.
- **Proposal B-06.c (scope of visibility)** — A pass is visible only at locations
  it is authorised for, and the **current post/session determines the issuance
  location** — autofill must never fill location from the pass
  (`docs/demo-data.md:42`). Autofill fills vehicle number, driver name,
  gate-pass number, department, contractor and vehicle type only; never
  violation, remarks, evidence or signature (`:43`).
- **Proposal B-06.d (expired/inactive)** — An expired or inactive pass may be
  **displayed** with its status, and may be blocked from issuance by rule; the
  expired fixture (`pass-08`) is a display fixture only. Inactive master options
  must not be silently filled (`docs/demo-data.md:52`). Whether an expired pass
  may still be challaned is a **business rule, not yet decided**.
- **Proposal B-06.e (refresh)** — Registry refresh is an explicit admin
  import/upsert operation with an auditable run (E6.1), not a background sync, so
  the pilot stays single-host and deterministic.

**4. Questions the owner must answer.**

1. What is the real production source of gate-pass and vehicle data for the pilot:
   maintained local registry, periodic import from a file/system, or an existing
   gate-pass system? If an external system exists, who owns it and is an API
   available before M3?
2. Is an **expired** gate pass allowed to be used for issuance? The fixture has
   one and deliberately leaves the rule open.
3. Which locations may see which passes, and does visibility differ by role?
4. Refresh mechanism and cadence: manual admin import, scheduled file import, or
   push? Who operates it, and is an audit record of each refresh required?
5. How are corrections handled — overwrite, deactivate, or supersede? Does this
   collide with B-05 (master history)?
6. Confirm Proposal B-06.b: F-01 delivers the contract and storage behind an
   adapter, without building the external integration.
7. Is a pass allowed to exist with **zero** prior challans, and must lookup find
   it? (The fixture requires this; it needs approval as a rule, not a fixture
   quirk.)
8. Is vehicle registration unique per gate pass, or can one vehicle hold several
   passes — and can one pass cover several vehicles? This determines uniqueness
   constraints for DOM-03.

**5. What depends on it.**

- **Contracts**: the lookup/autocomplete request and response contract (query,
  normalised form, minimum 3 characters, suggestion list, ambiguity handling),
  and the fields a selection is permitted to fill.
- **Schema fields**: gate-pass record with driver, vehicle, department,
  contractor, authorised location scope, validity window and status; any
  uniqueness keys chosen in question 8; import/refresh audit rows.
- **Cases**: **DOM-02** (repeatable seeds without duplicate masters — a registry
  import is a seeding path), **DOM-03** (uniqueness/FK on the registry keys).
  Downstream: I-01 lookup integration, E2.2–E2.4 acceptance, AUTH-02 (location
  scoping), MST-02 (inactive entries not selectable).

---

## Explicitly **not** F-01 blockers

These stay open but do **not** gate the F-01 domain build. They are listed so the
boundary is deliberate and visible, not forgotten.

| Item | Why not an F-01 blocker | What it gates instead |
|---|---|---|
| **B-04** username login vs per-shift tablet sessions, audit attribution | F-01 must provide users/posts/shifts and an actor reference; it does not have to decide session semantics | F-02, I-01 session integration, AUTH-01–AUTH-06 |
| **B-05** master history: snapshot vs versioned reference | F-01 only has to *allow* either — i.e. issued records must not hard-delete the meaning of a master. Picking the policy is F-03's job | F-03, F-04, MST-03 |
| **B-03** tablet model, OS, orientation, device policy | No schema consequence | V-03 hardware sign-off |
| **D1** offline issuance | Offline issuance is P2 (E2.19) and explicitly out of P0 pilot scope | Offline implementation only |
| **D8** hosting and ownership | Deployment is a separate task, never an automatic side effect of green tests | V-00 demo, V-01/V-02 pilot ops |
| **E-01/E-02/E-03** media, submission and signature contracts | Media rules attach to I-02–I-06; F-01 owns the storage *shape* of evidence and signature/refusal, not the byte budgets | I-02, I-03, I-04, I-06 |

One caveat on B-05: if F-01 hard-copies master labels into the challan table,
the B-05 choice is foreclosed by schema. F-01 should therefore reference masters
and preserve historical meaning **without** deciding snapshot versus version —
that is a design constraint on F-01, not the B-05 decision itself.

---

## How to close these items

1. The owner answers the numbered questions above, or supplies Functional
   Specification v0.2 (B-01 question 1).
2. Each answer is recorded in **`docs/decisions.md`** with: the decision ID, the
   status change from OPEN, the answer, the **source** (document/section, email,
   meeting, owner name), the **date**, and the affected case IDs. Existing rows and
   their history stay intact — amend the status and add dated notes rather than
   rewriting the register.
3. Only then may this worksheet be used to prepare the bounded F-01 Spec Kit
   feature and planner-owned acceptance tests for **DOM-01–DOM-03**. Until then,
   F-01 stays blocked and no schema, contract or migration is written.
4. Anything still unanswered after the pilot build starts should be escalated as a
   scope cut, not filled in by engineering judgement — the constitution (§1)
   forbids turning assumptions into production behaviour.
