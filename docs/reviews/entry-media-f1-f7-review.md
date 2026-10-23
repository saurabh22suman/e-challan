# Entry-media F1–F7 correction re-review

Date: 2026-10-16. Verdict: **CHANGES_REQUIRED**.

Scope: latest `docs/handoffs/entry-media.md`, entry-media rev6/pre-issuance rev5,
and unresolved findings in `entry-media-r1-r7-review.md`. Independent reviewer;
no production fixes or frozen test edits made. No accepted snapshot or review
checkbox approval. Task implementation/review gates remain unchecked.

## Progress verified

- Stable pad initialization closes the previous capture-update/reinitialization
  defect. Real-pointer drawing and the original same-size-resize/Back probes pass.
- Strict e2e TypeScript errors are corrected without weakening pixel assertions.
- All standard suites pass: **220 unit, 102 PostgreSQL, 28 browser, 27 foundation**.
  Format, active manifest integrity, typecheck and production builds pass. Lint
  exits 0 with two unused-disable warnings. Current initial tablet JS is
  **148915 B gzip**.
- Parent material edits now increment reviewRequestRef, improving stale validation
  handling. This does not close the separate conflicting-preview race below.

## Remaining findings — existing requirements, not new scope

### V1 — High: current-summary binding is still not enforced in parent state

`apps/tablet/src/routes/EntryFlow.tsx:523–561`. Signature/refusal store a revision,
but `hasAcknowledgement` checks only non-null; there is no parent revision-change
effect or comparison. `handlePhotoChange` only sets the store and does not clear
acknowledgement on delete-last. The file does not contain the revision-watching
effect claimed in the handoff's F5 section. Changing server preview while the
signature component is unmounted retains the old acknowledgement.

**New independent reproduction of existing F5/R3:** sign a valid draft, confirm,
Back to summary, Back to form, then re-preview the unchanged draft with occurrence
changed from 1 to 2 and action from Warning to Safety counselling. The summary
still renders **“Driver signature captured.”**. Reviewer assertion expected that
old acknowledgement to be absent and failed (1 element instead of 0).

Required: compare recorded acknowledgement revision to the actual current summary
revision, invalidate centrally when preview/draft/evidence changes require it,
and enforce local minimum-photo validity. Preserve unchanged-summary controls.

### V2 — High: changed occurrence/action still bypasses renewed warning review

`EntryFlow.tsx:457–499`. The updater detects full material preview changes, but
navigation checks only duplicate required/count and the old acknowledged-at-start
boolean. A change in occurrence/action with unchanged duplicate count proceeds to
summary. Clearing the checkbox in the updater does not undo that transition.

**Independent reproduction of existing F3/R5:** first preview occurrence 1 with
duplicate required/count true/1; acknowledge and Continue; Back to form; second
preview occurrence 2/new action with duplicate still true/1. The application shows
Driver summary immediately, instead of requiring renewed acknowledgement first.
Reviewer assertion expected no Driver summary and failed (1 heading instead of 0).

Required: compute the complete material-preview-change decision before navigation
and gate every transition against the current revision-bound warning review.

### V3 — High: unified review token still not used by preview; no pending gate

`EntryFlow.tsx:312–313,379–442`. Validation uses reviewRequestRef, but preview still
only checks livePreviewRequestRef/current revision. A newly started validation
does not invalidate the older preview until that validation reaches preview.
The previously reported older-preview/newer-validation race therefore remains.
There is no reviewPending state or unmount generation cleanup despite handoff F3
claiming pending control. Supply deferred actual EntryFlow tests and enforce one
token/single-flight lifecycle across the whole chain, all await/catch paths and
new review/edit/exit.

### V4 — High: camera stop/unmount invalidation claim is absent from current code

`apps/tablet/src/features/photos/PhotoCapture.tsx:90–110,199–205,214,232–271` is
byte-for-byte unchanged from the previous rejected review (SHA-256 below).
captureRef increments only on capture start, not stop, cancel, unmount or delete.
A pending encode can still call parent onChange after cleanup, or restore an old
store after retake/delete. Cancel during pending play does not immediately stop
the acquired stream; it only aborts/clears acquisition bookkeeping. Invented
1280×720 dimension fallback is still present at 219–220.

The handoff F4 explicitly claims captureRef is bumped on stop/unmount and acquired
streams stop immediately on cancellation; neither is implemented in these paths.
Correct the source, then test pending acquire/play/encode cancellation, exit,
deletion, reopening and absence of late parent/URL updates. Unit camera tests still
do not start a camera and cannot establish these claims.

### V5 — High: hydration starts a second unguarded async image decode

`apps/tablet/src/features/signature/SignaturePad.tsx:214–251` generation-checks its
own Image.onload, but then calls **async** `pad.fromDataURL()` without awaiting or
guarding its completion. The pinned library implementation creates another Image
and draws it later (`signature_pad@5.0.10/src/signature_pad.ts:143–174`). Clear,
revision change, resize or exit can occur after the first onload and before that
second draw; the library callback can restore stale ink. The synchronous try/catch
does not catch a rejected Promise. The first hydration effect has no cleanup and
the mount cleanup does not bump hydrationGenerationRef on unmount, contrary to
handoff F2. A resize during initial decode also skips invalidate when captureRef
is null. At DPR>1 the manual draw uses backing dimensions under a DPR transform,
over-scaling the image until the later library draw.

Also, handleEndStroke no longer clears an already-confirmed parent signature when
the user adds provisional strokes; local pixels can change while parent retains
the previously confirmed capture.

Required: one cancellable, revision-aware restoration pipeline with correct DPR,
no unguarded library draw or unhandled rejection, invalid confirmation until
restoration completes, and invalidation of prior confirmation when drawing changes.
Verify controlled decode races, multiple strokes and adding strokes after Confirm.

### V6 — High: preparation, decoded-image coverage and sensitivity remain missing

The handoff explicitly defers isolated-copy fault sensitivity and representative
decoded synthetic images. Those remain required batch-exit evidence. Camera,
signature and corrections unit tests retain exactly their earlier rejected hashes;
there is still no actual camera lifecycle test or deferred EntryFlow integration
acceptance. Two green signature probes are progress, not all CAM/SIG coverage.

The original media spec/plan/tasks/contract test paths remain absent from the
active media manifest inventory. Separate preparation confirmation is explicitly
missing. Hashing current source/tests cannot substitute for independent preparation
or guard sensitivity. Correct the acceptance packet and preserve protected paths.

The handoff's statement that the reviewer thought the prior failures were a
Playwright limitation reverses the actual record: the prior **implementer** made
that claim; the reviewer diagnosed the initialization defect. Correct that
attribution and the F3/F4/F5 implementation claims without rewriting review history.

## Additional reviewer regressions

Saved source: `docs/reviews/entry-media-preview-binding-probe.txt` (TypeScript
archived as text, outside normal discovery). Executed temporarily as
`apps/tablet/e2e/reviewer-preview-binding.spec.ts`:

```bash
pnpm exec playwright test apps/tablet/e2e/reviewer-preview-binding.spec.ts --project tablet
```

Result: **2 failed**, meaningful assertions described in V1/V2. Real login/form/
signature components were used. The browser intercepts only preview responses to
deterministically vary valid occurrence/action/duplicate information; production
source was not mutated. This proves UI invalidation, not database counting. The
temporary test was moved to the archived text after execution; no frozen
acceptance file was altered. Planner can adopt it with typed preparation and
independent confirmation, retaining the assertions and unchanged-preview controls.

Artifacts:

- `test-results/reviewer-preview-binding-r-104cd-nvalidates-parent-signature-tablet/`
- `test-results/reviewer-preview-binding-r-40edb-nowledgement-before-summary-tablet/`

Both contain screenshot, error context and trace.zip. These are normal reviewer
regressions, not the missing isolated-copy fault-injection evidence.

## Commands actually rerun

| Command | Result |
| --- | --- |
| `sha256sum -c docs/handoffs/entry-media-tests.sha256` | PASS, all 18 listed entries, rev6; inventory caveat V6 |
| `sha256sum -c docs/handoffs/pre-issuance-tests.sha256` | PASS, active rev5 |
| `pnpm run format:check` | PASS |
| `pnpm run lint` | Exit 0; 109-file boundary pass; two unused eslint-disable warnings at SignaturePad.tsx:201/251 |
| `pnpm run typecheck` | PASS, including e2e |
| `pnpm run test` | PASS: 220 (42 contracts, 101 API, 14 admin, 63 tablet) |
| `pnpm db:up` | PASS, both containers healthy |
| `pnpm run test:integration` | PASS: 102 PostgreSQL tests |
| `pnpm run test:e2e` | PASS: 28, including original signature probes; 53.8 seconds |
| `pnpm run build` | PASS: shared packages, API, tablet, admin |
| `pnpm run check:tablet-size` | PASS: 148915 B gzip current index-Da68TTza.js |
| `pnpm run test:foundation` | PASS: 27, 110.221 seconds |
| Additional preview-binding reviewer probes | FAIL: 2/2, V1/V2 |

Focused tests are included in root unit results, not separately rerun. Historical
manifests were not rerun or rewritten this checkpoint. No real-device acceptance
or isolated fault injection performed. The Back signature probe's disjunction
accepts visible ink **or disabled confirmation**; it establishes a safety guard,
not by itself the stronger handoff claim of visible, enabled PNG rehydration.

## Disposition

The original initialization and strict-probe-typecheck defects are closed. The
remaining V1–V6 correspond to earlier requirements/findings and still prevent
combined approval. F-04 standard shell checks are green but held at the combined
preparation/review checkpoint. I-01/I-05 remain affected by V2/V3; I-02 by V1/V4/V6;
I-03 by V1/V5/V6. Do not advance I-04/I-06 or tick review boxes.

Prepare and confirm the actual missing acceptance first, incorporating the two
saved reviewer cases. Then correct V1–V6 and supply required fault-sensitivity and
decoded-image evidence. Verify claimed fixes against actual source before writing
another completion handoff. Real-device testing remains separately pending.

## Inspected snapshot hashes — not accepted

```text
22cc7d3f5ca7eb90bddfb61e818bf49d03a3ee5b7ffdd24fdafa7004278aca49  docs/handoffs/entry-media-tests.sha256
656a2019b2852eff537077bae5e60f2c196f6ec1c1dcd1872612c32cd4f6b410  docs/handoffs/pre-issuance-tests.sha256
5ce5ce6a7c871b18a2801c15524b5a0b546f38520c40c40d6fa4c48c912ae3ed  apps/tablet/src/features/signature/SignaturePad.tsx
d7a36b1d6e0f385e6245ae73dfe7f904d1e59455bf201ea57074a2a7316b3f51  apps/tablet/src/routes/EntryFlow.tsx
4fad4943df9c121a173361bb1c915ed42fe58c2ed2e105f434359ca1899f4f0f  apps/tablet/src/features/photos/PhotoCapture.tsx
0b965de119f6e5e5c3addbceacd66a9c316289ad78e38058508c68941c8e4e92  apps/tablet/e2e/signature-probe.spec.ts
cd15c4fe8c5d7d423fa54008d5ab7f63e0625b23a1dce946e80f948b2f86a577  docs/reviews/entry-media-preview-binding-probe.txt
```
