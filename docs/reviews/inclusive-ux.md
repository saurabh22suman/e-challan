# Inclusive UX revamp: independent implementation review

Date: 2026-10-19 (browser artifacts use UTC 2026-10-18).

**Verdict: CHANGES_REQUIRED.**

Scope: `docs/review-requests/inclusive-ux.md`, owner-authorised UX-01–UX-08
batch, including the C1/C2 corrections and overlapping owner-UI revision.
Reviewer did not implement the production changes or the batch acceptance. This
conversation previously authored the UX proposal; this review independently
inspected the other agent's implementation and executed its own browser probes.
No application source, contracts or frozen acceptance were modified in review.

The standard gates reproduce the implementer's green results. They do not prove
the batch's acceptance: independent browser probes find a stuck primary action,
contradictory signature state, disappearing errors and additional recovery defects.
No combined approval or accepted-source snapshot is issued.

## 1. Baseline and acceptance integrity

- `sha256sum -c docs/handoffs/inclusive-ux-tests.sha256`: **32/32 OK**.
- The manifest itself has SHA-256
  `6252b7284850f2c4cb14c3dc759bb4f82c36f86b32cc68ad5c29c5b3bdd3abe6`.
- Read the batch/preparation/implementation records, UX-00 readiness, feature
  spec/tasks, C1/C2 preparation and tests, preceding independent review, and the
  recorded 2026-10-18 owner batch authorisation.
- Read current tests carrying the renamed actions, sign-in selectors and shell
  markers. Their current assertions exercise meaningful behaviour. Copy/selector
  changes are consistent with the documented intent; the exported 2000-character
  limit and theme DOM lib are disclosed, not an observed domain-policy change.
- There is no Git history in this workspace and the older manifests are hashes,
  not recoverable copies of the old test bytes. This review does not certify a
  byte-for-byte historical diff or assert that every old change was only a label.
  Keep historical manifests and obtain archived originals/diffs if exact historical
  equivalence is required. Do not regenerate the old manifests.
- **Baseline confirmation is withheld for overall acceptance.** In particular,
  new UXA-04, UXA-09 and UXA-23/27 acceptance misses behaviours their names/records
  claim to prove. See the planner corrections below. No test needs weakening.

Snapshot of inspected production/configuration files and the active acceptance
manifest: `docs/reviews/inclusive-ux-inspected.sha256`. This is an inspected,
rejected baseline, not an accepted one.

## 2. Findings returned to implementer

### R1 — High: editing during Check details permanently disables the next action

Files: `apps/tablet/src/routes/EntryFlow.tsx:216–236,437–457,669–670,1022–1033`.

`materialChange` advances `reviewRequestRef` but does not reset `reviewing`.
The superseded request's `finally` resets `reviewing` only if its old request
identity is still current. The form remains editable during the request, so an
ordinary correction leaves Check details disabled indefinitely.

**Independent browser reproduction:** fill a valid draft; hold the real
`/api/challans/validate` response using `route.fetch()` and a promise; activate
Check details; change Driver name; release the response and await its completion.

Observed after completion:

```json
{
  "buttonText": "Checking details…",
  "buttonDisabled": true,
  "stillOnEntry": true,
  "value": "Kavita edited while checking"
}
```

This prevents finishing the entry without reloading and losing work. The stale
response is correctly rejected; the missing piece is recovery to a fresh review.

**Required correction:** derive/reset pending state consistently when a review is
superseded. Preserve stale-response guards and ensure an older completion cannot
clear the pending state of a newer request. Cover held validation and held preview,
successful/error settlements, and an edit followed by a fresh successful Check.

### R2 — High: confirmed signature UI diverges from authoritative parent state

Files: `apps/tablet/src/features/signature/SignaturePad.tsx:62–68,265–309,368–440`;
`apps/tablet/src/routes/EntryFlow.tsx:719–725,1083–1086,1122–1127`.

There are two independently reproduced directions of mismatch:

1. Confirm signature → Back to summary → Continue to photos without editing.
   Summary reports Driver signature captured. After hydration, the pad reports
   “Stroke captured — confirm to apply”, lacks the confirmed badge and enables
   Confirm again. `confirmedLocal` starts false and successful hydration does not
   restore confirmed presentation.
2. Capture one synthetic photo, confirm signature, then Retake the only photo.
   The parent clears the acknowledged signature as intended. The mounted pad
   keeps “Signature confirmed”, its local success message and a disabled Confirm.
   Returning to summary shows no captured signature. The `initialCapture=null`
   effect returns without reconciling that invalidation in the child's UI.

Observed for the second path:

```json
{
  "after": {
    "confirmedBadge": 1,
    "localSuccess": 1,
    "confirmDisabled": true,
    "photos": 0
  },
  "parentCapturedOnSummary": 0
}
```

The operator is told confirmation exists after the actual acknowledgement has
been removed, or is asked to repeat an already confirmed action.

**Required correction:** establish coherent provisional/confirmed/invalidated
presentation against the parent's acknowledgement and actual rendered capture.
Handle both restoration and external invalidation explicitly; do not simply mark
all decoded/provisional strokes confirmed. Keep C2 start-of-drawing invalidation,
generation guards, multi-stroke pixels and canonical-summary binding intact.

### R3 — High: correction erases unrelated errors; one summary link cannot focus

Files: `apps/tablet/src/routes/EntryFlow.tsx:113–130,216–219,390–405,965–990`;
`apps/tablet/e2e/inclusive-ux.spec.ts:128–159`.

**Independent reproduction:** submit the empty form, observe six summary links,
then type only Driver name without submitting again. All six summary entries
disappear; the still-empty Gate pass field reports `aria-invalid="false"`.
`materialChange` still calls `setErrors({})`, contrary to UXA-04 and the delivery
claim that other errors survive a fix.

The new UXA-04 test checks only after activating Check details again. That action
recalculates errors and masks the actual edit-time failure.

**Additional reproduced recovery defect:** the “Select at least one violation”
summary link targets `#violations-group`, a DIV without tabindex. Its `.focus()`
does nothing; after activation the link itself remains `document.activeElement`.
The checkboxes have no association with their error description. The summary's
error field map/order also omits `contractorId`, although server error mapping and
the contractor field support it.

**Required correction:** retain unresolved errors until their field is corrected
or deliberately revalidated; give all actionable fields summary coverage. Focus
the first checkbox or a properly focusable/labelled group and associate its error.
Add assertions immediately after one edit, before a second Check; test each link,
not just Department.

### R4 — Medium: Escape cannot dismiss search results after three typed characters

File: `apps/tablet/src/features/issuance/VehiclePicker.tsx:89–99,139–143`.

The close handler sets `open=false`, but `autoShow` remains true while the focused
input has a three-character search. `panelVisible = open || autoShow` keeps the
panel open. Chevron dismissal has the same state conflict.

**Independent reproduction:** focus Vehicle registration, type `GJ0`, await
results, press Escape. Panel count remains 1 and `aria-expanded` remains `true`.
The supplied keyboard test covers Escape after opening an empty/list query only.

**Required correction:** represent explicit dismissal for the current query and
allow deliberate reopen/new input. Verify list, search, loading/error/no-result
states; keep focus on the input and remove stale active-descendant references.
Also add actual ArrowUp assertions: the test title promises them but uses only
ArrowDown, Enter and Escape.

### R5 — Medium: summary reintroduces the false “not in registry” claim

File: `apps/tablet/src/routes/EntryFlow.tsx:1070–1074`.

Manual-entry wording on the first screen is improved, but the summary still
renders `New vehicle (not in registry)` whenever `vehicleMode === 'new'`.

**Independent reproduction:** select existing `GJ05JP6207` from the real registry,
switch to manual mode with values carried, choose a violation and Check details.
The same registered plate appears beside “New vehicle (not in registry).”

**Required correction:** use truthful mode/scope wording across the full journey,
such as Manual entry. Extend UXA-12 beyond the initial form. Also avoid calling
the prospective occurrence a generated “challan number” in the repeat notice;
the build has no issued server number yet.

### R6 — Medium: signature accessibility/control-separation requirements remain unmet

File: `apps/tablet/src/features/signature/SignaturePad.tsx:374–435`.

The canvas still has no accessible name or programmatically associated signing
instruction (browser `aria-label` is null; source has no alternative naming
relationship). Clear signature and Confirm signature remain adjacent actions in
one row on wider layouts. The revamp plan and existing design explicitly require
separation of Clear and Confirm; minimum inter-control spacing alone is not that
separation.

**Required correction:** name/describe the drawing surface, provide an appropriate
labelled region and reachable controls, and move destructive clearing away from
routine confirmation. Preserve the truthful witnessed-refusal rule; do not turn
refusal into consent for someone unable to draw. Verify actual focus order,
instructions and geometry, including gloved-hand device checks when available.

### R7 — Medium: dashboard sign-in states the wrong inactivity policy

Files: `apps/admin/src/routes/LoginScreen.tsx:124–126`;
`packages/contracts/src/auth.ts:155–165`.

Visible admin/supervisor help says sessions end after 10 minutes without activity.
The approved addendum and runtime role policy use 3600 seconds (60 minutes) for
both desktop roles; 600 seconds is the marshal policy.

**Required correction:** show truthful surface-specific wording based on the
approved role policy, or omit the duration. Do not change server expiry to match
the mistaken copy. Add a copy/policy consistency assertion for both surfaces.

## 3. Items returned to planner / acceptance author

The returned behaviours need stronger tests before production corrections:

| Existing acceptance | Missing positive/negative control |
| --- | --- |
| UXA-04, inclusive spec lines 128–159 | Assert unrelated inline/summary errors immediately after a single field edit; every link must focus its actual control; include contractor server error. |
| Deferred response spec lines 42–107 | Besides no stale advance, assert pending finishes and a valid edited draft can be checked successfully. Replace the fixed 700ms negative window with held-response completion synchronisation. |
| UXA-09, inclusive spec lines 161–185 | Dismiss searched results, reopen after dismissal, actual ArrowUp, and active-descendant validity during loading/result replacement. |
| UXA-12, inclusive spec lines 207–228 | Check summary and subsequent screens for the carried registered plate; no false registry absence claim. |
| UXA-23/27, inclusive spec lines 242–259 | Restore a confirmed signature without mutation and invalidate UI after deleting last photo. Check parent and child together. |
| UXA-25, inclusive spec lines 262–286 | Include limits as well as blank fields; map a too-long reason to a length correction, not “Enter why” while text already exists. |
| UXA-29 and UI-01 | Name/describe signature canvas, ensure violation error association and separate destructive controls. |
| UXA-06/28 | Assert truthful dashboard session wording against the role policy. |

The unit `signature-invalidation.test.tsx:208` currently explicitly expects a
restored confirmed capture to have Confirm enabled. That pins the R2 inconsistency
introduced by the UX state model. Planner must revise this presentation assertion
while preserving the test's actual purpose: drawing after restoration immediately
invalidates parent acknowledgement and stale image decode cannot win.

The feature spec's acceptance section lists `inclusive-ux-*.test.tsx` component
files that do not exist in this delivered packet. Reconcile it with the actual
browser/C1/C2 acceptance inventory; do not count proposed files as executed tests.

Test revisions require a documented planner correction/new manifest and reviewer
confirmation. Preserve old manifests and current tests until that revision exists.

## 4. Checks actually rerun

All commands below executed on the inspected workspace, without production edits.

| Command | Result |
| --- | --- |
| `sha256sum -c docs/handoffs/inclusive-ux-tests.sha256` | PASS, 32/32 entries |
| `pnpm run format:check` | PASS |
| `pnpm run lint` | Exit 0, 118-file boundary pass, one pre-existing unused eslint-disable warning at SignaturePad.tsx:247 |
| `pnpm run typecheck` | PASS, all workspaces and e2e |
| `pnpm run test` | PASS, 231 total: 42 contracts, 101 API, 14 admin, 74 tablet |
| `pnpm db:up` | PASS, demo and test containers healthy |
| `pnpm run test:integration` | PASS, 103 real-PostgreSQL tests |
| `pnpm run test:e2e` | PASS, 52 browser cases, about 1.3 minutes |
| `pnpm run build` | PASS, shared packages, API, tablet, admin |
| `pnpm run check:tablet-size` | PASS, 153002 B gzip, 2 initial assets, <250000 B |
| `pnpm run test:foundation` | PASS, 27 in one run, 120.920 seconds |

The combined unit run includes the two C1 acquired-camera tests and three C2
invalidation/hydration tests. Browser run includes C2a/C2b, restored PNG ink,
changed-preview binding, actual encoder/decode, auth scope and deferred responses.

The original narrow C1/C2 fixes are present and their regression cases pass:
Cancel shares immediate stop/detach, and drawing invalidates parent confirmation
and hydration generations. This is verified progress, not a combined approval of
the wider signature implementation with R2/R6 still outstanding.

The implementer's disposable-copy fault script and log were inspected, not rerun.
Independent browser probes above establish additional concrete failures without
mutating production code. Existing tests were not changed to create these results.

## 5. Live browser coverage and limits

Playwright MCP used the live local app and real API/DB with synthetic fixture
accounts. Probes covered:

- Empty validation, field correction, summary-link focus.
- Scoped vehicle selection, manual switch, full summary.
- Keyboard dismissal after a real searched query.
- Held real validation response with a material edit and completed response.
- Draw/confirm/back/restore, and last-photo removal after confirmation.
- 390px entry, summary, signature and refusal: no horizontal document overflow
  on the inspected paths. The supplied suite also reran 768/1024/1280 entry widths.
- Dashboard sign-in copy and supervisor workspace: single h1, real session role,
  no horizontal overflow at 390px on the inspected workspace.

Photo-success probing injected a clearly labelled synthetic canvas stream into
this review browser only. No real driver data, physical-camera, gloved-hand,
screen-reader session, 200% browser zoom or representative-user acceptance is
claimed. Device and language decisions remain pending as disclosed, not new
reasons for rejecting this automated scope. No services were started solely for
visual review; existing dev servers remain running.

Screenshots:

- `.playwright-mcp/review-inclusive-ux-stuck-check.png`
- `.playwright-mcp/review-inclusive-ux-errors-390.png`

Browser results central to this rejection are tabulated above so missing temporary
screenshots do not remove the reproduction instructions.

## 6. Disposition

- Return R1–R7 production corrections to the implementer after the planner prepares
  the missing/incorrect acceptance. Existing code improvements are retained.
- Return acceptance gaps and baseline-revision confirmation to the planner.
- Return UX-01, UX-02, UX-03, UX-04, UX-06 and the automated UX-08 completion to
  unchecked in `specs/007-inclusive-ux/tasks.md`; the claimed completion does not
  prove their acceptance. UX-05/UX-07 implementation boxes remain as existing
  implementation claims, not independent approval.
- Combined review remains unchecked. Existing F-04/I-01/I-02/I-03/I-05 canonical
  boxes remain unchecked; no release or hardware gate advances.
- Re-review the corrected baseline with hashes, focused RED/GREEN evidence and
  affected regression results. Do not introduce mascot integration into this
  correction until the owner schedules it; it cannot repair state/validation bugs.
