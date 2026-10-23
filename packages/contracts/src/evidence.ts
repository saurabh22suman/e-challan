import { z } from 'zod';

/**
 * Authenticated evidence metadata and retrieval contracts (R-01/E3.2).
 *
 * Binaries are never embedded in list/detail JSON. The reviewer requests bytes
 * separately from an authorised, logged API route; the database stores only
 * object keys.
 */
export const ChallanEvidencePhotoSchema = z.strictObject({
  id: z.uuid(),
  ordinal: z.number().int().min(1).max(4),
  contentType: z.string().min(1),
  byteSize: z.number().int().min(0).nullable(),
  capturedAt: z.iso.datetime(),
});
export type ChallanEvidencePhoto = z.infer<typeof ChallanEvidencePhotoSchema>;

export const ChallanSignatureEvidenceSchema = z.strictObject({
  id: z.uuid(),
  contentType: z.string().min(1),
  byteSize: z.number().int().min(0).nullable(),
  signedAt: z.iso.datetime(),
});
export type ChallanSignatureEvidence = z.infer<typeof ChallanSignatureEvidenceSchema>;

export const ChallanRefusalEvidenceSchema = z.strictObject({
  id: z.uuid(),
  reason: z.string().min(1),
  witnessName: z.string().min(1),
  witnessStaffId: z.string().min(1),
  refusedAt: z.iso.datetime(),
});
export type ChallanRefusalEvidence = z.infer<typeof ChallanRefusalEvidenceSchema>;

export const ChallanEvidenceResponseSchema = z.strictObject({
  photos: z.array(ChallanEvidencePhotoSchema),
  signature: ChallanSignatureEvidenceSchema.nullable(),
  refusal: ChallanRefusalEvidenceSchema.nullable(),
});
export type ChallanEvidenceResponse = z.infer<typeof ChallanEvidenceResponseSchema>;
