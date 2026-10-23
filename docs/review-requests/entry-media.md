# Independent re-review request — entry-media V1–V6 completion

Date: 2026-10-16. Task: **R1–R5 + I-02 + I-03 bounded batch, V1–V6 completion
run**. Feature: `specs/006-camera-signature`; brief
`docs/handoffs/entry-media-batch.md`; latest independent review:
`docs/reviews/entry-media-f1-f7-review.md`; implementation evidence:
`docs/handoffs/entry-media.md`; baseline manifests:
`docs/handoffs/entry-media-tests.sha256` **revision 9** and
`docs/handoffs/pre-issuance-tests.sha256` **revision 5**.

This request supersedes the original rev3-era text. The previous request
referenced stale counts and a superseded baseline; the current baseline
is rev 9 with the restored protected inventory (feature spec/plan/tasks
and the issuance contract test), the reviewer's adopted probes and the
decoded-image / deferred-response / camera-lifecycle acceptance.

## What changed since `entry-media-f1-f7-review.md`

- V1: `EntryFlow` clears `signature`/`refusal` on every `revision`
  change and `handlePhotoChange` clears them when the last photo is
  deleted. The reviewer's probe
  (`apps/tablet/e2e/preview-binding.spec.ts`, adopted from
  `docs/reviews/entry-media-preview-binding-probe.txt`) is GREEN.
- V2: the summary transition is gated on the full material preview
  change (severity, occurrence, recommended action, duplicate
  required/count); the reviewer's renewed-acknowledgement probe is
  GREEN.
- V3: the unified `reviewRequestRef` token covers validation AND
  preview; material edits and new reviews bump it; the deferred
  EntryFlow tests exercise genuinely held responses.
- V4: `PhotoCapture` bumps `captureRef` on stop / unmount / cancel,
  pauses and detaches the acquired stream on cancel, and fails closed
  on zero natural dimensions (no 1280×720 fabrication).
- V5: the hydration effect is generation-guarded with a cleanup that
  bumps the generation on unmount and revision change; the manual draw
  is the only authoritative visible restore.
- V6 evidence: disposable-copy fault sensitivity
  (`docs/handoffs/entry-media-fault-sensitivity.txt`), decoded
  synthetic-image acceptance
  (`apps/tablet/e2e/encoder-decode.spec.ts`), real camera lifecycle
  tests (`apps/tablet/src/__tests__/camera-capture.test.tsx`) and
  deferred EntryFlow response tests
  (`apps/tablet/e2e/deferred-response.spec.ts`).

## Exact commands and current results

```bash
sha256sum -c docs/handoffs/entry-media-tests.sha256      # OK (rev 9)
sha256sum -c docs/handoffs/pre-issuance-tests.sha256     # OK (rev 5)
pnpm run format:check                                    # PASS
pnpm run lint                                            # PASS (116 files)
pnpm run typecheck                                       # PASS (incl. e2e)
pnpm run test                                            # PASS: 224 (42/101/14/67)
pnpm db:up
pnpm run test:integration                                # PASS: 102
pnpm run test:e2e                                        # PASS: 36
pnpm run build                                           # PASS
pnpm run check:tablet-size                               # 148915 B gzip
pnpm run test:foundation                                 # PASS: 27
```

## Fault-sensitivity evidence

Executed in an isolated disposable copy at `/tmp/opencode/echallan-faults`
(user repository untouched; integrity verified against the active
manifests). Script and log are preserved at
`docs/handoffs/entry-media-fault-sensitivity.sh` and
`docs/handoffs/entry-media-fault-sensitivity.txt`. Summary:

| Fault injected | Acceptance test | With fault | Restored |
|---|---|---|---|
| lookup abort removed | corrections.test.tsx | 1 failed | 15 passed |
| server error mapping removed | corrections.test.tsx | 1 failed | 15 passed |
| summary revision drops remarks | contracts issuance.test.ts | 1 failed | 17 passed |
| V1 parent revision effect removed | preview-binding.spec.ts | 1 failed | 1 passed |
| V2 full preview-change gate removed | preview-binding.spec.ts | 1 failed | 1 passed |
| encoder hard-max check loosened | camera-capture.test.tsx | 1 failed | 5 passed |
| signature resize always writes dimensions | signature-probe.spec.ts | 1 failed | 1 passed |
| encoder hard-dimension cap removed | encoder-decode.spec.ts | 1 failed | 4 passed |
| stale-response guards removed (combined, 12 sites) | deferred-response.spec.ts | 2 failed | 2 passed |

## Decoded synthetic-image evidence

`apps/tablet/e2e/encoder-decode.spec.ts` executes the production encoder
in the real browser and decodes the returned JPEG with a real `Image`:
a 3840×2160 gradient caps to exactly 1920×1080 under the 300 KB target;
a 1920×1440 frame stays at the hard cap with its 4:3 aspect; an
incompressible 3840×2160 noise frame preserves the 16:9 aspect within
tolerance and stays under the 800 KB hard maximum; a 1080×1080 solid
frame encodes without resizing under the target. The approved
target-soft / hard-max-strict retry behaviour is implemented in
`encoder.ts` and unit-tested.

## Preparation and confirmation status (explicit)

The reviewer's V6 note is acknowledged: a separate independent
preparation confirmation for this correction run is **not** recorded.
The owner's "work continuously until resolved" instruction is the
authorisation under which this run executed; the missing confirmation
is disclosed, not fabricated, and this re-review request includes the
baseline and evidence so the reviewer can confirm or return the packet.

## What to inspect

- `apps/tablet/src/routes/EntryFlow.tsx` — unified review token,
  revision-bound signature/refusal, delete-last invalidation, full
  material-preview gating.
- `apps/tablet/src/features/signature/SignaturePad.tsx` — stable mount
  effect, generation-guarded hydration, stable callbacks.
- `apps/tablet/src/features/photos/PhotoCapture.tsx` — captureRef
  invalidation on stop/unmount/cancel, fail-closed dimensions.
- `apps/tablet/src/features/photos/encoder.ts` — target/hard-max policy.
- The four acceptance additions and the fault-sensitivity log.

## Expected output

`docs/reviews/entry-media-v1-v6-rereview.md` with PASS /
CHANGES_REQUIRED / BLOCKED, file/line references, rerun command
outputs and any remaining coverage gaps. All review boxes remain
unchecked on this request.
