# Independent entry-media review

**Latest checkpoint:** V1–V6 completion re-review on 2026-10-17 remains
**CHANGES_REQUIRED**. See `docs/reviews/entry-media-v1-v6-rereview.md`: decoded
images and fault-sensitivity evidence are supplied; standard suites pass (224
unit / 102 database / 36 browser / 27 foundation after isolated rerun), but two
existing camera/signature lifecycle paths remain open. Playwright MCP is repaired
and smoke-verified. Earlier reports remain historical evidence.

Date: 2026-10-16. Verdict: **CHANGES_REQUIRED**.

Role: independent reviewer of R1–R5 + I-02/I-03, feature
`specs/006-camera-signature`, requested by
`docs/review-requests/entry-media.md`. This session did not implement the batch.
F-04, I-01, I-02, I-03 and I-05 implementation boxes are returned to unchecked;
all review boxes remain unchecked. No production or acceptance files were fixed
in this review. No accepted snapshot is issued.

## Findings

### EM-01 — High: authenticated entry cannot load its catalogues

`apps/tablet/src/features/issuance/useCatalogues.ts:40–42,59` defaults to raw
`fetch`, with only an Accept header, rather than the authenticated client.
The real browser run signs in successfully, then receives 401 for every
`/masters/*` request. Entry remains at the recoverable error instead of showing
the form. Restore authenticated catalogue transport and verify through real
login/API browser acceptance. Contract validation alone does not cover transport.

### EM-02 — High: R2 still accepts stale validation/preview results

`apps/tablet/src/routes/EntryFlow.tsx:150–158,275–310`: material edits neither
advance request counters nor cancel requests. `sentRevision` and `revision` at
line 310 belong to the same async callback closure, so the comparison cannot
observe a later render's revision. Validation 422/errors are applied without any
draft-revision check; JSON decoding has additional unguarded waits. An old
validation can start an old preview, resurrect summary, or overwrite errors after
an edit/registry selection. Compare a captured request generation/revision to a
live current reference after every await, including error/JSON paths, and prevent
conflicting review actions. Add deferred-request tests against EntryFlow itself.
The hook-only `result.current.bindRevision` test does not exercise this closure.

### EM-03 — High: signature screen throws before mounting

`apps/tablet/src/features/signature/SignaturePad.tsx:132–134` evaluates
`handleEndStroke` in an effect dependency array before its `const` declaration.
Typecheck/build report TS2448/TS2454; rendering this function also encounters the
JavaScript temporal dead zone. Correct callback ordering and test the actual
signature component, rather than only its schema and RefusalForm.

### EM-04 — High: camera stream is not attached; pending acquisition leaks

`apps/tablet/src/features/photos/PhotoCapture.tsx:83–106,219–243`: the video is
conditionally mounted only after `streaming` becomes true. Immediately after
`setStreaming(true)`, `videoRef.current` is still null on first start; there is no
subsequent effect/ref callback to assign `srcObject`. Live preview/frame readiness
therefore never starts normally.

There is also no pending/cancel generation: the Start button stays available
during permission acquisition, no cancel action is exposed then, and a stream
resolving after unmount is stored after cleanup already ran. Stop late streams,
make pending permission cancellable, and guard capture completions against
stop/exit/new generations. Encoding failures currently disable capture with no
direct retry; insecure context is never detected explicitly. Verify recovery,
late acquisition/encoding and reopen paths with controlled promises.

### EM-05 — High: media and acknowledgement never reach entry state

`apps/tablet/src/routes/EntryFlow.tsx:616–655` supplies no `onChange` to
PhotoCapture, SignaturePad or RefusalForm. Their data exists only in local child
state; leaving signature for refusal/form unmounts and loses photos/signature.
No parent evidence validity or signed/refused acknowledgement is recorded.
The `acknowledged` boolean is only the duplicate-warning checkbox. Passing a
revision string to a display does not bind a captured acknowledgement.

Lift transient data into the active issuance flow, preserve valid work through
Back navigation, integrate minimum-photo validity, and invalidate signature AND
refusal when the canonical summary changes. Storage/submission remain later
tasks, but these local-state requirements are explicitly in this batch.

### EM-06 — High: resize can retain signed state over a blank canvas

`apps/tablet/src/features/signature/SignaturePad.tsx:61–77,93–103,155–159,226`:
every resize clears backing pixels and the pad, but only a threshold-triggered
resize invalidates `capture`. A small resize can leave Confirm enabled for an
old capture over a blank canvas. DPR changes up to 5% are ignored despite E-03's
any-DPR-change rule. After a threshold invalidation, a fresh stroke does not clear
`invalidated`, so Confirm remains disabled unless Clear is also pressed.
`summaryRevision` changes do not clear capture/refusal state in either media
component. Also scale the drawing context consistently with backing DPR and
remove the 720px cap if the required full available canvas width exceeds it.
Test actual visible PNG strokes, small/large resize, rotation, DPR, redraw and
revision replacement.

### EM-07 — High: acceptance integrity and coverage are insufficient

`sha256sum -c docs/handoffs/entry-media-tests.sha256` fails for
`corrections.test.tsx` and `camera-capture.test.tsx`. No separate approved baseline
correction is established by this review. The archived and active pre-issuance
manifests also mismatch `docs/decisions.md`; that file contains disclosed newer
decision additions, but historical hashes must stay preserved and the difference
must be reconciled explicitly by the planner.

`apps/tablet/src/__tests__/camera-capture.test.tsx:78–118` checks absence of a
capture button before starting, static four-photo text and zero-photo text. It
does not start a camera, prove disabled capture before real frames, attempt a
fifth capture, delete the last photo, or exercise cleanup/recovery. Changing the
readiness assertion to Start-button visibility loses the required assertion.
The fake encoder never decodes a real JPEG, and its alleged downscale test
expects failure. `signature.test.tsx` never imports SignaturePad. The browser
`camera-signature.spec.ts:20–27` only visits `/` and expects an e-Challan button,
without sign-in, camera, strokes, confirmation or revision binding; its detailed
journey comments are unsupported. R2/R3 tests call hook helpers unused by the
actual production flow, so their green result does not verify the integration.

Return test defects/coverage and manifest revision to the planner first; preserve
assertions and historical manifests. Require independent confirmation of the
corrected packet before production fixes. Disposable-copy failure sensitivity,
required by the brief, is deferred in the handoff and was not demonstrated here.

### EM-08 — Medium: encoder distorts aspect ratio and misses recovery paths

`apps/tablet/src/features/photos/encoder.ts:52–58,71–88` clamps width and height
independently (e.g. a 3840×2160 frame becomes 1920×1440), distorting evidence.
Factory/context/drawImage errors occur outside the encoder's catch and can
reject the capture handler without a recoverable notice. The success path only
accepts the target budget; final output below the hard maximum but above target
is rejected without an explicit approved target-vs-hard-limit interpretation.
Use proportional scaling, catch rendering failures, and have the planner confirm
the budget retry expectations with decoded synthetic image coverage.

### EM-09 — Medium: combined gates fail and handoff diagnosis is inaccurate

The rerun confirms failures in format, lint, typecheck, unit, browser and build
gates (see below). The nine unit failures are three foundation cases, five repeat
cases and one refusal case. Repeat cases stop before the form because catalogue
fixtures are rejected, not at changed summary wording. The refusal assertion
fails because it matches multiple visible elements, not because errors failed to
render. `docs/handoffs/entry-media.md:109–145` cannot justify completion on these
results. Correct the evidence after planner-owned fixture/assertion repairs and
production fixes; provide actual RED/GREEN, full gates and fault-sensitivity logs.

### EM-10 — Medium: native select typography override is not applied

`apps/tablet/src/routes/EntryFlow.tsx:747–761` renders plain HTML selects.
`packages/theme/src/createTheme.ts:97–108` targets MuiNativeSelect and cannot style
these elements. The inline font size does not establish the approved self-hosted
font family. Verify computed font, usable form/canvas width, focus, touch gaps and
200% zoom in the actual signed-in form. Current R4 token-only checks are not
geometry/typography acceptance. These measurements remain unproven here.

## Verification actually rerun

Commands are the request's exact commands. Checks continued after failures for
independent diagnosis; this is not a successful ordered gate run.

| Command | Actual result |
| --- | --- |
| `sha256sum -c docs/handoffs/pre-issuance-tests.sha256` | FAIL: decisions.md mismatch; other listed entries OK |
| `sha256sum -c docs/handoffs/pre-issuance-tests-rev2.sha256` | FAIL: decisions.md mismatch; other listed entries OK |
| `sha256sum -c docs/handoffs/entry-media-tests.sha256` | FAIL: corrections and camera-capture tests mismatch; other 6 entries OK |
| `pnpm --filter @echallan/contracts exec vitest run test/issuance.test.ts` | PASS: 17 tests |
| `pnpm --filter @echallan/tablet exec vitest run src/__tests__/corrections.test.tsx` | PASS: 15 tests, subject to EM-07 |
| `pnpm --filter @echallan/tablet exec vitest run src/__tests__/pre-issuance-entry.test.tsx` | PASS: 14 tests |
| `pnpm run format:check` | FAIL: 14 files reported |
| `pnpm run lint` | FAIL: 8 unused-variable errors in new tests; boundary script not reached |
| `pnpm run typecheck` | FAIL: test fixtures/types/unused values; useLookupController.ts:67 fetch argument type; SignaturePad.tsx:132 declaration order; e2e typecheck not reached |
| `pnpm run test` | FAIL: contracts 42, API 101, admin 14 pass; tablet 54 pass / 9 fail (211 pass / 9 fail overall) |
| `pnpm db:up` | PASS: both local database containers healthy |
| `pnpm run test:integration` | PASS: 9 files, 102 real-PostgreSQL tests |
| `pnpm run test:e2e` | NOT COMPLETE: tool terminated after 240000 ms; multiple tablet failures already observed, catalogue requests return 401; no full-suite pass/count claimed |
| `pnpm run build` | FAIL: tablet TypeScript errors prevent Vite production build |
| `pnpm run check:tablet-size` | Command reports 147603 B gzip, but from existing old dist assets: NOT acceptance evidence for this source because build failed |
| `pnpm run test:foundation` | NOT COMPLETE: tool terminated after 120000 ms; clean-artifact typecheck and unit gates already FAIL; no 27-test pass claimed |

Captured large command output is retained by the harness at:

- Unit: `/home/soloengine/.local/share/opencode/tool-output/tool_144d56daf0016xOmzoycSDiLTm`
- Browser: `/home/soloengine/.local/share/opencode/tool-output/tool_144d7565e0012bQwHF95IvvXmv`

The timeouts are reported as incomplete, not converted to passing checks.
No mutation/fault-injection run was performed and no hardware checks were done.

## Acceptance coverage and return

- UI-01–03 / F-04: token changes present; actual form transport, typography and
  geometry acceptance fail or remain unproven (EM-01/09/10).
- ENT-01–06 / I-01: 14 focused tests green; real browser entry blocked and stale
  validation/preview integration still incorrect (EM-01/02).
- REP-01–05 / I-05: existing DB service checks green; five repeat UI tests fail.
  R3 resets the warning boolean on changed preview, but navigation at
  EntryFlow.tsx:343–351 still uses the old `acknowledged` closure in that same
  call, so renewed warning review can be bypassed on that response. Require an
  integration test with previously acknowledged duplicate + changed re-preview.
- CAM-01–05 / I-02: schema/fake-encoder checks are partial; real live-preview,
  limits, state validity, cleanup and recovery are not established (EM-04/05/07/08).
- SIG-01–05 / I-03: refusal schema and positive form work partially, but actual
  signature render, PNG pixels, resize and entry binding fail or lack tests
  (EM-03/05/06/07).
- Real-device rear camera, permissions, stylus/finger feel, glare/gloves and
  trusted-HTTPS acceptance remain pending B-03/V-03. This alone is not presented
  as the cause of the code-review rejection.

Next handoff: planner corrects/strengthens and freezes acceptance with explicit
baseline correction evidence, then implementer corrects EM-01–06/08–10 and reruns
all gates plus isolated-copy sensitivity. Obtain fresh independent re-review.
I-04/I-06 remain outside this review's implementation scope.

## Inspected baseline hashes

SHA-256, observed snapshot only; **not accepted**:

```text
31a9932b158e4bbc6c8ece412d8504fa03143a4ede6539700eaf11dc640c38fb  docs/handoffs/entry-media-tests.sha256
ba2b0a21850073b26e049dfb6cdec153032cdf74b45d9f38fe092d90fb8fd563  docs/handoffs/pre-issuance-tests.sha256
27076b9880ccdd0e53349be7bab51a54771460f4b63e5ff14c76cf6bd4d1a8fe  docs/handoffs/pre-issuance-tests-rev2.sha256
bfd2fc86238a9bd23231f3a9fd01c557f3cff26e321c312a257b936e64399ccd  apps/tablet/src/routes/EntryFlow.tsx
dc81dd34c9de4a7879b3023cc3fa5412da7b6b8fae196d82ed7da096d07e96ae  apps/tablet/src/features/issuance/useLookupController.ts
5b0fe5e515ca318c7777472ff4c803eafa161371bc5e7edfb37fda544431769e  apps/tablet/src/features/issuance/useDraftRevision.ts
7c85fb0c7e7eafe918676686810c9754b0fda9f9796429d0fa4bdc28618f66e9  apps/tablet/src/features/issuance/useCatalogues.ts
7e3db53c34a1bf9e8e622d321daed92021b5c12b446fe954e45d6aa908c03715  apps/tablet/src/features/issuance/serverErrors.ts
1b42a92f74cd0668701c4ae2cf52957b7568f511e16e57431470e5fd4e8a3bbd  apps/tablet/src/features/photos/PhotoCapture.tsx
2101ddb8f065099dc237ac8d0ecc82bc3332e1e99246b555097fae86befc672c  apps/tablet/src/features/photos/encoder.ts
a7113a0d3432a581cac5e67969d50af84c2532106cea60d1357de9c5e1451d8c  apps/tablet/src/features/signature/SignaturePad.tsx
5f646cee4ac3338913d99799b643ff06816ba9c9aeafb1e0fb37ab86d6f9c8be  apps/tablet/src/features/signature/RefusalForm.tsx
c56c192d6e8f22e718cc0a1804ca567764944cb90a784e2227b5063017d53ae2  apps/tablet/src/__tests__/corrections.test.tsx
edcb631279e617c72c045436d1b84751aae6afd91e61eff404ab32fca226009c  apps/tablet/src/__tests__/camera-capture.test.tsx
b5ac198767b0b9d3f16a755c730097ab07659ad9949a3d1bfaf40410c27b5f98  apps/tablet/src/__tests__/signature.test.tsx
fb8d916a5496ac48f6e1b3c06549862fe738ef9111216cb699b6fc1c2b79cdb0  apps/tablet/e2e/camera-signature.spec.ts
a40e5c6d1c6ac182d90e526f58ebcf4418c98976ba22fb955420eeee5e71f54c  packages/contracts/src/issuance.ts
e53946377ed134ddee938e5d896f94b3f03762bdd7cac99db90ac0c36db937a3  docs/decisions.md
```
