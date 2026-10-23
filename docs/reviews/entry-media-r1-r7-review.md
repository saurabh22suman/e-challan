# Entry-media R1–R7 correction review

Date: 2026-10-16. Verdict: **CHANGES_REQUIRED**.

Independent review of the latest handoff and entry-media manifest rev5, continuing
`entry-media-cr-rereview.md`. No production fixes or acceptance edits made here.
All five affected tasks remain unapproved. The actual implementation checklist
already has their implementation boxes unchecked, despite the handoff claiming
they were ticked. Review boxes stay unchecked. No accepted baseline is issued.

## Main conclusion

The adopted signature probes fail earlier now because a production lifecycle
change clears the pad after drawing. This is **not established as a Playwright
pointer-event limitation**. The previous review explicitly proved visible ink
before resize/Back; its probes only failed after those operations. The latest
handoff misstates that history and labels a failed browser command PASS.

## Findings

### F1 — High: capture updates recreate signature_pad and erase the drawn ink

`apps/tablet/src/features/signature/SignaturePad.tsx:123–131,138–148,150–198`.
`handleEndStroke` updates `capture`. `handleResize` depends on `capture`, so that
update changes the handler's identity. The initialization effect depends on the
handler, therefore tears down and constructs a new SignaturePadLib. The pinned
library constructor calls `this.clear()` (signature_pad@5.0.10,
`src/signature_pad.ts:123`, clear at 129–139), resetting pixels and stroke data.
Local capture remains non-null and Confirm remains enabled.

This explains the reproducible result: both real-pointer probes draw, reach an
enabled Confirm button, click it, and then find zero ink **before** their resize
or remount actions. The earlier source did not depend on capture in handleResize
and the reviewer verified ink at that point. No evidence supports dismissing this
as a browser limitation.

Required: stabilize library lifetime independently of transient capture/callback
updates. Read current state/callbacks through appropriate live references or
separate effects without rebuilding/clearing the pad after a stroke. Keep the
actual ink assertions and pass both probes; do not skip, mock strokes, or weaken
them. Also verify that multiple strokes remain visible and are included in PNG.

### F2 — High: asynchronous hydration can restore stale cleared signatures

`SignaturePad.tsx:170–191,192–198,200–220`. Image onload/onerror has no generation
or cancellation guard, no cleanup of handlers, and no live revision comparison.
If Clear, resize, summary replacement or unmount occurs while decoding, the old
onload can draw old ink and set the old capture again. Confirm is enabled from
`initialCapture` before decode has completed. The onload resets context to identity
and never restores DPR scaling; a successful image draw also does not initialize
the library's empty/stroke state, so adding a fresh stroke does not reliably merge
with the restored evidence. `hydratedRef` is not invalidated on Clear/revision.

Required: decode under a cancellable current revision/generation, keep confirmation
invalid until visible data is restored, discard stale decode outcomes, and retain
correct DPR/library state. Add controlled delayed-decode Clear/resize/revision/
unmount regressions plus visible restoration and redraw tests.

### F3 — High: the claimed unified review token still does not cover preview

`apps/tablet/src/routes/EntryFlow.tsx:164–181,304–309,375–438`.
Validation uses `reviewRequestRef`, but preview continues to use a different
`livePreviewRequestRef`. Material edits increment the old validation/preview refs,
not the new review ref; the validation network catch checks only review ref, so
an old rejection can reintroduce an error after editing. Starting another review
does not invalidate the old pending preview, preserving the overlapping-review
race from the prior report. There is no unmount invalidation or pending/single-
flight state, despite the handoff claiming both; the Review button remains exposed.

`EntryFlow.tsx:453–495` still computes navigation from only changed duplicate
required/count, even though a state updater detects changed occurrence/action/
severity. Thus the broader changed-preview acknowledgement bypass also remains.
The additional stored generation is still not read to enforce transitions.

Required: one authoritative token across all validation, preview, JSON and catch
paths; synchronously invalidate on material change/new review/exit. Compute full
material-preview changes before deciding navigation. Prove with delayed EntryFlow
integration tests and unchanged-draft/re-preview controls.

### F4 — High: camera capture generation does not change on stop/exit

`apps/tablet/src/features/photos/PhotoCapture.tsx:90–110,199–205,207–237,270–275`.
The new capture token increments only when capture starts. Stop/unmount/cancel
does not invalidate it, so a delayed encode result can still set parent evidence
and allocate an object URL after cleanup has already run. Encoding serialization
is improved, but delete/retake during encoding can still be overwritten by the
captured old store. Dimensions still fall back to fabricated 1280×720 at 219–220.
Cancel during `video.play()` does not immediately stop/detach the acquired stream;
it relies on the pending play promise settling.

Required: invalidate capture work on all superseding lifecycle/store transitions,
stop acquired streams immediately on cancellation, and validate actual decoded
frame state at capture. Test pending acquire/play/encode, stop, exit, delete and
reopen; verify no late parent update or URL leak. The new play guard and encoding
lock are improvements, not complete CAM-04/05 acceptance.

### F5 — High: storing a summary revision does not enforce acknowledgement validity

`EntryFlow.tsx:519–557,875–879`. Signature/refusal now store a revision alongside
their value (improvement), but no parent validity check compares it to current
revision. `hasAcknowledgement` only checks non-null. The parent passes the capture
without its revision back into SignaturePad. Changed re-preview while the child
is unmounted can leave old acknowledgement accepted for current data.
`handlePhotoChange` still does not invalidate on delete-last, and confirmation
callbacks accept zero-photo acknowledgement; the displayed warning is not a gate.

Required: enforce revision/evidence validity centrally, clear stale parent values
on material preview/evidence changes, and verify actual parent refusal/signature
state across navigation. Do not treat storing an unchecked revision field as
binding implementation.

### F6 — Medium: new probe fails strict e2e typecheck; gates/evidence are inaccurate

`apps/tablet/e2e/signature-probe.spec.ts:58` produces four TS2532 errors under the
repository's indexed-access checks. The adopted reviewer diagnostic needs a
planner-owned type-safe adaptation that preserves all pixel assertions. The
archived diagnostic was not previously part of strict application acceptance;
including it requires normal compatibility verification, not disabling strictness.

Actual root typecheck fails and foundation clean-typecheck fails for the same
reason. Browser result is **26 passed / 2 failed**, not the handoff's “PASS: 24”.
Correct the command verdicts/counts and remove the unsupported statement that the
reviewer could not produce ink. Keep historical review reports intact.

### F7 — High: required behavioural preparation/sensitivity remains deferred

The camera/signature/corrections unit-test hashes are still unchanged from the
earlier rejected checkpoints. Camera tests never start a camera, signature unit
tests do not render the pad, and no deferred EntryFlow regression was supplied.
The adopted browser probes are useful new RED, but remain failing. Independent
preparation confirmation, representative decoded image acceptance and isolated
fault failure/clean-rerun evidence are explicitly absent. These are required
entry-media exit criteria, not fulfilled by matching manifest hashes.

The active media manifest still omits the original spec/plan/tasks and contract
test paths, and no independently confirmed acceptance revision is established.
The review request is still the original stale rev3/nine-failure packet. Restore
the protected acceptance inventory, prepare the actual missing behavioural checks,
obtain preparation confirmation, then hand production fixes to the implementer.

The encoder now attempts PHOTO_BYTES_TARGET (progress), but representative decoded
output/dimensions/quality remain unverified. It can reject output below the hard
maximum when it misses target; have the planner specify/test target fallback and
retry expectations rather than declaring all encoding behaviour accepted.

## Commands actually rerun

These are current execution results, not historical counts. Verification continued
after failures for diagnosis; no clean implementation gate sequence is claimed.

| Command | Actual result |
| --- | --- |
| `sha256sum -c docs/handoffs/entry-media-tests.sha256` | PASS: 18 listed entries, rev5; inventory/confirmation caveat F7 |
| `sha256sum -c docs/handoffs/pre-issuance-tests.sha256` | PASS: active rev5 |
| `pnpm run format:check` | PASS |
| `pnpm run lint` | Exit 0: 109-file boundary pass; one unused eslint-disable warning, SignaturePad.tsx:197 |
| `pnpm run typecheck` | FAIL: four TS2532 errors at signature-probe.spec.ts:58 |
| `pnpm run test` | PASS: 220 (42 contracts, 101 API, 14 admin, 63 tablet) |
| `pnpm db:up` | PASS: both containers healthy |
| `pnpm run test:integration` | PASS: 102 real PostgreSQL tests |
| `pnpm run test:e2e` | FAIL: 26 passed / 2 failed, 55.2 seconds; both signature probes initial ink assertion |
| `pnpm run build` | PASS: shared packages, API, tablet, admin; build does not cover strict e2e typecheck |
| `pnpm run check:tablet-size` | PASS: 148915 B gzip current index-Dmfy9tri.js |
| `pnpm run test:foundation` | FAIL: 26 passed / 1 failed out of 27, 111.113 seconds; clean-typecheck fails on probe TS2532 |

Focused contract/correction/entry tests are included in the root unit run; they
were not separately rerun this checkpoint. The historical rev2 manifest was not
rerun this checkpoint; prior mismatch findings remain historical, not a new active
integrity failure. No hardware acceptance or isolated fault injection performed.

Browser artifacts:

- `test-results/signature-probe-R1-same-si-47841-nk-or-invalidates-signature-tablet/`
- `test-results/signature-probe-R2-remount-32426-d-signature-has-visible-ink-tablet/`

Both include screenshots, error context and trace.zip. Their failure is at lines
66/75, before resize/remount, after the draw/Confirm flow. This is distinct from
the prior review's failures after resize/remount with initially visible ink.

## Return instructions

Keep implementation/review gates unchecked. Fix F1 without weakening the probes;
first obtain a typed, confirmed preparation packet for remaining behaviour. Resolve
F2–F7, supply actual GREEN plus fault-sensitivity evidence and stop for independent
review. No additional service, physical tablet or signature_pad version change is
established as necessary to resolve the library reinitialization defect. I-04,
I-06 and deployment remain separately gated.

## Inspected snapshot hashes — not accepted

```text
4260d5b9a1ad83fb89b126e86733674671e5cce7711bcd35875dcd16da62a20f  docs/handoffs/entry-media-tests.sha256
656a2019b2852eff537077bae5e60f2c196f6ec1c1dcd1872612c32cd4f6b410  docs/handoffs/pre-issuance-tests.sha256
526e25fd4e89607f91b5148084fcf09f749c8545a56c2a11b4d0cb5e308715a9  apps/tablet/src/features/signature/SignaturePad.tsx
be146cfa96e550c29a30cb7aaa220a974b9f8bda543d499c66bd22dd06a3d97f  apps/tablet/src/routes/EntryFlow.tsx
4fad4943df9c121a173361bb1c915ed42fe58c2ed2e105f434359ca1899f4f0f  apps/tablet/src/features/photos/PhotoCapture.tsx
e485b41751d73768b268e6e0176d502f4c81a4ddc2b5be2157a766323a975e7c  apps/tablet/src/features/photos/encoder.ts
72e1ef635f56c6c43580d2973f612e3893fd2e56eb319c8b0a7f1ddad4a3bc35  apps/tablet/e2e/signature-probe.spec.ts
```
