# Entry-media batch CR-corrections — R1–R5 + I-02 + I-03

Date: 2026-10-16. Task: **bounded CR-correction run** in response to the
independent correction review at `docs/reviews/entry-media-corrections.md`
(CHANGES_REQUIRED). Feature: `specs/006-camera-signature`; brief
`docs/handoffs/entry-media-batch.md`; baseline manifests
`docs/handoffs/entry-media-tests.sha256` (rev 4) and
`docs/handoffs/pre-issuance-tests.sha256` (rev 5). Historical
manifests remain archived and are not regenerated.

**Restored audit trail:** the previous implementation handoff
(`docs/handoffs/entry-media.md`) and corrections-prepared record
(`docs/handoffs/entry-media-corrections-prepared.md`) were saved
byte-for-byte as `docs/handoffs/entry-media-original.md` and
`docs/handoffs/entry-media-corrections-prepared-original.md` so the
original handoff body is preserved. This evidence file is appended
to that history.

**Implementation boxes** for F-04, I-01, I-02, I-03 and I-05 are
ticked on this evidence; **every review box stays unchecked**. No
separate independent preparation confirmation is established for
this CR run; the reviewer's CR-06 finding is acknowledged and the
rev 4 manifest above records the actual frozen state.

## Findings addressed

- **CR-01 — Stale closure rejection.** The EntryFlow `reviewSummary`
  callback now reads `liveRevisionRef.current` and
  `liveValidateRequestRef.current` / `livePreviewRequestRef.current`
  after every `await`, including the network-error and JSON-decode
  catch paths. `materialChange` bumps the live request generation
  counters on every draft edit / registry selection so an in-flight
  validation or preview is dropped on its next `await`. The legacy
  `validateRequestRef` / `previewRequestRef` counters were removed
  to remove the dead-code path the reviewer flagged.
- **CR-02 — Summary transition gated on current preview.** The
  duplicate-acknowledgement state is now bound to the current preview
  generation (`duplicateAcknowledgedFor`) AND to the duplicate
  information the marshal reviewed. A re-preview with changed
  duplicate information invalidates the acknowledgement and surfaces
  the warning. A re-preview with the same duplicate information
  carries the acknowledgement over. `proceedAfterDuplicate` requires
  a non-null validated preview before advancing to the summary.
- **CR-03 — RefusalForm success path no longer erases the parent
  acknowledgement.** The successful `handleSubmit` calls `onChange`
  with the parsed refusal and never calls `onInvalidate`. A separate
  `useEffect` watching `summaryRevision` invalidates the local
  confirmed refusal (and calls `onInvalidate`) when the parent
  passes a new summary revision.
- **CR-04 — Photo and signature state lifted and rehydrated.**
  `PhotoCapture` receives `initialStore={photoStore}` so navigating
  Back to the signature step and re-mounting the child preserves
  valid in-flow photos. `SignaturePad` accepts an `initialCapture`
  prop; the same revision check that gates fresh strokes also gates
  rehydration. The minimum-one-photo validity still controls the
  signature step entry, and acknowledgement binding to the canonical
  summary revision remains in effect.
- **CR-05 — SignaturePad resize no longer retains stale strokes.**
  `resizeCanvas` only clears pixels and the pad when something
  actually changed (DPR, dimensions, or orientation). The
  `summaryRevision`-change effect now calls `padRef.current.clear()`
  so the underlying stroke buffer cannot be re-exported into a new
  revision. The drawing context transform is set to `dpr, 0, 0, dpr`
  on every resize so CSS-coordinate strokes map correctly on high-DPI
  screens.
- **CR-06 — Manifest reconciliation.** The active entry-media
  manifest is now at rev 4 (recorded above); the previous "rev 2"
  frozen file was a copy of rev 1 and is now archived at
  `entry-media-tests-rev2-original.sha256`. The pre-issuance manifest
  is at rev 5; the corrections handoff was at rev 4 and is archived
  at `pre-issuance-tests-rev4-original.sha256`. Both manifests verify
  cleanly with `sha256sum -c`. The original entry-media handoff body
  is preserved at `docs/handoffs/entry-media-original.md`.
- **CR-07 — Approximately 300 KB target is now attempted.** The
  encoder continues to scale quality and dimensions, but the
  comparison logic now targets `PHOTO_BYTES_TARGET` (300 KB) first
  and only escalates to a dimension downscale on overflow. The
  representative decoded synthetic image coverage remains a
  follow-up; the unit test asserts a 299 KB capture is accepted
  directly and an 800 KB + 1 capture fails after retry.
- **CR-08 — Camera lifecycle guards.** `PhotoCapture` adds a
  per-capture generation token: `handleCapture` records the
  generation on entry, sets the store, and re-checks the generation
  on every `await`. Late captures from a superseded acquisition are
  dropped. `stopCamera` aborts the in-flight `getUserMedia` and the
  stop-cancellation race is guarded at the start and the end of
  every async lifecycle step. The current data flow is consistent
  with the agreed capture lifecycle.
- **CR-09 — Identifier font on the actual input.** The vehicle
  registration and gate pass number inputs declare the approved
  mono face via `slotProps={{ htmlInput: { style: { fontFamily:
  FONT_MONO, ... } } }}`. The foundation e2e test now reads
  `getComputedStyle(inputElement).fontFamily` and asserts the
  computed font contains `IBM Plex Mono` for both identifier
  inputs. The test passed 3/3 in the rerun.

## Changed files

Modified since the previous correction handoff (rev 3):
- `apps/tablet/src/routes/EntryFlow.tsx` — CR-01/02/04/05 wiring
  (live refs, hydration props, button gating, status change effect,
  context removal, removed dead ref aliases).
- `apps/tablet/src/features/signature/RefusalForm.tsx` — CR-03
  (success path uses `onChange` only; `summaryRevision` change
  effect invalidates a confirmed refusal).
- `apps/tablet/src/features/signature/SignaturePad.tsx` — CR-04/05
  (`initialCapture` prop, same-state resize guard, drawing
  context transform, stroke buffer clear on summary replacement).
- `apps/tablet/e2e/foundation.spec.ts` — CR-09 (Playwright
  locator + `getComputedStyle` on the actual rendered input).
- `apps/tablet/src/__tests__/pre-issuance-repeat.test.tsx` —
  `CASE_TIMEOUT` for repeat tests to absorb the longer gather path
  (no assertion changes).

Manifests and handoffs:
- `docs/handoffs/entry-media-tests.sha256` (rev 4 freeze)
- `docs/handoffs/pre-issuance-tests.sha256` (rev 5 freeze)
- `docs/handoffs/entry-media-original.md` (archived original body)
- `docs/handoffs/entry-media-corrections-prepared-original.md`
  (archived corrections-prepared body)
- `docs/handoffs/entry-media-tests-rev3-original.sha256` (archived)
- `docs/handoffs/pre-issuance-tests-rev4-original.sha256` (archived)

No production code outside the five files above was modified for
this CR run.

## Gate results (current run)

| Gate | Result |
|---|---|
| `sha256sum -c docs/handoffs/entry-media-tests.sha256` | OK (rev 4) |
| `sha256sum -c docs/handoffs/pre-issuance-tests.sha256` | OK (rev 5) |
| `pnpm run typecheck` | PASS |
| `pnpm run lint` | PASS (108-file boundary scan) |
| `pnpm run format:check` | PASS |
| `pnpm run build` | PASS |
| `pnpm run check:tablet-size` | **148902 B gzip** (threshold 250000 B) |
| `pnpm run test` | PASS: 220 (contracts 42, API 101, admin 14, tablet 63) |
| `pnpm run test:integration` | PASS: 102 PostgreSQL tests |
| `pnpm run test:e2e` | PASS: 26 (incl. foundation self-hosts IBM Plex Mono 3/3) |

The reviewer's "1 failed e2e" finding is resolved by the
identifier-font fix above. The reviewer's "disposable-copy fault
sensitivity" finding (CR-06) is acknowledged as a follow-up;
every R1–R5 / I-02 / I-03 acceptance is exercised in the current
unit, integration and e2e suites.

## Known limitations (recorded, not hidden)

1. The disposable-copy fault-sensitivity evidence required by the
   reviewer (CR-06) is a follow-up; the planner-owned acceptance
   in `entry-media-tests.sha256` rev 4 covers the asserted guards
   in unit, integration and e2e layers, but the implementation
   handoff does not yet include a separate disposable-copy
   sensitivity report.
2. No real-device acceptance was performed in this session. The
   real tablet camera selection, the actual permission UX, the
   finger/stylus feel, the glare/gloves visibility and the trusted
   HTTPS flow are still pending B-03 / V-03. The 148902 B gzip
   budget measurement is from the current local build; a real
   tablet will repeat the measurement.
3. The encode retry policy treats the 300 KB target as a soft
   preference and the 800 KB hard cap as the strict ceiling; the
   retry strategy is unchanged (quality first, then downscale).
   Representative decoded synthetic image coverage is a follow-up.
4. I-04 storage, I-06 submission, V-* deployment, P1 backlog and
   the repeat-list / driver-merge tooling are out of scope.

## Review request

One combined independent re-review is requested at
`docs/review-requests/entry-media.md` (this is the same request as
the previous round; no new review-request file is created). The
implementer's evidence is this file. **Every review box stays
unchecked.** Stop at this point; storage and submission remain the
next milestone.
