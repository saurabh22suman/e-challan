import { DraftValidationErrorSchema, type DraftFieldError } from '@echallan/contracts';

/**
 * R5 server-error mapper.
 *
 * The shared contract carries field codes the marshal's controls actually
 * bind to: `vehicleRegistration`, `gatePassNumber`, `driverName`,
 * `departmentId`, `contractorId`, `vehicleTypeId`, `violationTypeIds`,
 * `remarks`. When the API also returns the approved codes `department`,
 * `vehicleType`, `contractor` and `violationType` (the controlled field
 * names from {@link OtherFieldSchema}), the mapper translates them onto
 * the matching form ids so the error message actually appears under the
 * right control.
 *
 * Unmapped errors join a single `submitError` field used by the global
 * fallback notice (R5 "an accessible fallback alert for unmapped/general
 * failures"). The function returns the union of mapped field errors and
 * the fallback.
 */

export interface ServerErrorDisplay {
  fieldErrors: Record<string, string>;
  fallback: string | null;
}

const OTHER_FIELD_TO_FORM_FIELD: Record<string, string> = {
  department: 'departmentId',
  vehicleType: 'vehicleTypeId',
  contractor: 'contractorId',
  violationType: 'violationTypeIds',
};

/** Form field ids the entry flow actually binds errors to. */
const FORM_FIELD_IDS = new Set([
  'vehicleRegistration',
  'gatePassNumber',
  'driverName',
  'departmentId',
  'contractorId',
  'vehicleTypeId',
  'violationTypeIds',
  'remarks',
]);

/** Server-side field names the mapper knows how to translate. */
const KNOWN_SERVER_FIELDS = new Set([...FORM_FIELD_IDS, ...Object.keys(OTHER_FIELD_TO_FORM_FIELD)]);

export function applyServerErrors(body: unknown): ServerErrorDisplay {
  const parsed = DraftValidationErrorSchema.safeParse(body);
  if (!parsed.success) {
    return { fieldErrors: {}, fallback: "Couldn't validate the challan. Try again." };
  }
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.data.fields) {
    const target = mapField(issue);
    if (fieldErrors[target] === undefined) fieldErrors[target] = issue.message;
  }
  const unmapped = parsed.data.fields.filter((issue) => !KNOWN_SERVER_FIELDS.has(issue.field));
  const fallback = unmapped.length > 0 ? parsed.data.message : null;
  return { fieldErrors, fallback };
}

function mapField(issue: DraftFieldError): string {
  if (OTHER_FIELD_TO_FORM_FIELD[issue.field] !== undefined) {
    return OTHER_FIELD_TO_FORM_FIELD[issue.field]!;
  }
  return issue.field;
}
