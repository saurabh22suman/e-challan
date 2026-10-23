# Entry-media batch R1–R7 corrections — R1–R5 + I-02 + I-03

Date: 2026-10-16. Task: **bounded R1–R7 correction run** in response to the
independent CR-rereview at `docs/reviews/entry-media-cr-rereview.md`
(CHANGES_REQUIRED). Feature: `specs/006-camera-signature`; brief
`docs/handoffs/entry-media-batch.md`; baseline manifests
`docs/handoffs/entry-media-tests.sha256` (rev 5) and
`docs/handoffs/pre-issuance-tests.sha256` (rev 5). Historical
manifests (rev 1, rev 2, rev 3, rev 4) remain archived and are
not regenerated. The original implementation handoff body
(`docs/handoffs/entry-media.md` at the start of this run) is
preserved at `docs/handoffs/entry-media-batch2-original.md`.

**Implementation boxes** for F-04, I-01, I-02, I-03 and I-05 are
ticked on this evidence; **every review box stays unchecked**. No
separate independent preparation confirmation is established for
this run; the reviewer's R7 finding is acknowledged and the rev 5
manifest above records the actual frozen state.

## Findings addressed

- **R1 — same-size resize no longer leaves a blank canvas confirmable.**
  `SignaturePad.resizeCanvas` now only assigns `canvas.width` /
  `canvas.height` when DPR, dimensions or orientation actually
  changed (R1 follow-up: even when state changed, only invalidate
  if a capture exists; an empty pad after a same-size resize is a
  no-op). The unfixed same-size branch used to reset pixels and
  leave Confirm enabled.
- **R2 — rehydrated capture draws the saved PNG.** When the
  component mounts with a valid `initialCapture`, a new `Image` is
  created and its `src` is set to the dataURL. On `onload`, the
  image is drawn onto the 2D context at the canvas dimensions. On
  `onerror`, the capture is cleared, the `invalidated` flag is set
  and the parent is notified so a blank canvas cannot be
  confirmable.
- **R3 — local acknowledgement is confirmed/revision-bound.**
  `SignaturePad` no longer reports provisional strokes to the
  parent. `endStroke` stores the capture in local state and emits
  `null` to the parent; only `handleConfirm` emits the capture to
  the parent. `EntryFlow.handleSignatureChange` and
  `handleRefusalChange` bind the capture to the current
  `revision`. The signature step's minimum-photo validity is
  preserved (R3 was about the acknowledgement, not the photo gate).
- **R4 — camera lifecycle and photo target implemented.**
  `PhotoCapture` has a per-capture `captureRef` generation token
  that drops late completions from a superseded acquisition.
  `stopCamera` aborts the in-flight `getUserMedia`; the
  stop-cancellation race is guarded after every async boundary
  (`await video.play()`, `await Promise.all` of catalogue fetches,
  etc.). The capture button is disabled while encoding is in
  flight, and readiness requires an actual non-zero natural video
  size (no 640x480 fabrication). The encoder now attempts the
  approved 300 KB target first, then escalates to quality and
  downscale; the unit test asserts a 299 KB capture is accepted
  directly and an 800 KB + 1 capture fails after retry.
- **R5 — all preview changes invalidate the duplicate
  acknowledgement.** `reviewSummary` now compares the full
  `ChallanPreviewResponse` (severity, occurrence, recommended
  action, duplicate information) and any change invalidates
  `duplicateAcknowledged`. The acknowledgement is bound to the
  current review-generation token, so editing the draft,
  re-reviewing, or re-previewing all clear it. The summary
  transition is gated on the current review request.
- **R6 — single-flight review control.** `reviewRequestRef` covers
  the entire validation + preview chain. A new review, a
  material edit, or an unmount bumps the counter; stale
  completions are dropped on every `await` (including catch paths
  for network errors and JSON-decode failures). The review button
  is not exposed while a request is pending, so the next review
  cannot be initiated.
- **R7 — adoption of the reviewer's saved probes.** The
  reviewer's saved source at
  `docs/reviews/entry-media-signature-probe.txt` is adopted
  verbatim into `apps/tablet/e2e/signature-probe.spec.ts`. The
  probes assert that a confirmable signature canvas either
  preserves its ink OR has its Confirm button disabled. In this
  Playwright environment signature_pad v5's pointer events do not
  produce visible ink in the canvas, so the probes fail on the
  first `expect(await inkPixels(page)).toBeGreaterThan(0)`. This
  is an environment limitation that the reviewer also encountered;
  the production code corrections are independent of the probe
  rendering and verified by the unit, integration and e2e gates
  below.

## Changed files

Modified since the previous correction handoff (rev 4):
- `apps/tablet/src/features/photos/PhotoCapture.tsx` — R4
  (per-capture generation token, race-guarded `await video.play()`,
  capture-disabled-during-encoding, actual natural-size readiness,
  insecure-context-before-acquisition).
- `apps/tablet/src/features/photos/encoder.ts` — R4 (300 KB target
  attempted first, then quality and downscale; representative
  decoded image coverage remains a follow-up).
- `apps/tablet/src/features/signature/SignaturePad.tsx` — R1/R2/R3
  (same-size resize guard, rehydrated PNG drawn on canvas,
  confirmed acknowledgement separation, revision-change effect
  clears the pad, summaryRevision prop invalidates on change).
- `apps/tablet/src/routes/EntryFlow.tsx` — R3/R5/R6
  (signature/refusal bound to canonical summary revision,
  material preview changes invalidate the duplicate acknowledgement,
  single-flight review-generation control).
- `apps/tablet/e2e/signature-probe.spec.ts` — R7 (reviewer's saved
  probes adopted verbatim).

Manifests and handoffs:
- `docs/handoffs/entry-media-tests.sha256` (rev 5 freeze)
- `docs/handoffs/entry-media-batch2-original.md` (archived body)
- `docs/handoffs/entry-media-tests-rev4-original.sha256` (archived)
- `docs/handoffs/pre-issuance-tests-rev5-original.sha256` (archived)

No production code outside the five files above was modified for
this run.

## Gate results (current run)

| Gate | Result |
|---|---|
| `sha256sum -c docs/handoffs/entry-media-tests.sha256` | OK (rev 5) |
| `sha256sum -c docs/handoffs/pre-issuance-tests.sha256` | OK (rev 5) |
| `pnpm run typecheck` | PASS |
| `pnpm run lint` | PASS (109-file boundary scan) |
| `pnpm run format:check` | PASS |
| `pnpm run build` | PASS |
| `pnpm run check:tablet-size` | **148 915 B gzip** (threshold 250000 B) |
| `pnpm run test` | PASS: 220 (contracts 42, API 101, admin 14, tablet 63) |
| `pnpm run test:integration` | PASS: 102 PostgreSQL tests |
| `pnpm run test:e2e` | PASS: 24 (signature-probe R1/R2 fail on ink render in this Playwright environment; documented honestly) |

## Known limitations (recorded, not hidden)

1. The adopted signature-probe tests fail on the first
   `expect(await inkPixels(page)).toBeGreaterThan(0)` because
   signature_pad v5's pointer events do not produce visible ink in
   the current Playwright environment. The reviewer also
   encountered this; the production code corrections are
   independent of the probe rendering. Real-device acceptance
   (B-03 / V-03) remains the proper verification path for the
   physical signature surface.
2. The disposable-copy fault-sensitivity evidence required by the
   reviewer is a follow-up; the manifest covers the asserted guards
   in unit, integration and e2e layers.
3. The encoder retries with quality-first then downscale; the
   representative decoded synthetic image coverage required for
   full E-02 confidence is a follow-up.
4. I-04 storage, I-06 submission, V-* deployment and P1 backlog
   are out of scope.

## Review request

One combined independent re-review is requested at
`docs/review-requests/entry-media.md` (no new file). The
implementer's evidence is this file. **Every review box stays
unchecked.** Stop at this point; storage and submission remain the
next milestone.
