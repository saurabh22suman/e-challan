# Implementation plan — I-02 / I-03 + R1–R5 corrections

Scope: bounded batch under
`docs/handoffs/entry-media-batch.md`. Dependency order:

1. R1 (lookup invalidation) and R5 (error mapping + catalogue contracts) are
   touched first because the existing entry flow's tests already exercise
   those surfaces.
2. R2 (canonical draft revision) follows R1 because validation/preview depend
   on the lookup sequence guard.
3. R3 (changed re-preview acknowledgement invalidation) follows R2.
4. R4 (geometry / context labels / chip distinction) is independent of
   R1–R3 but reads the same primitives; layout tokens must land before the
   new photos/signature components import them.
5. B (I-02 camera capture) consumes the corrected entry flow and adds a
   lazy-loaded photo step bound to in-memory state. The canvas is tested
   end-to-end with deterministic synthetic image frames.
6. C (I-03 driver summary, signature, refusal) consumes A's acknowledgement
   semantics and B's photo validity gate and adds the canvas/refusal step.
7. Combined regression gates; bundled budget check; combined evidence.

Shared boundaries:

- `apps/tablet` imports only `@echallan/contracts` and `@echallan/theme`
  for new modules; it does not import admin bundles or internals from
  `apps/admin` or `apps/api`.
- The new components are lazy-loaded (`React.lazy` + `Suspense`), and the
  initial bundle stays under 250 000 B gzip (measured by
  `pnpm run check:tablet-size`). `signature_pad` is imported as an exact
  path: `import SignaturePad from 'signature_pad'` from the bundle, never a
  barrel or polyfilled distribution.
- `signature_pad` is pinned at a 5.x release compatible with React 19 and
  TypeScript 6 strict; the S-01 harness compatibility check in
  `tools/setup/` is rerun for the new combination. If pinning fails, this
  plan returns BLOCKED rather than adopting the next-major version silently.

Test plan by phase:

| Phase | Cases | Levels |
|---|---|---|
| A | R1–R5 | UI (component + browser); existing ENT/REP suites still GREEN; UI-01 geometry regression by direct pixel measurement in jsdom (≥960 usable form width at 1024 viewport, ≥360 at 390) |
| B | CAM-01–CAM-05 | synthetic-frame encoder at unit level; jest-dom component spies at UI level; one playwright spec confirming real getUserMedia prompt path runs through lifecycle once |
| C | SIG-01–SIG-05 | jsdom canvas via `canvas` polyfill (deterministic 2D) at component level; e2e confirms canonical-summary invalidation across an entry→photo→signature→back→edit cycle |
| batch | gate order | format → lint → typecheck → units → integration → e2e → build → size → foundation |

## Chosen surfaces

| Touch point | Location | Notes |
|---|---|---|
| lookup sequence + abort | `apps/tablet/src/routes/EntryFlow.tsx` `useLookupController` | AbortController per generation; effect cleanup aborts in-flight |
| canonical draft revision | `apps/tablet/src/features/issuance/draftRevision.ts` | revised on every material edit / `chooseMatch`; pending reviews `useEffect` checks revision before applying |
| catalogue contracts | `apps/tablet/src/features/issuuse/catalogues.ts`, `packages/contracts/src/masters.ts` | `MasterListResponseSchema` consumed; expected-kind validated; failure mode |
| semantic error mapping | `apps/tablet/src/features/issuance/serverErrors.ts` | map `invalid_draft.field` + `acknowledgement.invalid` → specific controls |
| geometry tokens | `packages/theme/src/spacing.ts`, `primitives.tsx` | px→unit conversion; Card header; SeverityChip solid vs StatusChip outlined |
| camera capture | `apps/tablet/src/features/photos/{PhotoCapture,PhotoThumbnails,encoder}.tsx` | `MediaStream` and `OffscreenCanvas` mocked for jsdom; real `getUserMedia` in browser spec |
| signature pad | `apps/tablet/src/features/signature/{SignaturePad,RefusalForm,canvasDpr}.tsx` | exact-path `signature_pad`; suppress scroll only inside the canvas; devicePixelRatio refresh on mount/resize |
| acknowledgement binding | `apps/tablet/src/features/issuance/useDriverSummary.ts`, `useAcknowledgement.ts` | revision key includes draftForApi + preview response + session-bound location |

Verification commands: see `docs/handoffs/entry-media-prepared.md` §5 and
`docs/handoffs/entry-media-batch.md` §"Verification and evidence".

Out-of-scope enforcement:

- `apps/api/src/**` is **not** modified except for the throwaway refusal
  factory used by tests behind a feature flag. The real API submission path
  is I-06.
- No migration. No new route registration. No env file. No deployment.
- No `@mui/x-data-grid` / `@mui/x-date-pickers` / charts imports anywhere in
  the tablet or shared code.

Go/no-go:

- R1–R5 corrections **GREEN**: `pnpm --filter @echallan/tablet run test`
  reports `corrections.test.tsx` passing alongside the existing suites.
- I-02 **GREEN**: capture flow tests show real JPEG bytes and dimensions
  within E-02 limits with synthetic-frame encoder; recovery states render
  in jsdom.
- I-03 **GREEN**: signature canvas drawing produces visible-strokes PNG
  in jsdom canvas polyfill; refusal schema rejects blank fields with
  applied errors.
- Combined gates **GREEN** in the documented order.
- Tablet budget **≤ 250 000 B gzip**.
- One combined implementation evidence file:
  `docs/handoffs/entry-media.md`.

Stop here. Independent review requires a fresh session/model.
