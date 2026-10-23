import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  deriveChallanSeverity,
  recommendedActionForOccurrence,
  type ResolutionActionCode,
  type Severity,
} from '@echallan/contracts';
import { DEMO_DATA_PATH, loadEnv } from '../env.js';
import { createDb, type Db } from './client.js';
import { assertIsSeedAllowedDatabase } from './testDatabase.js';
import * as s from './schema.js';

/**
 * SYNTHETIC HISTORY ADAPTER - NOT OPERATIONAL ISSUANCE.
 *
 * This adapter maps the approved synthetic fixture `docs/demo-data.json`
 * (see `docs/demo-data.md`) onto the F-01 demo domain schema so the relational
 * constraints, joins and repeat-history behaviour can be exercised end to end
 * against real PostgreSQL.
 *
 * Provenance, stated plainly so nothing here is mistaken for live behaviour:
 *
 *  - **No evidence rows are inserted.** The fixture's `photoCount` values are
 *    display metadata; the specification states metadata counts are not
 *    evidence. Real captured blobs arrive through the validated media flow in
 *    I-02 to I-06 with their own byte budgets.
 *  - **No signature rows are inserted.** `signatureState: "signed"` is likewise
 *    display metadata and no signature blob exists in the fixture.
 *  - **Refusals are inserted** for the two explicit refusal fixtures, because
 *    those carry real structured data (reason plus witnessing supervisor name
 *    and staff ID) rather than a media claim.
 *  - **Statuses are display states.** `Resolved`/`Cancelled` records come with
 *    action rows so the append-only history is coherent, and every such row is
 *    marked `demo_source_id` and synthetic remarks. No operational transition,
 *    approval or reviewer judgement is asserted to have happened.
 *  - **Occurrence numbers and recommendations are derived** by applying the
 *    owner-approved 90-day rule and recommendation tiers to the fixture's own
 *    timestamps. They are a faithful reproduction of the approved rule over
 *    synthetic history, not an independently approved dataset.
 *  - **Master default actions are left NULL**, because the fixture does not
 *    supply or approve them.
 *
 * Safety: the target is validated *before any write*, refusing anything that is
 * not an explicitly allowed local demo/test database.
 *
 * Idempotence: every primary key is derived deterministically from the fixture
 * identifier and every write is insert-if-absent (`onConflictDoNothing`), so
 * repeated invocations never duplicate a row or change an identity. This is
 * deliberately **not** described as an upsert: it does not reconcile or overwrite a
 * row that was edited after an earlier seed. Re-seeding restores nothing that was
 * manually changed to a *new* row, it only leaves existing rows untouched.
 */

/** Fixed namespace so seeded UUIDs are stable across runs and machines. */
const UUID_NAMESPACE = 'e-challan/f01-demo-domain/v0.1';

/** Fixed reference clock from the fixture; tests must not use the machine clock. */
const SEED_SOURCE = 'docs/demo-data.json';
const SYNTHETIC_SOURCE = 'seed:synthetic';

/** Marker prefix on synthetic remarks, so no row reads as operational truth. */
const SYNTHETIC_NOTE =
  'Synthetic demo history seeded from docs/demo-data.json; not an operational record.';

/**
 * Derive a stable UUID from a fixture identifier.
 *
 * Fixture IDs are never treated as approved UUIDs; this is the explicit mapping.
 *
 * **Not a standards-conformant UUID v5.** Standard name-based UUID v5 is defined
 * over SHA-1; this uses SHA-256 and then sets the version/variant bits so the value
 * is a well-formed, unique and stable UUID for PostgreSQL. It is a custom
 * deterministic derivation for this synthetic fixture, chosen because it cannot
 * collide with a real name-based v5. It is deliberately left unchanged so that
 * already-seeded row identities are preserved.
 */
export function deterministicUuid(sourceKey: string): string {
  const digest = createHash('sha256').update(`${UUID_NAMESPACE}:${sourceKey}`).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/* ----------------------------- fixture shape ------------------------------ */

interface Fixture {
  metadata: { referenceNow: string };
  locations: Array<{ id: string; name: string }>;
  gates: Array<{ id: string; locationId: string; name: string; postId: string }>;
  departments: Array<{ id: string; name: string; active: boolean }>;
  contractors: Array<{ id: string; name: string; active: boolean }>;
  vehicleTypes: Array<{ id: string; name: string; active: boolean }>;
  violationTypes: Array<{
    id: string;
    name: string;
    demoSeverity: string;
    active: boolean;
  }>;
  staff: Array<{
    id: string;
    name: string;
    employeeId: string;
    role: string;
    locationIds: string[];
  }>;
  shifts: Array<{
    id: string;
    gateId: string;
    label: string;
    marshalId: string;
    supervisorId: string;
  }>;
  drivers: Array<{ id: string; name: string; gatePassNumber: string }>;
  vehicles: Array<{ id: string; registration: string; vehicleTypeId: string }>;
  gatePassRecords: Array<{
    id: string;
    gatePassNumber: string;
    driverId: string;
    vehicleId: string;
    departmentId: string;
    contractorId: string;
    locationIds: string[];
    demoStatus: string;
    validFrom: string;
    validUntil: string;
  }>;
  challans: Array<{
    id: string;
    demoNumber: string;
    issuedAt: string;
    driverId: string;
    vehicleId: string;
    gateId: string;
    shiftId: string;
    violationIds: string[];
    demoStatus: string;
    remarks: string;
    refusal?: { reason: string; witnessStaffId: string; witnessName: string };
  }>;
}

function byId<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

/* --------------------------------- seeding -------------------------------- */

export async function seedDomainDemoDatabase(connectionString: string): Promise<{
  databaseName: string;
  challans: number;
}> {
  // Guard first: nothing is connected or written before this succeeds.
  const databaseName = assertIsSeedAllowedDatabase(connectionString);
  const fixture = JSON.parse(await readFile(DEMO_DATA_PATH, 'utf8')) as Fixture;

  const gates = byId(fixture.gates);
  const departments = byId(fixture.departments);
  const contractors = byId(fixture.contractors);
  const vehicleTypes = byId(fixture.vehicleTypes);
  const violationTypes = byId(fixture.violationTypes);
  const staff = byId(fixture.staff);
  const vehicles = byId(fixture.vehicles);
  const passesByDriver = new Map(fixture.gatePassRecords.map((pass) => [pass.driverId, pass]));

  /** One post per gate: the authorised post a marshal issues from. */
  const postForGate = new Map(fixture.gates.map((gate) => [gate.id, gate.postId]));

  const db = createDb(connectionString);
  try {
    await db.orm.transaction(async (tx) => {
      await tx
        .insert(s.locations)
        .values(
          fixture.locations.map((row) => ({
            id: deterministicUuid(`location:${row.id}`),
            label: row.name,
            isActive: true,
            demoSourceId: row.id,
          })),
        )
        .onConflictDoNothing();

      await tx
        .insert(s.gates)
        .values(
          fixture.gates.map((gate) => ({
            id: deterministicUuid(`gate:${gate.id}`),
            locationId: deterministicUuid(`location:${gate.locationId}`),
            label: gate.name,
            isActive: true,
            demoSourceId: gate.id,
          })),
        )
        .onConflictDoNothing();

      // The fixture supplies `gate.postId`; the association is persisted on the post
      // so the authoritative gate is recoverable from stored data rather than from a
      // transient seed-time map (corrective migration 0003/0004).
      await tx
        .insert(s.posts)
        .values(
          fixture.gates.map((gate) => ({
            id: deterministicUuid(`post:${gate.postId}`),
            locationId: deterministicUuid(`location:${gate.locationId}`),
            gateId: deterministicUuid(`gate:${gate.id}`),
            label: `${gate.postId}`,
            isActive: true,
            demoSourceId: gate.postId,
          })),
        )
        .onConflictDoNothing();

      // Credentials are provisioned outside the fixture (spec section 8). A reset
      // hash is written only by an Admin action, so the seed leaves it null and
      // the F-02 env-backed demo path remains the bootstrap.
      await tx
        .insert(s.users)
        .values(
          fixture.staff.map((person) => ({
            id: deterministicUuid(`staff:${person.id}`),
            username: person.employeeId,
            displayName: person.name,
            employeeId: person.employeeId,
            role: person.role as (typeof s.ROLE_VALUES)[number],
            isActive: true,
            demoSourceId: person.id,
          })),
        )
        .onConflictDoNothing();

      await tx
        .insert(s.userLocations)
        .values(
          fixture.staff.flatMap((person) =>
            person.locationIds.map((locationId) => ({
              userId: deterministicUuid(`staff:${person.id}`),
              locationId: deterministicUuid(`location:${locationId}`),
            })),
          ),
        )
        .onConflictDoNothing();

      await tx
        .insert(s.shifts)
        .values(
          fixture.shifts.map((shift) => ({
            id: deterministicUuid(`shift:${shift.id}`),
            gateId: deterministicUuid(`gate:${shift.gateId}`),
            label: shift.label,
            marshalUserId: deterministicUuid(`staff:${shift.marshalId}`),
            supervisorUserId: deterministicUuid(`staff:${shift.supervisorId}`),
            isActive: true,
            demoSourceId: shift.id,
          })),
        )
        .onConflictDoNothing();

      await tx
        .insert(s.departments)
        .values(
          fixture.departments.map((row) => ({
            id: deterministicUuid(`department:${row.id}`),
            label: row.name,
            isActive: row.active,
            demoSourceId: row.id,
          })),
        )
        .onConflictDoNothing();

      await tx
        .insert(s.contractors)
        .values(
          fixture.contractors.map((row) => ({
            id: deterministicUuid(`contractor:${row.id}`),
            label: row.name,
            isActive: row.active,
            demoSourceId: row.id,
          })),
        )
        .onConflictDoNothing();

      await tx
        .insert(s.vehicleTypes)
        .values(
          fixture.vehicleTypes.map((row) => ({
            id: deterministicUuid(`vehicleType:${row.id}`),
            label: row.name,
            isActive: row.active,
            demoSourceId: row.id,
          })),
        )
        .onConflictDoNothing();

      // The fixture supplies a display severity only, and no approved default
      // action, so defaultAction stays NULL rather than being invented.
      await tx
        .insert(s.violationTypes)
        .values(
          fixture.violationTypes.map((row) => ({
            id: deterministicUuid(`violationType:${row.id}`),
            label: row.name,
            severity: row.demoSeverity as Severity,
            defaultAction: null,
            isActive: row.active,
            demoSourceId: row.id,
          })),
        )
        .onConflictDoNothing();

      await tx
        .insert(s.drivers)
        .values(
          fixture.drivers.map((row) => ({
            id: deterministicUuid(`driver:${row.id}`),
            name: row.name,
            gatePassNumber: row.gatePassNumber,
            demoSourceId: row.id,
          })),
        )
        .onConflictDoNothing();

      await tx
        .insert(s.vehicles)
        .values(
          fixture.vehicles.map((row) => ({
            id: deterministicUuid(`vehicle:${row.id}`),
            registrationNumber: row.registration.toUpperCase(),
            vehicleTypeId: deterministicUuid(`vehicleType:${row.vehicleTypeId}`),
            demoSourceId: row.id,
          })),
        )
        .onConflictDoNothing();

      await tx
        .insert(s.gatePassRecords)
        .values(
          fixture.gatePassRecords.map((row) => ({
            id: deterministicUuid(`pass:${row.id}`),
            gatePassNumber: row.gatePassNumber.toUpperCase(),
            driverId: deterministicUuid(`driver:${row.driverId}`),
            vehicleId: deterministicUuid(`vehicle:${row.vehicleId}`),
            departmentId: deterministicUuid(`department:${row.departmentId}`),
            contractorId: deterministicUuid(`contractor:${row.contractorId}`),
            validFrom: new Date(row.validFrom),
            validUntil: new Date(row.validUntil),
            registryStatus: row.demoStatus,
            demoSourceId: row.id,
          })),
        )
        .onConflictDoNothing();

      await tx
        .insert(s.gatePassLocations)
        .values(
          fixture.gatePassRecords.flatMap((row) =>
            row.locationIds.map((locationId) => ({
              gatePassRecordId: deterministicUuid(`pass:${row.id}`),
              locationId: deterministicUuid(`location:${locationId}`),
            })),
          ),
        )
        .onConflictDoNothing();

      await seedChallans(tx, fixture, {
        gates,
        postForGate,
        passesByDriver,
        vehicles,
        violationTypes,
        staff,
        departments,
        contractors,
        vehicleTypes,
      });

      await tx
        .insert(s.auditEvents)
        .values(
          fixture.challans.map((row) => ({
            id: deterministicUuid(`audit:created:${row.id}`),
            challanId: deterministicUuid(`challan:${row.id}`),
            actorUserId: deterministicUuid(
              `staff:${fixture.shifts.find((shift) => shift.id === row.shiftId)?.marshalId ?? ''}`,
            ),
            eventType: 'challan.created',
            source: SYNTHETIC_SOURCE,
            payload: {
              synthetic: true,
              fixtureSource: SEED_SOURCE,
              note: SYNTHETIC_NOTE,
              displayStatus: row.demoStatus,
            },
          })),
        )
        .onConflictDoNothing();
    });

    console.log(
      `db:seed:domain: seeded ${fixture.challans.length} synthetic challan record(s) into ` +
        `${databaseName} from ${SEED_SOURCE}; no media or operational issuance implied`,
    );
    return { databaseName, challans: fixture.challans.length };
  } finally {
    await db.close();
  }
}

type Transaction = Parameters<Parameters<Db['orm']['transaction']>[0]>[0];

async function seedChallans(
  tx: Transaction,
  fixture: Fixture,
  refs: {
    gates: Map<string, Fixture['gates'][number]>;
    postForGate: Map<string, string>;
    passesByDriver: Map<string, Fixture['gatePassRecords'][number]>;
    vehicles: Map<string, Fixture['vehicles'][number]>;
    violationTypes: Map<string, Fixture['violationTypes'][number]>;
    staff: Map<string, Fixture['staff'][number]>;
    departments: Map<string, Fixture['departments'][number]>;
    contractors: Map<string, Fixture['contractors'][number]>;
    vehicleTypes: Map<string, Fixture['vehicleTypes'][number]>;
  },
): Promise<void> {
  const { gates, postForGate, passesByDriver, vehicles, violationTypes, staff } = refs;

  const ordered = [...fixture.challans].sort(
    (a, b) => new Date(a.issuedAt).getTime() - new Date(b.issuedAt).getTime(),
  );

  await tx
    .insert(s.challans)
    .values(
      ordered.map((row) => {
        const gate = gates.get(row.gateId);
        if (gate === undefined) throw new Error(`Fixture challan ${row.id} has an unknown gate`);
        const pass = passesByDriver.get(row.driverId);
        if (pass === undefined)
          throw new Error(`Fixture challan ${row.id} has no gate-pass registry record`);
        const vehicle = vehicles.get(row.vehicleId);
        if (vehicle === undefined)
          throw new Error(`Fixture challan ${row.id} has an unknown vehicle`);
        const shift = fixture.shifts.find((candidate) => candidate.id === row.shiftId);
        if (shift === undefined) throw new Error(`Fixture challan ${row.id} has an unknown shift`);

        const department = refs.departments.get(pass.departmentId);
        const contractor = refs.contractors.get(pass.contractorId);
        const vehicleType = refs.vehicleTypes.get(vehicle.vehicleTypeId);
        if (department === undefined || contractor === undefined || vehicleType === undefined) {
          throw new Error(`Fixture challan ${row.id} references an unknown master`);
        }

        const issuedAt = new Date(row.issuedAt);
        const cancelled = row.demoStatus === 'Cancelled';

        // Approved 90-day rule over synthetic history: one occurrence per
        // non-cancelled prior challan for the same normalised gate pass.
        const prior = ordered.filter((candidate) => {
          if (candidate.id === row.id) return false;
          if (candidate.demoStatus === 'Cancelled') return false;
          const candidatePass = passesByDriver.get(candidate.driverId);
          if (candidatePass?.gatePassNumber.toUpperCase() !== pass.gatePassNumber.toUpperCase()) {
            return false;
          }
          const candidateAt = new Date(candidate.issuedAt).getTime();
          return (
            issuedAt.getTime() - DAY_MS * 90 <= candidateAt && candidateAt < issuedAt.getTime()
          );
        });
        const occurrenceNumber = prior.length + 1;

        const severities = row.violationIds.map((violationId) => {
          const violation = violationTypes.get(violationId);
          if (violation === undefined)
            throw new Error(`Fixture challan ${row.id} references an unknown violation type`);
          return violation.demoSeverity;
        });

        return {
          id: deterministicUuid(`challan:${row.id}`),
          challanNumber: row.demoNumber,
          gatePassNumber: pass.gatePassNumber.toUpperCase(),
          vehicleRegistrationNumber: vehicle.registration.toUpperCase(),
          driverName: fixture.drivers.find((driver) => driver.id === row.driverId)?.name ?? '',
          gatePassRecordId: deterministicUuid(`pass:${pass.id}`),
          departmentId: deterministicUuid(`department:${department.id}`),
          departmentLabelSnapshot: department.name,
          contractorId: deterministicUuid(`contractor:${contractor.id}`),
          contractorLabelSnapshot: contractor.name,
          vehicleTypeId: deterministicUuid(`vehicleType:${vehicleType.id}`),
          vehicleTypeLabelSnapshot: vehicleType.name,
          locationId: deterministicUuid(`location:${gate.locationId}`),
          gateId: deterministicUuid(`gate:${gate.id}`),
          postId: deterministicUuid(`post:${postForGate.get(row.gateId) ?? ''}`),
          shiftId: deterministicUuid(`shift:${shift.id}`),
          issuedByUserId: deterministicUuid(`staff:${shift.marshalId}`),
          status: row.demoStatus as (typeof s.CHALLAN_STATUS_VALUES)[number],
          severity: deriveChallanSeverity(severities),
          occurrenceNumber,
          recommendedAction: recommendedActionForOccurrence(occurrenceNumber),
          remarks: row.remarks,
          entryStartedAt: null,
          issuedAt,
          cancelledAt: cancelled ? issuedAt : null,
          cancelledByUserId: cancelled
            ? deterministicUuid(`staff:${staff.get('staff-admin')?.id ?? 'staff-admin'}`)
            : null,
          cancellationReason: cancelled ? `Synthetic demo cancellation. ${SYNTHETIC_NOTE}` : null,
          demoSourceId: row.id,
        };
      }),
    )
    .onConflictDoNothing();

  // Immutable issued snapshots of the master values, so later master edits or
  // deactivation cannot change the meaning of an issued challan (B-05).
  await tx
    .insert(s.challanViolations)
    .values(
      ordered.flatMap((row) =>
        row.violationIds.map((violationId) => {
          const violation = violationTypes.get(violationId);
          if (violation === undefined)
            throw new Error(`Fixture challan ${row.id} references an unknown violation type`);
          return {
            challanId: deterministicUuid(`challan:${row.id}`),
            violationTypeId: deterministicUuid(`violationType:${violation.id}`),
            labelSnapshot: violation.name,
            severitySnapshot: violation.demoSeverity as Severity,
            defaultActionSnapshot: null,
          };
        }),
      ),
    )
    .onConflictDoNothing();

  // Real structured refusal data only: no signature blob exists in the fixture.
  const refusalRows = ordered.filter((row) => row.refusal !== undefined);
  if (refusalRows.length > 0) {
    await tx
      .insert(s.refusals)
      .values(
        refusalRows.map((row) => {
          const refusal = row.refusal;
          if (refusal === undefined) throw new Error('unreachable');
          const shift = fixture.shifts.find((candidate) => candidate.id === row.shiftId);
          return {
            id: deterministicUuid(`refusal:${row.id}`),
            challanId: deterministicUuid(`challan:${row.id}`),
            reason: refusal.reason,
            witnessName: refusal.witnessName,
            witnessStaffId: refusal.witnessStaffId,
            recordedByUserId: deterministicUuid(`staff:${shift?.marshalId ?? ''}`),
            refusedAt: new Date(row.issuedAt),
          };
        }),
      )
      .onConflictDoNothing();
  }

  // Append-only review history for the display states that need one. Every row is
  // marked synthetic; no operational approval is asserted.
  const resolved = ordered.filter((row) => row.demoStatus === 'Resolved');
  if (resolved.length > 0) {
    await tx
      .insert(s.challanActions)
      .values(
        resolved.map((row) => {
          const shift = fixture.shifts.find((candidate) => candidate.id === row.shiftId);
          return {
            id: deterministicUuid(`action:resolved:${row.id}`),
            challanId: deterministicUuid(`challan:${row.id}`),
            toStatus: 'Resolved' as const,
            action: 'custom' as ResolutionActionCode,
            remarks: `Synthetic demo resolution. ${SYNTHETIC_NOTE}`,
            performerUserId: deterministicUuid(`staff:${shift?.supervisorId ?? ''}`),
            demoSourceId: row.id,
          };
        }),
      )
      .onConflictDoNothing();
  }

  const cancelled = ordered.filter((row) => row.demoStatus === 'Cancelled');
  if (cancelled.length > 0) {
    await tx
      .insert(s.challanActions)
      .values(
        cancelled.map((row) => ({
          id: deterministicUuid(`action:cancelled:${row.id}`),
          challanId: deterministicUuid(`challan:${row.id}`),
          toStatus: 'Cancelled' as const,
          action: null,
          remarks: null,
          reason: `Synthetic demo cancellation. ${SYNTHETIC_NOTE}`,
          performerUserId: deterministicUuid(`staff:staff-admin`),
          demoSourceId: row.id,
        })),
      )
      .onConflictDoNothing();
  }

  // Evidence and signatures are deliberately absent: see the file header.
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  try {
    await seedDomainDemoDatabase(loadEnv().DATABASE_URL);
  } catch (error) {
    console.error('db:seed:domain: failed', error);
    process.exit(1);
  }
}
