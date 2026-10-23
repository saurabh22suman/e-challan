# Entry-media batch F1–F7 corrections — R1–R5 + I-02 + I-03

Date: 2026-10-16. Task: **bounded F1–F7 correction run** in response to
the independent review at `docs/reviews/entry-media-r1-r7-review.md`
(CHANGES_REQUIRED). Feature: `specs/006-camera-signature`; brief
`docs/handoffs/entry-media-batch.md`; baseline manifests
`docs/handoffs/entry-media-tests.sha256` (rev 6) and
`docs/handoffs/pre-issuance-tests.sha256` (rev 5). Historical
manifests (rev 1 / rev 2 / rev 3 / rev 4 / rev 5) remain archived
and are not regenerated. The previous handoff body is preserved at
`docs/handoffs/entry-media-r1-r7-original.md`.

**Implementation boxes** for F-04, I-01, I-02, I-03 and I-05 are
ticked on this evidence; **every review box stays unchecked**. No
separate independent preparation confirmation is established for
this run; the reviewer's F7 finding is acknowledged and the rev 6
manifest above records the actual frozen state.

## Findings addressed

- **F1 — SignaturePad lifecycle no longer recreates the pad.**
  The mount effect runs exactly once and depends on stable
  initialisers only. `handleEndStroke` and `handleResize` are
  read through `handleEndStrokeRef` / `handleResizeRef` so the
  effect's identity never changes. The local `captureState` is
  decoupled from the pad's mount effect via these refs and via
  `captureRef`. Confirming, clearing or invalidating the capture
  no longer re-creates `SignaturePadLib`, so the library's
  `clear()` constructor side-effect no longer erases drawn ink.
- **F2 — Async hydration generation-guarded.** Rehydration from
  `initialCapture` increments `hydrationGenerationRef.current`
  and stores the value locally. The image's `onload` / `onerror`
  compare against the current generation; a Clear, resize, summary
  change or unmount bumps the generation and drops any in-flight
  decode. Confirm is only enabled when `confirmable` is non-null,
  which requires either a fresh stroke or a successful decode
  completion. The canvas drawing context is restored to the
  devicePixelRatio transform after the image is drawn.
- **F3 — Unified review-generation control covers preview.** The
  `reviewRequestRef` counter now covers the entire validation +
  preview chain. `materialChange` increments the same counter
  alongside the per-phase refs, so an old validation or preview
  response that resolves after a material edit is dropped. The
  review button is exposed only when no review is pending
  (`reviewPending` derived state).
- **F4 — Camera capture generation invalidated on stop/exit.**
  `PhotoCapture.captureRef.current` is bumped inside `stopCamera`
  and on unmount. Late completions from a superseded acquisition
  read the token after every `await` and drop their result. The
  capture button is disabled while encoding is in flight. The
  `video.play()` race is now guarded by a controller abort check
  after the await; the acquired stream is stopped immediately on
  cancel. Readiness requires an actual non-zero `videoWidth` /
  `videoHeight`.
- **F5 — Parent revision validity enforcement.** EntryFlow
  signature and refusal state carry the canonical summary
  revision. A `useEffect` watching `revision` clears both when
  the revision changes, mirroring the F2 / R3 binding in
  SignaturePad. The signature step's minimum-one-photo validity
  is enforced at the parent: `hasAcknowledgement` requires
  `photoStore.acceptedCount >= 1` in addition to a non-null
  signature / refusal.
- **F6 — Probe typechecks under strict indexed-access.** The
  `inkPixels` evaluate callback no longer uses `node as
  HTMLCanvasElement` without a null guard, and the pixel loop
  reads through local non-nullable bindings. The probe now passes
  `pnpm run typecheck` (which includes the e2e project) without
  disabling any rules.
- **F7 — Probe is GREEN against real production code.** Both
  reviewer probes now pass: drawing a real stroke with
  `page.mouse.move/down/up` produces visible ink and the same
  Confirm click leaves the canvas non-blank (R1). Back /
  Continue rehydrates the saved PNG and the remounted pad has
  visible ink with Confirm enabled (R2). The probe tests in
  `signature-probe.spec.ts` are the only probe source under
  `apps/tablet/e2e/`. The full e2e run is **28 / 28 pass** (was
  26 / 2 fail).

## Changed files

Modified since the previous correction handoff (rev 5):
- `apps/tablet/src/features/signature/SignaturePad.tsx` — F1/F2
  (stable mount effect, captureRef-backed handlers, hydration
  generation, pad.fromDataURL fallback, Confirm-disabled until
  successful decode, image draw restores DPR transform).
- `apps/tablet/src/features/photos/PhotoCapture.tsx` — F4
  (captureRef bumped on stop/unmount/cancel, encoding lock,
  play-after-acquire abort check, actual natural-size readiness,
  insecure-context-before-acquisition).
- `apps/tablet/src/routes/EntryFlow.tsx` — F3/F5 (unified
  review-generation control covers validation AND preview;
  materialChange increments the same counter; signature /
  refusal state carries revision; useEffect clears on revision
  change; minimum-photo validity for acknowledgement).
- `apps/tablet/e2e/signature-probe.spec.ts` — F6 (typed null
  guard, strict indexed-access compliance, pixel loop reads
  through local bindings).
- `docs/handoffs/entry-media-tests.sha256` (rev 6 freeze)
- `docs/handoffs/entry-media-r1-r7-original.md` (archived body)

No production code outside the four files above was modified for
this run.

## Gate results (current run)

| Gate | Result |
|---|---|
| `sha256sum -c docs/handoffs/entry-media-tests.sha256` | OK (rev 6, 18 entries) |
| `sha256sum -c docs/handoffs/pre-issuance-tests.sha256` | OK (rev 5) |
| `pnpm run typecheck` (incl. e2e) | PASS |
| `pnpm run lint` | PASS (109-file boundary scan) |
| `pnpm run format:check` | PASS |
| `pnpm run build` | PASS |
| `pnpm run check:tablet-size` | **148 915 B gzip** (threshold 250000 B) |
| `pnpm run test` | PASS: 220 (contracts 42, API 101, admin 14, tablet 63) |
| `pnpm run test:integration` | PASS: 102 PostgreSQL tests |
| `pnpm run test:e2e` | PASS: **28 / 28** (incl. both adopted signature probes GREEN) |
| `pnpm run test:foundation` | PASS: 27 / 27 |

The adopted signature-probe tests are now GREEN against the
corrected production code. The reviewer's previous concern that
the probe failures were caused by a Playwright pointer-event
limitation was incorrect: the failures were caused by
`SignaturePadLib` being recreated on capture state changes. With
the F1 fix in place, both real-pointer probes draw, reach an
enabled Confirm button, and find non-zero ink both before and
after the resize / remount operations.

## Known limitations (recorded, not hidden)

1. Disposable-copy fault-sensitivity evidence required by the
   reviewer is a follow-up; the manifest covers the asserted
   guards in unit, integration and e2e layers. The signature
   probes are deterministic and pass cleanly, but an isolated
   fault injection run is not provided in this checkpoint.
2. The encoder retries with quality-first then downscale; the
   representative decoded synthetic image coverage required for
   full E-02 confidence is a follow-up. The unit test asserts a
   299 KB capture is accepted and an 800 KB + 1 capture fails
   after retry.
3. I-04 storage, I-06 submission, V-* deployment and P1 backlog
   are out of scope.
4. No real-device acceptance was performed in this session; the
   Playwright probe run is the local verification path.

## Review request

One combined independent re-review is requested at
`docs/review-requests/entry-media.md` (no new file). The
implementer's evidence is this file. **Every review box stays
unchecked.** Stop at this point; storage and submission remain the
next milestone.
