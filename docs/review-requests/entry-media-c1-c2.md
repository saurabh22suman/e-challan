# Review request — entry-media C1/C2 correction (2026-10-18)

Independent review requested for the bounded C1/C2 correction of the
entry-media batch, per the disposition in
`docs/reviews/entry-media-v1-v6-rereview.md`. Run the review in a fresh
session/model; the implementing session cannot approve it.

## What to review

1. **C1 closure** (`apps/tablet/src/features/photos/PhotoCapture.tsx`):
   cancel during an acquired-but-pending `video.play()` must stop tracks and
   detach the video immediately via the shared teardown, and a late play
   settlement must not disturb a newer acquisition. The reviewer's saved probe
   (`docs/reviews/entry-media-cancel-play-probe.txt`) is adopted in
   `apps/tablet/src/__tests__/photo-cancel-play.test.tsx` without weakening the
   immediate-stop assertion.
2. **C2 closure** (`apps/tablet/src/features/signature/SignaturePad.tsx`):
   a drawing that starts or changes must invalidate the parent confirmation
   (`onChange(null)`, including for a remounted pad whose `initialCapture` has
   not decoded yet), drop outstanding hydration and preserve visible strokes;
   Confirm → add stroke → Back must not restore the superseded capture;
   reconfirmed multi-stroke exports must survive restore; a delayed decode must
   not overwrite a new stroke. Acceptance:
   `apps/tablet/src/__tests__/signature-invalidation.test.tsx` and
   `apps/tablet/e2e/entry-media-invalidation.spec.ts`.
3. **Preserved behavior**: no existing acceptance test was modified; the
   approval must confirm no assertion was weakened, skipped or replaced. The
   rev-2 baseline revision (remount unit case + one pending-decode assertion,
   whitespace normalization) is documented in
   `docs/handoffs/entry-media-c1-c2-prepared.md` and requires reviewer
   confirmation.
4. **Baseline integrity**: `sha256sum -c docs/handoffs/entry-media-c1-c2-tests.sha256`
   (rev 2; rev 1 archived at `entry-media-c1-c2-tests-rev1.sha256`).
5. **Evidence**: `docs/handoffs/entry-media-c1-c2.md` (RED/GREEN, gates,
   fault sensitivity, MCP screens/states). Screenshots: `.playwright-mcp/c1c2-*.png`.
6. **Re-run independently**: `pnpm run format:check`, `pnpm run lint`,
   `pnpm run typecheck`, `pnpm run test`, `pnpm run test:integration`
   (db containers required), `pnpm run test:e2e`, `pnpm run build`,
   `pnpm run check:tablet-size`, `pnpm run test:foundation`.

Scope fence for the review: only the two named production files plus the
listed acceptance/record files changed. Any broader change invalidates this
request.

## Known open items (not defects)

- Real rear-camera cancellation and stylus/signature feel remain the
  B-03/V-03 device gate; browser fake-device evidence is not hardware
  acceptance.
- The pre-existing unused eslint-disable warning in `SignaturePad.tsx` is
  unchanged.
- The owner-ui-revision independent review and the entry-media combined
  checkpoint remain separate; this review only covers C1/C2.

Report PASS / CHANGES_REQUIRED / BLOCKED in `docs/reviews/entry-media-c1-c2.md`
with accepted file hashes and rerun results.
