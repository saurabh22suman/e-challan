# I-02 / I-03 + R1–R5 — bounded batch task list

| ID | Task | Phase |
|---|---|---|
| T1 | R1 lookup invalidation: AbortController per generation; cancel on shorter query / clear / select / route-exit / session-exit | A |
| T2 | R2 canonical draft revision key + validation/preview bind to it | A |
| T3 | R3 changed re-preview acknowledgement invalidation (compare old/new occurrence, recommended action, duplicate set) | A |
| T4 | R4 spacing/touch/visual/context corrections (px vs sx unit, blue card header, severity solid vs status outlined, native select typography, session-bound Location/Post/Shift labels, accurate usable form width) | A |
| T5 | R5 semantic error mapping (`invalid_draft.field` → control) + catalogue contracts (`MasterListResponseSchema` expected-kind) | A |
| T6 | Existing ENT/REP suites regression after R1–R5 (must still pass without weakening) | A |
| T7 | B-1: pin `signature_pad` + `@types/signature_pad`; verify peer/type compat with React 19 + TypeScript 6 strict | B |
| T8 | B-2: `apps/tablet/src/features/photos/PhotoCapture.tsx` (live preview via getUserMedia, rear-camera, capture disable until frames ready, no gallery) | B |
| T9 | B-3: `apps/tablet/src/features/photos/encoder.ts` (offline-friendly JPEG re-encode with E-02 dimensions/quality fallback) | B |
| T10 | B-4: `apps/tablet/src/features/photos/PhotoThumbnails.tsx` (1–4 photos, retake, delete, fifth blocked) | B |
| T11 | B-5: camera recovery (`Permission denied`, `NotAllowedError`, `NotFoundError`, insecure context, busy camera, encoder failure) | B |
| T12 | B-6: track cleanup + object URL revocation on close / camera switch / remove / route-exit / logout | B |
| T13 | C-1: plain-language driver summary before signature, reading from `useDriverSummary` revision | C |
| T14 | C-2: `apps/tablet/src/features/signature/SignaturePad.tsx` (full-width `signature_pad` canvas, scroll-suppression only on canvas, visible focus, Clear + Confirm separated) | C |
| T15 | C-3: DPR + resize handling (rotation, DPR change, resize >10% invalidate and require re-sign) | C |
| T16 | C-4: PNG export + bytes within E-03 limits; visible-strokes assertion | C |
| T17 | C-5: refusal form (reason + witness name + staff id) with non-blank validation | C |
| T18 | C-6: acknowledgement bound to canonical summary revision; material draft edit OR changed re-preview invalidates signature AND refusal | C |
| T19 | C-7: cross-phase race: entry → photo → summary → signature → back → entry edit invalidates signature and refusal | C |
| T20 | Shared contracts: `CapturedPhotoStoreSchema`, `SignaturePadSchema`, `RefusalSchema`, `AcknowledgementStateSchema`, `DriverSummaryRevision` semantics; tests at `packages/contracts/test/issuance.test.ts` | shared |
| T21 | Lazy-route integration in `apps/tablet/src/App.tsx`; the new components do not load on the shell or on FormSection | A |
| T22 | Tablet bundle budget recheck (`pnpm run check:tablet-size` ≤ 250 000 B gzip) | gate |
| T23 | Combined gates (format / lint / typecheck / unit / integration / e2e / build / size / foundation) in order | gate |
| T24 | Combined evidence `docs/handoffs/entry-media.md` + dated correction in `pre-issuance.md` + review request `docs/review-requests/entry-media.md` | docs |

Writes during Phases A/B/C stay disjoint:

- Coordinator (this session) owns root/shared installs, contracts, theme,
  evidence, review request.
- No worker fans out under this batch; the brief authorises the single
  coordinating run with explicit preparation-confirmation override.

Stop after T24. Independent reviewer inspects diffs and reruns gates.
