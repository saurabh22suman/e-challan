import { randomUUID } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import type { ResolutionActionCode, Severity, MasterKind, MasterRecord } from '@echallan/contracts';
import type { Db } from '../db/client.js';
import * as s from '../db/schema.js';

/**
 * Admin master-data service over the existing F-01 tables.
 *
 * No schema change and no migration: `is_active` and the immutable issued snapshots
 * already exist. Every function touches **only** master tables, so an edit or
 * deactivation can never rewrite the meaning of an issued challan (B-05).
 */

/** The label-only kinds, which share one implementation. */
type SimpleKind = 'departments' | 'contractors' | 'locations' | 'vehicle-types';

/** A service-level refusal the route maps onto the shared error contract. */
export class MasterFailure extends Error {
  readonly code: 'not_found' | 'invalid_reference';
  readonly status: number;

  constructor(code: 'not_found' | 'invalid_reference', status: number, message: string) {
    super(message);
    this.name = 'MasterFailure';
    this.code = code;
    this.status = status;
  }
}

export interface MasterCreatePayload {
  label: string;
  severity?: Severity;
  defaultAction?: ResolutionActionCode | null;
  locationId?: string;
}

export interface MasterUpdatePayload {
  label?: string;
  severity?: Severity;
  defaultAction?: ResolutionActionCode | null;
}

function notFound(kind: MasterKind): MasterFailure {
  return new MasterFailure('not_found', 404, `No such ${kind} entry.`);
}

/* -------------------------------------------------------------------------- */
/* Listing                                                                     */
/* -------------------------------------------------------------------------- */

async function listSimple(db: Db, kind: SimpleKind, activeOnly: boolean): Promise<MasterRecord[]> {
  if (kind === 'departments') {
    const rows = await db.orm
      .select({
        id: s.departments.id,
        label: s.departments.label,
        isActive: s.departments.isActive,
      })
      .from(s.departments)
      .where(activeOnly ? eq(s.departments.isActive, true) : undefined)
      .orderBy(asc(s.departments.label), asc(s.departments.id));
    return rows.map((row) => ({ id: row.id, kind, label: row.label, isActive: row.isActive }));
  }
  if (kind === 'contractors') {
    const rows = await db.orm
      .select({
        id: s.contractors.id,
        label: s.contractors.label,
        isActive: s.contractors.isActive,
      })
      .from(s.contractors)
      .where(activeOnly ? eq(s.contractors.isActive, true) : undefined)
      .orderBy(asc(s.contractors.label), asc(s.contractors.id));
    return rows.map((row) => ({ id: row.id, kind, label: row.label, isActive: row.isActive }));
  }
  if (kind === 'locations') {
    const rows = await db.orm
      .select({ id: s.locations.id, label: s.locations.label, isActive: s.locations.isActive })
      .from(s.locations)
      .where(activeOnly ? eq(s.locations.isActive, true) : undefined)
      .orderBy(asc(s.locations.label), asc(s.locations.id));
    return rows.map((row) => ({ id: row.id, kind, label: row.label, isActive: row.isActive }));
  }
  const rows = await db.orm
    .select({
      id: s.vehicleTypes.id,
      label: s.vehicleTypes.label,
      isActive: s.vehicleTypes.isActive,
    })
    .from(s.vehicleTypes)
    .where(activeOnly ? eq(s.vehicleTypes.isActive, true) : undefined)
    .orderBy(asc(s.vehicleTypes.label), asc(s.vehicleTypes.id));
  return rows.map((row) => ({ id: row.id, kind, label: row.label, isActive: row.isActive }));
}

/**
 * List master entries.
 *
 * `activeOnly` is the **selection catalogue** rule: inactive entries disappear.
 * For gates, a gate is selectable only while both the gate and its location are
 * active — a gate at a deactivated location can no longer be chosen.
 */
export async function listMasters(
  db: Db,
  kind: MasterKind,
  options: { activeOnly: boolean },
): Promise<MasterRecord[]> {
  const activeOnly = options.activeOnly;
  if (kind === 'violation-types') {
    const rows = await db.orm
      .select({
        id: s.violationTypes.id,
        label: s.violationTypes.label,
        isActive: s.violationTypes.isActive,
        severity: s.violationTypes.severity,
        defaultAction: s.violationTypes.defaultAction,
      })
      .from(s.violationTypes)
      .where(activeOnly ? eq(s.violationTypes.isActive, true) : undefined)
      .orderBy(asc(s.violationTypes.label), asc(s.violationTypes.id));
    return rows.map((row) => ({
      id: row.id,
      kind,
      label: row.label,
      isActive: row.isActive,
      severity: row.severity,
      defaultAction: row.defaultAction ?? null,
    }));
  }

  if (kind === 'gates') {
    const rows = await db.orm
      .select({
        id: s.gates.id,
        label: s.gates.label,
        isActive: s.gates.isActive,
        locationId: s.gates.locationId,
      })
      .from(s.gates)
      .innerJoin(s.locations, eq(s.locations.id, s.gates.locationId))
      .where(
        activeOnly ? and(eq(s.gates.isActive, true), eq(s.locations.isActive, true)) : undefined,
      )
      .orderBy(asc(s.gates.label), asc(s.gates.id));
    return rows.map((row) => ({
      id: row.id,
      kind,
      label: row.label,
      isActive: row.isActive,
      locationId: row.locationId,
    }));
  }

  return listSimple(db, kind, activeOnly);
}

/* -------------------------------------------------------------------------- */
/* Create, update, deactivate                                                  */
/* -------------------------------------------------------------------------- */

/** Create a master entry. Kind-specific requirements are enforced by the caller's schema. */
export async function createMaster(
  db: Db,
  kind: MasterKind,
  payload: MasterCreatePayload,
): Promise<MasterRecord> {
  if (kind === 'violation-types') {
    const [row] = await db.orm
      .insert(s.violationTypes)
      .values({
        id: randomUUID(),
        label: payload.label,
        severity: payload.severity as Severity,
        defaultAction: payload.defaultAction ?? null,
        isActive: true,
      })
      .returning();
    if (row === undefined) throw new Error('Failed to create the violation type');
    return {
      id: row.id,
      kind,
      label: row.label,
      isActive: row.isActive,
      severity: row.severity,
      defaultAction: row.defaultAction ?? null,
    };
  }

  if (kind === 'gates') {
    const locationId = payload.locationId as string;
    const location = await db.orm
      .select({ id: s.locations.id, isActive: s.locations.isActive })
      .from(s.locations)
      .where(eq(s.locations.id, locationId))
      .limit(1);
    if (location[0] === undefined || !location[0].isActive) {
      throw new MasterFailure(
        'invalid_reference',
        422,
        'A gate needs an existing active location.',
      );
    }
    const [row] = await db.orm
      .insert(s.gates)
      .values({ id: randomUUID(), label: payload.label, locationId, isActive: true })
      .returning();
    if (row === undefined) throw new Error('Failed to create the gate');
    return {
      id: row.id,
      kind,
      label: row.label,
      isActive: row.isActive,
      locationId: row.locationId,
    };
  }

  const row = await insertSimple(db, kind, payload.label);
  return { id: row.id, kind, label: row.label, isActive: row.isActive };
}

async function insertSimple(
  db: Db,
  kind: SimpleKind,
  label: string,
): Promise<{ id: string; label: string; isActive: boolean }> {
  const id = randomUUID();
  switch (kind) {
    case 'departments': {
      const [row] = await db.orm
        .insert(s.departments)
        .values({ id, label, isActive: true })
        .returning();
      if (row === undefined) throw new Error('Failed to create the department');
      return { id: row.id, label: row.label, isActive: row.isActive };
    }
    case 'contractors': {
      const [row] = await db.orm
        .insert(s.contractors)
        .values({ id, label, isActive: true })
        .returning();
      if (row === undefined) throw new Error('Failed to create the contractor');
      return { id: row.id, label: row.label, isActive: row.isActive };
    }
    case 'locations': {
      const [row] = await db.orm
        .insert(s.locations)
        .values({ id, label, isActive: true })
        .returning();
      if (row === undefined) throw new Error('Failed to create the location');
      return { id: row.id, label: row.label, isActive: row.isActive };
    }
    case 'vehicle-types': {
      const [row] = await db.orm
        .insert(s.vehicleTypes)
        .values({ id, label, isActive: true })
        .returning();
      if (row === undefined) throw new Error('Failed to create the vehicle type');
      return { id: row.id, label: row.label, isActive: row.isActive };
    }
  }
}

/** Update the mutable fields of one entry. A gate never changes location. */
export async function updateMaster(
  db: Db,
  kind: MasterKind,
  id: string,
  payload: MasterUpdatePayload,
): Promise<MasterRecord> {
  if (kind === 'violation-types') {
    const patch: {
      label?: string;
      severity?: Severity;
      defaultAction?: ResolutionActionCode | null;
    } = {};
    if (payload.label !== undefined) patch.label = payload.label;
    if (payload.severity !== undefined) patch.severity = payload.severity;
    if ('defaultAction' in payload) patch.defaultAction = payload.defaultAction ?? null;
    const [row] = await db.orm
      .update(s.violationTypes)
      .set(patch)
      .where(eq(s.violationTypes.id, id))
      .returning();
    if (row === undefined) throw notFound(kind);
    return {
      id: row.id,
      kind,
      label: row.label,
      isActive: row.isActive,
      severity: row.severity,
      defaultAction: row.defaultAction ?? null,
    };
  }

  if (kind === 'gates') {
    const [row] = await db.orm
      .update(s.gates)
      .set({ label: payload.label as string })
      .where(eq(s.gates.id, id))
      .returning();
    if (row === undefined) throw notFound(kind);
    return {
      id: row.id,
      kind,
      label: row.label,
      isActive: row.isActive,
      locationId: row.locationId,
    };
  }

  const row = await updateSimple(db, kind, id, payload.label as string);
  return { id: row.id, kind, label: row.label, isActive: row.isActive };
}

async function updateSimple(
  db: Db,
  kind: SimpleKind,
  id: string,
  label: string,
): Promise<{ id: string; label: string; isActive: boolean }> {
  switch (kind) {
    case 'departments': {
      const [row] = await db.orm
        .update(s.departments)
        .set({ label })
        .where(eq(s.departments.id, id))
        .returning({
          id: s.departments.id,
          label: s.departments.label,
          isActive: s.departments.isActive,
        });
      if (row === undefined) throw notFound(kind);
      return row;
    }
    case 'contractors': {
      const [row] = await db.orm
        .update(s.contractors)
        .set({ label })
        .where(eq(s.contractors.id, id))
        .returning({
          id: s.contractors.id,
          label: s.contractors.label,
          isActive: s.contractors.isActive,
        });
      if (row === undefined) throw notFound(kind);
      return row;
    }
    case 'locations': {
      const [row] = await db.orm
        .update(s.locations)
        .set({ label })
        .where(eq(s.locations.id, id))
        .returning({
          id: s.locations.id,
          label: s.locations.label,
          isActive: s.locations.isActive,
        });
      if (row === undefined) throw notFound(kind);
      return row;
    }
    case 'vehicle-types': {
      const [row] = await db.orm
        .update(s.vehicleTypes)
        .set({ label })
        .where(eq(s.vehicleTypes.id, id))
        .returning({
          id: s.vehicleTypes.id,
          label: s.vehicleTypes.label,
          isActive: s.vehicleTypes.isActive,
        });
      if (row === undefined) throw notFound(kind);
      return row;
    }
  }
}

/**
 * Deactivate one entry. Idempotent: deactivating an already-inactive master
 * returns it unchanged rather than failing.
 */
export async function deactivateMaster(
  db: Db,
  kind: MasterKind,
  id: string,
): Promise<MasterRecord> {
  if (kind === 'violation-types') {
    const [row] = await db.orm
      .update(s.violationTypes)
      .set({ isActive: false })
      .where(eq(s.violationTypes.id, id))
      .returning();
    if (row === undefined) throw notFound(kind);
    return {
      id: row.id,
      kind,
      label: row.label,
      isActive: row.isActive,
      severity: row.severity,
      defaultAction: row.defaultAction ?? null,
    };
  }

  if (kind === 'gates') {
    const [row] = await db.orm
      .update(s.gates)
      .set({ isActive: false })
      .where(eq(s.gates.id, id))
      .returning();
    if (row === undefined) throw notFound(kind);
    return {
      id: row.id,
      kind,
      label: row.label,
      isActive: row.isActive,
      locationId: row.locationId,
    };
  }

  const row = await deactivateSimple(db, kind, id);
  return { id: row.id, kind, label: row.label, isActive: row.isActive };
}

async function deactivateSimple(
  db: Db,
  kind: SimpleKind,
  id: string,
): Promise<{ id: string; label: string; isActive: boolean }> {
  switch (kind) {
    case 'departments': {
      const [row] = await db.orm
        .update(s.departments)
        .set({ isActive: false })
        .where(eq(s.departments.id, id))
        .returning({
          id: s.departments.id,
          label: s.departments.label,
          isActive: s.departments.isActive,
        });
      if (row === undefined) throw notFound(kind);
      return row;
    }
    case 'contractors': {
      const [row] = await db.orm
        .update(s.contractors)
        .set({ isActive: false })
        .where(eq(s.contractors.id, id))
        .returning({
          id: s.contractors.id,
          label: s.contractors.label,
          isActive: s.contractors.isActive,
        });
      if (row === undefined) throw notFound(kind);
      return row;
    }
    case 'locations': {
      const [row] = await db.orm
        .update(s.locations)
        .set({ isActive: false })
        .where(eq(s.locations.id, id))
        .returning({
          id: s.locations.id,
          label: s.locations.label,
          isActive: s.locations.isActive,
        });
      if (row === undefined) throw notFound(kind);
      return row;
    }
    case 'vehicle-types': {
      const [row] = await db.orm
        .update(s.vehicleTypes)
        .set({ isActive: false })
        .where(eq(s.vehicleTypes.id, id))
        .returning({
          id: s.vehicleTypes.id,
          label: s.vehicleTypes.label,
          isActive: s.vehicleTypes.isActive,
        });
      if (row === undefined) throw notFound(kind);
      return row;
    }
  }
}
