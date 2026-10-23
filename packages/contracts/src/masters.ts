import { z } from 'zod';
import { ResolutionActionCodeSchema, SeveritySchema } from './domain.js';

/**
 * F-03 approved master-data contracts.
 *
 * Authority: `docs/eChallan_replacement_spec.md` v0.1 (owner-approved 2026-10-02),
 * the B-05 historical-meaning policy in `docs/decisions.md`, and PRD E5.1–E5.3.
 *
 * The six approved master sets are managed by an Admin-only API; every
 * authenticated role reads the **active-only** selection catalogue. A master is
 * deactivated, never deleted, and the issued snapshots on historical challans keep
 * their meaning after any edit or deactivation.
 *
 * These schemas are strict: an unknown field is a contract violation, so a client
 * cannot smuggle an unapproved property into a master payload.
 */

/** The approved master kinds, as URL segments. */
export const MASTER_KINDS = [
  'violation-types',
  'departments',
  'contractors',
  'locations',
  'gates',
  'vehicle-types',
] as const;

export const MasterKindSchema = z.enum(MASTER_KINDS);
export type MasterKind = z.infer<typeof MasterKindSchema>;

/** Approved label bound (spec section 4: trimmed Unicode text, 1–120 characters). */
export const MASTER_LABEL_MAX_LENGTH = 120;

/** Trimmed, non-blank, bounded label. Parsing returns the trimmed value. */
const LabelSchema = z.string().trim().min(1).max(MASTER_LABEL_MAX_LENGTH);

/**
 * One master entry as returned by the API.
 *
 * The kind-specific fields are enforced **strictly and symmetrically**, not merely
 * allowed:
 *
 *  - a `violation-types` record always carries `severity` and a present (possibly
 *    `null`) `defaultAction`, and never a `locationId`;
 *  - a `gates` record always carries `locationId`, and never a severity or action;
 *  - a `departments`, `contractors`, `locations` or `vehicle-types` record carries
 *    only `id`, `kind`, `label` and `isActive`.
 *
 * The base object is strict about unknown keys; the refinement enforces the
 * per-kind rules without changing the shape the API legitimately returns.
 */
export const MasterRecordSchema = z
  .strictObject({
    id: z.uuid(),
    kind: MasterKindSchema,
    label: LabelSchema,
    isActive: z.boolean(),
    severity: SeveritySchema.optional(),
    defaultAction: ResolutionActionCodeSchema.nullable().optional(),
    locationId: z.uuid().optional(),
  })
  .superRefine((record, ctx) => {
    if (record.kind === 'violation-types') {
      if (record.severity === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['severity'],
          message: 'a violation type must carry its severity',
        });
      }
      if (!Object.prototype.hasOwnProperty.call(record, 'defaultAction')) {
        ctx.addIssue({
          code: 'custom',
          path: ['defaultAction'],
          message: 'a violation type must carry a present, nullable default action',
        });
      }
      if (record.locationId !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['locationId'],
          message: 'a violation type does not carry a location',
        });
      }
      return;
    }

    if (record.kind === 'gates') {
      if (record.locationId === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['locationId'],
          message: 'a gate must carry its location',
        });
      }
      if (record.severity !== undefined || record.defaultAction !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'a gate does not carry a severity or a default action',
        });
      }
      return;
    }

    if (
      record.severity !== undefined ||
      record.defaultAction !== undefined ||
      record.locationId !== undefined
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'this master kind carries only id, kind, label and isActive',
      });
    }
  });
export type MasterRecord = z.infer<typeof MasterRecordSchema>;

/**
 * `{kind, masters}` for both the catalogue and the management list.
 *
 * A list is **homogeneous**: every record's `kind` must equal the declared list
 * `kind`, so a response can never mix master variants.
 */
export const MasterListResponseSchema = z
  .strictObject({
    kind: MasterKindSchema,
    masters: z.array(MasterRecordSchema),
  })
  .superRefine((response, ctx) => {
    response.masters.forEach((record, index) => {
      if (record.kind !== response.kind) {
        ctx.addIssue({
          code: 'custom',
          path: ['masters', index, 'kind'],
          message: `record kind "${record.kind}" does not match the list kind "${response.kind}"`,
        });
      }
    });
  });
export type MasterListResponse = z.infer<typeof MasterListResponseSchema>;

/** Single-master response for create, update and deactivate. */
export const MasterResponseSchema = z.strictObject({ master: MasterRecordSchema });
export type MasterResponse = z.infer<typeof MasterResponseSchema>;

/** Create payload for a violation type: severity is required, action optional. */
export const ViolationTypeCreateRequestSchema = z.strictObject({
  label: LabelSchema,
  severity: SeveritySchema,
  defaultAction: ResolutionActionCodeSchema.nullable().optional(),
});

/** Update payload for a violation type: any subset, at least one field. */
export const ViolationTypeUpdateRequestSchema = z
  .strictObject({
    label: LabelSchema.optional(),
    severity: SeveritySchema.optional(),
    defaultAction: ResolutionActionCodeSchema.nullable().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'at least one field is required',
  });

/** Create payload for the label-only kinds. */
export const SimpleMasterCreateRequestSchema = z.strictObject({ label: LabelSchema });
/** Update payload for the label-only kinds: the label is the only mutable field. */
export const SimpleMasterUpdateRequestSchema = z.strictObject({ label: LabelSchema });

/** Create payload for a gate: it must name an existing active location. */
export const GateCreateRequestSchema = z.strictObject({
  label: LabelSchema,
  locationId: z.uuid(),
});
/** Update payload for a gate: only the label may change; a gate never moves. */
export const GateUpdateRequestSchema = z.strictObject({ label: LabelSchema });

export type MasterOperation = 'create' | 'update';

/**
 * The request schema for a kind and operation.
 *
 * Pure dispatch so the API and any future admin screen validate identically; an
 * unknown combination is a programming error, not a request error.
 */
export function masterRequestSchema(kind: MasterKind, operation: MasterOperation): z.ZodType {
  if (kind === 'violation-types') {
    return operation === 'create'
      ? ViolationTypeCreateRequestSchema
      : ViolationTypeUpdateRequestSchema;
  }
  if (kind === 'gates') {
    return operation === 'create' ? GateCreateRequestSchema : GateUpdateRequestSchema;
  }
  return operation === 'create' ? SimpleMasterCreateRequestSchema : SimpleMasterUpdateRequestSchema;
}
