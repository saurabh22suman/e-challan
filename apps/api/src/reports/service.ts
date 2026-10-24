import ExcelJS from 'exceljs';
import {
  type ChallanReportQuery,
  type ChallanReportResponse,
  type ChallanReportTotals,
  type ChallanSortField,
  type ChallanSummary,
  type ChallanTrendPoint,
  type ChallanTrendQuery,
  type ChallanTrendResponse,
  type ChallanTrendTotals,
} from '@echallan/contracts';
import type { Db } from '../db/client.js';
import type { Session } from '../db/schema.js';
import { authorisedLocationIds } from '../auth/service.js';

interface WhereClause {
  text: string;
  params: unknown[];
}

const SORT_COLUMN: Record<ChallanSortField, string> = {
  issuedAt: 'c.issued_at',
  challanNumber: 'c.challan_number',
  status: 'c.status',
  severity: 'c.severity',
};

function addParam(params: unknown[], value: unknown): string {
  params.push(value);
  return `$${params.length}`;
}

async function buildWhere(
  db: Db,
  session: Session,
  query: ChallanReportQuery,
  includeFilters: boolean,
): Promise<WhereClause | null> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (session.role === 'Supervisor') {
    const locations = await authorisedLocationIds(db, session.userId);
    if (locations.length === 0) return null;
    conditions.push(`c.location_id = ANY(${addParam(params, locations)}::uuid[])`);
  }
  if (!includeFilters) return { text: conditions.join(' AND '), params };

  if (query.status !== undefined) conditions.push(`c.status = ${addParam(params, query.status)}`);
  if (query.severity !== undefined)
    conditions.push(`c.severity = ${addParam(params, query.severity)}`);
  if (query.locationId !== undefined)
    conditions.push(`c.location_id = ${addParam(params, query.locationId)}::uuid`);
  if (query.departmentId !== undefined)
    conditions.push(`c.department_id = ${addParam(params, query.departmentId)}::uuid`);
  if (query.violationTypeId !== undefined) {
    conditions.push(
      `EXISTS (SELECT 1 FROM challan_violations cv WHERE cv.challan_id = c.id AND cv.violation_type_id = ${addParam(
        params,
        query.violationTypeId,
      )}::uuid)`,
    );
  }
  if (query.issuedByUserId !== undefined)
    conditions.push(`c.issued_by_user_id = ${addParam(params, query.issuedByUserId)}::uuid`);
  if (query.search !== undefined) {
    const term = addParam(params, `%${query.search}%`);
    conditions.push(
      `(c.challan_number ILIKE ${term} OR c.vehicle_registration_number ILIKE ${term} OR c.gate_pass_number ILIKE ${term} OR c.driver_name ILIKE ${term} OR l.label ILIKE ${term})`,
    );
  }
  if (query.vehicle !== undefined)
    conditions.push(
      `c.vehicle_registration_number ILIKE ${addParam(params, `%${query.vehicle.toUpperCase()}%`)}`,
    );
  if (query.gatePass !== undefined)
    conditions.push(
      `c.gate_pass_number ILIKE ${addParam(params, `%${query.gatePass.toUpperCase()}%`)}`,
    );
  if (query.from !== undefined)
    conditions.push(
      `(c.issued_at AT TIME ZONE 'Asia/Kolkata')::date >= ${addParam(params, query.from)}::date`,
    );
  if (query.to !== undefined)
    conditions.push(
      `(c.issued_at AT TIME ZONE 'Asia/Kolkata')::date <= ${addParam(params, query.to)}::date`,
    );

  return { text: conditions.join(' AND '), params };
}

interface ReportRow {
  id: string;
  challan_number: string;
  status: string;
  severity: string;
  occurrence_number: number;
  recommended_action: string;
  gate_pass_number: string;
  vehicle_registration_number: string;
  driver_name: string;
  location_id: string;
  location_label: string;
  issued_at: Date;
}

function toSummary(row: ReportRow): ChallanSummary {
  return {
    id: row.id,
    challanNumber: row.challan_number,
    status: row.status as ChallanSummary['status'],
    severity: row.severity as ChallanSummary['severity'],
    occurrenceNumber: row.occurrence_number,
    recommendedAction: row.recommended_action as ChallanSummary['recommendedAction'],
    gatePassNumber: row.gate_pass_number,
    vehicleRegistrationNumber: row.vehicle_registration_number,
    driverName: row.driver_name,
    locationId: row.location_id,
    locationLabel: row.location_label,
    issuedAt: row.issued_at.toISOString(),
  };
}

function kolkataToday(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

async function loadTotals(db: Db, scope: WhereClause, now: Date): Promise<ChallanReportTotals> {
  const where = scope.text === '' ? '' : `WHERE ${scope.text}`;
  const params = [...scope.params];
  const today = addParam(params, kolkataToday(now));
  const row = (
    await db.pool.query<{
      total: number;
      issued_today: number;
      pending: number;
      resolved: number;
    }>(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE (c.issued_at AT TIME ZONE 'Asia/Kolkata')::date = ${today}::date)::int AS issued_today,
              count(*) FILTER (WHERE c.status IN ('Issued','Under Review'))::int AS pending,
              count(*) FILTER (WHERE c.status = 'Resolved')::int AS resolved
         FROM challans c
         ${where}`,
      params,
    )
  ).rows[0];

  const repeatParams = [...scope.params, new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)];
  const repeatWhere = scope.text === '' ? '' : `${scope.text} AND`;
  const repeat = (
    await db.pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM (
         SELECT c.gate_pass_number
           FROM challans c
          WHERE ${repeatWhere} c.status <> 'Cancelled' AND c.issued_at >= $${repeatParams.length}
          GROUP BY c.gate_pass_number
         HAVING count(*) >= 2
       ) repeats`,
      repeatParams,
    )
  ).rows[0];

  return {
    total: Number(row?.total ?? 0),
    issuedToday: Number(row?.issued_today ?? 0),
    pending: Number(row?.pending ?? 0),
    resolved: Number(row?.resolved ?? 0),
    repeatOffenders: Number(repeat?.n ?? 0),
  };
}

export async function reportChallans(
  db: Db,
  session: Session,
  query: ChallanReportQuery,
  now: Date = new Date(),
): Promise<ChallanReportResponse | null> {
  const filters = await buildWhere(db, session, query, true);
  if (filters === null) return null;
  const scope = await buildWhere(db, session, query, false);
  if (scope === null) return null;
  const where = filters.text === '' ? '' : `WHERE ${filters.text}`;
  const offset = (query.page - 1) * query.pageSize;
  const listParams = [...filters.params, query.pageSize, offset];
  const rows = await db.pool.query<ReportRow>(
    `SELECT c.id, c.challan_number, c.status, c.severity, c.occurrence_number,
            c.recommended_action, c.gate_pass_number, c.vehicle_registration_number,
            c.driver_name, c.location_id, l.label AS location_label, c.issued_at
       FROM challans c
       JOIN locations l ON l.id = c.location_id
       ${where}
      ORDER BY ${SORT_COLUMN[query.sort]} ${query.direction.toUpperCase()}, c.challan_number ASC
      LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  );
  const total = await db.pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM challans c JOIN locations l ON l.id = c.location_id ${where}`,
    filters.params,
  );
  return {
    items: rows.rows.map(toSummary),
    page: query.page,
    pageSize: query.pageSize,
    total: Number(total.rows[0]?.n ?? 0),
    totals: await loadTotals(db, scope, now),
  };
}

export interface ReportExport {
  buffer: Buffer;
  rowCount: number;
  filename: string;
}

export async function exportChallans(
  db: Db,
  session: Session,
  query: ChallanReportQuery,
  now: Date = new Date(),
): Promise<ReportExport | null> {
  const filters = await buildWhere(db, session, query, true);
  if (filters === null) return null;
  const where = filters.text === '' ? '' : `WHERE ${filters.text}`;
  const rows = await db.pool.query<{
    challan_number: string;
    status: string;
    severity: string;
    issued_at: Date;
    vehicle_registration_number: string;
    gate_pass_number: string;
    driver_name: string;
    department_label: string;
    contractor_label: string | null;
    vehicle_type_label: string;
    location_label: string;
    gate_label: string;
    occurrence_number: number;
    recommended_action: string;
    remarks: string | null;
    issued_by: string;
    violations: string | null;
  }>(
    `SELECT c.challan_number, c.status, c.severity, c.issued_at,
            c.vehicle_registration_number, c.gate_pass_number, c.driver_name,
            c.department_label_snapshot AS department_label,
            c.contractor_label_snapshot AS contractor_label,
            c.vehicle_type_label_snapshot AS vehicle_type_label,
            l.label AS location_label, g.label AS gate_label,
            c.occurrence_number, c.recommended_action, c.remarks,
            u.display_name || ' (' || u.username || ')' AS issued_by,
            string_agg(cv.label_snapshot, ', ' ORDER BY cv.label_snapshot) AS violations
       FROM challans c
       JOIN locations l ON l.id = c.location_id
       JOIN gates g ON g.id = c.gate_id
       JOIN users u ON u.id = c.issued_by_user_id
       LEFT JOIN challan_violations cv ON cv.challan_id = c.id
       ${where}
      GROUP BY c.id, l.label, g.label, u.display_name, u.username
      ORDER BY ${SORT_COLUMN[query.sort]} ${query.direction.toUpperCase()}, c.challan_number ASC
      LIMIT 10000`,
    filters.params,
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'e-Challan';
  workbook.created = now;
  const sheet = workbook.addWorksheet('Challans');
  sheet.columns = [
    { header: 'Challan number', key: 'challanNumber', width: 22 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Severity', key: 'severity', width: 10 },
    { header: 'Issued', key: 'issuedAt', width: 22 },
    { header: 'Vehicle', key: 'vehicle', width: 16 },
    { header: 'Gate pass', key: 'gatePass', width: 16 },
    { header: 'Driver', key: 'driver', width: 24 },
    { header: 'Department', key: 'department', width: 22 },
    { header: 'Contractor', key: 'contractor', width: 24 },
    { header: 'Vehicle type', key: 'vehicleType', width: 16 },
    { header: 'Location', key: 'location', width: 34 },
    { header: 'Gate', key: 'gate', width: 22 },
    { header: 'Occurrence', key: 'occurrence', width: 12 },
    { header: 'Recommended action', key: 'recommendedAction', width: 28 },
    { header: 'Violations', key: 'violations', width: 40 },
    { header: 'Remarks', key: 'remarks', width: 48 },
    { header: 'Issued by', key: 'issuedBy', width: 32 },
  ];
  for (const row of rows.rows) {
    sheet.addRow({
      challanNumber: row.challan_number,
      status: row.status,
      severity: row.severity,
      issuedAt: new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata',
      }).format(row.issued_at),
      vehicle: row.vehicle_registration_number,
      gatePass: row.gate_pass_number,
      driver: row.driver_name,
      department: row.department_label,
      contractor: row.contractor_label ?? '',
      vehicleType: row.vehicle_type_label,
      location: row.location_label,
      gate: row.gate_label,
      occurrence: row.occurrence_number,
      recommendedAction: row.recommended_action,
      violations: row.violations ?? '',
      remarks: row.remarks ?? '',
      issuedBy: row.issued_by,
    });
  }
  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = { from: 'A1', to: 'Q1' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    buffer,
    rowCount: rows.rows.length,
    filename: `echallan-${kolkataToday(now)}.xlsx`,
  };
}

/* -------------------------------------------------------------------------- */
/* Challan trend (Supervisor/Admin Trend tab)                                  */
/* -------------------------------------------------------------------------- */

const TREND_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TREND_RANGE_DAYS = 365;
const TREND_TIMEZONE = 'Asia/Kolkata' as const;

function addIsoDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isoDayDifference(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((end - start) / TREND_DAY_MS);
}

function mondayOf(date: string): string {
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return addIsoDays(date, -((weekday + 6) % 7));
}

function trendBuckets(
  from: string,
  to: string,
  granularity: ChallanTrendQuery['granularity'],
): string[] {
  if (granularity === 'week') {
    const buckets: string[] = [];
    const last = mondayOf(to);
    for (let cursor = mondayOf(from); cursor <= last; cursor = addIsoDays(cursor, 7)) {
      buckets.push(cursor);
    }
    return buckets;
  }
  const buckets: string[] = [];
  for (let cursor = from; cursor <= to; cursor = addIsoDays(cursor, 1)) {
    buckets.push(cursor);
  }
  return buckets;
}

function resolveTrendRange(
  query: ChallanTrendQuery,
  now: Date,
): { from: string; to: string } | null {
  const to = query.to ?? kolkataToday(now);
  if (!isValidIsoDate(to)) return null;
  const from = query.from ?? addIsoDays(to, -29);
  if (!isValidIsoDate(from) || from > to) return null;
  const inclusiveDays = isoDayDifference(from, to) + 1;
  if (inclusiveDays > MAX_TREND_RANGE_DAYS) return null;
  return { from, to };
}

interface TrendScope {
  text: string;
  params: unknown[];
}

/**
 * Supervisor scope is their assigned locations; Admin reads all locations. A
 * requested location is intersected with the supervisor scope, and asking for a
 * location outside it is a forbidden request rather than an empty result.
 */
async function buildTrendScope(
  db: Db,
  session: Session,
  query: ChallanTrendQuery,
): Promise<TrendScope | null> {
  if (session.role !== 'Supervisor' && session.role !== 'Admin') return null;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (session.role === 'Supervisor') {
    const locations = await authorisedLocationIds(db, session.userId);
    if (locations.length === 0) return null;
    if (query.locationId !== undefined && !locations.includes(query.locationId)) return null;
    conditions.push(`c.location_id = ANY(${addParam(params, locations)}::uuid[])`);
  }
  if (query.locationId !== undefined) {
    conditions.push(`c.location_id = ${addParam(params, query.locationId)}::uuid`);
  }

  return {
    text: conditions.length === 0 ? '' : `AND ${conditions.join(' AND ')}`,
    params,
  };
}

interface IssuedTrendRow {
  bucket: string;
  issued: number;
}

interface ActionTrendRow {
  bucket: string;
  resolved: number;
  cancelled: number;
}

export type ChallanTrendResult =
  | { ok: true; response: ChallanTrendResponse }
  | { ok: false; reason: 'forbidden' | 'invalid-range' };

/**
 * Event-count trend over the requested Asia/Kolkata window (design section 8).
 *
 * Aggregation happens in PostgreSQL: issued events from `challans.issued_at`,
 * resolved/cancelled events from `challan_actions.created_at` joined to the
 * challan's location. Distinct challans are counted per bucket so duplicate
 * action rows cannot inflate a series. The requested range is zero-filled in JS;
 * no event rows are read into application memory for aggregation.
 */
export async function reportChallanTrend(
  db: Db,
  session: Session,
  query: ChallanTrendQuery,
  now: Date,
): Promise<ChallanTrendResult> {
  const range = resolveTrendRange(query, now);
  if (range === null) return { ok: false, reason: 'invalid-range' };

  const scope = await buildTrendScope(db, session, query);
  if (scope === null) return { ok: false, reason: 'forbidden' };

  const truncUnit = query.granularity === 'week' ? 'week' : 'day';
  const start = range.from;
  const endExclusive = addIsoDays(range.to, 1);

  const issuedParams = [...scope.params];
  const issuedStart = addParam(issuedParams, start);
  const issuedEnd = addParam(issuedParams, endExclusive);
  const issuedRows = await db.pool.query<IssuedTrendRow>(
    `SELECT to_char(date_trunc('${truncUnit}', c.issued_at AT TIME ZONE '${TREND_TIMEZONE}'), 'YYYY-MM-DD') AS bucket,
            count(*)::int AS issued
       FROM challans c
      WHERE c.issued_at >= (${issuedStart}::date::timestamp AT TIME ZONE '${TREND_TIMEZONE}')
        AND c.issued_at < (${issuedEnd}::date::timestamp AT TIME ZONE '${TREND_TIMEZONE}')
        ${scope.text}
      GROUP BY 1
      ORDER BY 1`,
    issuedParams,
  );

  const actionParams = [...scope.params];
  const actionStart = addParam(actionParams, start);
  const actionEnd = addParam(actionParams, endExclusive);
  const actionRows = await db.pool.query<ActionTrendRow>(
    `SELECT to_char(date_trunc('${truncUnit}', a.created_at AT TIME ZONE '${TREND_TIMEZONE}'), 'YYYY-MM-DD') AS bucket,
            (count(DISTINCT a.challan_id) FILTER (WHERE a.to_status = 'Resolved'))::int AS resolved,
            (count(DISTINCT a.challan_id) FILTER (WHERE a.to_status = 'Cancelled'))::int AS cancelled
       FROM challan_actions a
       JOIN challans c ON c.id = a.challan_id
      WHERE a.created_at >= (${actionStart}::date::timestamp AT TIME ZONE '${TREND_TIMEZONE}')
        AND a.created_at < (${actionEnd}::date::timestamp AT TIME ZONE '${TREND_TIMEZONE}')
        AND a.to_status IN ('Resolved','Cancelled')
        ${scope.text}
      GROUP BY 1
      ORDER BY 1`,
    actionParams,
  );

  const issuedByBucket = new Map(
    issuedRows.rows.map((row) => [row.bucket, Number(row.issued)] as const),
  );
  const actionsByBucket = new Map(actionRows.rows.map((row) => [row.bucket, row] as const));

  const points: ChallanTrendPoint[] = trendBuckets(range.from, range.to, query.granularity).map(
    (bucketStart) => ({
      bucketStart,
      issued: issuedByBucket.get(bucketStart) ?? 0,
      resolved: Number(actionsByBucket.get(bucketStart)?.resolved ?? 0),
      cancelled: Number(actionsByBucket.get(bucketStart)?.cancelled ?? 0),
    }),
  );

  const totals = points.reduce<ChallanTrendTotals>(
    (sum, point) => ({
      issued: sum.issued + point.issued,
      resolved: sum.resolved + point.resolved,
      cancelled: sum.cancelled + point.cancelled,
    }),
    { issued: 0, resolved: 0, cancelled: 0 },
  );

  return {
    ok: true,
    response: {
      timezone: TREND_TIMEZONE,
      granularity: query.granularity,
      from: range.from,
      to: range.to,
      points,
      totals,
    },
  };
}
