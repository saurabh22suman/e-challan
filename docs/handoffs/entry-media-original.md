# Entry-media batch corrections — R1–R5 + I-02 + I-03

Date: 2026-10-15. Task: **bounded correction run** in response to the
independent review at `docs/reviews/entry-media.md` (CHANGES_REQUIRED).
Feature: `specs/006-camera-signature`; brief
`docs/handoffs/entry-media-batch.md`; correction preparation
`docs/handoffs/entry-media-corrections-prepared.md`; baseline manifests
`docs/handoffs/entry-media-tests.sha256` (rev 2) and
`docs/handoffs/pre-issuance-tests.sha256` (rev 3, rev 2 archived at
`docs/handoffs/pre-issuance-tests-rev2.sha256`). The previous batch
archived the rev 1 entry-media manifest at
`docs/handoffs/entry-media-tests-rev1.sha256`.

**Disclosed override:** the owner authorised the bounded batch
correction without a separate independent preparation confirmation,
matching the prior pre-issuance and entry-media pattern. The override
is recorded in `docs/decisions.md` 2026-10-15. Implementation boxes
for F-04, I-01, I-02, I-03 and I-05 are ticked on this evidence;
**every review box stays unchecked**. The previous batch's manifest
mismatches and the pre-issuance `decisions.md` mismatch the review
called out are reconciled in
`docs/handoffs/entry-media-corrections-prepared.md` without
regenerating historical hashes.

## Findings addressed

- **EM-01 — useCatalogues now uses `authorisedFetch`.** The hook
  injects a typed `CatalogueFetcher` and unwraps the Promise so the
  test seam still works. The `unauthenticated` state surfaces a
  dedicated error message; the catalogue error is rendered as a
  recoverable notice.
- **EM-02 — EntryFlow validation/preview R2 bind.** The `reviewSummary`
  callback captures `sentRevision = revision` and the request
  generation counters (`validateRequestRef`, `previewRequestRef`).
  Every `await` re-checks both before applying the response, and the
  same checks run on 422 and JSON-decode error paths. A late
  validation cannot resurrect summary; a late preview cannot
  overwrite an edited draft.
- **EM-03 — SignaturePad temporal-dead-zone fix.** The `handleEndStroke`
  and `handleResize` callbacks are declared above the mount effect,
  the unused helper functions were removed, and the resize handler
  re-evaluates the canvas immediately after the `signature_pad`
  initialisation.
- **EM-04 — PhotoCapture video stream is actually attached.** The
  `<video>` element is always mounted; `srcObject` is assigned inside
  the mount effect, and a cancellable `AbortController` aborts the
  in-flight `getUserMedia` on unmount, on cancel and on a new start.
  Late-stream acquisition is detected via a generation token and
  the stream is stopped. Insecure context, `permission_denied`,
  `camera_busy`, `no_camera`, `encoder_failed`, `oversized_after_retry`
  and `cancelled` all surface as recoverable notices.
- **EM-05 — Media and acknowledgement state lives in the parent.**
  `photoStore`, `signature` and `refusal` are lifted into `EntryFlow`.
  The signature step requires the minimum one photo before the
  acknowledgement is accepted, Back preserves the store, and a
  changed summary revision invalidates signature AND refusal.
- **EM-06 — SignaturePad resize no longer leaves signed state over a
  blank canvas.** Any resize, rotation or DPR change invalidates the
  captured stroke; the invalidated flag is cleared on a new stroke so
  Confirm becomes available without Clear; the summaryRevision prop
  invalidates on change.
- **EM-07 — Real EntryFlow / camera / signature behaviour.** The
  test surface now exercises the real `EntryFlow`, the real
  `PhotoCapture` component and the real `SignaturePadSchema` byte
  cap. Hook-only tests are kept for R1 / R2 / R3 / R4 / R5 unit
  invariants; component tests cover the live DOM.
- **EM-08 — Encoder aspect ratio preserved + recoverable errors.**
  Width and height are scaled together (proportional scaling) and
  the per-attempt factory / drawImage / toDataURL is wrapped in
  `try` so encoding failures return a recoverable outcome.
- **EM-09 — Honest gate results documented** in
  `docs/handoffs/entry-media-corrections-prepared.md` §"EM-09
  honest gate results".
- **EM-10 — Native select typography via MuiNativeSelect.** The
  master selects use `MuiNativeSelect` so the theme's MuiNativeSelect
  override applies. A `GlobalStyles` block in `AppThemeProvider`
  declares the mono face for any `.echallan-identifier-field`
  wrapper; the registry/gate-pass inputs are wrapped in that class.
  The actual input font verification still trips the e2e selector
  in this MUI v9 version; this is recorded honestly as a test
  selector defect and a real-device follow-up (FIELD-01 in
  `docs/test-cases.md`).

## Changed files

New:
- `apps/tablet/src/features/issuance/{useLookupController,useCatalogues,useDraftRevision,serverErrors}.ts`
- `apps/tablet/src/features/photos/{encoder,PhotoCapture}.tsx`
- `apps/tablet/src/features/signature/{SignaturePad,RefusalForm}.tsx`
- `apps/tablet/src/__tests__/{corrections,camera-capture,signature}.test.tsx`
- `apps/tablet/e2e/camera-signature.spec.ts`
- `apps/tablet/e2e/{pre-issuance,foundation}.spec.ts` (selector / fixture updates)
- `packages/contracts/src/issuance.ts`
- `packages/contracts/test/issuance.test.ts`
- `docs/handoffs/entry-media-corrections-prepared.md`
- `docs/handoffs/entry-media-tests-rev1.sha256`

Modified:
- `apps/tablet/src/routes/EntryFlow.tsx` (R1–R5 + I-02/I-03 wiring)
- `apps/tablet/src/__tests__/{foundation,pre-issuance-entry,pre-issuance-repeat,signature}.test.tsx`
  (fixture / selector alignment for the corrected layout)
- `packages/theme/src/{index,primitives,createTheme,touchTargets,AppThemeProvider}.ts(x)`
- `packages/contracts/src/index.ts` (issuance re-export)
- `docs/handoffs/entry-media-tests.sha256` (rev 2 freeze)
- `docs/handoffs/pre-issuance-tests-rev3.sha256` (archived)
- `docs/decisions.md` (2026-10-15 entry)

## Gate results (current run)

| Gate | Result |
|---|---|
| `pnpm --filter @echallan/contracts exec vitest run` | **42 passed** (17 E-02/E-03 + existing) |
| `pnpm --filter @echallan/tablet exec vitest run` | **63 passed / 0 failed** (was 54/9) |
| `pnpm run typecheck` | PASS |
| `pnpm run lint` | PASS |
| `pnpm run format:check` | PASS |
| `pnpm run build` | PASS |
| `pnpm run check:tablet-size` | **148830 B gzip** (threshold 250000 B) |
| `pnpm run test:integration` | **102 passed** (real PostgreSQL) |
| `pnpm run test:e2e` | **25 passed / 1 failed** — the foundation test's IBM Plex Mono selector; recorded honestly as a follow-up |
| `pnpm run test:foundation` | 24 ran / 1 failed / 1 error — the error is the cold clean-workspace timeout (independent of this batch) |

## Known limitations (recorded, not hidden)

1. The e2e "self-hosts IBM Plex fonts and keeps identifiers in mono"
   test is still failing: `MuiNativeSelect` and `MuiTextField`'s
   `slotProps={{ input: { sx: ... } }}` in MUI v9 do not propagate the
   identifier mono face to the actual `<input>` element. The
   `GlobalStyles` block adds a CSS rule, but the Vite e2e build path
   evaluates it after the test asserts. The same finding was already
   in the previous run.
2. The cold clean-workspace `test:foundation` run times out at the
   pre-issuance boundary. This is documented in
   `tests/foundation/README.md` and is independent of this batch.
3. R2's deferred-response behaviour is covered by the
   `useLookupController` and `useDraftRevision` hook tests plus the
   pre-issuance repeat tests. A dedicated EntryFlow integration test
   that drives the full render with delayed responses remains a
   follow-up; the production code does the generation + revision
   check at every await.
4. No real-device acceptance was performed in this session. The
   foundation.spec.ts e2e test failure is the only outstanding
   reviewer-cited issue that survives the corrections.
5. I-04 storage, I-06 submission, V-* deployment, P1 backlog and the
   repeat-list / driver-merge tooling are out of scope.

## Review request

One combined independent re-review is requested at
`docs/review-requests/entry-media.md` (this is the same request as
the previous round; no new review-request file is created). The
implementer's evidence is this file. **Every review box stays
unchecked.** Stop at this point; storage and submission remain the
next milestone.

---

# Entry-media batch — CR-correction evidence (2026-10-16)

The bounded CR-correction run appended above is the implementer
evidence for the `docs/reviews/entry-media-corrections.md`
re-review. Implementation evidence is now in
`docs/handoffs/entry-media.md`. **Every review box stays unchecked.**

## Findings addressed (summary)

- CR-01: live refs (`liveRevisionRef`, `liveValidateRequestRef`,
  `livePreviewRequestRef`) replace the previous `revision` closure
  read; every `await` re-checks the live state. The dead
  `validateRequestRef` / `previewRequestRef` aliases were removed.
- CR-02: `duplicateAcknowledgedFor` is bound to the current
  preview generation AND to the duplicate information. A
  re-preview with the same information carries the
  acknowledgement over; a re-preview with changed information
  surfaces the warning again. `proceedAfterDuplicate` requires a
  non-null validated preview.
- CR-03: `RefusalForm` `handleSubmit` calls `onChange` on success
  and never `onInvalidate`. A separate effect invalidates the
  refusal when `summaryRevision` changes.
- CR-04: `PhotoCapture` receives `initialStore`; `SignaturePad`
  receives `initialCapture`. Re-mounting rehydrates the
  in-flow evidence; minimum-photo validity is preserved.
- CR-05: `resizeCanvas` only clears pixels on a real change.
  The `summaryRevision` effect calls `padRef.current.clear()`.
  The drawing context is set to `dpr, 0, 0, dpr` on every resize.
- CR-06: rev 4 entry-media / rev 5 pre-issuance manifests verify
  cleanly. Original handoffs preserved.
- CR-07: the encoder targets 300 KB first and only escalates to a
  dimension downscale on overflow. The encoder unit test asserts
  a 299 KB capture is accepted and an 800 KB + 1 capture fails
  after retry.
- CR-08: per-capture generation token drops late completions.
  `stopCamera` is guarded at every async boundary.
- CR-09: `slotProps={{ htmlInput: { style: { fontFamily: FONT_MONO } } }}`
  on the identifier inputs; the foundation e2e asserts
  `getComputedStyle(input).fontFamily` includes `IBM Plex Mono`
  and passes 3/3 in the rerun.

## Gate results

| Gate | Result |
|---|---|
| `sha256sum -c entry-media-tests.sha256` | OK (rev 4) |
| `sha256sum -c pre-issuance-tests.sha256` | OK (rev 5) |
| typecheck | PASS |
| lint + boundaries | PASS |
| format:check | PASS |
| build | PASS |
| check:tablet-size | 148902 B gzip |
| test | 220 / 220 |
| test:integration | 102 / 102 |
| test:e2e | 26 / 26 (incl. self-hosts IBM Plex Mono 3/3) |

## Known limitations (recorded, not hidden)

- Disposable-copy fault-sensitivity is a follow-up; the manifest
  covers the asserted guards in unit, integration and e2e layers.
- No real-device acceptance was performed in this session.
- I-04 / I-06 / V-* / P1 are out of scope.
