# Next-agent handoff — entry corrections, camera and signature

Prepared: 2026-10-15. Batch ID: **entry-media**.

## Goal and owner request

The owner requested a document for the next agent to work on existing changes
plus two pending tasks in one go. This packet interprets the two pending tasks as
**I-02 (live camera capture/compression)** and **I-03 (driver summary,
touchscreen signature/refusal)**, the next two issuance tasks in the checklist.

Deliver one bounded batch in this order:

1. Correct **R1–R5** from the independent F-04 / I-01 / I-05 review.
2. Implement **I-02** against prepared acceptance and agreed E-02.
3. Implement **I-03** against prepared acceptance and agreed E-03.
4. Run combined regression gates, record evidence, and request independent review.

After the readiness checkpoint below is satisfied, execute these implementation
phases continuously without asking permission between successful phases. The
owner's request permits deferring internal F-04/I-01/I-05 dependency review to
the combined batch exit, rather than stopping between corrections and media.
Record this bounded dependency-gate exception in the implementation evidence.
It grants no self-review, acceptance-test ownership exception, or approval of
undecided media rules. All review checkboxes stay unchecked until independent PASS.

## Current checkpoint

- S-01, F-01, F-02 and F-03 are implemented and independently reviewed.
- F-04, I-01 and I-05 exist, but their implementation and review boxes are
  unchecked following **CHANGES_REQUIRED** on 2026-10-07.
- I-02 and I-03 are pending. No prepared executable acceptance packet for them
  was found at this handoff's creation.
- E-02 and E-03 remain **PROPOSED** in `docs/decisions.md`.
- Existing pre-issuance acceptance is revision 2, not revision 3.
- The last reviewer recorded 178 unit, 102 PostgreSQL integration, 25 browser
  and 27 foundation checks passing, with initial tablet JS 147603 B gzip.
  These are historical results, not verification of this batch or today's tree.

This document is an execution brief, **not a frozen test baseline or preparation
PASS**. It changes no implementation/review checkbox and resolves no decision.

## Read first

Read `AGENTS.md`, `docs/development-workflow.md`, the `pilot-tdd` skill and:

- `docs/implementation-plan.md`: F-04, I-01, I-02, I-03, I-05.
- `docs/reviews/F-04-I-01-I-05.md`: all R1–R5, baseline corrections and return.
- `docs/handoffs/pre-issuance-batch.md`, `pre-issuance-prepared.md` and
  `pre-issuance.md`: existing scope, preparation and implementation history.
- `specs/005-pre-issuance/{spec.md,plan.md,tasks.md}`.
- `docs/test-cases.md`: UI-01–03, ENT-01–06, REP-01–05, CAM-01–05, SIG-01–05.
- `docs/decisions.md`, `docs/eChallan_replacement_spec.md` and
  `docs/eChallan_replacement_spec_v0.2.md`.
- `docs/eChallan_PRD.md`: E2.8–E2.15; `docs/eChallan_DESIGN.md`: applicable
  tokens, tablet controls, contrast, typography and accessibility rules.
- `docs/tablet-media.md`: recommended approach, not an approved media contract.

Reinspect the tree before changing it. Preserve unfamiliar work. Historical
unchecked-status prose in older handoffs does not supersede the checklist's
current acceptance summaries. The missing Functional Specification v0.2 is not
the available replacement-specification addendum v0.2; do not conflate them.

## Phase 0 — readiness and preparation checkpoint

The next agent must identify its role and retain it. A planner prepares; a
separate implementer executes the frozen packet. This brief does not authorise
the implementer to write its own acceptance and call it independently prepared.

If the packet is still missing, the next planner should complete the following
in one preparation run, then request the required confirmation. An implementer
receiving this document before readiness must report the specific missing
artifacts/approvals rather than start blocked production work.

1. Verify existing manifests before editing. Investigate mismatches; do not
   regenerate historical hashes to hide changed files.
2. Prepare **one combined R1–R5 correction packet**. Archive the active revision-2
   pre-issuance manifest byte-for-byte as
   `docs/handoffs/pre-issuance-tests-rev2.sha256`, then freeze revision 3 in the
   active manifest. Follow the review's requirement for separate preparation
   confirmation. Fix the documented `{changed}` metadata and stale expected
   counts with a dated correction; preserve historical evidence.
3. Draft a bounded camera/signature feature with spec, plan and tasks, using the
   next available feature number after checking the tree. Keep correction
   traceability in `specs/005-pre-issuance`; record the new feature path here or
   in the prepared packet rather than silently changing feature state.
4. Obtain and record E-02/E-03 agreement before media implementation. Present one
   consolidated proposal: JPEG target versus hard maximum, max dimensions,
   quality/fallback strategy and failure behaviour; signature PNG limits,
   resize policy and precisely which summary/evidence/repeat changes invalidate
   acknowledgement. Distinguish client encoding limits from future server
   enforcement. Do not infer approval from this batch request or choose new
   limits and label them approved. E-01/I-04/I-06 retain their separate gates.
5. Prepare executable CAM/SIG acceptance, synthetic image fixtures and deterministic
   correction regressions. Record exact commands, meaningful RED assertions and
   observed counts. Import/setup failures alone are not behavioural RED.
6. Freeze `docs/handoffs/entry-media-tests.sha256`, including the approved spec,
   decision references, acceptance tests, fixtures/config and preparation record.
   Write `docs/handoffs/entry-media-prepared.md` with the exact file inventory,
   approved scope and focused commands. Record the preparation session reference.
7. Obtain separate preparation confirmation for the correction revision and new
   packet. Record the actual report paths and baseline digests. Only then hand
   this document plus the prepared packet to the implementation session.

**Ready means:** E-02/E-03 agreed, frozen tests/spec available, separate preparation
confirmation recorded, dependencies inspected, required local tools/services
available. This checkpoint may require an owner answer and a separate session;
“one go” applies to the ready implementation batch, not bypassing these gates.

## Phase A — correct the existing entry/UI changes

Use the review's line references as starting points; recheck current source.
Likely touch points are `apps/tablet/src/routes/EntryFlow.tsx`, shared theme
primitives/tokens, and the client catalogue/error handling.

| Finding | Required implementation and acceptance |
|---|---|
| R1: stale lookup | Invalidate every obsolete lookup generation, including below-three-character input, clearing, match selection and route/session exit. Cancel started requests; aborted/late work cannot display stale results or errors. Use manually deferred requests that prove the old request started, not timer-only tests. |
| R2: stale validation/preview | Bind validation and preview to a canonical draft revision. Material edits and registry selection invalidate pending reviews, preview and acknowledgements. Prevent conflicting review actions. Delayed validation **and** delayed preview must not advance an edited draft, overwrite current errors or resurrect old state. Preserve unchanged-draft and Back controls. |
| R3: stale acknowledgement | Compare newly returned occurrence/recommendation/duplicate information even when the draft is unchanged. Material server-preview changes require renewed review and warning acknowledgement. Cover changed occurrence/action and duplicate information, plus an unchanged-preview control. |
| R4: unusable spacing/touch/context | Correct pixel versus MUI spacing-multiplier use consistently. Measure actual usable form width at tablet/narrow widths and 200% zoom. Enforce inputs/options >=56px, icon controls >=56x56px, adjacent gaps >=12px, and eventual commit >=64px. Verify blue card headers, solid labelled severity versus outlined status, readable native controls, visible focus and accurate session-bound location/post/shift context. |
| R5: invisible errors/contracts | Map semantic API errors to the displayed controls, including every applicable Other field. Provide an accessible fallback alert for unmapped/general failures. Parse catalogue responses with shared contracts and expected-kind validation; malformed/wrong-kind responses need explicit recoverable failure. Correct fixtures to the actual reviewed master contract, preserving assertions. |

Run focused correction acceptance and existing ENT/REP/UI regression to GREEN
before adding camera or signature code. Do not repeat old claims that the current
suite already proves cancellation, geometry or changed-preview invalidation.

## Phase B — I-02 live camera capture and compression

Deliver CAM-01–CAM-05 and PRD E2.8–E2.10 under the agreed E-02 contract:

- Live `getUserMedia` video only, rear-camera preference, inline preview, and
  capture enabled only when real frames are ready; no gallery/file picker.
- One through four accepted photos, actual frame thumbnails, review/retake/delete,
  and a blocked fifth capture. Removing the last photo invalidates evidence state.
- Real JPEG resize/re-encoding with agreed dimensions/quality/limits and the
  approximately 300 KB target. Test decoded output/dimensions and representative
  synthetic frames; changing a filename/MIME is not compression.
- Recoverable denied, unanswered, absent/busy camera, insecure-context and encoding
  failures. Cancellation remains available during a pending permission request;
  any stream arriving after cancellation/exit must immediately be stopped.
- Track cleanup and object-URL revocation on close, camera switch, removal,
  route exit and logout; reopen works and stale captures cannot restore data.

Keep media within the active in-memory issuance flow and clear it at session end.
Integrate photo validity with entry/summary navigation using the prepared spec.
Back navigation must preserve still-valid in-flow work. Use lazy loading where
appropriate to preserve the initial tablet bundle budget.

## Phase C — I-03 driver summary, signature and refusal

Deliver SIG-01–SIG-05 and PRD E2.12–E2.15's client-side prerequisites:

- Show the current plain-language driver summary before signature. Include current
  violations, severity, accurate context and repeat/recommendation information.
- Full-width finger/stylus canvas using a pinned compatible `signature_pad`
  dependency; suppress scrolling only on the canvas. Provide accessible, separated
  Clear/Confirm controls and meaningful feedback.
- Blank drawing is invalid; clear invalidates acknowledgement; redraw yields a
  PNG with visible strokes. Verify pixels/content rather than only a boolean or
  mocked export call.
- Handle high DPI, resize and rotation according to approved E-03. Preserve and
  re-render valid strokes or explicitly require re-signing; never keep signed
  state over a blank canvas or allow a stale async export to restore it.
- Provide a no-drawing refusal path requiring nonblank reason, witnessing
  **supervisor** name and staff ID. Reuse shared acknowledgement semantics; the
  existing persisted signed schema's `signatureId` is not a local Blob ID.
  Prepare a separate transient client representation if needed; do not fabricate
  uploaded evidence IDs or weaken the server-facing contract.
- Bind acknowledgement to the approved current summary revision. Material edits,
  registry changes, changed preview information and other E-03-defined changes
  invalidate both signature and refusal state as required. Cover cross-phase
  races after returning from summary/signature to edit the entry form.

The result is a valid local capture/acknowledgement flow ready for subsequent
storage and submission integration. Show an honest terminal state: no simulated
issuance number, persisted-success message or working submit claim.

## Architecture and scope boundaries

Apps import shared contracts/theme, never another app's internals. Keep tablet
controls and media code out of admin bundles; shared-theme changes require admin
regression. Exact-path MUI/icon imports, static labels, self-hosted fonts,
green-fill-only-for-commit and initial JS **under 250000 B gzip** still apply.

I-04 storage/uploads/authorised reads and I-06 atomic submission/numbering/retries
are subsequent tasks. This batch does not add their API routes, migrations,
storage adapters or audit claims. Review/dashboard/export, production auth,
offline persistence and VPS deployment are also outside this bounded run.
Do not request deployment access to complete local camera/signature work.

## Verification and evidence

At implementation start, verify the frozen preparation manifests and run the
prepared focused acceptance to record RED. Preserve test ownership: a suspected
test defect goes back to the planner for a documented correction and confirmation.
Do not change expected results, skip cases or replace database coverage with mocks.

Use focused commands from the approved packet during each phase. At batch exit,
run the verified root commands below in gate order, after starting PostgreSQL
with `pnpm db:up` before integration tests:

```bash
sha256sum -c docs/handoffs/pre-issuance-tests.sha256
sha256sum -c docs/handoffs/entry-media-tests.sha256
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run test:integration
pnpm run test:e2e
pnpm run build
pnpm run check:tablet-size
pnpm run test:foundation
```

The new manifest above is a required preparation output; it does not exist merely
because this command is listed. Also verify applicable older baselines as directed
by the prepared packet; accepted snapshot mismatches from intentional shared-file
changes must be disclosed, not erased by rewriting historical manifests.

Run DB suites against the guarded isolated test DB, sequentially where resets
conflict. Record exact commands, counts and failures; do not copy old counts as
new results. Keep secrets out of logs and handoffs. Resolve new dependency peer/
type compatibility and confirm the tablet budget after adding signature code.

Prove key regressions load-bearing in a disposable copy: stale lookup, stale
validation/preview, changed-warning acknowledgement, geometry/error handling,
photo-limit/cleanup and blank-or-stale signature guards. Revert faults and rerun
clean checks. Never fault-inject into the user's working source.

Browser media mocks or synthetic streams can establish flow, output and cleanup,
not rear-camera selection, real permission behaviour, sunlight readability or
finger/stylus feel. Record actual-device/HTTPS checks separately as performed or
pending. B-03/V-03 device acceptance remains open; report any unverified CAM/SIG
device portions explicitly rather than claiming complete field acceptance.

After three attempts without new evidence/progress, record the precise blocker
and return it. Runtime/service failures and undecided requirements are not PASS.

## Completion and final review handoff

Produce these files (preserve prior evidence; append dated corrections where needed):

- `docs/handoffs/entry-media.md`: phase-by-phase RED/GREEN, files changed,
  decisions, dependency-gate exception, regressions/build/size results, fault
  sensitivity, manual evidence, outstanding device checks and known issues.
- A dated correction section in `docs/handoffs/pre-issuance.md`, linked to the
  combined evidence rather than overwriting the original claims.
- `docs/review-requests/entry-media.md`: request one independent review of
  R1–R5 plus I-02/I-03; list exact manifests, feature paths, changed-file hashes,
  commands, acceptance mapping and unresolved limitations.
- Checklist/feature implementation updates only where verified acceptance allows.
  If a task's required acceptance remains unproven, leave it unchecked and explain
  the pending portion. All review boxes remain unchecked.

Ask a fresh independent session/model to write `docs/reviews/entry-media.md`,
rerun checks and issue PASS / CHANGES_REQUIRED / BLOCKED. Shared-code changes
invalidate affected prior approvals; disclose them for that reviewer. Stop here.
I-04/I-06 and the rest of the backlog require their own preparation and approval.

## Paste into the next agent session

> Follow `docs/handoffs/entry-media-batch.md`. First check Phase 0 readiness and
> state your role. If preparation is missing, act as planner for the combined
> R1–R5 correction plus I-02/I-03 packet, obtain the E-02/E-03 answers, and request
> separate preparation confirmation. Do not invent approval or implement against
> self-authored acceptance. If the frozen packet and confirmation already exist,
> act as implementer: execute correction → camera → summary/signature continuously
> at verified GREEN under this bounded batch authorisation, run combined gates,
> document evidence and request independent review. Preserve existing work and
> historical baselines. Stop at the combined review handoff.
