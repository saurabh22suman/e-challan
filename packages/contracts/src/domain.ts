import { z } from 'zod';

/**
 * F-01 approved demo-domain contracts.
 *
 * Authority: `docs/eChallan_replacement_spec.md` v0.1 (owner-approved
 * 2026-10-02), as recorded in `docs/decisions.md`. The unavailable Functional
 * Specification v0.2 is not reconstructed here.
 *
 * Scope boundary: these schemas describe *client-supplied structure only*. They
 * deliberately contain no actor, post, shift, location, status, severity,
 * challan number, timestamp, occurrence or recommendation field, because none of
 * those may be supplied by a client as authority (spec section 4: "reject forged
 * attribution"). Master activeness, Other-with-remarks coupling, witness roles,
 * ownership and duplicate/repeat acknowledgement need real API/domain context
 * and belong to their later tasks.
 */

/* -------------------------------------------------------------------------- */
/* Controlled vocabularies                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Master severity vocabulary. One severity per violation type; a challan's
 * displayed severity is the highest of its selected violations (spec section 5).
 */
export const SeveritySchema = z.enum(['Minor', 'Major', 'Critical']);
export type Severity = z.infer<typeof SeveritySchema>;

/**
 * Challan lifecycle vocabulary. Cancelled is terminal and is never reused
 * (spec section 6). UI labels are deliberately distinct from stable action codes.
 */
export const ChallanStatusSchema = z.enum(['Issued', 'Under Review', 'Resolved', 'Cancelled']);
export type ChallanStatus = z.infer<typeof ChallanStatusSchema>;

/** Role vocabulary for attribution and permissions (spec section 8). */
export const RoleSchema = z.enum(['Marshal', 'Supervisor', 'Admin']);
export type Role = z.infer<typeof RoleSchema>;

/** Stable resolution-action codes. These are codes, not display labels. */
export const ResolutionActionCodeSchema = z.enum([
  'warning_issued',
  'safety_counselling_completed',
  'referred_to_department_contractor',
  'custom',
]);
export type ResolutionActionCode = z.infer<typeof ResolutionActionCodeSchema>;

/* -------------------------------------------------------------------------- */
/* Field primitives                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Supported demo registration patterns after normalisation (spec section 4).
 *
 * Conventional: two state letters, one or two district digits, one to three
 * series letters, one to four terminal digits.
 * BH: two year digits, `BH`, four digits and one or two trailing letters.
 *
 * This is format checking only, never government-registration verification.
 */
const CONVENTIONAL_REGISTRATION = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}$/;
const BH_REGISTRATION = /^\d{2}BH\d{4}[A-Z]{1,2}$/;

export const SUPPORTED_REGISTRATION_PATTERNS: readonly RegExp[] = [
  CONVENTIONAL_REGISTRATION,
  BH_REGISTRATION,
];

/** Uppercase and remove all whitespace, per the approved vehicle-number rule. */
export function normaliseRegistration(value: string): string {
  return value.replace(/\s+/gu, '').toUpperCase();
}

/** Uppercase and trim the gate-pass number; internal whitespace stays invalid. */
export function normaliseGatePassNumber(value: string): string {
  return value.trim().toUpperCase();
}

export const VehicleNumberSchema = z
  .string()
  .transform(normaliseRegistration)
  .refine(
    (value) => SUPPORTED_REGISTRATION_PATTERNS.some((pattern) => pattern.test(value)),
    'Vehicle number should look like GJ05DS4821 or 26BH1234AA',
  );

export const GatePassNumberSchema = z
  .string()
  .transform(normaliseGatePassNumber)
  .refine(
    (value) => /^[A-Z0-9/-]{1,64}$/u.test(value),
    'Gate-pass number may contain letters, digits, hyphens and slashes only',
  );

export const DriverNameSchema = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value.length >= 1 && value.length <= 120, 'Driver name is required');

/** Shared remark limit; the UI counter must show exactly this value. */
export const REMARKS_MAX_LENGTH = 2000;

/** Trimmed free text. `nonblank` is what makes "Other" remarks mandatory. */
function remarkText({ nonblank }: { nonblank: boolean }) {
  const base = z
    .string()
    .transform((value) => value.trim())
    .refine(
      (value) => value.length <= REMARKS_MAX_LENGTH,
      `Remarks may be at most ${REMARKS_MAX_LENGTH} characters`,
    );
  return nonblank ? base.refine((value) => value.length >= 1, 'Remarks are required') : base;
}

/** Distinct UUID list with an inclusive minimum. */
function distinctIds(min: number, max: number, label: string) {
  return z
    .array(z.uuid())
    .min(min)
    .max(max)
    .refine((values) => new Set(values).size === values.length, `${label} must be distinct`);
}

/* -------------------------------------------------------------------------- */
/* Issuance                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Driver acknowledgement. Exactly one mode (spec section 4 / E2.14/E2.15).
 *
 * A refusal must carry a reason and a witnessing supervisor's name and staff ID.
 * The *structural* shape cannot prove that the witness holds the Supervisor
 * role; that qualification is checked with real domain context later.
 */
export const AcknowledgementSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('signed'),
    signatureId: z.uuid(),
  }),
  z.strictObject({
    kind: z.literal('refused'),
    reason: remarkText({ nonblank: true }),
    witnessName: z
      .string()
      .transform((value) => value.trim())
      .refine(
        (value) => value.length >= 1 && value.length <= 120,
        'Witnessing supervisor name is required',
      ),
    witnessStaffId: z
      .string()
      .transform((value) => value.trim())
      .refine(
        (value) => value.length >= 1 && value.length <= 64,
        'Witnessing supervisor staff ID is required',
      ),
  }),
]);
export type Acknowledgement = z.infer<typeof AcknowledgementSchema>;

/**
 * Structurally complete client submission request.
 *
 * `strictObject` is load-bearing: a client-supplied `severity`, `status`,
 * `challanNumber`, `issuedAt`, `marshalId` or `locationId` is *rejected*, never
 * silently stripped, because those are server authorities.
 */
export const ChallanSubmissionSchema = z.strictObject({
  /** Idempotency key: the client operation UUID, reused on retries. */
  operationId: z.uuid(),
  vehicleNumber: VehicleNumberSchema,
  gatePassNumber: GatePassNumberSchema,
  driverName: DriverNameSchema,
  departmentId: z.uuid(),
  contractorId: z.uuid().optional(),
  vehicleTypeId: z.uuid(),
  /** One or more distinct active violation IDs; duplicate selections rejected. */
  violationIds: distinctIds(1, Number.MAX_SAFE_INTEGER, 'Violations'),
  remarks: remarkText({ nonblank: false }).optional(),
  /** 1-4 distinct owned evidence objects. Metadata counts are not evidence. */
  photoIds: distinctIds(1, 4, 'Photos'),
  acknowledgement: AcknowledgementSchema,
});
export type ChallanSubmission = z.infer<typeof ChallanSubmissionSchema>;

/* -------------------------------------------------------------------------- */
/* Review and resolution                                                       */
/* -------------------------------------------------------------------------- */

/**
 * One resolution action for the whole challan (not one per violation).
 * Remarks are mandatory for every choice, including `custom`; there is
 * deliberately no separate custom-action-name field (spec section 6).
 */
export const ResolutionActionSchema = z.strictObject({
  action: ResolutionActionCodeSchema,
  remarks: remarkText({ nonblank: true }),
});
export type ResolutionAction = z.infer<typeof ResolutionActionSchema>;

/**
 * Review transition request. This schema fixes the request *shape* only:
 * role scope, current-state legality and Admin-only reopening/cancellation are
 * enforced with real authorisation and domain state in the later review feature,
 * so this schema does not pretend to authorise a transition by itself.
 */
export const ReviewTransitionSchema = z.discriminatedUnion('to', [
  z.strictObject({
    to: z.literal('Under Review'),
    /** Mandatory when reopening an already Resolved record; optional otherwise. */
    reason: remarkText({ nonblank: true }).optional(),
  }),
  z.strictObject({
    to: z.literal('Resolved'),
    action: ResolutionActionCodeSchema,
    remarks: remarkText({ nonblank: true }),
  }),
  z.strictObject({
    to: z.literal('Cancelled'),
    reason: remarkText({ nonblank: true }),
  }),
]);
export type ReviewTransition = z.infer<typeof ReviewTransitionSchema>;

/* -------------------------------------------------------------------------- */
/* Approved pure helpers                                                       */
/* -------------------------------------------------------------------------- */

/** Highest-of-set ordering. No weighted severity is approved for this demo. */
const SEVERITY_RANK: Readonly<Record<Severity, number>> = {
  Minor: 1,
  Major: 2,
  Critical: 3,
};

/**
 * Derive a challan's displayed severity as the highest selected violation
 * severity, independent of selection order.
 *
 * This is a pure mapping only. It is not a repeat-counting query and not an
 * issuance service.
 *
 * @throws when the selection is empty or contains a non-approved severity.
 */
export function deriveChallanSeverity(severities: readonly string[]): Severity {
  if (severities.length === 0) {
    throw new Error('deriveChallanSeverity requires at least one severity');
  }
  const parsed = severities.map((value) => {
    const result = SeveritySchema.safeParse(value);
    if (!result.success) {
      throw new Error(`deriveChallanSeverity received an unapproved severity: ${value}`);
    }
    return result.data;
  });
  return parsed.reduce((highest, current) =>
    SEVERITY_RANK[current] > SEVERITY_RANK[highest] ? current : highest,
  );
}

/**
 * Approved recommendation tiers (spec section 5, owner-approved).
 *
 * These are recommendations for the reviewer, not enforced penalties.
 *
 * @throws unless the occurrence number is a positive integer.
 */
export function recommendedActionForOccurrence(occurrence: number): ResolutionActionCode {
  if (!Number.isInteger(occurrence) || occurrence < 1) {
    throw new Error(
      `recommendedActionForOccurrence requires a positive integer occurrence, received ${occurrence}`,
    );
  }
  if (occurrence === 1) return 'warning_issued';
  if (occurrence === 2) return 'safety_counselling_completed';
  return 'referred_to_department_contractor';
}
