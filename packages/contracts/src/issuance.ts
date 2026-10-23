import { z } from 'zod';

/**
 * I-02 / I-03 issuance contracts (camera capture, signature, refusal).
 *
 * Authority: `docs/eChallan_PRD.md` E2.8–E2.15 and `docs/decisions.md`
 * E-02 / E-03 (both RESOLVED FOR PILOT 2026-10-15). Server-side hard
 * enforcement (MED-02 size/MIME validation, SUB-06 acknowledgement
 * binding) is its own gate and is not implemented here; this batch keeps
 * photo bytes and signature PNGs in memory and ships no API routes.
 *
 * The schemas below are the single definition the tablet client and the
 * API consumption layer (when wired) will share. The acknowledgement
 * stores **transient** client-side ids; the persisted schema's
 * `signatureId` is not a Blob ID (I-04 owns real evidence ids).
 */

/** E-02 client limits: target ~300 KB JPEG, hard max 800 KB or 1920×1440. */
export const PHOTO_BYTES_TARGET = 300 * 1024;
export const PHOTO_BYTES_HARD_MAX = 800 * 1024;
export const PHOTO_WIDTH_HARD_MAX = 1920;
export const PHOTO_HEIGHT_HARD_MAX = 1440;
/** Initial encode quality used by the on-device JPEG re-encoder. */
export const PHOTO_QUALITY_INITIAL = 0.85;
export const PHOTO_QUALITY_FLOOR = 0.6;
export const PHOTO_DOWNSCALE_FACTOR = 0.85;

/** Approved 1–4 evidence photos per PRD E2.8. */
export const MIN_PHOTOS = 1;
export const MAX_PHOTOS = 4;

/** A single captured photo, validated to the client-side limits above. */
export const PhotoCaptureSchema = z.strictObject({
  id: z.uuid(),
  dataUrl: z
    .string()
    .min(1)
    .refine((value) => value.startsWith('data:image/jpeg;base64,'), {
      message: 'photo data url must be a base64 JPEG',
    }),
  width: z.number().int().min(1).max(PHOTO_WIDTH_HARD_MAX),
  height: z.number().int().min(1).max(PHOTO_HEIGHT_HARD_MAX),
  bytes: z.number().int().min(1).max(PHOTO_BYTES_HARD_MAX),
});
export type PhotoCapture = z.infer<typeof PhotoCaptureSchema>;

/** The accepted photo store consumed by the entry flow. */
export const CapturedPhotoStoreSchema = z.strictObject({
  acceptedCount: z.number().int().min(0).max(MAX_PHOTOS),
  photos: z.array(PhotoCaptureSchema).max(MAX_PHOTOS),
});
export type CapturedPhotoStore = z.infer<typeof CapturedPhotoStoreSchema>;

/** Add photo and check whether the fifth would be blocked. */
export function wouldExceedPhotoLimit(store: CapturedPhotoStore): boolean {
  return store.acceptedCount >= MAX_PHOTOS;
}

/** Remove a photo and invalidate evidence when the last photo goes. */
export function removePhoto(store: CapturedPhotoStore, id: string): CapturedPhotoStore {
  const next = store.photos.filter((photo) => photo.id !== id);
  return {
    acceptedCount: Math.min(store.acceptedCount, next.length),
    photos: next,
  };
}

/** E-03 client limits: target ≤200 KB PNG, hard max 500 KB. */
export const SIGNATURE_BYTES_TARGET = 200 * 1024;
export const SIGNATURE_BYTES_HARD_MAX = 500 * 1024;

/** A signature PNG produced by signature_pad. */
export const SignaturePadSchema = z.strictObject({
  dataUrl: z
    .string()
    .min(1)
    .refine((value) => value.startsWith('data:image/png;base64,'), {
      message: 'signature data url must be a base64 PNG',
    }),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  bytes: z.number().int().min(1).max(SIGNATURE_BYTES_HARD_MAX),
});
export type SignaturePad = z.infer<typeof SignaturePadSchema>;

/**
 * The refusal path: a non-blank reason plus a witnessing supervisor's
 * name and staff id (PRD E2.14, E-03 owner approval 2026-10-15).
 */
/** Shared refusal limits; UI counters and messages must use exactly these. */
export const REFUSAL_REASON_MAX_LENGTH = 2000;
export const REFUSAL_WITNESS_NAME_MAX_LENGTH = 120;
export const REFUSAL_WITNESS_STAFF_ID_MAX_LENGTH = 64;

const TrimmedTextSchema = z.string().transform((value) => value.trim());

export const RefusalSchema = z.strictObject({
  reason: TrimmedTextSchema.refine(
    (value) => value.length >= 1 && value.length <= REFUSAL_REASON_MAX_LENGTH,
    {
      message: `Reason is required (1–${REFUSAL_REASON_MAX_LENGTH} characters).`,
    },
  ),
  witnessName: TrimmedTextSchema.refine(
    (value) => value.length >= 1 && value.length <= REFUSAL_WITNESS_NAME_MAX_LENGTH,
    {
      message: 'Supervisor witness name is required.',
    },
  ),
  witnessStaffId: TrimmedTextSchema.refine(
    (value) => value.length >= 1 && value.length <= REFUSAL_WITNESS_STAFF_ID_MAX_LENGTH,
    {
      message: 'Supervisor witness staff ID is required.',
    },
  ),
});
export type Refusal = z.infer<typeof RefusalSchema>;

/**
 * The marshal's acknowledgement of the driver summary: either a signature
 * or a refusal. The `summaryRevision` binds it to the summary that was
 * actually shown; any later change to the draft or the preview invalidates
 * the acknowledgement.
 *
 * The `signatureId` / `refusalId` fields are **transient** client ids; the
 * real server-side evidence ids are owned by I-04.
 */
export const AcknowledgementStateSchema = z.strictObject({
  summaryRevision: z.string().min(1),
  kind: z.enum(['signature', 'refusal']),
  signatureId: z.uuid().optional(),
  refusalId: z.uuid().optional(),
});
export type AcknowledgementState = z.infer<typeof AcknowledgementStateSchema>;

/**
 * The fields the marshall changes between the summary review and the
 * signature/commit step. Any change to one of these invalidates the
 * signature/refusal acknowledgement (E-03 owner approval 2026-10-15).
 */
export const SUMMARY_BINDING_FIELDS = [
  'vehicleRegistration',
  'gatePassNumber',
  'driverName',
  'departmentId',
  'contractorId',
  'vehicleTypeId',
  'violationTypeIds',
  'remarks',
  'registry',
] as const;
export type SummaryBindingField = (typeof SUMMARY_BINDING_FIELDS)[number];

/**
 * Canonical revision for the summary shown to the driver. The revision is a
 * stable SHA-256-style digest computed from the entry draft's summary-binding
 * fields, the accepted acknowledgement-required state and the session-bound
 * location id. Any change anywhere invalidates the prior signature/refusal.
 */
export function deriveSummaryRevision(input: {
  draft: {
    vehicleRegistration: string;
    gatePassNumber: string;
    driverName: string;
    departmentId: string;
    contractorId: string;
    vehicleTypeId: string;
    violationTypeIds: readonly string[];
    remarks: string;
    registry: { gatePassRecordId: string; driverId: string; vehicleId: string } | null;
  };
  preview: {
    severity: string;
    occurrenceNumber: number;
    recommendedAction: string;
    duplicateWarning: { required: boolean; matchedCount: number };
  } | null;
  locationId: string;
}): string {
  const parts: string[] = [
    input.draft.vehicleRegistration.trim().toUpperCase(),
    input.draft.gatePassNumber.trim().toUpperCase(),
    input.draft.driverName.trim(),
    input.draft.departmentId,
    input.draft.contractorId,
    input.draft.vehicleTypeId,
    [...input.draft.violationTypeIds].sort().join(','),
    input.draft.remarks.trim(),
    input.draft.registry === null
      ? 'no-registry'
      : `${input.draft.registry.gatePassRecordId}|${input.draft.registry.driverId}|${input.draft.registry.vehicleId}`,
    input.preview === null
      ? 'no-preview'
      : `${input.preview.severity}|${input.preview.occurrenceNumber}|${input.preview.recommendedAction}|${input.preview.duplicateWarning.required ? 1 : 0}|${input.preview.duplicateWarning.matchedCount}`,
    input.locationId,
  ];
  return stableHash(parts.join('\u0000'));
}

/** Tiny FNV-1a-style summary digest — stable across JS engines, no crypto dep. */
function stableHash(value: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0xdeadbeef;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193);
    h2 = Math.imul(h2 ^ code, 0x85ebca6b);
  }
  const a = (h1 >>> 0).toString(16).padStart(8, '0');
  const b = (h2 >>> 0).toString(16).padStart(8, '0');
  return `s${a}${b}${value.length.toString(16)}`;
}

/**
 * A cancellation reason for a photo or signature capture attempt
 * (permission denied, insecure context, etc). Used in the client only —
 * these never reach the server in this batch.
 */
export const MediaFailureReasonSchema = z.enum([
  'permission_denied',
  'permission_dismissed',
  'permission_unsupported',
  'insecure_context',
  'no_camera',
  'camera_busy',
  'encoder_failed',
  'oversized_after_retry',
  'cancelled',
]);
export type MediaFailureReason = z.infer<typeof MediaFailureReasonSchema>;

export interface MediaFailureNotice {
  kind: 'camera' | 'signature';
  reason: MediaFailureReason;
  message: string;
}
