# Handoff — entry-media C1/C2 correction

Date: 2026-10-18. Implementer session (owner-directed; UX-00 record:
`docs/handoffs/ux-00-readiness.md`). Source:
`docs/reviews/entry-media-v1-v6-rereview.md` (CHANGES_REQUIRED) and its
disposition to prepare the C1/C2 regressions, implement, run gates and return
for independent re-review. Prepared handoff:
`docs/handoffs/entry-media-c1-c2-prepared.md`; frozen baseline:
`docs/handoffs/entry-media-c1-c2-tests.sha256` (rev 2).

**No checkbox is ticked by this record.** F-04, I-01, I-02, I-03 and I-05 keep
both boxes unchecked; only an independent reviewer may approve. C1/C2 are
corrections to an existing batch awaiting review, not new scope. No contract,
API, route, migration or business rule changed.

Related cases: CAM-05 (teardown), SIG-01/SIG-02/SIG-05 (canvas capture,
resize/confirm binding, achieved through the existing acknowledgement binding).
No PRD rule was changed; the approved E-02/E-03 limits and the B-02 single-form
flow are untouched.

## Files changed

| File | Change |
| --- | --- |
| `apps/tablet/src/features/photos/PhotoCapture.tsx` | `cancelAcquisition` now shares `stopCamera`'s immediate teardown (abort, ref clear, track stop, video pause/detach, state reset, encoding-generation bump) when an acquisition is pending; the existing post-`play()` guard still discards the late settlement. Header note records the C1 correction. |
| `apps/tablet/src/features/signature/SignaturePad.tsx` | C2 correction: `invalidateConfirmed` clears the local confirmation, notifies the parent `onChange(null)` and bumps the hydration generation; `beginStroke`/`endStroke` both invoke it; a new `parentCaptureRef` tracks the parent's acknowledged capture from the pad's first render (render-time `useRef` initializer plus prop sync) so a remounted pad invalidates it even before the restore decode lands. `invalidate`, the summary-change effect, `handleClear` and the hydration error path clear `parentCaptureRef` too. No stroke, pad or lifetime change. |

Workflow artifacts changed: the rev-2 baseline revision (see below) plus this
handoff, `docs/review-requests/entry-media-c1-c2.md`, and the fault-sensitivity
script/log. Acceptance files were not edited after the rev-2 freeze.

## RED evidence (before any production change)

- `pnpm --filter @echallan/tablet exec vitest run src/__tests__/photo-cancel-play.test.tsx src/__tests__/signature-invalidation.test.tsx`
  — **2 files failed / 4 tests failed**. C1: `expected "vi.fn()" to be called at
  least once` (track `stop` never called while `play()` was pending). C2:
  `expected last "vi.fn()" call to have been called with [ null ]` (no parent
  invalidation) and `expected "vi.fn()" to not be called at all, but actually
  been called 1 times` (`drawImage` from the stale decode).
- `pnpm exec playwright test apps/tablet/e2e/entry-media-invalidation.spec.ts --project=tablet`
  — **C2a failed** at `expect(getByText('Driver signature captured.')).toHaveCount(0)`;
  C2b passed pre-fix as designed (regression guard, disclosed in the prepared
  record).

## GREEN evidence

- Focused unit: `pnpm --filter @echallan/tablet exec vitest run src/__tests__/photo-cancel-play.test.tsx src/__tests__/signature-invalidation.test.tsx`
  — **2 files, 5 tests passed** (2 C1 + 3 C2 after the rev-2 addition).
- Focused browser: `pnpm exec playwright test apps/tablet/e2e/entry-media-invalidation.spec.ts --project=tablet`
  — **2 passed**.
- Tablet suite: `pnpm --filter @echallan/tablet run test` — **9 files, 74
  passed** (69 existing unchanged + 5 new).
- Baseline verification: `sha256sum -c docs/handoffs/entry-media-c1-c2-tests.sha256`
  — all entries OK (rev 2).

## Baseline revision rev 2 (documented planner correction)

During implementation the browser C2a run exposed that the rev-1 unit
acceptance did not pin the parent-notification behavior for a remounted pad
(the confirmation then exists only in `initialCapture`). Rev 2 added one C2
unit case (remount: decode success, then a stroke notifies the parent) and one
assertion in the delayed-decode case (notification while the decode is still
pending); Prettier normalized the added test's whitespace before the revision
was finalized. No assertion was weakened or removed. rev 1 archived at
`docs/handoffs/entry-media-c1-c2-tests-rev1.sha256`. Reviewer confirmation of
this revision is required.

## Fault sensitivity (disposable copy)

`docs/handoffs/entry-media-c1-c2-fault-sensitivity.sh` against
`/tmp/opencode/echallan-faults` (refreshed from this workspace); log saved as
`docs/handoffs/entry-media-c1-c2-fault-sensitivity.txt`:

| Fault | Result with fault | After restore |
| --- | --- | --- |
| C1 immediate cancel teardown removed | 2 failed (2) | 2 passed (2) |
| C2 parent notification removed | 3 failed (3) | 3 passed (3) |
| C2 stroke hydration invalidation removed | 1 failed / 2 passed | 3 passed (3) |

Browser-level failure sensitivity for C2a is the recorded rev-1 RED run above
(the injected fault class — no parent invalidation — is exactly the pre-fix
behavior); the copy runs cover the unit guards' specificity.

## Full gate sequence (run after GREEN, sequentially)

| Command | Result |
| --- | --- |
| `pnpm run format:check` | PASS (all files) |
| `pnpm run lint` | PASS, 0 errors; 1 pre-existing warning (`SignaturePad.tsx` unused eslint-disable, line 241, unchanged from the rereview's noted warning at the old line 201) + 116-file import-boundary pass |
| `pnpm run typecheck` | PASS (all workspaces + e2e tsconfig) |
| `pnpm run test` | PASS: contracts 42, api 101, admin 14, tablet 74 |
| `pnpm run test:integration` | PASS: 103 real-PostgreSQL tests |
| `pnpm run test:e2e` | PASS: 40 (38 previous + 2 new), ~1.5 min |
| `pnpm run build` | PASS (shared packages, API, tablet, admin) |
| `pnpm run check:tablet-size` | PASS: 149348 B gzip initial (threshold 250000) |
| `pnpm run test:foundation` | PASS: all 27 in one run (162 s); no contention timeout this time |

## Browser/machine checks (Playwright MCP, live stack)

Screenshots under `.playwright-mcp/`: `c1c2-signature-step.png`,
`c1c2-camera-failure-state.png`, `c1c2-summary-review.png`,
`c1c2-summary-after-edit.png`, `c1c2-blank-pad-after-edit.png`.

- Confirm → Back to summary shows "Driver signature captured."; returning and
  drawing a new stroke clears it; reopening the step shows a blank pad with
  Confirm disabled and no restored ink. Verified live, including an immediate
  edit right after the step remount.
- Camera in this environment reports the distinct recoverable
  "Camera permission was denied." state with Start camera available; no false
  photo and no gallery fallback. (Permission acquisition itself is the fake
  browser device here, not hardware.)
- One MCP attempt initially showed the notice persisting; it was reproduced as
  a script artifact (stale canvas coordinates after step re-navigation, the
  stroke never landed on the canvas). Re-measured and re-run, the behavior is
  correct; this is recorded so the observation is not mistaken for a defect.

Pending, not claimed: real rear-camera cancellation on device, real
stylus/signature feel, and the B-03/V-03 device gate. A late-`play()` cancel
cannot be reproduced with a physical camera in this harness; the component
tests are the executable proof, and the device check remains separately gated.

## Known issues / notes

- The pre-existing `pnpm run lint` warning at `SignaturePad.tsx` was left
  untouched to keep the correction diff minimal.
- `captureRef`/`captureState` semantics for provisional strokes are unchanged.
- The rev-2 unit case for the remount path is the durable regression for the
  behavior the browser caught; the browser E2E remains the journey-level proof.

## Review request

See `docs/review-requests/entry-media-c1-c2.md`. Independent review must verify
the changed source, the preserved acceptance (including the rev-2 revision),
the fault-sensitivity record, and rerun the standard gates; then decide
PASS/CHANGES_REQUIRED/BLOCKED. No review box may be ticked from this session.
