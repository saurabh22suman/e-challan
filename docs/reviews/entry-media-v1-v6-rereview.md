# Entry-media V1–V6 completion re-review

Date: 2026-10-17. Verdict: **CHANGES_REQUIRED**.

Independent review of the appended V6-completion evidence in
`docs/handoffs/entry-media.md`, requested at `docs/review-requests/entry-media.md`.
Baseline: entry-media rev9 / pre-issuance rev5. No application fixes or frozen
acceptance edits were made by this reviewer. No review approval or accepted
snapshot is issued; affected task boxes remain unchecked.

## Verified progress

The two previously deferred V6 deliverables are now supplied:

- Four actual browser JPEG encode/decode cases, passing against the production
  encoder, with dimensions/aspect/target/hard-limit checks.
- A disposable-copy fault-sensitivity script and recorded fault/restored results.
  Reviewed the script and log; did not independently rerun those mutations.
  The script contains seven fault runs; the log additionally records the combined
  stale-guard and hard-dimension faults. Those final two commands are not included
  in the saved script, so the script alone does not reproduce all nine log entries.

The protected spec/plan/tasks and contracts-test inventory is restored in rev9.
Four added camera lifecycle tests and two deferred EntryFlow tests pass. Real
database/role regressions, original reviewer signature probes, changed-preview
binding probes, production builds and the tablet budget all pass. The incorrect
pointer-limitation attribution is explicitly withdrawn in the appended handoff.

Standard rerun totals are **224 unit, 102 PostgreSQL, 36 browser and 27 foundation**.
This closes the former blanket absence-of-evidence objection. Remaining findings
below are concrete paths in the earlier camera/signature lifecycle requirements,
not missing hardware acceptance or new application scope.

## Remaining findings

### C1 — High: Cancel does not immediately stop an already-acquired camera

`apps/tablet/src/features/photos/PhotoCapture.tsx:175–193,213–219`.
When getUserMedia resolves, the stream is attached and `video.play()` is awaited.
During that await, the visible Cancel action only aborts the controller, clears
acquisitionRef and sets acquiring false. It does not stop the acquired tracks,
pause/detach the video, or invoke stopCamera. Tracks are stopped only if the
pending play promise later settles. A new start can begin in the meantime while
the old stream remains active.

**Independent reproduction:** mock getUserMedia to resolve a stream, hold
video.play() pending, assert the stream is attached and play was called, click
Cancel, and assert tracks stop immediately. The actual component fails:
`expected "vi.fn()" to be called at least once`. This is an assertion failure,
not a runtime/setup failure. The newly added acceptance only cancels before
getUserMedia resolves, so it does not cover this acquired-but-playing state.

Required: share immediate stream teardown/capture invalidation with cancel,
including tracks, video attachment and encoding state as appropriate. Discard late
play completion without allowing it to disturb a newer acquisition. Add this
pending-play control plus normal-start/reopen tests.

Saved reviewer reproduction: `docs/reviews/entry-media-cancel-play-probe.txt`.
It was temporarily executed at
`apps/tablet/src/__tests__/reviewer-cancel-play.test.tsx` using:

```bash
pnpm --filter @echallan/tablet exec vitest run src/__tests__/reviewer-cancel-play.test.tsx
```

Result: **1 failed**. It resolves the held play promise in finally and restores
spies; the temporary test was moved to the archived text after execution. No
frozen test or production source was modified. Planner may adopt this case in a
typed acceptance revision without weakening the immediate-stop assertion.

### C2 — High: drawing after confirmation does not invalidate confirmed evidence

`apps/tablet/src/features/signature/SignaturePad.tsx:125–159,217–255,290–300`.
handleEndStroke updates only local capture/confirmable state. It does not clear
confirmedRef, notify the parent that a previously confirmed capture is obsolete,
or advance hydrationGenerationRef. Thus adding a new stroke after Confirm leaves
the parent acknowledging the old PNG until Confirm is pressed again. Back can
restore the old capture even though the operator edited the visible signature.

The same omission allows an in-flight hydration image to overwrite a freshly
drawn stroke: image.onload only compares hydrationGenerationRef, and drawing never
changes that generation despite the source comment claiming it does. Clear,
summary changes and effect cleanup now guard their cases (progress); drawing is
still the missing invalidation boundary from earlier F2/V5 findings.

Required: separate provisional drawing from confirmed evidence consistently.
Invalidate parent confirmation and outstanding hydration when a drawing starts
or changes; preserve valid visible strokes. Test Confirm → add stroke → Back
without reconfirmation, reconfirmed multi-stroke PNG contents, and delayed image
decode → new stroke. Keep the existing stable mount lifetime so this correction
does not reintroduce the old reinitialization regression.

## Coverage/evidence notes

- The decoded-image and recorded sensitivity additions are accepted as supplied
  evidence of progress, not deferred again as absent. The noise-case description
  does not itself establish representative field readability; real-device checks
  remain separate B-03/V-03.
- Deferred-response tests now exercise real held API responses, but use a 700ms
  negative assertion window and do not cover delayed JSON/error paths or
  conflicting reviews. Future preparation should use explicit held-response
  readiness/completion synchronization rather than interpreting a fixed wait as
  all race coverage. No pass of those additional paths is claimed here.
- Separate independent preparation confirmation remains unrecorded and disclosed
  by the request. It is not fabricated by this review. The verdict is grounded in
  C1/C2, not a demand for physical hardware or deployment access.
- Keep I-04 storage, I-06 submission and deployment separately gated.

## Commands actually rerun

| Command | Result |
| --- | --- |
| `sha256sum -c docs/handoffs/entry-media-tests.sha256` | PASS, all 27 listed entries, rev9 |
| `sha256sum -c docs/handoffs/pre-issuance-tests.sha256` | PASS, active rev5 |
| `pnpm run format:check` | PASS |
| `pnpm run lint` | Exit 0; 112-file boundary pass; one unused eslint-disable warning at SignaturePad.tsx:201 |
| `pnpm run typecheck` | PASS, including e2e |
| `pnpm run test` | PASS: 224 (42 contracts, 101 API, 14 admin, 67 tablet) |
| `pnpm db:up` | PASS: both containers healthy |
| `pnpm run test:integration` | PASS: 102 PostgreSQL tests |
| `pnpm run test:e2e` | PASS: 36, approximately 1.3 minutes |
| `pnpm run build` | PASS: shared packages, API, tablet, admin |
| `pnpm run check:tablet-size` | PASS: 148915 B gzip current index-tx7-MAFx.js |
| `pnpm run test:foundation` first run | 26 pass / 1 fail: Other-remarks entry test exceeded 5000ms while heavy suites ran concurrently |
| `pnpm run test:foundation` isolated rerun | PASS: all 27, 144.449 seconds; initial timeout disclosed, not erased |
| Additional acquired-camera cancellation reviewer test | FAIL: 1, immediate track-stop assertion, C1 |

No real-device checks performed. No claim of hardware acceptance is made.
Focused tests are included in root suite results, not separately rerun. Historical
manifests were not rewritten. No independent mutation rerun performed this session.

## Playwright MCP fix (separate configuration work)

User also requested fixing Playwright MCP. This is independent of application
review and does not alter the app/test baseline.

- Reproduced `opencode mcp list`: playwright failed, connection closed.
- Direct `npx -y @playwright/mcp --help` exposed npm ENOTEMPTY renaming Playwright
  inside the shared `_npx/86170c4cd1c5da32` cache.
- Updated only `/home/soloengine/.config/opencode/opencode.jsonc` to use a dedicated
  npm cache, pin `@playwright/mcp@0.0.83`, and run isolated headless installed Chrome.
  Existing npm cache contents were preserved.
- `opencode mcp list` now reports **playwright connected**.
- Executed actual MCP JSON-RPC initialize, tools/list (**25 tools**),
  browser_navigate to a temporary localhost test page, browser_snapshot (asserted
  heading content), and browser_close: all PASS.
- Smoke script: `/tmp/opencode/playwright-mcp-smoke.py`. Temporary HTTP server and
  browser/MCP processes were closed by the smoke check.

Quit and restart OpenCode to reload the changed global MCP configuration in the
interactive session. No system reboot is needed.

## Disposition and next handoff

Leave affected review boxes unchecked. Prepare the two narrowly scoped C1/C2
regressions, confirm the acceptance packet, implement the fixes, run affected
regressions and standard gates, then return for independent re-review. Retain all
new V6 evidence and the stable initialization fixes. The local correction verdict
does not treat unavailable hardware as a blocker; it returns the remaining
software lifecycle defects with actionable references.

## Inspected snapshot hashes — not accepted

```text
0810d60f532b5036d6dc12fcb5c9b8516c77016712516a7d2915553bb9448a8d  docs/handoffs/entry-media-tests.sha256
656a2019b2852eff537077bae5e60f2c196f6ec1c1dcd1872612c32cd4f6b410  docs/handoffs/pre-issuance-tests.sha256
7e11d1823474a1ea723a41bc2910212b5fa021633933fb6696803daf445c291e  apps/tablet/src/features/photos/PhotoCapture.tsx
7f88dcdf1401de40af7570e6aac8aecd195d43f1a4da849fb556cdd6658c1e0f  apps/tablet/src/features/photos/encoder.ts
34ff98c248ad09c13cab662be974cf5395a2a192eb2b4d744ff2857b9b5ad9c3  apps/tablet/src/features/signature/SignaturePad.tsx
e3f4c9fff7a630f752247ce52f668adb95bf08c556508db2262493c043cfbbbb  apps/tablet/src/routes/EntryFlow.tsx
1141e954e617d2da5dd54940c0bcd0885a3b4b491a2a825e8eb4f09a6479e585  docs/reviews/entry-media-cancel-play-probe.txt
```
