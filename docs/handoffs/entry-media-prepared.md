# Entry-media batch prepared planner handoff — R1–R5 + I-02 + I-03

Prepared: 2026-10-15, planner/test-owner session. Feature:
`specs/006-camera-signature`; brief: `docs/handoffs/entry-media-batch.md`.
**This record authorises no production change and approves nothing.**
All seven parent boxes (F-04, I-01, I-02, I-03, I-05, R1, R5) are unchecked.

## Read first

`AGENTS.md`, `docs/development-workflow.md`, `docs/implementation-plan.md`
F-04 / I-01 / I-02 / I-03 / I-05, `docs/reviews/F-04-I-01-I-05.md` (R1–R5),
`docs/handoffs/pre-issuance*.md`, the spec/plan/tasks under
`specs/005-pre-issuance/` and `specs/006-camera-signature/`, PRD E2.8–E2.15,
the design doc, `docs/tablet-media.md`, and `docs/decisions.md` for E-02 /
E-03 (both **RESOLVED FOR PILOT 2026-10-15**) and the bounded batch
authorisation entry.

## Scope

F-04 layout, I-01 lookup/validation, I-05 acknowledgement and the new
I-02 (live `getUserMedia` JPEG capture, 1–4 photos) and I-03 (plain-language
summary, `signature_pad` signature or refusal). No I-04 storage or I-06
submission; no API/media routes; no migrations; no deployment. Media stays
in memory and is cleared at session end.

## Pre-issuance manifest revision 3

The active pre-issuance manifest `docs/handoffs/pre-issuance-tests.sha256`
is frozen at revision 3, with revision 2 archived at
`docs/handoffs/pre-issuance-tests-rev2.sha256` (byte-for-byte copy of the
prior active file). The revision 3 narrative documents the metadata
correction: the `{changed}` placeholder is removed and the expected counts
match the pre-issuance implementation evidence. No assertion is weakened,
skipped or narrowed.

## New tests and surface inventory

- `apps/tablet/src/__tests__/corrections.test.tsx` — R1–R5 at the hook
  level: lookup abort/sequence/cancel, canonical draft revision semantics,
  re-preview acknowledgement invalidation, theme spacing tokens, semantic
  error mapping and catalogue contract kind-validation.
- `apps/tablet/src/__tests__/camera-capture.test.tsx` — encoder honouring
  E-02 limits, capture disabled until real frames, blocked fifth capture,
  minimum-photo evidence validity.
- `apps/tablet/src/__tests__/signature.test.tsx` — RefusalSchema validation,
  refusal form confirmation, signature byte cap.
- `apps/tablet/e2e/camera-signature.spec.ts` — browser shell smoke for the
  new lazy routes; device acceptance is B-03 / V-03.
- `packages/contracts/test/issuance.test.ts` — E-02 / E-03 limits, photo
  and signature schemas, summary-revision determinism.

## New components

- `apps/tablet/src/features/issuance/useLookupController.ts` — R1 abort +
  sequence guard.
- `apps/tablet/src/features/issuance/useCatalogues.ts` — R5 expected-kind
  validation against `MasterListResponseSchema`.
- `apps/tablet/src/features/issuance/useDraftRevision.ts` — R2 canonical
  revision; R3 re-preview comparison.
- `apps/tablet/src/features/issuance/serverErrors.ts` — R5 semantic error
  mapping and unmapped-fallback.
- `apps/tablet/src/features/photos/encoder.ts` — E-02 JPEG re-encode
  retry with downscaling and quality floor.
- `apps/tablet/src/features/photos/PhotoCapture.tsx` — lazy, getUserMedia,
  1–4 photos, recoverable failure reasons, track cleanup.
- `apps/tablet/src/features/signature/SignaturePad.tsx` — `signature_pad`
  wrapper, full-width canvas, DPR + resize + rotation handling per E-03.
- `apps/tablet/src/features/signature/RefusalForm.tsx` — reason + witness
  name + staff id with the shared `RefusalSchema`.

## Phase ownership

| Phase | Tasks | Internal exit |
|---|---|---|
| A — R1–R5 corrections | T1–T6 | corrections.test.tsx green; existing ENT/REP suites green; theme spacing solid; severity chip solid; blue card header |
| B — I-02 camera | T7–T12, T20 | camera-capture.test.tsx green; lazy route split; bundle under 250 000 B gzip |
| C — I-03 summary / signature / refusal | T13–T19, T20 | signature.test.tsx green; refusal form green; acknowledgement bound to canonical summary revision |
| batch | T21–T24 | combined gates, sized bundle, evidence and one combined review request |

## Verification commands

```bash
sha256sum -c docs/handoffs/pre-issuance-tests.sha256
sha256sum -c docs/handoffs/pre-issuance-tests-rev2.sha256
sha256sum -c docs/handoffs/entry-media-tests.sha256
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run test:integration
pnpm run test:e2e
pnpm run build
pnpm run check:tablet-size
pnpm run test:foundation
```

## Ownership and limits

- **Frozen:** every acceptance file listed above, the
  `specs/005-pre-issuance/` and `specs/006-camera-signature/` spec/plan/tasks,
  the authority documents and the harness configs.
- **Writable:** `apps/tablet/src/**`, `apps/api/src/**` (refusal
  factory only), `packages/contracts/src/**`, `packages/theme/src/**`,
  `package.json` and `pnpm-lock.yaml` for `signature_pad@5.0.10`.
- **Read-only:** every historical `*.sha256` manifest and every
  `docs/reviews/**` record.

## Known limitations (recorded, not hidden)

1. No I-04 storage and no I-06 submission; the captured photos, signature
   PNGs and refusals are session memory.
2. Browser e2e proves the application flow but cannot verify the rear
   camera selection, real permission behaviour or finger/stylus feel.
   B-03 / V-03 device acceptance remains pending.
3. Multiple-driver choice and the duplicate warning remain component and
   real-DB-only; the browser covers the persistent repeat notice.
4. The disposable-copy fault sensitivity covers every guard listed in
   `specs/006-camera-signature/spec.md` §"Failure sensitivity"; the
   implementer is expected to demonstrate each fault in a separate copy
   and rerun cleanly.
5. The missing independent preparation confirmation is disclosed at
   `docs/implementation-plan.md` F-04 / I-01 / I-05 / I-02 / I-03; this
   batch follows the disclosed pre-issuance override pattern. One combined
   independent review is requested at batch exit; no review boxes are
   ticked by this preparation.

## Stop

Implementation begins only in a fresh implementer session that verifies
this manifest and the archived pre-issuance rev2. Implementer records
RED → GREEN evidence in `docs/handoffs/entry-media.md` and a dated
correction in `docs/handoffs/pre-issuance.md`, then requests the combined
review and stops.
