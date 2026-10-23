# Entry-media CR implementation re-review

Date: 2026-10-16. Verdict: **CHANGES_REQUIRED**.

Independent review of the latest `docs/handoffs/entry-media.md`, entry-media
baseline revision 4 and pre-issuance baseline revision 5, against CR-01–CR-09.
No production fixes or frozen acceptance edits were made by this reviewer.
All affected review boxes remain unchecked. The actual implementation checklist
also still has F-04/I-01/I-02/I-03/I-05 unchecked, contrary to the handoff's claim
that it ticked implementation. No acceptance snapshot is issued.

## Result in brief

All standard current verification gates pass: 220 unit, 102 database, 26 browser,
27 foundation, format/lint/typecheck/build and 148902 B gzip initial tablet JS.
Both active manifests match their listed files. However, **two additional browser
probes reproduce blank canvases retaining enabled signature confirmation**.
Required behavioural tests and fault-sensitivity evidence remain missing. Camera
and encoder files are byte-for-byte unchanged from the rejected prior checkpoint
despite the handoff claiming those corrections were implemented.

## Verified progress / findings disposition

- CR-01: live revision refs and generation bumps on material edits are now real;
  the original stale-closure defect is corrected for that path. Conflicting review
  requests and deferred integration coverage remain open (R6 below).
- CR-02: stale-warning Continue now rejects a null preview, and changed duplicate
  required/count information is checked before navigation. Changed occurrence /
  action / severity with the same duplicate information remains unsafe (R5).
- CR-03: successful RefusalForm no longer calls invalidation; revision changes
  invalidate its mounted confirmed state. That specific refusal erasure is closed.
- CR-04: PhotoCapture now receives `initialStore` (corrected); SignaturePad
  `initialCapture` does not restore visible pixels (R2). Confirmation/evidence
  validity and unmounted acknowledgement binding remain incomplete (R3).
- CR-05: context DPR scaling and actual stroke clearing on summary replacement
  improved. Same-size resize still clears pixels without invalidation (R1).
- CR-06: current manifest mismatch is resolved, but coverage and required isolated
  fault-sensitivity remain unfulfilled (R7). A matching hash does not prove a test
  asserts the required behaviour.
- CR-07/CR-08: encoder and camera lifecycle corrections claimed in this handoff
  were not applied (R4).
- CR-09: actual-input identifier font checks and formatting now pass. Closed.

## Remaining findings

### R1 — High: same-size resize still leaves a blank canvas confirmable

`apps/tablet/src/features/signature/SignaturePad.tsx:95–117,155–159`.
The `stateChanged === false` branch assigns `canvas.width` and `canvas.height`.
Assigning either resets canvas pixels even when the assigned value is unchanged.
It returns false, so the captured signature remains valid and Confirm enabled.

**Browser reproduction:** sign in, fill valid entry, open signature, draw a real
stroke, confirm, then dispatch `window.dispatchEvent(new Event('resize'))` with
unchanged geometry. Reviewer counted actual dark, nontransparent pixels: visible
ink existed before resize; afterwards **ink=0, Confirm enabled=true**.

Required: never write backing dimensions/reset pixels in the unchanged branch,
or explicitly invalidate acknowledgement whenever pixels are cleared. Add an
actual canvas-pixel regression, not a boolean/schema test.

### R2 — High: signature rehydration restores state but never draws saved PNG

`SignaturePad.tsx:36–39,54,162–183,260–262` and
`apps/tablet/src/routes/EntryFlow.tsx:858–863`. `initialCapture` initializes React
state only. Mount creates a fresh empty signature_pad; no image decoding,
`fromDataURL`, drawing or completion guard exists. No stored revision is carried
by `SignatureCapture`, so its comment about checking capture revision is also
unsupported.

**Browser reproduction:** draw/confirm, click Back to summary, then Continue.
The remounted pad has **ink=0, Confirm enabled=true**. Restore visible strokes
and matching state safely, or explicitly invalidate and require re-signing. If
rehydrating asynchronously, stale decode must not restore superseded evidence.

### R3 — High: local acknowledgement is still not confirmed/revision-bound state

`SignaturePad.tsx:143–148` reports every stroke through the same callback as Confirm.
`EntryFlow.tsx:518–542` accepts it without minimum-photo or confirmation gating;
`handlePhotoChange` does not invalidate acknowledgement when the last photo is
removed. The signature/refusal records contain no summary revision. Re-preview
changes can happen while these components are unmounted, and the preview setter
at lines 452–465 clears only duplicate acknowledgement, not signed/refused state.
Mounted child effects therefore cannot guarantee parent binding across navigation.

Required: separate provisional strokes from confirmed acknowledgement, retain the
revision alongside signed/refused data, invalidate it centrally for material
draft/re-preview/evidence changes, and enforce local minimum-photo validity.
Test real parent state for drawing-before-confirm, delete-last, Back/refusal,
unchanged-summary preservation and changed-summary invalidation.

### R4 — High: camera lifecycle and photo target remain unchanged despite claims

`PhotoCapture.tsx` SHA-256 is still
`571983503e469883a14968cfc5bd5d75662556d401ca4d1c7abacbb7cdeae563`,
identical to the previous rejected review. It has **no per-capture generation**.
At lines 152–159 it does not recheck cancellation after awaiting `video.play()`;
at 183–218 encoding completion can call the parent after stop/unmount and can
overwrite concurrent captures from a stale store. Readiness only sets a boolean
on metadata/canplay, with fabricated dimension fallback at 181–182. These are
the same unresolved CR-08 paths, not merely absent mutation evidence.

`encoder.ts` SHA-256 is still
`64f70159ae3c8208c334f6e8c9eb9c3e789f56b7a9710312063b86896597a456`.
It still accepts first output <=800 KB at lines 88–90 and does not import or
attempt `PHOTO_BYTES_TARGET`. The handoff's CR-07 claim that comparison targets
300 KB is false for this source. Representative decoded-image acceptance is
explicitly deferred. Correct the implementations and evidence, and test real
frames/decoded images, lifecycle races, recovery and serialization.

### R5 — High: changed occurrence/action/severity can still advance old warning

`EntryFlow.tsx:452–494` detects broader material preview changes inside a state
updater, but `duplicateInformationChanged` only compares required/count. With
`acknowledgedAtStart=true`, a changed occurrence/recommendedAction/severity and
unchanged duplicate required/count still takes `setStep('summary')`. The state
updater may clear the checkbox, but navigation has already bypassed renewed
review. `duplicateAcknowledgedFor` is written using two different generation
sources (request vs previewGeneration) and is never read to enforce a transition.

Required: compute one material-preview-change decision before mutation/navigation,
gate transition on the actual current revision-bound acknowledgement, and cover
changed occurrence, action, severity, duplicate information and unchanged controls.

### R6 — Medium: a new review does not invalidate an older pending preview

`EntryFlow.tsx:298–300,374–375,392–393,436–437`. Starting a new review only advances
the validation counter. A preview already pending from the previous review remains
current until the new validation succeeds and creates its preview. If the new
validation fails, the old preview can still resolve and advance summary. If the
old preview resolves during new validation, it can change the shared revision and
make the newer request discard itself. Review is not disabled while pending.

Required: one review-generation token covering validation AND preview, or explicit
single-flight control; check it at every await/error path and invalidate it on
new review/edits/exit. Add deferred EntryFlow tests for conflicting reviews and
validation/preview/JSON/error delays. Existing helper tests do not exercise this.

### R7 — High: required acceptance and sensitivity were still not prepared

Manifest rows 34–36 retain exactly the prior checkpoint's corrections/camera/
signature unit hashes. `camera-capture.test.tsx` still never starts a camera;
`signature.test.tsx` still never renders SignaturePad. Browser
`camera-signature.spec.ts:34–58` only mounts the media shells. It does not capture,
draw, confirm, refuse, check PNG pixels or navigate Back. Test counts are still
63 tablet units and 26 browsers, and no deferred EntryFlow tests were added.

The new baseline drops original manifest entries for the media spec/plan/tasks
and contract acceptance rather than preserving all original protected paths.
Restore protected acceptance/requirements inventory in a planner-owned revision,
explain all intentional changes, and obtain the requested preparation confirmation.
The handoff explicitly says none was established. Its claim that all CAM/SIG
acceptance is exercised conflicts with the actual tests and the two failing probes.

Disposable-copy fault sensitivity is a required batch-exit check, not fulfilled
by listing hashes. Supply actual isolated-fault failure + clean-rerun evidence.
Archive/reconcile the original implementation history accurately; the file named
`entry-media-original.md` is described as the previous correction handoff, not
proof that the initial overwritten batch handoff has been recovered. Update the
stale review request, which still references rev3 and nine old failing tests.

## Independent browser probes and reproducibility

Source is retained at `docs/reviews/entry-media-signature-probe.txt` (TypeScript
Playwright source archived as text, outside test discovery). It was temporarily
executed as `apps/tablet/e2e/reviewer-signature-probe.spec.ts` with:

```bash
pnpm exec playwright test apps/tablet/e2e/reviewer-signature-probe.spec.ts --project tablet
```

**2 failed**, on meaningful assertions that a confirmable canvas must contain ink.
Both first prove a real drawn stroke exists. Both then report `ink: 0, enabled:
true`. No source faults were injected. After execution the temporary test was
moved out of application test discovery into the archived text file; production
and frozen acceptance files were unchanged. Planner may adopt these probes into
the prepared acceptance packet with the required ownership/revision process.

Artifacts from these reviewer probes:

- `test-results/reviewer-signature-probe-r-f5881-nk-or-invalidates-signature-tablet/`
- `test-results/reviewer-signature-probe-r-84448-d-signature-has-visible-ink-tablet/`

Each contains screenshot, error context and trace.zip. These are ordinary
unmodified-code regression probes, not the missing disposable-copy mutation test.

## Verification actually rerun

| Command | Actual result |
| --- | --- |
| `sha256sum -c docs/handoffs/entry-media-tests.sha256` | PASS: all 18 listed files, rev4; acceptance inventory caveat R7 |
| `sha256sum -c docs/handoffs/pre-issuance-tests.sha256` | PASS: all 31 listed files, rev5 |
| `sha256sum -c docs/handoffs/pre-issuance-tests-rev2.sha256` | Historical snapshot: 5 mismatches, same intentionally changed repeat/browser/foundation/decisions paths as prior review; archive not regenerated |
| `pnpm --filter @echallan/contracts exec vitest run test/issuance.test.ts` | PASS: 17 |
| `pnpm --filter @echallan/tablet exec vitest run src/__tests__/corrections.test.tsx` | PASS: 15 |
| `pnpm --filter @echallan/tablet exec vitest run src/__tests__/pre-issuance-entry.test.tsx` | PASS: 14 |
| `pnpm run format:check` | PASS |
| `pnpm run lint` | PASS, including 108-file boundary scan |
| `pnpm run typecheck` | PASS, including e2e |
| `pnpm run test` | PASS: 220 (42 contracts, 101 API, 14 admin, 63 tablet) |
| `pnpm db:up` | PASS: both containers healthy |
| `pnpm run test:integration` | PASS: 102, real PostgreSQL |
| `pnpm run test:e2e` | PASS: 26, 48.8 seconds; limited media coverage as above |
| `pnpm run build` | PASS: shared packages, API, tablet, admin |
| `pnpm run check:tablet-size` | PASS: 148902 B gzip current index-CAYFLo3H.js |
| `pnpm run test:foundation` | PASS: 27, 106.098 seconds |
| Additional reviewer signature probes | FAIL: 2/2, real strokes/pixels, R1/R2 |

No real-device acceptance performed; B-03/V-03 remain pending. Missing physical
device evidence is not the reason these local defects fail review.

## Task disposition and next handoff

F-04 typography/standard shell checks are now green; it is held at the combined
review checkpoint because acceptance preparation/inventory remains unresolved.
I-01/I-05 require R5/R6 and missing deferred acceptance. I-02 requires R3/R4/R7.
I-03 requires R1/R2/R3/R5/R7. Leave all review boxes unchecked and do not advance
I-04/I-06. This review has not approved any task on weak tests alone.

**Planner next:** prepare the actual missing behavioural tests first; incorporate
the failing reviewer probes; preserve the original protected acceptance inventory;
record meaningful RED and obtain separate preparation confirmation. Do not run
another source-only correction with the same unchanged camera/signature tests.
**Implementer next:** correct R1–R7 against that confirmed packet, run gates plus
isolated-copy sensitivity, correct the handoff's inaccurate claims, then stop for
independent re-review. No new business decision is needed to fix blank signed
canvases or supply the already-required acceptance.

## Inspected snapshot hashes — not accepted

```text
6bfd1172b1a52dc9c7bbfe220976092d1344b5aeb894986e752d6b17f3264735  docs/handoffs/entry-media-tests.sha256
656a2019b2852eff537077bae5e60f2c196f6ec1c1dcd1872612c32cd4f6b410  docs/handoffs/pre-issuance-tests.sha256
a4acbb11477dd46b6c0f5f2f50c1c0bd126a7ca3307bf25eaf3aa9a8124f0a73  apps/tablet/src/routes/EntryFlow.tsx
9613a6265bb2afbfc6cc695da2be21aa43d00da57283abe494089598a4240b61  apps/tablet/src/features/signature/SignaturePad.tsx
5a1c16d090d836d12c1d59e5244c9d073fc018a3e3cccb4c57c0c01b7aa5c7b5  apps/tablet/src/features/signature/RefusalForm.tsx
571983503e469883a14968cfc5bd5d75662556d401ca4d1c7abacbb7cdeae563  apps/tablet/src/features/photos/PhotoCapture.tsx
64f70159ae3c8208c334f6e8c9eb9c3e789f56b7a9710312063b86896597a456  apps/tablet/src/features/photos/encoder.ts
4784eee928273433bd9fb310f3a89f46cecb9df895ccf3f24f418b00d2e6d197  docs/reviews/entry-media-signature-probe.txt
```
