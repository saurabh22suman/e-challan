import { z } from 'zod';
import { EntryDraftSchema } from './preIssuance.js';
import {
  MAX_PHOTOS,
  MIN_PHOTOS,
  PhotoCaptureSchema,
  RefusalSchema,
  SignaturePadSchema,
} from './issuance.js';
import { ChallanStatusSchema, ResolutionActionCodeSchema, SeveritySchema } from './domain.js';

/**
 * I-06 atomic submission contract (PRD E2.15–E2.17, E3.4; E-01/E-02/E-03).
 *
 * This is the wire shape for the one write that creates an issued challan. The
 * client supplies only user-entered values and actual captured media; actor,
 * post, shift, location, status, number, severity, occurrence and recommendation
 * remain server authorities.
 *
 * `operationId` is the idempotency key. Retrying the same operation after a lost
 * response must return the already-issued record rather than create a second
 * challan. Reusing the key with a different payload is a conflict.
 */
export const ChallanCommitRequestSchema = z
  .strictObject({
    operationId: z.uuid(),
    draft: EntryDraftSchema,
    photos: z.array(PhotoCaptureSchema).min(MIN_PHOTOS).max(MAX_PHOTOS),
    signature: SignaturePadSchema.nullable(),
    refusal: RefusalSchema.nullable(),
    /** Canonical summary digest the driver acknowledged. */
    summaryRevision: z.string().min(1),
    /** The marshal accepted the final same-vehicle/location warning. */
    duplicateWarningAcknowledged: z.boolean(),
  })
  .superRefine((value, ctx) => {
    const modes = Number(value.signature !== null) + Number(value.refusal !== null);
    if (modes !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['signature'],
        message: 'Provide exactly one of a signature or a refusal.',
      });
    }
    if (new Set(value.photos.map((photo) => photo.id)).size !== value.photos.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['photos'],
        message: 'Photos must be distinct.',
      });
    }
  });
export type ChallanCommitRequest = z.infer<typeof ChallanCommitRequestSchema>;

/**
 * Confirmation returned after a successful commit. `replayed` is true when the
 * response came from an idempotent retry of the same operation.
 */
export const ChallanCommitResponseSchema = z.strictObject({
  id: z.uuid(),
  challanNumber: z.string().min(1),
  status: ChallanStatusSchema,
  severity: SeveritySchema,
  occurrenceNumber: z.number().int().min(1),
  recommendedAction: ResolutionActionCodeSchema,
  issuedAt: z.iso.datetime(),
  replayed: z.boolean(),
});
export type ChallanCommitResponse = z.infer<typeof ChallanCommitResponseSchema>;
