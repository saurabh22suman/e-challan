import { z } from 'zod';
import {
  DriverNameSchema,
  GatePassNumberSchema,
  ResolutionActionCodeSchema,
  SeveritySchema,
  VehicleNumberSchema,
} from './domain.js';

/**
 * F-04/I-01/I-05 pre-issuance contracts.
 *
 * Authority: `docs/eChallan_replacement_spec.md` v0.1 (sections 3, 4, 5, 7) and the
 * approved decisions B-02 (single full-width form, then summary), B-04, B-05, B-06
 * and D5. The unavailable Functional Specification v0.2 is not reconstructed.
 *
 * These schemas are the single definition the tablet client and the API consume.
 * The draft deliberately contains **no** severity, status, number, location or actor
 * field: those are server authorities.
 */

/** A controlled master field that can carry an explicit Other option. */
export const OtherFieldSchema = z.enum([
  'department',
  'vehicleType',
  'contractor',
  'violationType',
]);
export type OtherField = z.infer<typeof OtherFieldSchema>;

/** Other is the active master row whose trimmed label is exactly `Other`. */
export function isOtherLabel(label: string): boolean {
  return label.trim() === 'Other';
}

const RemarkTextSchema = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value.length <= 2000, 'Remarks may be at most 2000 characters');

/** Registry provenance when the marshal chose a suggested gate-pass record. */
export const RegistryProvenanceSchema = z.strictObject({
  gatePassRecordId: z.uuid(),
  driverId: z.uuid(),
  vehicleId: z.uuid(),
});
export type RegistryProvenance = z.infer<typeof RegistryProvenanceSchema>;

/**
 * The entry draft. Registration, gate-pass and driver text are normalised here, so
 * the client and the API agree on what the marshal typed. `remarks` may be blank;
 * whether it must be non-blank is an Other-context rule enforced by validation.
 */
export const EntryDraftSchema = z
  .strictObject({
    vehicleRegistration: VehicleNumberSchema,
    gatePassNumber: GatePassNumberSchema,
    driverName: DriverNameSchema,
    vehicleTypeId: z.uuid(),
    departmentId: z.uuid(),
    contractorId: z.uuid().nullable(),
    violationTypeIds: z.array(z.uuid()).min(1).max(20),
    remarks: RemarkTextSchema,
    registry: RegistryProvenanceSchema.nullable(),
  })
  .superRefine((draft, ctx) => {
    if (new Set(draft.violationTypeIds).size !== draft.violationTypeIds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['violationTypeIds'],
        message: 'Violations must be distinct',
      });
    }
  });
export type EntryDraft = z.infer<typeof EntryDraftSchema>;

/** Registry lookup fields and the three-character trigger. */
export const RegistryLookupFieldSchema = z.enum(['registration', 'gatePassNumber', 'driverName']);
export type RegistryLookupField = z.infer<typeof RegistryLookupFieldSchema>;

export const REGISTRY_LOOKUP_MIN_CHARACTERS = 3;

/**
 * Bounded size of the list mode used by the tablet vehicle dropdown
 * (owner decision B-08, 2026-10-17). The registry list is scoped to the
 * session post's location, ordered for stable scanning.
 */
export const REGISTRY_LIST_LIMIT = 100;

/**
 * Registry lookup query.
 *
 * A non-empty `query` is the search path and keeps the three-character
 * minimum. An **empty** query is the list path: it returns the session
 * location's registered vehicles for the vehicle dropdown, bounded by
 * {@link REGISTRY_LIST_LIMIT}. Absent `q` is treated as empty.
 */
export const RegistryLookupQuerySchema = z.strictObject({
  field: RegistryLookupFieldSchema,
  query: z
    .string()
    .default('')
    .transform((value) => value.trim())
    .refine(
      (value) => value.length === 0 || value.length >= REGISTRY_LOOKUP_MIN_CHARACTERS,
      `Enter at least ${REGISTRY_LOOKUP_MIN_CHARACTERS} characters, or leave the query empty to list the location's vehicles`,
    ),
});
export type RegistryLookupQuery = z.infer<typeof RegistryLookupQuerySchema>;

/**
 * One registry candidate. A vehicle with several gate-pass records yields one match
 * per record so the marshal chooses the driver/pass explicitly; a vehicle with no
 * prior challans still matches from the registry.
 */
export const RegistryMatchSchema = z.strictObject({
  gatePassRecordId: z.uuid(),
  gatePassNumber: z.string().min(1),
  driverId: z.uuid(),
  driverName: z.string().min(1),
  vehicleId: z.uuid(),
  vehicleRegistrationNumber: z.string().min(1),
  vehicleTypeId: z.uuid(),
  vehicleTypeLabel: z.string().min(1),
  departmentId: z.uuid(),
  departmentLabel: z.string().min(1),
  contractorId: z.uuid().nullable(),
  contractorLabel: z.string().nullable(),
  status: z.enum(['active', 'expired']),
  validUntil: z.iso.datetime().nullable(),
});
export type RegistryMatch = z.infer<typeof RegistryMatchSchema>;

export const RegistryLookupResponseSchema = z.strictObject({
  matches: z.array(RegistryMatchSchema),
});
export type RegistryLookupResponse = z.infer<typeof RegistryLookupResponseSchema>;

/** Field-level draft refusal codes (422 `invalid_draft`). */
export const DRAFT_ERROR_CODES = [
  'required',
  'format',
  'inactive_master',
  'unknown_master',
  'not_distinct',
  'other_remarks_required',
  'provenance_mismatch',
  'too_long',
  'too_short',
] as const;
export const DraftErrorCodeSchema = z.enum(DRAFT_ERROR_CODES);
export type DraftErrorCode = z.infer<typeof DraftErrorCodeSchema>;

export const DraftFieldErrorSchema = z.strictObject({
  field: z.string().min(1),
  code: DraftErrorCodeSchema,
  message: z.string().min(1),
});
export type DraftFieldError = z.infer<typeof DraftFieldErrorSchema>;

export const DraftValidationErrorSchema = z.strictObject({
  error: z.literal('invalid_draft'),
  message: z.string().min(1),
  fields: z.array(DraftFieldErrorSchema).min(1),
});
export type DraftValidationError = z.infer<typeof DraftValidationErrorSchema>;

/** Successful validation: the derived severity and which Other fields were chosen. */
export const EntryValidationResponseSchema = z.strictObject({
  severity: SeveritySchema,
  otherFields: z.array(OtherFieldSchema),
});
export type EntryValidationResponse = z.infer<typeof EntryValidationResponseSchema>;

/** Preview request. Acknowledgement is pre-issuance state, never a stored record. */
export const ChallanPreviewRequestSchema = z.strictObject({
  draft: EntryDraftSchema,
  warningAcknowledged: z.boolean(),
});
export type ChallanPreviewRequest = z.infer<typeof ChallanPreviewRequestSchema>;

/** Approved windows (spec section 5). */
export const REPEAT_WINDOW_DAYS = 90;
export const DUPLICATE_WINDOW_MINUTES = 15;

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** Inclusive lower bound of the 90-day repeat window: `T - 90 days`. */
export function repeatWindowStart(now: Date): Date {
  return new Date(now.getTime() - REPEAT_WINDOW_DAYS * DAY_MS);
}

/** Inclusive lower bound of the 15-minute duplicate window: `T - 15 minutes`. */
export function duplicateWindowStart(now: Date): Date {
  return new Date(now.getTime() - DUPLICATE_WINDOW_MINUTES * MINUTE_MS);
}

/**
 * `T - 90 days <= issuedAt < T`. Exactly 90 days old is included; `T` is excluded.
 */
export function isWithinRepeatWindow(issuedAt: Date, now: Date): boolean {
  return (
    issuedAt.getTime() >= repeatWindowStart(now).getTime() && issuedAt.getTime() < now.getTime()
  );
}

/** `T - 15 minutes <= issuedAt < T`, the same inclusive/exclusive convention. */
export function isWithinDuplicateWindow(issuedAt: Date, now: Date): boolean {
  return (
    issuedAt.getTime() >= duplicateWindowStart(now).getTime() && issuedAt.getTime() < now.getTime()
  );
}

/**
 * Preview response: the current occurrence and recommendation, plus whether a
 * duplicate warning must be acknowledged. A preview is not a reservation.
 */
export const ChallanPreviewResponseSchema = z.strictObject({
  severity: SeveritySchema,
  occurrenceNumber: z.number().int().min(1),
  recommendedAction: ResolutionActionCodeSchema,
  duplicateWarning: z.strictObject({
    required: z.boolean(),
    matchedCount: z.number().int().min(0),
  }),
  windowDays: z.literal(REPEAT_WINDOW_DAYS),
  windowMinutes: z.literal(DUPLICATE_WINDOW_MINUTES),
});
export type ChallanPreviewResponse = z.infer<typeof ChallanPreviewResponseSchema>;
