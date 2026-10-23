import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type {
  ChallanActionRecord,
  ChallanDetailResponse,
  ChallanSummary,
  ReviewTransition,
} from '@echallan/contracts';
import type { Db } from '../db/client.js';
import * as s from '../db/schema.js';
import { authorisedLocationIds, canReadChallan } from '../auth/service.js';

/**
 * Role-scoped review reads and the approved D3 transition subset.
 *
 * Scope boundary: listing and mutation are for Supervisor/Admin. The existing
 * scoped detail read keeps its Marshal behaviour for F-02 compatibility. Issued
 * fields are never rewritten; every accepted transition appends history and an
 * audit row in one transaction.
 */

const MAX_LIST_ITEMS = 200;

export type DetailResult =
  { kind: 'ok'; detail: ChallanDetailResponse } | { kind: 'not_found' } | { kind: 'forbidden' };

export type ReviewResult =
  | { kind: 'ok'; detail: ChallanDetailResponse }
  | { kind: 'not_found' }
  | { kind: 'forbidden' }
  | { kind: 'invalid_request'; message: string }
  | { kind: 'invalid_transition'; message: string };

export interface ListFilter {
  status?: s.Challan['status'];
}

function iso(value: Date): string {
  return value.toISOString();
}

/** Rows the caller may list: Supervisor = assigned locations, Admin = all. */
export async function listChallans(
  db: Db,
  session: s.Session,
  filter: ListFilter,
): Promise<ChallanSummary[]> {
  const conditions = [];
  if (filter.status !== undefined) conditions.push(eq(s.challans.status, filter.status));

  if (session.role === 'Supervisor') {
    const locations = await authorisedLocationIds(db, session.userId);
    if (locations.length === 0) return [];
    conditions.push(inArray(s.challans.locationId, locations));
  }

  const rows = await db.orm
    .select({
      id: s.challans.id,
      challanNumber: s.challans.challanNumber,
      status: s.challans.status,
      severity: s.challans.severity,
      occurrenceNumber: s.challans.occurrenceNumber,
      recommendedAction: s.challans.recommendedAction,
      gatePassNumber: s.challans.gatePassNumber,
      vehicleRegistrationNumber: s.challans.vehicleRegistrationNumber,
      driverName: s.challans.driverName,
      locationId: s.challans.locationId,
      locationLabel: s.locations.label,
      issuedAt: s.challans.issuedAt,
    })
    .from(s.challans)
    .innerJoin(s.locations, eq(s.locations.id, s.challans.locationId))
    .where(conditions.length === 0 ? undefined : and(...conditions))
    .orderBy(desc(s.challans.issuedAt), asc(s.challans.challanNumber))
    .limit(MAX_LIST_ITEMS);

  return rows.map((row) => ({ ...row, issuedAt: iso(row.issuedAt) }));
}

/** Load the full detail, including append-only history. */
export async function loadChallanDetail(db: Db, id: string): Promise<ChallanDetailResponse | null> {
  const issuer = alias(s.users, 'issuer');
  const rows = await db.orm
    .select({
      id: s.challans.id,
      challanNumber: s.challans.challanNumber,
      status: s.challans.status,
      severity: s.challans.severity,
      occurrenceNumber: s.challans.occurrenceNumber,
      recommendedAction: s.challans.recommendedAction,
      gatePassNumber: s.challans.gatePassNumber,
      vehicleRegistrationNumber: s.challans.vehicleRegistrationNumber,
      driverName: s.challans.driverName,
      locationId: s.challans.locationId,
      locationLabel: s.locations.label,
      issuedAt: s.challans.issuedAt,
      issuedByUserId: s.challans.issuedByUserId,
      issuedByUsername: issuer.username,
      issuedByDisplayName: issuer.displayName,
      departmentLabel: s.challans.departmentLabelSnapshot,
      contractorLabel: s.challans.contractorLabelSnapshot,
      vehicleTypeLabel: s.challans.vehicleTypeLabelSnapshot,
      gateLabel: s.gates.label,
      remarks: s.challans.remarks,
      reopenedAt: s.challans.reopenedAt,
      reopenedByUserId: s.challans.reopenedByUserId,
      reopeningReason: s.challans.reopeningReason,
      cancellationReason: s.challans.cancellationReason,
    })
    .from(s.challans)
    .innerJoin(s.locations, eq(s.locations.id, s.challans.locationId))
    .innerJoin(s.gates, eq(s.gates.id, s.challans.gateId))
    .innerJoin(issuer, eq(issuer.id, s.challans.issuedByUserId))
    .where(eq(s.challans.id, id))
    .limit(1);

  const row = rows[0];
  if (row === undefined) return null;

  const violations = await db.orm
    .select({
      label: s.challanViolations.labelSnapshot,
      severity: s.challanViolations.severitySnapshot,
    })
    .from(s.challanViolations)
    .where(eq(s.challanViolations.challanId, id))
    .orderBy(asc(s.challanViolations.labelSnapshot));

  const actions = await db.orm
    .select({
      id: s.challanActions.id,
      toStatus: s.challanActions.toStatus,
      action: s.challanActions.action,
      remarks: s.challanActions.remarks,
      reason: s.challanActions.reason,
      performerUserId: s.challanActions.performerUserId,
      performerUsername: s.users.username,
      performerDisplayName: s.users.displayName,
      createdAt: s.challanActions.createdAt,
    })
    .from(s.challanActions)
    .innerJoin(s.users, eq(s.users.id, s.challanActions.performerUserId))
    .where(eq(s.challanActions.challanId, id))
    .orderBy(asc(s.challanActions.createdAt));

  const { issuedByUserId, issuedByUsername, issuedByDisplayName, ...detail } = row;

  return {
    ...detail,
    issuedAt: iso(row.issuedAt),
    issuedBy: {
      id: issuedByUserId,
      username: issuedByUsername,
      displayName: issuedByDisplayName,
    },
    reopenedAt: row.reopenedAt === null ? null : iso(row.reopenedAt),
    violations,
    actions: actions.map((action) => ({
      ...action,
      createdAt: iso(action.createdAt),
    })) satisfies ChallanActionRecord[],
  };
}

/** Scoped detail read, preserving the F-02 Marshal behaviour. */
export async function getChallanDetail(
  db: Db,
  session: s.Session,
  id: string,
): Promise<DetailResult> {
  const rows = await db.orm
    .select({ locationId: s.challans.locationId, postId: s.challans.postId })
    .from(s.challans)
    .where(eq(s.challans.id, id))
    .limit(1);
  const ref = rows[0];
  if (ref === undefined) return { kind: 'not_found' };
  if (!(await canReadChallan(db, session, ref))) return { kind: 'forbidden' };

  const detail = await loadChallanDetail(db, id);
  return detail === null ? { kind: 'not_found' } : { kind: 'ok', detail };
}

/**
 * Apply one approved review transition.
 *
 * Legality:
 *  - Issued → Under Review (Supervisor/Admin, scoped);
 *  - Under Review → Resolved (Supervisor/Admin, scoped; action + remarks);
 *  - Resolved → Under Review (Admin only; mandatory reason);
 *  - any non-cancelled → Cancelled (Admin only; mandatory reason, terminal).
 * Reopening and cancellation are separate audited transitions; issued fields,
 * evidence and prior action history are not rewritten.
 */
export async function reviewChallan(
  db: Db,
  session: s.Session,
  id: string,
  transition: ReviewTransition,
  now: Date = new Date(),
): Promise<ReviewResult> {
  if (session.role !== 'Supervisor' && session.role !== 'Admin') {
    return { kind: 'forbidden' };
  }

  const rows = await db.orm
    .select({
      locationId: s.challans.locationId,
      postId: s.challans.postId,
      status: s.challans.status,
    })
    .from(s.challans)
    .where(eq(s.challans.id, id))
    .limit(1);
  const current = rows[0];
  if (current === undefined) return { kind: 'not_found' };
  if (!(await canReadChallan(db, session, current))) return { kind: 'forbidden' };

  if (transition.to === 'Cancelled' && session.role !== 'Admin') {
    return { kind: 'forbidden' };
  }

  if (current.status === 'Cancelled') {
    return { kind: 'invalid_transition', message: 'A cancelled challan cannot change status.' };
  }

  if (transition.to === 'Under Review') {
    if (current.status === 'Under Review') {
      return { kind: 'invalid_transition', message: 'This challan is already under review.' };
    }
    if (current.status === 'Resolved') {
      if (session.role !== 'Admin') {
        return { kind: 'forbidden' };
      }
      if (transition.reason === undefined) {
        return { kind: 'invalid_request', message: 'A reopening reason is required.' };
      }
    }
  }

  if (transition.to === 'Resolved' && current.status !== 'Under Review') {
    return {
      kind: 'invalid_transition',
      message: 'A challan must be under review before it can be resolved.',
    };
  }

  try {
    await db.orm.transaction(async (tx) => {
      const update =
        transition.to === 'Cancelled'
          ? {
              status: transition.to,
              cancelledAt: now,
              cancelledByUserId: session.userId,
              cancellationReason: transition.reason,
            }
          : transition.to === 'Under Review' && current.status === 'Resolved'
            ? {
                status: transition.to,
                reopenedAt: now,
                reopenedByUserId: session.userId,
                reopeningReason: transition.reason,
              }
            : { status: transition.to };

      const updated = await tx
        .update(s.challans)
        .set(update)
        .where(and(eq(s.challans.id, id), eq(s.challans.status, current.status)))
        .returning({ id: s.challans.id });

      if (updated.length === 0) {
        throw new ReviewConflict();
      }

      const actionRow =
        transition.to === 'Resolved'
          ? {
              id: randomUUID(),
              challanId: id,
              toStatus: transition.to,
              action: transition.action,
              remarks: transition.remarks,
              reason: null,
              performerUserId: session.userId,
            }
          : {
              id: randomUUID(),
              challanId: id,
              toStatus: transition.to,
              action: null,
              remarks: null,
              reason: transition.reason ?? null,
              performerUserId: session.userId,
            };
      await tx.insert(s.challanActions).values(actionRow);

      await tx.insert(s.auditEvents).values({
        id: randomUUID(),
        challanId: id,
        actorUserId: session.userId,
        eventType: transition.to === 'Cancelled' ? 'challan.cancelled' : 'challan.status_changed',
        source: 'admin',
        payload: {
          from: current.status,
          to: transition.to,
          synthetic: false,
          ...(transition.to === 'Resolved'
            ? { action: transition.action, remarks: transition.remarks }
            : transition.reason === undefined
              ? {}
              : { reason: transition.reason }),
        },
      });
    });
  } catch (error) {
    if (error instanceof ReviewConflict) {
      return {
        kind: 'invalid_transition',
        message: 'The challan changed status while this review was being recorded.',
      };
    }
    throw error;
  }

  const detail = await loadChallanDetail(db, id);
  return detail === null ? { kind: 'not_found' } : { kind: 'ok', detail };
}

class ReviewConflict extends Error {}
