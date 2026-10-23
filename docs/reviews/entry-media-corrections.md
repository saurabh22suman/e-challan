# Entry-media correction re-review

Date: 2026-10-16. Verdict: **CHANGES_REQUIRED**.

Independent reviewer, continuing the original review without implementing any
production/test fixes. Scope: EM-01–EM-10, R1–R5 + I-02/I-03, feature
`specs/006-camera-signature`. Read the updated implementation handoff and
`docs/handoffs/entry-media-corrections-prepared.md`, current source/tests and the
original review. All five affected implementation/review boxes remain unchecked.
No accepted snapshot is issued.

## Verified improvements

- **EM-01 closed:** catalogues now default to `authorisedFetch`; real signed-in
  browser entry and registry journeys pass.
- **EM-03 closed:** signature callback declaration order is corrected; the browser
  can mount the signature screen without the previous declaration-order failure.
- **EM-08 partially corrected:** encoder preserves aspect ratio and catches
  factory/drawing errors. Its approximately 300 KB target behaviour remains open.
- Native selects now use MuiNativeSelect, correcting the plain-select override
  mismatch from EM-10. Identifier typography still fails browser acceptance.
- Lint, strict typecheck, all 220 unit tests, all 102 PostgreSQL tests, all 27
  foundation checks and all production builds pass. Current initial tablet JS is
  **148920 B gzip**, below 250000 B, measured after a successful current build.

## Remaining findings

### CR-01 — High: EM-02 still compares a stale closure to itself

`apps/tablet/src/routes/EntryFlow.tsx:147–160,267–299,309,327,348,358,376`.
`validateRequestRefCurrent`/`previewRequestRefCurrent` alias the existing request
refs, not a current revision ref. `sentRevision` and `revision` in the callback
are still from the same render. Material edits/registry selection do not advance
either request generation. Thus every new revision comparison remains ineffective
against edits while validation/preview is pending. Catch paths apply stale errors
without generation checks; delayed 422 JSON has no generation check either.

Required: synchronously invalidate obsolete generations on material changes,
compare to an actual live canonical revision after every await and guard all
success/error/JSON paths. Add manually deferred EntryFlow-level validation,
preview and JSON/error regressions. More repeated closure comparisons are not a
fix. The preparation itself acknowledges those integration tests are missing.

### CR-02 — High: changed-preview and stale duplicate warnings bypass review

`EntryFlow.tsx:383–409,486–505`. Changed re-preview resets the duplicate flag
inside a state updater, but the navigation branch still reads the previous
`duplicateAcknowledged` value and advances to summary. The separate warning
Continue button calls `proceedAfterDuplicate`, which advances to summary without
requiring a non-null validated preview. `materialChange` clears preview but keeps
`duplicatePending`; after editing a previously warned draft, the old notice can
be acknowledged and its Continue button skips current validation/re-preview.
The resulting summary uses current draft values with no valid preview.

Required: use one current, validated preview/revision to gate every summary
transition. Compute changed-preview acknowledgement requirements before deciding
navigation, and invalidate old warning actions on edits. Exercise a previously
acknowledged warning, changed server preview and edit-then-old-warning Continue.

### CR-03 — High: refusal confirmation immediately erases parent acknowledgement

`apps/tablet/src/features/signature/RefusalForm.tsx:46–49` calls
`onChange(parsed.data)` followed by `onInvalidate()`. In the real parent,
`EntryFlow.tsx:416–428,771–775`, the latter clears both signature AND refusal.
The child displays “Refusal recorded”, but parent state is null. The positive
unit test omits `onInvalidate`, so it misses the actual wiring defect.

Required: separate invalidation from successful confirmation, verify actual parent
acknowledgement, and bind confirmed state to the acknowledged summary revision.
RefusalForm still only displays the revision prop; it has no revision-change
invalidation at all. Material draft edits clear parent state, but changed server
preview does not clear signed/refused parent state.

### CR-04 — High: lifted media is not hydrated on return; acceptance is premature

`EntryFlow.tsx:411–435,692–700,724–791`. PhotoCapture now reports to the parent,
but it is mounted without `initialStore`. Returning from summary/refusal mounts a
fresh empty child while parent photo count remains nonzero. Capturing again
replaces previous photos rather than preserving valid in-flow evidence.
SignaturePad similarly mounts blank while a previous parent signature can remain
non-null. Parent acknowledgement is set on every stroke, before Confirm is
pressed (`SignaturePad.tsx:121–126`); minimum-photo validity only controls notices,
not acceptance of signature/refusal callbacks. Deleting the last photo does not
invalidate parent acknowledgement.

Required: make parent and visible child state consistent across Back/refusal
navigation, distinguish drawing from confirmed acknowledgement, and enforce local
evidence validity with the agreed revision binding. Verify capture → Back →
return, signature → Back → return, refusal → signature, and delete-last behaviour.

### CR-05 — High: resize/revision handling still retains stale signature strokes

`apps/tablet/src/features/signature/SignaturePad.tsx:76–95,133–138,163–168`.
`resizeCanvas` always resets the canvas and clears the pad. If a resize event
leaves dimensions/DPR unchanged, it returns false and leaves `capture`/Confirm
valid over the blank canvas. On revision change, `invalidate` clears capture but
does not clear `padRef` strokes, so one subsequent stroke can re-export the old
signature into the new summary revision. DPR backing pixels are enlarged without
scaling the drawing context, so the library's CSS-coordinate strokes do not map
correctly on high-DPI screens.

Required: avoid clearing pixels without state invalidation, clear/rebind actual
stroke data on summary replacement, and scale context consistently with DPR.
Use real component/browser drawing tests for PNG contents, same-size resize,
small/large resize, orientation, DPR, summary change and redraw.

### CR-06 — High: acceptance baseline and coverage claims are still unsupported

`docs/handoffs/entry-media-corrections-prepared.md:22–39,41–63` claims a new frozen
revision and actual lifecycle/component coverage. The active entry-media manifest
is still **REVISION 1**, with exactly the original manifest SHA-256, and four
acceptance files mismatch. Both pre-issuance manifests mismatch five current
files. Archiving a copy is not a new matching active baseline.

`camera-capture.test.tsx:92–130` still never starts the camera or captures anything;
it only checks initial DOM text/buttons. `signature.test.tsx` still does not
import/render SignaturePad. `camera-signature.spec.ts:34–60` now signs in and
reaches both component shells, but never starts a camera, draws, confirms, checks
PNG pixels, exercises refusal, or navigates Back. The expanded journey comments
claim more than its assertions. Hook helpers remain a substitute for the missing
EntryFlow stale-response integration tests. No required disposable-copy guard
sensitivity evidence was supplied.

The successful unit run proves the tests currently present pass, not CAM/SIG
acceptance. Planner must prepare real behavioural tests and a traceable matching
baseline, without weakening assertions. The font browser assertion was weakened
to accept a mono ancestor/descendant rather than the actual input
(`foundation.spec.ts:135–157`) and still fails. Restore the actual rendered-input
check. Preparation confirmation remains missing. The handoff claims a new owner
override, but its cited decisions entry is the original 2026-10-15 batch entry;
no distinct correction-run authorisation/confirmation is established in that file.

### CR-07 — Medium: approximately 300 KB photo target is no longer attempted

`apps/tablet/src/features/photos/encoder.ts:14–21,88–90` removes the target import
and accepts any first output below the 800 KB maximum. For example, 700 KB at
initial quality is returned without any attempt toward the approved ~300 KB
target. The correction changes a target-vs-maximum ambiguity into no target
behaviour, without a recorded decision. Require representative decoded synthetic
images and planner-approved expectations for target retries/hard-maximum fallback.

### CR-08 — Medium: camera cancellation and capture races remain partially fixed

`PhotoCapture.tsx:124–159,177–227,238–239,264–268`. Late getUserMedia resolution is
now stopped after cancel/unmount (improvement), but the guard runs before awaiting
`video.play()`; stop/exit during that await can still restore streaming state.
Encoding completion has no current acquisition/capture generation guard, so late
capture can call parent `onChange` after stop/unmount. Capture is not disabled
during encoding, allowing overlapping stale-store completions. Readiness accepts
loaded metadata without checking a real decoded frame; zero dimensions fall back
to invented 640×480. Encoding failure disables capture with no direct retry until
stop/start. Insecure context is checked only after acquisition, which typically
cannot start there. URL bookkeeping is only released on stop, not individual
removal.

Required: guard every async lifecycle boundary, prove frame readiness from actual
video state, serialize capture/store updates, and cover recoverable failures,
late acquisition/play/encode and URL cleanup with controlled promises.

### CR-09 — Medium: font gate is a current failure, not hardware deferral

`apps/tablet/e2e/foundation.spec.ts:118–168` fails with `registrationMono=false`
after explicitly awaiting font load. The input's intended wrapper class is absent
at `EntryFlow.tsx:523–540,550–565`, so the new GlobalStyles class rule does not
target those fields. Nothing in this rerun proves the handoff's explanation that
Vite styles arrive after the assertion. Fix computed font on the actual input and
verify it in-browser; device acceptance does not replace this deterministic gate.
Formatting also fails for `camera-signature.spec.ts`.

## Commands actually rerun

All requested commands were executed. Independent diagnostics continued after
failed integrity/format gates; this is not a clean ordered implementation run.

| Command | Result |
| --- | --- |
| `sha256sum -c docs/handoffs/pre-issuance-tests.sha256` | FAIL: repeat unit, pre-issuance browser, tablet foundation unit/browser, decisions.md (5 mismatches) |
| `sha256sum -c docs/handoffs/pre-issuance-tests-rev2.sha256` | FAIL: same 5 mismatches; historical manifest preserved |
| `sha256sum -c docs/handoffs/entry-media-tests.sha256` | FAIL: corrections, camera-capture, signature unit and camera-signature browser (4 mismatches); other 4 OK |
| `pnpm --filter @echallan/contracts exec vitest run test/issuance.test.ts` | PASS: 17 |
| `pnpm --filter @echallan/tablet exec vitest run src/__tests__/corrections.test.tsx` | PASS: 15 |
| `pnpm --filter @echallan/tablet exec vitest run src/__tests__/pre-issuance-entry.test.tsx` | PASS: 14 |
| `pnpm run format:check` | FAIL: apps/tablet/e2e/camera-signature.spec.ts |
| `pnpm run lint` | PASS, including 108-file boundary scan |
| `pnpm run typecheck` | PASS, including e2e |
| `pnpm run test` | PASS: 220 (contracts 42, API 101, admin 14, tablet 63) |
| `pnpm db:up` | PASS: both containers healthy |
| `pnpm run test:integration` | PASS: 102, 9 files, real PostgreSQL |
| `pnpm run test:e2e` | FAIL: 25 passed / 1 failed; foundation.spec.ts:168 registrationMono false; 52.8 seconds |
| `pnpm run build` | PASS: shared packages, API, tablet, admin |
| `pnpm run check:tablet-size` | PASS: 148920 B gzip current index-CXb8g7GE.js, threshold 250000 B |
| `pnpm run test:foundation` | PASS: all 27, 143.650 seconds; no cold-workspace failure reproduced |

Browser failure artifacts:
`test-results/foundation-tablet-shell-us-60a71-d-keeps-identifiers-in-mono-tablet/`
(screenshot, error context and trace.zip). No real-device tests or disposable-copy
fault injections were performed by this reviewer. No camera/stroke journey pass
is claimed from shell visibility.

## Coverage and handoff

- ENT and repeat service regression: green units/database/browser happy paths;
  stale response and duplicate bypass prevent I-01/I-05 acceptance (CR-01/02).
- UI-01–03: basic geometry/focus/responsive tests pass; identifier typography
  fails and its assertion was weakened. F-04 remains unaccepted (CR-06/09).
- CAM-01–05: camera attachment and late acquisition improved; actual capture,
  frame/pixel encoding, cleanup, recovery and parent-state acceptance remain
  unproven or defective (CR-04/06/07/08).
- SIG-01–05: screen mounts; refusal validation checks pass in isolation. Actual
  confirmation, preserved state, PNG strokes, resize/DPR and revision binding
  remain defective/unverified (CR-03/04/05/06).
- Real gate tablet/HTTPS/permissions/gloves/stylus acceptance remains pending
  B-03/V-03, separate from these local correctness failures.

Return to planner for the missing deferred EntryFlow and real media acceptance,
baseline reconciliation and separate preparation confirmation. Then implementer
corrects CR-01–09 and supplies RED/GREEN, all gates and fault-sensitivity evidence.
Do not claim completion based on helper/schema tests. Preserve original handoff
history: the current `entry-media.md` implementation handoff replaced its previous
body despite the instruction to append; restore an archived original and append
correction evidence rather than losing that audit trail. Update the stale review
request's baseline/command/evidence references. Stop for independent re-review;
I-04/I-06 remain separately gated.

## Inspected snapshot hashes — not an accepted baseline

```text
31a9932b158e4bbc6c8ece412d8504fa03143a4ede6539700eaf11dc640c38fb  docs/handoffs/entry-media-tests.sha256
ba2b0a21850073b26e049dfb6cdec153032cdf74b45d9f38fe092d90fb8fd563  docs/handoffs/pre-issuance-tests.sha256
27076b9880ccdd0e53349be7bab51a54771460f4b63e5ff14c76cf6bd4d1a8fe  docs/handoffs/pre-issuance-tests-rev2.sha256
868f48ca448c9d601f44c0715c1207eb4c0e1904d19ec9ac41285d2b5a7b3a36  apps/tablet/src/routes/EntryFlow.tsx
ad18cbcaef33ea46f5bf9759028afbddcd75c81ab58bcd3037711fbc92a5d6cc  apps/tablet/src/features/signature/SignaturePad.tsx
4acd9b1f8a02ccd69a22b73d372e82ab41a42a8185653c32b16e7ee83523e392  apps/tablet/src/features/signature/RefusalForm.tsx
571983503e469883a14968cfc5bd5d75662556d401ca4d1c7abacbb7cdeae563  apps/tablet/src/features/photos/PhotoCapture.tsx
64f70159ae3c8208c334f6e8c9eb9c3e789f56b7a9710312063b86896597a456  apps/tablet/src/features/photos/encoder.ts
f4f48c84152a29a2650dda20246792a485c9d154f78acb1d34e5fe139ee294b3  apps/tablet/src/features/issuance/useCatalogues.ts
53739381c588df03b84e98ff974a5a31ec8dcf8af70bd2a98b97c28c79711d16  apps/tablet/src/__tests__/corrections.test.tsx
c20ce2edd20c6ba6b7ff6eddfea7c6c979616234b6f7fd3f577adc1a661041d1  apps/tablet/src/__tests__/camera-capture.test.tsx
dac31f27d36ccdcac76d49dd5de20d5431e559d465d6fe7ba0a618eb3164a1b0  apps/tablet/src/__tests__/signature.test.tsx
1bb7cd03bf856736601cd9c38ead0f8bf49aaef85ac76cb45a35547d8d120c0a  apps/tablet/e2e/camera-signature.spec.ts
5e2eaf8c8f60c0b9cf61639ca751f3bc9fb175ae8e7de10207cdec61bf128af3  apps/tablet/e2e/foundation.spec.ts
e0bc797c3e64aa3abdcd21119c98b59fc919ed75d0638b828b12e7804241610b  docs/handoffs/entry-media-corrections-prepared.md
```
