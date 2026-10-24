import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app.js';
import type { Db } from '../../src/db/client.js';
import { resetAndMigrateTestDatabase, resolveTestDatabaseUrl } from './helpers/testTarget.js';

const CREDENTIALS = {
  marshal: { username: 'DEMO-EMP-004', password: 'planner-demo-marshal-secret' },
  supervisor: { username: 'DEMO-EMP-002', password: 'planner-demo-supervisor-secret' },
  admin: { username: 'DEMO-EMP-001', password: 'planner-demo-admin-secret' },
} as const;

/** Fixed reference clock: the response must never depend on the machine clock. */
const FIXED_NOW = new Date('2026-10-01T12:00:00+05:30');

interface TrendPoint {
  bucketStart: string;
  issued: number;
  resolved: number;
  cancelled: number;
}

interface TrendBody {
  timezone: 'Asia/Kolkata';
  granularity: 'day' | 'week';
  from: string;
  to: string;
  points: TrendPoint[];
  totals: { issued: number; resolved: number; cancelled: number };
}

function nextDate(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

describe('Supervisor challan trend over real PostgreSQL', () => {
  let db: Db;
  let server: FastifyInstance;
  const tokens: Record<string, string> = {};
  let mainLocationId: string;
  let dispatchLocationId: string;

  beforeAll(async () => {
    db = await resetAndMigrateTestDatabase();
    const seed = (await import('../../src/db/seed-domain-demo.js')) as {
      seedDomainDemoDatabase: (url: string) => Promise<unknown>;
    };
    await seed.seedDomainDemoDatabase(resolveTestDatabaseUrl());

    const locations = await db.pool.query<{ id: string; demo_source_id: string }>(
      "SELECT id, demo_source_id FROM locations WHERE demo_source_id IN ('loc-main','loc-dispatch')",
    );
    const locationBySource = new Map(
      locations.rows.map((row) => [row.demo_source_id, row.id] as const),
    );
    const main = locationBySource.get('loc-main');
    const dispatch = locationBySource.get('loc-dispatch');
    if (main === undefined || dispatch === undefined) {
      throw new Error('Demo locations were not seeded');
    }
    mainLocationId = main;
    dispatchLocationId = dispatch;

    // The demo seed leaves challan_actions.created_at on the machine clock. Replace
    // that synthetic history with controlled action instants so resolved/cancelled
    // events are deterministic around the fixed reference clock.
    await db.pool.query('DELETE FROM challan_actions');
    const challans = await db.pool.query<{ id: string; challan_number: string }>(
      `SELECT id, challan_number
         FROM challans
        WHERE challan_number = ANY($1::text[])`,
      [
        [
          'DEMO/2026/09/0001', // main, 2026-09-24
          'DEMO/2026/09/0002', // dispatch, 2026-09-28
          'DEMO/2026/09/0004', // main, 2026-09-30
          'DEMO/2026/09/0005', // main, 2026-09-30 (cancelled)
        ],
      ],
    );
    const challanByNumber = new Map(
      challans.rows.map((row) => [row.challan_number, row.id] as const),
    );
    const performer = await db.pool.query<{ id: string }>(
      "SELECT id FROM users WHERE role = 'Admin' ORDER BY username LIMIT 1",
    );
    const performerId = performer.rows[0]?.id;
    if (performerId === undefined) throw new Error('Demo admin was not seeded');

    const actionRows: Array<{
      challanNumber: string;
      toStatus: 'Resolved' | 'Cancelled';
      createdAt: string;
    }> = [
      // Two distinct resolved challans in the same bucket.
      {
        challanNumber: 'DEMO/2026/09/0001',
        toStatus: 'Resolved',
        createdAt: '2026-09-25T04:00:00.000Z',
      },
      {
        challanNumber: 'DEMO/2026/09/0002',
        toStatus: 'Resolved',
        createdAt: '2026-09-25T05:00:00.000Z',
      },
      // A duplicate action for the same challan in the same bucket must not count twice.
      {
        challanNumber: 'DEMO/2026/09/0002',
        toStatus: 'Resolved',
        createdAt: '2026-09-25T06:00:00.000Z',
      },
      {
        challanNumber: 'DEMO/2026/09/0004',
        toStatus: 'Resolved',
        createdAt: '2026-10-01T00:30:00.000Z',
      },
      {
        challanNumber: 'DEMO/2026/09/0005',
        toStatus: 'Cancelled',
        createdAt: '2026-09-30T05:00:00.000Z',
      },
    ];
    for (const row of actionRows) {
      const challanId = challanByNumber.get(row.challanNumber);
      if (challanId === undefined) throw new Error(`Missing ${row.challanNumber}`);
      await db.pool.query(
        `INSERT INTO challan_actions
           (id, challan_id, to_status, action, remarks, reason, performer_user_id, created_at)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::uuid, $8::timestamptz)`,
        [
          randomUUID(),
          challanId,
          row.toStatus,
          row.toStatus === 'Resolved' ? 'custom' : null,
          row.toStatus === 'Resolved' ? 'Synthetic trend resolved fixture' : null,
          row.toStatus === 'Cancelled' ? 'Synthetic trend cancellation fixture' : null,
          performerId,
          new Date(row.createdAt),
        ],
      );
    }

    server = createApp({
      db,
      credentials: CREDENTIALS,
      now: () => FIXED_NOW,
      evidenceStore: undefined,
    });
    await server.ready();
    for (const role of ['marshal', 'supervisor', 'admin'] as const) {
      const response = await server.inject({
        method: 'POST',
        url: '/auth/login',
        payload: CREDENTIALS[role],
      });
      expect(response.statusCode).toBe(200);
      tokens[role] = (response.json() as { token: string }).token;
    }
  });

  afterAll(async () => {
    if (server) await server.close();
    if (db) await db.close();
  });

  async function trend(role: string, query = '') {
    return server.inject({
      method: 'GET',
      url: `/challans/report/trend${query}`,
      headers: { authorization: `Bearer ${tokens[role]}` },
    });
  }

  it("returns Admin's default 30-day zero-filled daily series with event totals", async () => {
    const response = await trend('admin');
    expect(response.statusCode, response.body).toBe(200);
    const body = response.json() as TrendBody;

    expect(body.timezone).toBe('Asia/Kolkata');
    expect(body.granularity).toBe('day');
    expect(body.from).toBe('2026-09-02');
    expect(body.to).toBe('2026-10-01');
    expect(body.points).toHaveLength(30);

    const byBucket = new Map(body.points.map((point) => [point.bucketStart, point] as const));
    expect(byBucket.get('2026-09-02')).toEqual({
      bucketStart: '2026-09-02',
      issued: 0,
      resolved: 0,
      cancelled: 0,
    });
    expect(byBucket.get('2026-09-20')).toEqual({
      bucketStart: '2026-09-20',
      issued: 1,
      resolved: 0,
      cancelled: 0,
    });
    expect(byBucket.get('2026-09-25')).toEqual({
      bucketStart: '2026-09-25',
      issued: 0,
      resolved: 2,
      cancelled: 0,
    });
    expect(byBucket.get('2026-09-30')).toEqual({
      bucketStart: '2026-09-30',
      issued: 2,
      resolved: 0,
      cancelled: 1,
    });
    expect(byBucket.get('2026-10-01')).toEqual({
      bucketStart: '2026-10-01',
      issued: 6,
      resolved: 1,
      cancelled: 0,
    });

    expect(body.totals).toEqual({ issued: 12, resolved: 3, cancelled: 1 });
    expect(body.points.reduce((sum, point) => sum + point.issued, 0)).toBe(body.totals.issued);
    expect(body.points.reduce((sum, point) => sum + point.resolved, 0)).toBe(body.totals.resolved);
    expect(body.points.reduce((sum, point) => sum + point.cancelled, 0)).toBe(
      body.totals.cancelled,
    );
    for (let index = 1; index < body.points.length; index += 1) {
      expect(body.points[index]?.bucketStart).toBe(
        nextDate(body.points[index - 1]?.bucketStart ?? ''),
      );
    }

    const singleDay = await trend('admin', '?from=2026-09-30&to=2026-09-30');
    expect(singleDay.statusCode, singleDay.body).toBe(200);
    const singleDayBody = singleDay.json() as TrendBody;
    expect(singleDayBody.from).toBe('2026-09-30');
    expect(singleDayBody.to).toBe('2026-09-30');
    expect(singleDayBody.points).toEqual([
      { bucketStart: '2026-09-30', issued: 2, resolved: 0, cancelled: 1 },
    ]);
  });

  it('scopes Supervisor totals to authorised locations and refuses another location', async () => {
    const admin = (await trend('admin')).json() as TrendBody;
    const supervisorResponse = await trend('supervisor');
    expect(supervisorResponse.statusCode, supervisorResponse.body).toBe(200);
    const supervisor = supervisorResponse.json() as TrendBody;

    expect(supervisor.totals).toEqual({ issued: 6, resolved: 2, cancelled: 1 });
    expect(supervisor.totals.issued).toBeLessThanOrEqual(admin.totals.issued);
    expect(supervisor.totals.resolved).toBeLessThanOrEqual(admin.totals.resolved);

    const scoped = await trend('supervisor', `?locationId=${mainLocationId}`);
    expect(scoped.statusCode, scoped.body).toBe(200);
    expect((scoped.json() as TrendBody).totals).toEqual(supervisor.totals);

    const outOfScope = await trend('supervisor', `?locationId=${dispatchLocationId}`);
    expect(outOfScope.statusCode).toBe(403);

    const adminMain = (await trend('admin', `?locationId=${mainLocationId}`)).json() as TrendBody;
    const adminDispatch = (
      await trend('admin', `?locationId=${dispatchLocationId}`)
    ).json() as TrendBody;
    expect(adminMain.totals.issued + adminDispatch.totals.issued).toBe(admin.totals.issued);
    expect(adminMain.totals.resolved + adminDispatch.totals.resolved).toBe(admin.totals.resolved);
    expect(adminMain.totals.cancelled + adminDispatch.totals.cancelled).toBe(
      admin.totals.cancelled,
    );
  });

  it('refuses Marshal tokens and invalid query/range input', async () => {
    const marshal = await trend('marshal');
    expect(marshal.statusCode).toBe(403);

    const inverted = await trend('admin', '?from=2026-10-01&to=2026-09-01');
    expect(inverted.statusCode).toBe(400);

    const tooWide = await trend('admin', '?from=2025-01-01&to=2026-10-01');
    expect(tooWide.statusCode).toBe(400);

    const invalidGranularity = await trend('admin', '?granularity=month');
    expect(invalidGranularity.statusCode).toBe(400);

    const invalidDate = await trend('admin', '?from=2026-02-30&to=2026-03-01');
    expect(invalidDate.statusCode).toBe(400);
  });

  it('returns Monday-start weekly buckets for the same event totals', async () => {
    const response = await trend('admin', '?granularity=week');
    expect(response.statusCode, response.body).toBe(200);
    const body = response.json() as TrendBody;

    expect(body.granularity).toBe('week');
    expect(body.from).toBe('2026-09-02');
    expect(body.to).toBe('2026-10-01');
    expect(body.points.map((point) => point.bucketStart)).toEqual([
      '2026-08-31',
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
    ]);
    for (const point of body.points) {
      expect(new Date(`${point.bucketStart}T00:00:00.000Z`).getUTCDay()).toBe(1);
    }
    const byBucket = new Map(body.points.map((point) => [point.bucketStart, point] as const));
    expect(byBucket.get('2026-08-31')).toEqual({
      bucketStart: '2026-08-31',
      issued: 0,
      resolved: 0,
      cancelled: 0,
    });
    expect(byBucket.get('2026-09-14')).toEqual({
      bucketStart: '2026-09-14',
      issued: 1,
      resolved: 0,
      cancelled: 0,
    });
    expect(byBucket.get('2026-09-21')).toEqual({
      bucketStart: '2026-09-21',
      issued: 1,
      resolved: 2,
      cancelled: 0,
    });
    expect(byBucket.get('2026-09-28')).toEqual({
      bucketStart: '2026-09-28',
      issued: 10,
      resolved: 1,
      cancelled: 1,
    });
    expect(body.totals).toEqual({ issued: 12, resolved: 3, cancelled: 1 });
  });

  it('does not append an audit event for an aggregate read', async () => {
    const before = await db.pool.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM audit_events',
    );
    const response = await trend('admin');
    expect(response.statusCode, response.body).toBe(200);
    const after = await db.pool.query<{ n: number }>('SELECT count(*)::int AS n FROM audit_events');
    expect(after.rows[0]?.n).toBe(before.rows[0]?.n);
  });
});
