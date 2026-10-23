# Inclusive UX R1–R7: independent correction re-review

Date: 2026-10-19 (Playwright artifacts use UTC 2026-10-18).

**Verdict: PASS for the corrected, browser-verifiable inclusive-UX batch.**

All R1–R7 findings from `docs/reviews/inclusive-ux.md` are closed on the recorded
baseline. No new blocking finding was observed in this re-review. This report
supersedes that report's rejection for the current corrected scope, while
preserving the earlier record and its rejected-source hashes.

Scope: `docs/review-requests/inclusive-ux-corrections.md`, revision-2 acceptance,
the previously inspected batch and overlapping C1/C2 correction. Reviewer did not
implement the production corrections or author their acceptance. This conversation
authored the earlier proposal and reviewed the prior rejection; verification here
independently reran the other agent's corrected code. No application source or
frozen acceptance was changed during review.

This is **not** representative-user, physical-device, deployment or complete
issuance acceptance. The current build still stops at local capture. Optional
inactivity warning and unresolved language/device/help decisions remain disclosed.

## 1. Baseline and test revision confirmation

- Active `docs/handoffs/inclusive-ux-tests.sha256`: **35/35 entries OK**.
- Active manifest SHA-256:
  `595b6a2a73cb0dcc0276ce12e05685e65b5b7d21da68e61e77f60c195bcbf0e1`.
- Archived `inclusive-ux-tests-rev1.sha256` SHA-256:
  `6252b7284850f2c4cb14c3dc759bb4f82c36f86b32cc68ad5c29c5b3bdd3abe6`.
  This exactly matches the manifest hash independently recorded in the first
  review. The archive was preserved rather than rewriting history.
- Read both correction preparation and implementation records, the new review
  request, actual source changes, revised browser cases, restored-capture unit
  assertion and reconciled feature acceptance inventory.
- Confirm the documented R2 expectation revision: a restored parent-acknowledged
  image is confirmed after successful decode, not a new stroke awaiting Confirm.
  The unit case still requires a new stroke to invalidate the parent. C2 delayed
  decode, stable pad lifetime and multi-stroke assertions remain intact.
- Confirm the R5 chip revision from a false registry-absence statement to Manual
  entry. Registry provenance, required gate pass and one-off/manual semantics
  remain covered; the truthfulness change does not weaken those guarantees.
- Revised UXA-04 tests now check errors immediately after one edit and focus all
  six initial targets. Contractor server-error coverage is added. UXA-09 now
  asserts ArrowUp and searched-panel Escape rather than just list-mode dismissal.
- R1 tests replace fixed 700ms waits with held-request and observable recovery
  assertions. They require a fresh successful check and reject stale completion.
  An additional independent probe covers older completion while a newer request
  is still pending, not merely after the newer request has finished.
- Refusal length tests and canvas/control-geometry assertions add meaningful
  coverage. Non-existent component-test inventory was withdrawn in the feature
  spec. No skipped-test or relaxed business-boundary workaround was needed.

**Revision 2 is confirmed for this reviewed baseline.** Approval concerns the
present inspected content and documented acceptance intent; it does not claim a
reconstructed byte-for-byte diff of earlier pre-revamp files absent from this
non-Git workspace. The prior review's historical-comparison limitation remains.

## 2. Finding closure

| Finding | Source and acceptance inspected | Independent result |
| --- | --- | --- |
| R1: stuck Check details | `EntryFlow.tsx` materialChange and identity-guarded finally; four deferred-response cases | CLOSED. Edit releases the old pending state; fresh Check succeeds. Older response cannot clear a newer pending request. |
| R2: parent/child signature mismatch | `SignaturePad.tsx` parent restoration/retraction effect; restored-capture unit case; new fake-camera media spec | CLOSED. Restored confirmed capture remains confirmed. Last-photo retraction removes chip/success, clears pixels and parent acknowledgement, disables Confirm and explains re-signing. |
| R3: disappearing errors and failed focus | `EntryFlow.tsx` computeClientErrors, retained field errors, contractor targets, focusable described violations group; revised UXA-04 | CLOSED. One corrected field removes only its error; untouched invalid fields remain flagged. Violations link now focuses the group; server contractor error is mapped and focused. |
| R4: searched picker cannot dismiss | `VehiclePicker.tsx` per-query explicit dismissal, reopening and valid active-descendant; revised UXA-09 | CLOSED. Escape/chevron close real searched results, active reference disappears, deliberate reopen and ArrowUp work. |
| R5: false registry-absence claim | `EntryFlow.tsx` Manual entry summary chip and occurrence wording; revised summary journey | CLOSED. A selected registered plate carried into manual mode is not called absent from the registry. Prospective occurrence is not a generated challan number. |
| R6: canvas semantics and destructive separation | Named/described canvas in Driver signature group, separate Clear divider row; UXA-23/29 geometry | CLOSED for code/browser scope. Canvas has the expected name/description; Clear is vertically separated from Confirm. Actual gloves/stylus checks remain device work. |
| R7: wrong dashboard timeout copy | Both login pages use IDLE_TIMEOUT_SECONDS; tablet/admin policy assertions | CLOSED. Marshal states 10 minutes, dashboard 60; server role policy is unchanged. |

The earlier narrow C1/C2 corrections remain verified: immediate acquired-stream
cancel teardown, start-of-drawing confirmation invalidation, late hydration
rejection and restored multi-stroke PNG coverage all pass in the rerun suites.
This report closes those findings within the reviewed UX/media scope, without
automatically completing the wider canonical I-series tasks.

## 3. Additional live Playwright probes

Used the real running local API/database and synthetic accounts in a dedicated
review browser. No production mutation or test edits were needed.

### R1: overlapping real validation responses

Held two real `/api/challans/validate` responses with `route.fetch()` and explicit
handler-ready gates. Started request A, edited Driver name, started request B,
released A while B was still held, then released B.

Observed:

```json
{
  "afterEdit": true,
  "olderCannotClearNewPending": true,
  "text": "Checking details…"
}
```

The final summary contained `Kavita edited`, the newer value, and did not require
reloading. This directly checks the request-order boundary missing from the first
delivery, rather than inferring correctness from the passing standard suite.

### R3/R4: edit-time recovery and keyboard dismissal

- Empty Check yielded six errors. Filling only Driver name left five errors,
  including Gate pass and Violations. Gate pass retained `aria-invalid=true`.
- The violation link focused `violations-group`, whose description is
  `violations-error`.
- After a real `GJ0` search, Escape left zero panels, `aria-expanded=false` and
  no active-descendant. ArrowDown deliberately reopened it. Down/Down/Up returned
  to the first active option. Chevron also closed the searched panel.

### R2/R5/R6: carried registry values and acknowledgement consistency

- Selected real synthetic registry vehicle `GJ05JP6207`, switched to manual,
  checked details: one Manual entry chip and zero registry-absence claims.
- Drew and confirmed a synthetic stroke, returned to summary and back: parent
  remained acknowledged; pad showed Signature confirmed, no provisional badge,
  and disabled Confirm.
- Canvas name: Signature drawing area. Description: signature-instructions.
  Measured Clear top was 25px below Confirm bottom on the inspected wide layout.
- Injected a labelled synthetic canvas stream into the review browser, captured
  one photo, stopped camera, then removed that last photo. Observed:

```json
{
  "confirmedBadge": 0,
  "successNotice": 0,
  "confirmDisabled": true,
  "notice": true,
  "canvasInk": 0,
  "parentCaptured": 0
}
```

The explanatory evidence-photos-changed notice was present. Photo probing is
application-flow evidence, not physical-camera acceptance.

### R7: dashboard wording

Live dashboard sign-in displayed:

> Supervisor and admin accounts only. Sessions end after 60 minutes without activity.

The page had one h1. Tablet wording and the rest of sign-in behaviour also passed
the independently rerun browser acceptance.

## 4. Commands actually rerun

| Command | Result |
| --- | --- |
| `sha256sum -c docs/handoffs/inclusive-ux-tests.sha256` | PASS, 35/35 |
| `sha256sum docs/handoffs/inclusive-ux-tests-rev1.sha256` | Matches prior review's recorded rev-1 hash |
| `pnpm run format:check` | PASS |
| `pnpm run lint` | Exit 0, 119-file boundary pass; one pre-existing unused eslint-disable warning at SignaturePad.tsx:248 |
| `pnpm run typecheck` | PASS, packages/apps/e2e |
| `pnpm run test` | PASS, 231: 42 contracts, 101 API, 14 admin, 74 tablet |
| `pnpm db:up` | PASS, both PostgreSQL containers healthy |
| `pnpm run test:integration` | PASS, 103 real-PostgreSQL tests |
| `pnpm run test:e2e` | PASS, 56 browser cases, about 1.5 minutes |
| `pnpm run build` | PASS, shared packages, API and both clients |
| `pnpm run check:tablet-size` | PASS, 153070 B gzip across 2 initial assets, <250000 B |
| `pnpm run test:foundation` | PASS, 27 in one run, 112.218 seconds |

The test run includes C1/C2, actual browser encode/decode and PNG ink probes,
repeat/changed-preview binding, auth/location scope and all corrected UX cases.
No new independent fault mutation run was performed; disclosed pre-correction RED
and the earlier disposable-copy record remain supporting evidence, and were not
misreported as new reviewer executions.

Accepted production/configuration hashes and active/archived manifest hashes:
`docs/reviews/inclusive-ux-accepted.sha256`. The active acceptance manifest in turn
pins the exact accepted tests/specs and preparation/evidence packet. Later edits
to any accepted source or acceptance invalidate this scoped review as applicable.

## 5. Disposition and remaining work

- **PASS** for the corrected inclusive UX implementation and its browser-verifiable
  acceptance. Restore UX-01–UX-07 and automated UX-08 completion and tick the
  scoped independent combined-review box in `specs/007-inclusive-ux/tasks.md`.
- Keep a separate unchecked line for UX-08 representative-user/device work.
  No user-comprehension, real rear-camera, gloves/stylus, field glare, actual
  screen-reader session or hardware rotation acceptance is supplied here.
- Canonical F-04/I-01/I-02/I-03/I-05 and all release/operations checkboxes are not
  automatically advanced by this correction review. Their broader scope and
  phase-exit evidence remain subject to the cross-feature workflow.
- Preserve the original CHANGES_REQUIRED report and rejected inspected hashes.
  This new report is the disposition for the corrected snapshot.
- Mascot integration was not implemented or accepted here. It can now be planned
  against this reviewed UX baseline as a separate bounded change, retaining clear
  messages, honest local/server status and performance/accessibility gates.
