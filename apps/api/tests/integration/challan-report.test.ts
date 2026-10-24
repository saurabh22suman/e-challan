import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app.js';
import type { Db } from '../../src/db/client.js';
import { resetAndMigrateTestDatabase, resolveTestDatabaseUrl } from './helpers/testTarget.js';

const CREDENTIALS = {
  marshal: { username: 'EMP-3106', password: 'planner-demo-marshal-secret' },
  supervisor: { username: 'EMP-2217', password: 'planner-demo-supervisor-secret' },
  admin: { username: 'EMP-1042', password: 'planner-demo-admin-secret' },
} as const;

const FIXED_NOW = new Date('2026-10-07T12:00:00.000Z');

interface ReportBody {
  items: Array<{
    challanNumber: string;
    status: string;
    severity: string;
    locationLabel: string;
    vehicleRegistrationNumber: string;
  }>;
  page: number;
  pageSize: number;
  total: number;
  totals: {
    total: number;
    issuedToday: number;
    pending: number;
    resolved: number;
    repeatOffenders: number;
  };
}

describe('E4 reporting over real PostgreSQL', () => {
  let db: Db;
  let server: FastifyInstance;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    db = await resetAndMigrateTestDatabase();
    const seed = (await import('../../src/db/seed-domain-demo.js')) as {
      seedDomainDemoDatabase: (url: string) => Promise<unknown>;
    };
    await seed.seedDomainDemoDatabase(resolveTestDatabaseUrl());
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

  async function report(role: string, query = '') {
    return server.inject({
      method: 'GET',
      url: `/challans/report${query}`,
      headers: { authorization: `Bearer ${tokens[role]}` },
    });
  }

  it('returns authorised totals and a paginated report', async () => {
    const admin = await report('admin');
    expect(admin.statusCode, admin.body).toBe(200);
    const adminBody = admin.json() as ReportBody;
    expect(adminBody.total).toBe(14);
    expect(adminBody.items).toHaveLength(14);
    expect(adminBody.totals.total).toBe(14);
    expect(adminBody.totals.pending).toBe(9);
    expect(adminBody.totals.resolved).toBe(4);
    expect(adminBody.totals.repeatOffenders).toBeGreaterThan(0);

    const supervisor = await report('supervisor');
    expect(supervisor.statusCode).toBe(200);
    const supervisorBody = supervisor.json() as ReportBody;
    expect(supervisorBody.total).toBe(8);
    expect(
      supervisorBody.items.every(
        (item) => item.locationLabel === 'Hazira Industrial Estate — Main Gate',
      ),
    ).toBe(true);

    const marshal = await report('marshal');
    expect(marshal.statusCode).toBe(403);
  });

  it('filters, sorts and paginates on the server', async () => {
    const filtered = await report('admin', '?status=Resolved&direction=asc&sort=challanNumber');
    expect(filtered.statusCode).toBe(200);
    const body = filtered.json() as ReportBody;
    expect(body.items.every((item) => item.status === 'Resolved')).toBe(true);
    const numbers = body.items.map((item) => item.challanNumber);
    expect(numbers).toEqual([...numbers].sort());

    const date = await report('admin', '?from=2026-10-01&to=2026-10-01');
    expect(date.statusCode).toBe(200);
    expect((date.json() as ReportBody).total).toBe(6);

    const paged = await report('admin', '?page=2&pageSize=5&direction=desc');
    expect(paged.statusCode).toBe(200);
    const pagedBody = paged.json() as ReportBody;
    expect(pagedBody.page).toBe(2);
    expect(pagedBody.pageSize).toBe(5);
    expect(pagedBody.items).toHaveLength(5);
    expect(pagedBody.total).toBe(14);

    const search = await report('admin', '?search=GJ05DS4821');
    expect(search.statusCode).toBe(200);
    const searchBody = search.json() as ReportBody;
    expect(searchBody.items.length).toBeGreaterThan(0);
    expect(searchBody.items.every((item) => item.challanNumber.includes('HZL/EC/'))).toBe(true);

    const bad = await report('admin', '?severity=Extreme');
    expect(bad.statusCode).toBe(400);
  });

  it('exports the current filtered set as an XLSX and records the export', async () => {
    const exportResponse = await server.inject({
      method: 'GET',
      url: '/challans/report/export?status=Resolved',
      headers: { authorization: `Bearer ${tokens.admin}` },
    });
    expect(exportResponse.statusCode, exportResponse.body).toBe(200);
    expect(exportResponse.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exportResponse.rawPayload as never);
    const sheet = workbook.getWorksheet('Challans');
    expect(sheet).toBeDefined();
    expect(sheet?.rowCount).toBe(5);
    expect(sheet?.getRow(1).getCell(1).value).toBe('Challan number');

    const audit = await db.pool.query<{ payload: { rowCount: number } }>(
      "SELECT payload FROM audit_events WHERE event_type = 'challans.exported'",
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]?.payload.rowCount).toBe(4);
  });
});
