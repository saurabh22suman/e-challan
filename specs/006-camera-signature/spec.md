# Live camera capture, signature and refusal — I-02 / I-03

Status: planner preparation, 2026-10-15. Tasks: **I-02 + I-03** plus the
preceding **R1–R5 corrections** to the existing F-04/I-01/I-05 entry flow. All
five parent boxes unchecked. Feature directory: `specs/006-camera-signature`.
Bounded batch: `docs/handoffs/entry-media-batch.md`; preparation record:
`docs/handoffs/entry-media-prepared.md`; baseline manifest:
`docs/handoffs/entry-media-tests.sha256`.

Authority: `docs/eChallan_PRD.md` E2.8–E2.15; `docs/eChallan_DESIGN.md`
(touch targets, blue card header, severity/status chip distinction, green-only
commit); `docs/decisions.md` E-02 and E-03 (both RESOLVED FOR PILOT
2026-10-15), B-02 (single full-width form → summary → signature/refusal), D5
counting, B-06 synthetic registry, B-04 attribution; `docs/test-cases.md`
UI-01–UI-03, ENT-01–ENT-06, REP-01–REP-05, CAM-01–CAM-05, SIG-01–SIG-05;
`docs/eChallan_replacement_spec.md` v0.1 + `.v0.2.md` auth addendum;
`docs/handoffs/pre-issuance.md` (current entry flow implementation evidence).
The unavailable Functional Specification v0.2 is not reconstructed.

## Outcome

A marshal's tablet captures 1–4 rear-camera photographs with on-device
compression, shows a plain-language driver summary, accepts either a
`signature_pad` signature or an approved refusal, and binds the
acknowledgement to the current canonical summary revision. The existing
pre-issuance entry flow's stale-lookup, stale-validation/preview,
changed-repreview-acknowledgement, layout/spacing/touch/visual/context, and
error-mapping/catalogue-contract defects (R1–R5) are corrected against
already-approved behaviour/design constraints. No I-04 storage, I-06
submission, API/media routes or migration is added by this batch; media stays
in memory for the session.

## Phase ownership

| Phase | Tasks | Scope |
|---|---|---|
| **A** | R1–R5 | correction of the existing entry flow against already-approved constraints |
| **B** | I-02 | live `getUserMedia` camera, JPEG compression under E-02, 1–4 photo flow, recovery states, cleanup |
| **C** | I-03 | plain-language summary review, `signature_pad` full-width canvas, refusal path, acknowledgement binding |

Phase B consumes A's stable lookup/validate/preview surfaces; phase C consumes
B's photo validity and A's acknowledgement semantics. Internal stages may
proceed at verified GREEN under the owner's bounded batch authorisation
recorded in `decisions.md` (mirroring the disclosed pre-issuance override);
independent review is deferred to batch exit only.

## Shared contracts (`packages/contracts/src/issuance.ts`, frozen)

```text
PhotoCaptureSchema = strictObject({
  id: uuid,                         // per-photo client id
  dataUrl: string,                  // data:image/jpeg;base64,...
  width: int>=1, height: int>=1,    // pixels after resize
  bytes: int>=1,                    // raw JPEG byte length (≤ E-02 hard max)
})

CapturedPhotoStoreSchema = strictObject({
  photos: PhotoCaptureSchema[],
  acceptedCount: int>=0<=4,
})

SignaturePadSchema = strictObject({
  dataUrl: string,                  // data:image/png;base64,...
  width: int>=1, height: int>=1,
  bytes: int>=1,                    // raw PNG byte length (≤ E-03 hard max)
})

RefusalSchema = strictObject({
  reason: string.min(1).max(2000).trim(),
  witnessName: string.min(1).max(120).trim(),
  witnessStaffId: string.min(1).max(64).trim(),
})

AcknowledgementStateSchema = strictObject({
  summaryRevision: string,          // canonical summary hash
  kind: enum('signature','refusal'),
})

DriverSummaryRevision = hash(           // canonical summary state
  draftForApi() normalized + preview response + location label
)
```

The acknowledgement uses **transient** `signatureId`/`refusalId` placeholders
generated client-side; no server-facing fabricated IDs, no Blob ID in the
persisted schema. I-04 will replace this with real server evidence IDs.

`@echallan/theme` exposes:

```
issuanceSpacing     — oklch-derived per-step spacing tokens with unit suffix
photoStateMachine   — 1..4 photo phase enum w/ rescue/recovery actions
canvasDpr           — devicePixelRatio with mounted/resize refresh
tokens.surface.iconPhoto, iconSignature, iconClear, iconRefuse, iconConfirm
```

## API surface

This batch adds **no API routes**. Photo bytes, signature PNG bytes and
refusal data remain in memory. The existing `POST /challans/validate` and
`POST /challans/preview` continue to be authoritative; new draft fields
attaching `refusal` are gated behind a feature flag in the validation
service so the existing pre-issuance path remains PASS at GREEN while the
new camera/signature components can be prepared end-to-end. Mediated refusal
validation is implemented behind a `validateRefusal` factory exposed only in
test mode and stubbed for `chrome.headless` spec runs.

## Tablets and clients

```text
src/routes/EntryFlow.tsx           — corrections (R1–R5)
src/features/photos/PhotoCapture.tsx   — lazy chunk
src/features/photos/PhotoThumbnails.tsx
src/features/signature/SignaturePad.tsx
src/features/signature/RefusalForm.tsx
src/features/issuance/useDriverSummary.ts  — canonical summary revision
src/features/issuance/useAcknowledgement.ts — bind to summary revision
```

Lazy routes per `design-taste-frontend` budget. Initially only Photos and
SignaturePad render; admin imports remain forbidden.

## Testing and acceptance

| Level | Files | Cases |
|---|---|---|
| Unit | `packages/contracts/test/issuance.test.ts` | `CapturedPhotoStoreSchema`, `SignaturePadSchema`, `RefusalSchema`, `AcknowledgementStateSchema`, `DriverSummaryRevision` semantics |
| UI | `apps/tablet/src/__tests__/corrections.test.tsx` | R1 (lookup below-threshold no fetch; clearing cancels; selection cancels; session/route exit cancels; in-flight aborted fetch does not display stale result; old request from before a typed query never appears), R2 (canonical draft revision; delayed validation does not advance edited draft; delayed preview does not; chooseMatch invalidates pending reviews; unchanged-draft Back works), R3 (changed re-preview with new occurrence/action invalidates acknowledgement; changed duplicate set/count invalidates acknowledgement; unchanged-preview control does not require re-acknowledgement), R4 (form usable width ≥960px at 1024px tablet, ≥360px at 390px narrow; card has blue header; severity chip is solid; native select has ≥56px height and IBM Plex Sans via inherited theme; session-bound Location/Post/Shift context visible and labelled), R5 (semantic `invalid_draft` errors appear under their respective controls including `department`/`vehicleType`/`contractor`/`violationType`; unmapped error renders alert fallback; catalogue responses parsed via `MasterListResponseSchema` with kind validation; malformed/wrong-kind catalogue shows recoverable failure with retry) |
| UI | `apps/tablet/src/__tests__/camera-capture.test.tsx` | CAM-01 live preview only; rear-camera preference requested; capture button disabled until frames ready; no gallery picker offered; CAM-02 1–4 photos with blocked fifth; delete-last invalidates evidence state; CAM-03 JPEG dimensions and bytes within E-02 limits using a synthetic frame encoder; CAM-04 denied/unanswered/missing/insecure-context/encoding errors render recoverable notice and **no** synthetic capture; CAM-05 tracks stopped and object URLs revoked on close/switch/remove/route-exit/logout; reopening works |
| UI | `apps/tablet/src/__tests__/signature.test.tsx` | SIG-01 full-width canvas drawing, no page scroll during draw; saved PNG contains visible non-white strokes at >0.5% pixel area; SIG-02 blank not confirmable; clear invalidates acknowledgement; redraw re-enables confirm; SIG-03 resize/DPR/rotation invalidates state and renders re-sign required; never store blank as signed; SIG-04 refusal requires non-blank reason + supervisor witness name + supervisor staff id; SIG-05 changing any summary field OR re-preview with new occurrence/recommended/duplicate set invalidates signature AND refusal; unchanged-preview control preserves confirmation; cross-phase races after returning from summary invalidate entry form edits through the same hook |
| Browser | `apps/tablet/e2e/camera-signature.spec.ts` | full marshal journey through entry + camera + summary + signature; refusal path; size/budget non-regression |
| API | real DB suite: `apps/api/tests/integration/pre-issuance.test.ts` | refusal draft variant accepted when acknowledgement state.kind === 'refusal'; existing tests untouched (I-04 owns server evidence) |

Deterministic fixtures: synthetic image frames with known dimensions and
known colours via an in-memory canvas encoder; deterministic clock seams for
the synthetic frame timing.

## Failure sensitivity

Faults proven in a disposable copy and removed before delivery:

| Fault | Expect failure |
|---|---|
| R1 AbortController removed | old lookup for shorter query appears |
| R2 canonical-draft guard removed | delayed validation/preview advances edited draft |
| R3 prev/new comparison removed | unchanged-draft changed-preview keeps old acknowledgement |
| R4 SPACING unit conversion removed | form width collapses; severity chip outlined instead of solid |
| R5 `applyServerErrors` field key remap removed | `department`-fielded error invisible; wrong-kind catalogue accepted as empty |
| CAM-03 dimension/byte guard removed | oversized photo accepted or downscaled image decoded back is unchanged |
| CAM-05 cleanup removed | tracks still live after logout |
| SIG-03 canvas resize handler removed | signed flag survives blank canvas after resize |
| SIG-05 canonical-summary key removed | signature accepted against edited draft |

## Out of scope

I-04 (storage, uploads, audits), I-06 (atomic submission, numbering,
retry-safe submission), V-* deployment, R-* review/dashboard/export,
P2 offline issuance. Do not claim any of these as implemented by this batch.
