import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  MASTER_KINDS,
  MasterListResponseSchema,
  MasterResponseSchema,
  parseContract,
} from '@echallan/contracts';
import { createApp } from '../../src/app.js';
import type { Db } from '../../src/db/client.js';
import { resetAndMigrateTestDatabase, resolveTestDatabaseUrl } from './helpers/testTarget.js';

/**
 * Planner-owned F-03 acceptance against **real PostgreSQL**: MST-01 (Admin CRUD and
 * deactivation for every required master, non-admin refusal without side effects),
 * MST-02 (deactivated masters leave the selection catalogue but stay interpretable on
 * history) and MST-03 (post-issuance edits never change issued snapshots, per B-05).
 *
 * Credentials are injected explicitly, as F-02 requires. Read-only planner input; do
 * not replace, skip or weaken these assertions.
 */

const CREDENTIALS = {
  marshal: { username: 'EMP-3106', password: 'planner-demo-marshal-secret' },
  supervisor: { username: 'EMP-2217', password: 'planner-demo-supervisor-secret' },
  admin: { username: 'EMP-1042', password: 'planner-demo-admin-secret' },
} as const;

const ADMIN_PASSWORD = CREDENTIALS.admin.password;
const SUPERVISOR_PASSWORD = CREDENTIALS.supervisor.password;

const SIMPLE_KINDS = ['departments', 'contractors', 'locations', 'vehicle-types'] as const;

interface MasterBody {
  master: {
    id: string;
    kind: string;
    label: string;
    isActive: boolean;
    severity?: string | null;
    defaultAction?: string | null;
    locationId?: string;
  };
}

describe('MST-01/02/03: master-data API and historical meaning over real PostgreSQL', () => {
  let db: Db;
  let server: FastifyInstance;
  let labelCounter = 0;

  const nextLabel = (prefix: string): string => {
    labelCounter += 1;
    return `${prefix} ${labelCounter}`;
  };

  beforeAll(async () => {
    db = await resetAndMigrateTestDatabase();
    const seed = (await import('../../src/db/seed-domain-demo.js')) as {
      seedDomainDemoDatabase: (url: string) => Promise<unknown>;
    };
    await seed.seedDomainDemoDatabase(resolveTestDatabaseUrl());
    server = createApp({ db, credentials: CREDENTIALS });
    await server.ready();
  });

  afterAll(async () => {
    if (server) await server.close();
    if (db) await db.close();
  });

  async function login(
    body: Record<string, unknown>,
    app: FastifyInstance = server,
  ): Promise<{ status: number; json: unknown }> {
    const response = await app.inject({ method: 'POST', url: '/auth/login', payload: body });
    return { status: response.statusCode, json: response.json() };
  }

  async function tokenFor(username: string, password: string): Promise<string> {
    const result = await login({ username, password });
    expect(result.status, `login failed: ${JSON.stringify(result.json)}`).toBe(200);
    const token = (result.json as { token?: string }).token;
    expect(token, 'a successful login must return a session token').toBeTruthy();
    return token as string;
  }

  async function inject(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    options: { token?: string; payload?: unknown } = {},
  ): Promise<{ status: number; json: unknown }> {
    const response = await server.inject({
      method,
      url,
      ...(options.token === undefined
        ? {}
        : { headers: { authorization: `Bearer ${options.token}` } }),
      ...(options.payload === undefined ? {} : { payload: options.payload as object }),
    });
    return { status: response.statusCode, json: response.json() };
  }

  async function adminToken(): Promise<string> {
    return tokenFor('EMP-1042', ADMIN_PASSWORD);
  }

  async function createMaster(
    kind: string,
    payload: Record<string, unknown>,
    token?: string,
  ): Promise<MasterBody['master']> {
    const authToken = token ?? (await adminToken());
    const result = await inject('POST', `/admin/masters/${kind}`, { token: authToken, payload });
    expect(
      result.status,
      `creating ${kind} failed: ${result.status} ${JSON.stringify(result.json)}`,
    ).toBe(201);
    return parseContract(MasterResponseSchema, result.json).master;
  }

  /* ------------------------------------------------------------------ */
  /* MST-01: Admin CRUD and deactivation for every required master      */
  /* ------------------------------------------------------------------ */

  it.each(SIMPLE_KINDS)(
    'MST-01: admin creates, updates and deactivates a %s entry',
    async (kind) => {
      const token = await adminToken();
      const label = nextLabel(`F-03 ${kind}`);

      const created = await createMaster(kind, { label: `  ${label}  ` }, token);
      expect(created.kind).toBe(kind);
      expect(created.label).toBe(label);
      expect(created.isActive).toBe(true);
      expect(Object.keys(created).sort()).toEqual(['id', 'isActive', 'kind', 'label']);

      const listed = parseContract(
        MasterListResponseSchema,
        (await inject('GET', `/admin/masters/${kind}`, { token })).json,
      );
      expect(listed.masters.some((master) => master.id === created.id)).toBe(true);

      const updated = await inject('PATCH', `/admin/masters/${kind}/${created.id}`, {
        token,
        payload: { label: `${label} renamed` },
      });
      expect(updated.status).toBe(200);
      expect(parseContract(MasterResponseSchema, updated.json).master.label).toBe(
        `${label} renamed`,
      );

      const deactivated = await inject('POST', `/admin/masters/${kind}/${created.id}/deactivate`, {
        token,
      });
      expect(deactivated.status).toBe(200);
      expect(parseContract(MasterResponseSchema, deactivated.json).master.isActive).toBe(false);

      // Idempotent: deactivating again is not an error and changes nothing.
      const again = await inject('POST', `/admin/masters/${kind}/${created.id}/deactivate`, {
        token,
      });
      expect(again.status).toBe(200);
      expect(parseContract(MasterResponseSchema, again.json).master.isActive).toBe(false);

      const catalogue = parseContract(
        MasterListResponseSchema,
        (await inject('GET', `/masters/${kind}`, { token })).json,
      );
      expect(
        catalogue.masters.some((master) => master.id === created.id),
        'a deactivated master must leave the selection catalogue',
      ).toBe(false);
    },
  );

  it('MST-01: admin manages violation types with severity and default action', async () => {
    const token = await adminToken();
    const created = await createMaster(
      'violation-types',
      { label: nextLabel('F-03 violation'), severity: 'Major', defaultAction: 'warning_issued' },
      token,
    );
    expect(created.severity).toBe('Major');
    expect(created.defaultAction).toBe('warning_issued');

    const updated = await inject('PATCH', `/admin/masters/violation-types/${created.id}`, {
      token,
      payload: { severity: 'Critical', defaultAction: null },
    });
    expect(updated.status).toBe(200);
    const master = parseContract(MasterResponseSchema, updated.json).master;
    expect(master.severity).toBe('Critical');
    expect(master.defaultAction, 'an explicit null clears the action').toBeNull();

    const stored = await db.pool.query<{ severity: string; default_action: string | null }>(
      'SELECT severity, default_action FROM violation_types WHERE id = $1',
      [created.id],
    );
    expect(stored.rows[0]?.severity).toBe('Critical');
    expect(stored.rows[0]?.default_action).toBeNull();

    // Kind-field validation is refused without touching the row.
    expect(
      (
        await inject('PATCH', `/admin/masters/violation-types/${created.id}`, {
          token,
          payload: {},
        })
      ).status,
    ).toBe(400);
    expect(
      (await inject('POST', '/admin/masters/violation-types', { token, payload: { label: 'x' } }))
        .status,
    ).toBe(400);
    expect(
      (
        await inject('POST', '/admin/masters/violation-types', {
          token,
          payload: { label: 'x', severity: 'Unknown' },
        })
      ).status,
    ).toBe(400);
  });

  it('MST-01: admin manages gates and a gate needs an existing active location', async () => {
    const token = await adminToken();
    const location = await createMaster(
      'locations',
      { label: nextLabel('F-03 gate location') },
      token,
    );
    const gate = await createMaster(
      'gates',
      { label: nextLabel('F-03 gate'), locationId: location.id },
      token,
    );
    expect(gate.locationId).toBe(location.id);

    const renamed = await inject('PATCH', `/admin/masters/gates/${gate.id}`, {
      token,
      payload: { label: `${gate.label} renamed` },
    });
    expect(renamed.status).toBe(200);

    // A gate never moves: locationId is not an update field.
    expect(
      (
        await inject('PATCH', `/admin/masters/gates/${gate.id}`, {
          token,
          payload: { label: 'x', locationId: location.id },
        })
      ).status,
    ).toBe(400);
    expect(
      (await inject('POST', '/admin/masters/gates', { token, payload: { label: 'x' } })).status,
    ).toBe(400);
    expect(
      (
        await inject('POST', '/admin/masters/gates', {
          token,
          payload: { label: 'x', locationId: '00000000-0000-4000-8000-00000000dead' },
        })
      ).status,
    ).toBe(422);

    // A gate at a deactivated location is no longer selectable, while the gate row
    // itself stays active in the management list.
    const location2 = await createMaster(
      'locations',
      { label: nextLabel('F-03 gate location 2') },
      token,
    );
    const gate2 = await createMaster(
      'gates',
      { label: nextLabel('F-03 gate 2'), locationId: location2.id },
      token,
    );
    await inject('POST', `/admin/masters/locations/${location2.id}/deactivate`, { token });

    const catalogue = parseContract(
      MasterListResponseSchema,
      (await inject('GET', '/masters/gates', { token })).json,
    );
    expect(
      catalogue.masters.some((master) => master.id === gate2.id),
      'a gate at an inactive location must not be offered',
    ).toBe(false);

    const management = parseContract(
      MasterListResponseSchema,
      (await inject('GET', '/admin/masters/gates', { token })).json,
    );
    const managed = management.masters.find((master) => master.id === gate2.id);
    expect(managed?.isActive).toBe(true);

    // Creating a gate under the now-inactive location is refused.
    expect(
      (
        await inject('POST', '/admin/masters/gates', {
          token,
          payload: { label: 'x', locationId: location2.id },
        })
      ).status,
    ).toBe(422);
  });

  it('MST-01: non-admin attempts are refused with no side effects', async () => {
    const admin = await adminToken();
    const marshal = await tokenFor('EMP-3106', CREDENTIALS.marshal.password);
    const supervisor = await tokenFor('EMP-2217', SUPERVISOR_PASSWORD);
    const department = await createMaster(
      'departments',
      { label: nextLabel('F-03 protected') },
      admin,
    );

    const before = await db.pool.query<{ label: string; is_active: boolean }>(
      'SELECT label, is_active FROM departments WHERE id = $1',
      [department.id],
    );

    expect(
      (await inject('POST', '/admin/masters/departments', { payload: { label: 'anon' } })).status,
    ).toBe(401);
    for (const token of [marshal, supervisor]) {
      expect(
        (await inject('POST', '/admin/masters/departments', { token, payload: { label: 'nope' } }))
          .status,
      ).toBe(403);
      expect(
        (
          await inject('PATCH', `/admin/masters/departments/${department.id}`, {
            token,
            payload: { label: 'hijacked' },
          })
        ).status,
      ).toBe(403);
      expect(
        (await inject('POST', `/admin/masters/departments/${department.id}/deactivate`, { token }))
          .status,
      ).toBe(403);
      expect((await inject('GET', '/admin/masters/departments', { token })).status).toBe(403);
    }

    const after = await db.pool.query<{ label: string; is_active: boolean }>(
      'SELECT label, is_active FROM departments WHERE id = $1',
      [department.id],
    );
    expect(after.rows[0], 'a refused attempt must not change the master').toEqual(before.rows[0]);

    // The active-only catalogue itself is readable by every authenticated role.
    for (const token of [marshal, supervisor]) {
      expect((await inject('GET', '/masters/departments', { token })).status).toBe(200);
    }
    expect((await inject('GET', '/masters/departments')).status).toBe(401);
  });

  it('MST-01: unknown kinds, unknown ids and malformed payloads are controlled errors', async () => {
    const token = await adminToken();

    for (const url of ['/masters/unicorns', '/admin/masters/unicorns']) {
      const response = await inject('GET', url, { token });
      expect(response.status).toBe(404);
      expect((response.json as { error: string }).error).toBe('not_found');
    }
    expect(
      (await inject('POST', '/admin/masters/unicorns', { token, payload: { label: 'x' } })).status,
    ).toBe(404);

    const unknown = '00000000-0000-4000-8000-00000000dead';
    for (const [method, url] of [
      ['PATCH', `/admin/masters/departments/${unknown}`],
      ['PATCH', '/admin/masters/departments/not-a-uuid'],
      ['POST', `/admin/masters/departments/${unknown}/deactivate`],
      ['POST', '/admin/masters/departments/not-a-uuid/deactivate'],
    ] as const) {
      const response = await inject(method, url, { token, payload: { label: 'x' } });
      expect(response.status, `${method} ${url}`).toBe(404);
      expect((response.json as { error: string }).error).toBe('not_found');
    }

    for (const payload of [{}, { label: '   ' }, { label: 'ok', extra: true }]) {
      const response = await inject('POST', '/admin/masters/departments', { token, payload });
      expect(response.status).toBe(400);
      const body = response.json as { error: string; message: string };
      expect(body.error).toBe('invalid_request');
      expect(Object.keys(body).sort()).toEqual(['error', 'message']);
    }
  });

  it('MST-01: there is no delete or reactivate route, and history blocks a raw delete', async () => {
    const token = await adminToken();
    const department = await createMaster(
      'departments',
      { label: nextLabel('F-03 no delete') },
      token,
    );

    expect(
      (await inject('DELETE', `/admin/masters/departments/${department.id}`, { token })).status,
    ).toBe(404);
    expect(
      (await inject('POST', `/admin/masters/departments/${department.id}/reactivate`, { token }))
        .status,
    ).toBe(404);
    const stillThere = await db.pool.query('SELECT 1 FROM departments WHERE id = $1', [
      department.id,
    ]);
    expect(stillThere.rowCount).toBe(1);

    // A master referenced by issued history is protected by the database itself.
    const referenced = await db.pool.query<{ violation_type_id: string }>(
      'SELECT violation_type_id FROM challan_violations LIMIT 1',
    );
    const violationTypeId = referenced.rows[0]?.violation_type_id as string;
    expect(violationTypeId).toBeTruthy();
    await expect(
      db.pool.query('DELETE FROM violation_types WHERE id = $1', [violationTypeId]),
    ).rejects.toThrow();
    const retained = await db.pool.query('SELECT 1 FROM violation_types WHERE id = $1', [
      violationTypeId,
    ]);
    expect(retained.rowCount).toBe(1);
  });

  /* ------------------------------------------------------------------ */
  /* MST-02: deactivation vs the selection catalogue and history        */
  /* ------------------------------------------------------------------ */

  it('MST-02: a deactivated master leaves the catalogue but stays interpretable on history', async () => {
    const token = await adminToken();
    const used = await db.pool.query<{
      violation_type_id: string;
      challan_id: string;
      label_snapshot: string;
      severity_snapshot: string;
    }>(
      `SELECT violation_type_id, challan_id, label_snapshot, severity_snapshot
         FROM challan_violations ORDER BY challan_id LIMIT 1`,
    );
    const row = used.rows[0];
    expect(row, 'a seeded challan violation is required').toBeTruthy();
    const violationTypeId = row?.violation_type_id as string;
    const challanId = row?.challan_id as string;

    const before = await db.pool.query<{ label_snapshot: string; severity_snapshot: string }>(
      'SELECT label_snapshot, severity_snapshot FROM challan_violations WHERE challan_id = $1 AND violation_type_id = $2',
      [challanId, violationTypeId],
    );

    const deactivated = await inject(
      'POST',
      `/admin/masters/violation-types/${violationTypeId}/deactivate`,
      { token },
    );
    expect(deactivated.status).toBe(200);
    expect(parseContract(MasterResponseSchema, deactivated.json).master.isActive).toBe(false);

    const catalogue = parseContract(
      MasterListResponseSchema,
      (await inject('GET', '/masters/violation-types', { token })).json,
    );
    expect(catalogue.masters.some((master) => master.id === violationTypeId)).toBe(false);

    const management = parseContract(
      MasterListResponseSchema,
      (await inject('GET', '/admin/masters/violation-types', { token })).json,
    );
    expect(management.masters.find((master) => master.id === violationTypeId)?.isActive).toBe(
      false,
    );

    const after = await db.pool.query<{ label_snapshot: string; severity_snapshot: string }>(
      'SELECT label_snapshot, severity_snapshot FROM challan_violations WHERE challan_id = $1 AND violation_type_id = $2',
      [challanId, violationTypeId],
    );
    expect(after.rows[0], 'deactivation must not touch issued snapshots').toEqual(before.rows[0]);

    const read = await inject('GET', `/challans/${challanId}`, { token });
    expect(read.status).toBe(200);
  });

  /* ------------------------------------------------------------------ */
  /* MST-03: post-issuance edits never change issued meaning            */
  /* ------------------------------------------------------------------ */

  it('MST-03: editing masters after issuance cannot change issued snapshots', async () => {
    const token = await adminToken();
    const picked = await db.pool.query<{
      id: string;
      department_id: string;
      vehicle_type_id: string;
      severity: string;
      department_label_snapshot: string;
      vehicle_type_label_snapshot: string;
      violation_type_id: string;
    }>(
      `SELECT c.id, c.department_id, c.vehicle_type_id, c.severity,
              c.department_label_snapshot, c.vehicle_type_label_snapshot, cv.violation_type_id
         FROM challans c JOIN challan_violations cv ON cv.challan_id = c.id
        ORDER BY c.id LIMIT 1`,
    );
    const challan = picked.rows[0];
    expect(challan, 'a seeded challan with a violation is required').toBeTruthy();
    const challanId = challan?.id as string;

    const captureChallan = async () =>
      (await db.pool.query(`SELECT * FROM challans WHERE id = $1`, [challanId])).rows[0];
    const captureViolations = async () =>
      (
        await db.pool.query(
          `SELECT * FROM challan_violations WHERE challan_id = $1 ORDER BY violation_type_id`,
          [challanId],
        )
      ).rows;

    const challanBefore = await captureChallan();
    const violationsBefore = await captureViolations();

    // Edit every master that contributed issued snapshots.
    const violationEdit = await inject(
      'PATCH',
      `/admin/masters/violation-types/${challan?.violation_type_id as string}`,
      {
        token,
        payload: {
          label: 'F-03 edited violation label',
          severity: 'Critical',
          defaultAction: 'custom',
        },
      },
    );
    expect(violationEdit.status).toBe(200);
    const departmentEdit = await inject(
      'PATCH',
      `/admin/masters/departments/${challan?.department_id as string}`,
      { token, payload: { label: 'F-03 edited department label' } },
    );
    expect(departmentEdit.status).toBe(200);
    const vehicleTypeEdit = await inject(
      'PATCH',
      `/admin/masters/vehicle-types/${challan?.vehicle_type_id as string}`,
      { token, payload: { label: 'F-03 edited vehicle type label' } },
    );
    expect(vehicleTypeEdit.status).toBe(200);

    // The edits really happened on the masters.
    const edited = await db.pool.query<{ label: string; severity: string }>(
      'SELECT label, severity FROM violation_types WHERE id = $1',
      [challan?.violation_type_id],
    );
    expect(edited.rows[0]?.label).toBe('F-03 edited violation label');
    expect(edited.rows[0]?.severity).toBe('Critical');

    // The issued record is byte-for-byte unchanged.
    expect(await captureChallan(), 'a master edit must not touch the challan row').toEqual(
      challanBefore,
    );
    expect(
      await captureViolations(),
      'a master edit must not touch issued violation snapshots',
    ).toEqual(violationsBefore);

    const read = await inject('GET', `/challans/${challanId}`, { token });
    expect(read.status).toBe(200);
    const body = read.json as {
      severity: string;
      departmentLabel: string;
      vehicleTypeLabel: string;
    };
    expect(body.severity, 'displayed severity stays as issued').toBe(challan?.severity);
    expect(body.departmentLabel).toBe(challan?.department_label_snapshot);
    expect(body.vehicleTypeLabel).toBe(challan?.vehicle_type_label_snapshot);

    // Deactivation after edits changes nothing either.
    for (const [kind, id] of [
      ['violation-types', challan?.violation_type_id],
      ['departments', challan?.department_id],
      ['vehicle-types', challan?.vehicle_type_id],
    ] as const) {
      const result = await inject('POST', `/admin/masters/${kind}/${id as string}/deactivate`, {
        token,
      });
      expect(result.status).toBe(200);
    }
    expect(await captureChallan()).toEqual(challanBefore);
    expect(await captureViolations()).toEqual(violationsBefore);
  });

  it('MST-03: the master catalogue never exposes an invented kind or record shape', async () => {
    const token = await adminToken();
    for (const kind of MASTER_KINDS) {
      const response = await inject('GET', `/masters/${kind}`, { token });
      expect(response.status).toBe(200);
      const parsed = parseContract(MasterListResponseSchema, response.json);
      expect(parsed.kind).toBe(kind);
      for (const master of parsed.masters) {
        expect(master.kind).toBe(kind);
        expect(master.isActive, 'the selection catalogue is active-only').toBe(true);
      }
    }
  });
});
