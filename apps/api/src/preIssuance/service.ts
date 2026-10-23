import { eq, inArray } from 'drizzle-orm';
import {
  deriveChallanSeverity,
  duplicateWindowStart,
  recommendedActionForOccurrence,
  REGISTRY_LIST_LIMIT,
  repeatWindowStart,
  type ChallanPreviewResponse,
  type DraftFieldError,
  type EntryDraft,
  type EntryValidationResponse,
  type OtherField,
  type RegistryLookupField,
  type RegistryMatch,
  type Severity,
} from '@echallan/contracts';
import type { Db } from '../db/client.js';
import * as s from '../db/schema.js';
import {
  duplicateWarningFromCount,
  occurrenceFromPriorCount,
  otherFieldsFromSelections,
} from './rules.js';

/**
 * Pre-issuance service over real PostgreSQL: scoped registry lookup, authoritative
 * draft validation and the repeat/duplicate preview.
 *
 * The service never writes: a preview is not a reservation. Actual issuance,
 * numbering, transaction finalisation and idempotency remain I-06.
 */

/** A draft refusal carrying field errors for the 422 `invalid_draft` body. */
export class DraftFailure extends Error {
  readonly fields: DraftFieldError[];

  constructor(fields: DraftFieldError[]) {
    super('The draft is not valid.');
    this.name = 'DraftFailure';
    this.fields = fields;
  }
}

/* -------------------------------------------------------------------------- */
/* Registry lookup (I-01)                                                      */
/* -------------------------------------------------------------------------- */

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * Scoped registry matches, one match per gate-pass record.
 *
 * A non-empty query searches after three characters. An empty query lists the
 * session location's registered vehicles (B-08 vehicle dropdown), bounded by
 * {@link REGISTRY_LIST_LIMIT} and ordered by registration for stable scanning.
 *
 * Scope is the marshal's session location via `gate_pass_locations`; a vehicle with
 * no prior challans still matches because the source is the registry, not history.
 * Expired passes are returned with their status rather than hidden (B-06).
 */
export async function lookupRegistry(
  db: Db,
  locationId: string,
  query: { field: RegistryLookupField; query: string },
  now: Date,
): Promise<RegistryMatch[]> {
  const listing = query.query === '';
  const pattern = listing
    ? null
    : query.field === 'driverName'
      ? `${escapeLike(query.query)}%`
      : `${escapeLike(query.query.toUpperCase().replace(/\s+/g, ''))}%`;

  const column =
    query.field === 'registration'
      ? 'v.registration_number'
      : query.field === 'gatePassNumber'
        ? 'gpr.gate_pass_number'
        : 'd.name';

  const filterSql = listing
    ? 'gpl.location_id = $1'
    : `gpl.location_id = $1 AND ${column} ILIKE $2`;
  const orderSql = listing
    ? 'ORDER BY v.registration_number, gpr.gate_pass_number, gpr.id LIMIT $2'
    : 'ORDER BY gpr.gate_pass_number, gpr.id';
  const parameters = listing ? [locationId, REGISTRY_LIST_LIMIT] : [locationId, pattern];

  const rows = await db.pool.query<{
    gate_pass_record_id: string;
    gate_pass_number: string;
    driver_id: string;
    driver_name: string;
    vehicle_id: string;
    vehicle_registration_number: string;
    vehicle_type_id: string;
    vehicle_type_label: string;
    department_id: string;
    department_label: string;
    contractor_id: string | null;
    contractor_label: string | null;
    valid_until: Date | null;
  }>(
    `SELECT gpr.id AS gate_pass_record_id, gpr.gate_pass_number, d.id AS driver_id, d.name AS driver_name,
            v.id AS vehicle_id, v.registration_number AS vehicle_registration_number,
            vt.id AS vehicle_type_id, vt.label AS vehicle_type_label,
            dep.id AS department_id, dep.label AS department_label,
            con.id AS contractor_id, con.label AS contractor_label,
            gpr.valid_until
       FROM gate_pass_records gpr
       JOIN gate_pass_locations gpl ON gpl.gate_pass_record_id = gpr.id
       JOIN drivers d ON d.id = gpr.driver_id
       JOIN vehicles v ON v.id = gpr.vehicle_id
       JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
       JOIN departments dep ON dep.id = gpr.department_id
       LEFT JOIN contractors con ON con.id = gpr.contractor_id
      WHERE ${filterSql}
      ${orderSql}`,
    parameters,
  );

  return rows.rows.map((row) => ({
    gatePassRecordId: row.gate_pass_record_id,
    gatePassNumber: row.gate_pass_number,
    driverId: row.driver_id,
    driverName: row.driver_name,
    vehicleId: row.vehicle_id,
    vehicleRegistrationNumber: row.vehicle_registration_number,
    vehicleTypeId: row.vehicle_type_id,
    vehicleTypeLabel: row.vehicle_type_label,
    departmentId: row.department_id,
    departmentLabel: row.department_label,
    contractorId: row.contractor_id,
    contractorLabel: row.contractor_label,
    status:
      row.valid_until !== null && row.valid_until.getTime() < now.getTime() ? 'expired' : 'active',
    validUntil: row.valid_until === null ? null : row.valid_until.toISOString(),
  }));
}

/**
 * Recently issued vehicles at the session location, newest first.
 *
 * This is a convenience shortcut, not a registry authority: every returned
 * match still carries the stored gate-pass/driver/vehicle ids and is revalidated
 * on submission. Only vehicles with at least one non-cancelled challan qualify.
 */
export async function recentVehicles(
  db: Db,
  locationId: string,
  now: Date,
): Promise<RegistryMatch[]> {
  const rows = await db.pool.query<{
    gate_pass_record_id: string;
    gate_pass_number: string;
    driver_id: string;
    driver_name: string;
    vehicle_id: string;
    vehicle_registration_number: string;
    vehicle_type_id: string;
    vehicle_type_label: string;
    department_id: string;
    department_label: string;
    contractor_id: string | null;
    contractor_label: string | null;
    valid_until: Date | null;
    last_issued_at: Date;
  }>(
    `SELECT * FROM (
       SELECT DISTINCT ON (v.id)
              gpr.id AS gate_pass_record_id, gpr.gate_pass_number,
              d.id AS driver_id, d.name AS driver_name,
              v.id AS vehicle_id, v.registration_number AS vehicle_registration_number,
              vt.id AS vehicle_type_id, vt.label AS vehicle_type_label,
              dep.id AS department_id, dep.label AS department_label,
              con.id AS contractor_id, con.label AS contractor_label,
              gpr.valid_until, c.issued_at AS last_issued_at
         FROM gate_pass_records gpr
         JOIN gate_pass_locations gpl ON gpl.gate_pass_record_id = gpr.id
         JOIN drivers d ON d.id = gpr.driver_id
         JOIN vehicles v ON v.id = gpr.vehicle_id
         JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
         JOIN departments dep ON dep.id = gpr.department_id
         LEFT JOIN contractors con ON con.id = gpr.contractor_id
         JOIN challans c ON c.gate_pass_record_id = gpr.id
        WHERE gpl.location_id = $1 AND c.location_id = $1 AND c.status <> 'Cancelled'
        ORDER BY v.id, c.issued_at DESC
     ) latest
     ORDER BY last_issued_at DESC
     LIMIT 5`,
    [locationId],
  );

  return rows.rows.map((row) => ({
    gatePassRecordId: row.gate_pass_record_id,
    gatePassNumber: row.gate_pass_number,
    driverId: row.driver_id,
    driverName: row.driver_name,
    vehicleId: row.vehicle_id,
    vehicleRegistrationNumber: row.vehicle_registration_number,
    vehicleTypeId: row.vehicle_type_id,
    vehicleTypeLabel: row.vehicle_type_label,
    departmentId: row.department_id,
    departmentLabel: row.department_label,
    contractorId: row.contractor_id,
    contractorLabel: row.contractor_label,
    status:
      row.valid_until !== null && row.valid_until.getTime() < now.getTime() ? 'expired' : 'active',
    validUntil: row.valid_until === null ? null : row.valid_until.toISOString(),
  }));
}

/* -------------------------------------------------------------------------- */
/* Authoritative draft validation (I-01)                                       */
/* -------------------------------------------------------------------------- */

async function masterState(
  db: Db,
  kind: 'departments' | 'vehicle-types' | 'contractors' | 'violation-types',
  id: string,
): Promise<{ label: string; isActive: boolean } | undefined> {
  switch (kind) {
    case 'departments': {
      const rows = await db.orm
        .select({ label: s.departments.label, isActive: s.departments.isActive })
        .from(s.departments)
        .where(eq(s.departments.id, id))
        .limit(1);
      return rows[0];
    }
    case 'vehicle-types': {
      const rows = await db.orm
        .select({ label: s.vehicleTypes.label, isActive: s.vehicleTypes.isActive })
        .from(s.vehicleTypes)
        .where(eq(s.vehicleTypes.id, id))
        .limit(1);
      return rows[0];
    }
    case 'contractors': {
      const rows = await db.orm
        .select({ label: s.contractors.label, isActive: s.contractors.isActive })
        .from(s.contractors)
        .where(eq(s.contractors.id, id))
        .limit(1);
      return rows[0];
    }
    case 'violation-types': {
      const rows = await db.orm
        .select({
          label: s.violationTypes.label,
          isActive: s.violationTypes.isActive,
          severity: s.violationTypes.severity,
        })
        .from(s.violationTypes)
        .where(eq(s.violationTypes.id, id))
        .limit(1);
      return rows[0];
    }
  }
}

function masterFailure(
  field: string,
  state: { isActive: boolean } | undefined,
): DraftFieldError | null {
  if (state === undefined) {
    return { field, code: 'unknown_master', message: 'That master no longer exists.' };
  }
  if (!state.isActive) {
    return {
      field,
      code: 'inactive_master',
      message: 'That master is deactivated. Choose an active one.',
    };
  }
  return null;
}

/**
 * Validate a parsed draft with real context.
 *
 * The draft never carries a location: the actual location comes from the marshal's
 * session post. Inactive or unknown masters, Other-without-remarks and inconsistent
 * registry provenance are refused with field codes; severity is derived here and is
 * never accepted from the client.
 */
export async function validateDraft(
  db: Db,
  locationId: string,
  draft: EntryDraft,
): Promise<EntryValidationResponse> {
  const fields: DraftFieldError[] = [];
  const selections: Array<{ field: OtherField; label: string }> = [];

  const department = await masterState(db, 'departments', draft.departmentId);
  const departmentError = masterFailure('departmentId', department);
  if (departmentError !== null) fields.push(departmentError);
  if (department !== undefined) selections.push({ field: 'department', label: department.label });

  const vehicleType = await masterState(db, 'vehicle-types', draft.vehicleTypeId);
  const vehicleTypeError = masterFailure('vehicleTypeId', vehicleType);
  if (vehicleTypeError !== null) fields.push(vehicleTypeError);
  if (vehicleType !== undefined)
    selections.push({ field: 'vehicleType', label: vehicleType.label });

  if (draft.contractorId !== null) {
    const contractor = await masterState(db, 'contractors', draft.contractorId);
    const contractorError = masterFailure('contractorId', contractor);
    if (contractorError !== null) fields.push(contractorError);
    if (contractor !== undefined) selections.push({ field: 'contractor', label: contractor.label });
  }

  const violationRows = await db.orm
    .select({
      id: s.violationTypes.id,
      label: s.violationTypes.label,
      isActive: s.violationTypes.isActive,
      severity: s.violationTypes.severity,
    })
    .from(s.violationTypes)
    .where(inArray(s.violationTypes.id, draft.violationTypeIds));
  const byId = new Map(violationRows.map((row) => [row.id, row]));
  const severities: string[] = [];
  for (const id of draft.violationTypeIds) {
    const row = byId.get(id);
    const error = masterFailure('violationTypeIds', row);
    if (error !== null) {
      fields.push(error);
      continue;
    }
    severities.push(row?.severity as string);
    if (row !== undefined) selections.push({ field: 'violationType', label: row.label });
  }

  const otherFields = otherFieldsFromSelections(selections);
  if (otherFields.length > 0 && draft.remarks.trim() === '') {
    for (const field of otherFields) {
      fields.push({
        field,
        code: 'other_remarks_required',
        message: 'Remarks are required when Other is selected.',
      });
    }
  }

  if (draft.registry !== null) {
    const rows = await db.pool.query<{
      driver_id: string;
      vehicle_id: string;
      in_scope: number;
    }>(
      `SELECT gpr.driver_id, gpr.vehicle_id,
              (SELECT count(*)::int FROM gate_pass_locations gpl
                WHERE gpl.gate_pass_record_id = gpr.id AND gpl.location_id = $2) AS in_scope
         FROM gate_pass_records gpr WHERE gpr.id = $1`,
      [draft.registry.gatePassRecordId, locationId],
    );
    const row = rows.rows[0];
    if (
      row === undefined ||
      Number(row.in_scope) === 0 ||
      row.driver_id !== draft.registry.driverId ||
      row.vehicle_id !== draft.registry.vehicleId
    ) {
      fields.push({
        field: 'registry',
        code: 'provenance_mismatch',
        message: 'The selected registry record is not available for this location.',
      });
    }
  }

  if (fields.length > 0) throw new DraftFailure(fields);

  return {
    severity: deriveChallanSeverity(severities) as Severity,
    otherFields,
  };
}

/* -------------------------------------------------------------------------- */
/* Repeat and duplicate preview (I-05)                                         */
/* -------------------------------------------------------------------------- */

async function countPriorOccurrences(db: Db, gatePassNumber: string, now: Date): Promise<number> {
  const rows = await db.pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM challans
      WHERE gate_pass_number = $1 AND status <> 'Cancelled'
        AND issued_at >= $2 AND issued_at < $3`,
    [gatePassNumber, repeatWindowStart(now), now],
  );
  return Number(rows.rows[0]?.n ?? 0);
}

async function countRecentDuplicates(
  db: Db,
  registrationNumber: string,
  locationId: string,
  now: Date,
): Promise<number> {
  const rows = await db.pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM challans
      WHERE vehicle_registration_number = $1 AND location_id = $2 AND status <> 'Cancelled'
        AND issued_at >= $3 AND issued_at < $4`,
    [registrationNumber, locationId, duplicateWindowStart(now), now],
  );
  return Number(rows.rows[0]?.n ?? 0);
}

/**
 * Validate then preview. Occurrence is keyed on the normalised gate-pass number
 * across locations; the duplicate warning is keyed on the normalised registration at
 * the session location. Both windows include their lower bound and exclude `T`.
 */
export async function previewChallan(
  db: Db,
  locationId: string,
  draft: EntryDraft,
  now: Date,
): Promise<ChallanPreviewResponse> {
  const validation = await validateDraft(db, locationId, draft);
  const occurrence = occurrenceFromPriorCount(
    await countPriorOccurrences(db, draft.gatePassNumber, now),
  );
  const duplicateCount = await countRecentDuplicates(
    db,
    draft.vehicleRegistration,
    locationId,
    now,
  );
  return {
    severity: validation.severity,
    occurrenceNumber: occurrence,
    recommendedAction: recommendedActionForOccurrence(occurrence),
    duplicateWarning: duplicateWarningFromCount(duplicateCount),
    windowDays: 90,
    windowMinutes: 15,
  };
}
