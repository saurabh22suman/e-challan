import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  ChallanPreviewResponseSchema,
  EntryValidationResponseSchema,
  RegistryLookupResponseSchema,
  parseContract,
} from '@echallan/contracts';
import { createApp } from '../../src/app.js';
import type { Db } from '../../src/db/client.js';
import { resetAndMigrateTestDatabase, resolveTestDatabaseUrl } from './helpers/testTarget.js';

/**
 * Planner-owned pre-issuance acceptance against **real PostgreSQL**: ENT-02/03/04/06
 * (scoped registry lookup, authoritative validation, Other coupling, expiry) and
 * REP-01–REP-04 (occurrence counting, cancellations, multi-violation, exact 90-day
 * and 15-minute boundaries, recheck after new history).
 *
 * A fixed clock is injected through the app factory so every boundary is exact.
 * Read-only planner input; do not replace, skip or weaken these assertions.
 */

const FIXED_NOW = new Date('2026-10-07T12:00:00.000Z');

const BASE_CREDENTIALS = {
  marshal: { username: 'DEMO-EMP-004', password: 'planner-demo-marshal-secret' },
  supervisor: { username: 'DEMO-EMP-002', password: 'planner-demo-supervisor-secret' },
  admin: { username: 'DEMO-EMP-001', password: 'planner-demo-admin-secret' },
} as const;

const DISPATCH_CREDENTIALS = {
  ...BASE_CREDENTIALS,
  marshal: { username: 'DEMO-EMP-005', password: 'planner-demo-dispatch-secret' },
} as const;

const MAIN_MARSHAL_PASSWORD = BASE_CREDENTIALS.marshal.password;
const ADMIN_PASSWORD = BASE_CREDENTIALS.admin.password;

interface MainFixtureIds {
  postId: string;
  shiftId: string;
  locationId: string;
  gateId: string;
  templateChallanId: string;
  dispatchTemplateChallanId: string;
  departmentId: string;
  vehicleTypeId: string;
  contractorId: string;
  violationSeatbeltId: string;
  violationRouteId: string;
  violationRetiredId: string;
  violationOtherId: string;
  departmentOtherId: string;
  vehicleTypeOtherId: string;
}

describe('ENT/REP pre-issuance acceptance over real PostgreSQL', () => {
  let db: Db;
  let server: FastifyInstance;
  let dispatchServer: FastifyInstance;
  let ids: MainFixtureIds;

  beforeAll(async () => {
    db = await resetAndMigrateTestDatabase();
    const seed = (await import('../../src/db/seed-domain-demo.js')) as {
      seedDomainDemoDatabase: (url: string) => Promise<unknown>;
    };
    await seed.seedDomainDemoDatabase(resolveTestDatabaseUrl());
    const now = () => FIXED_NOW;
    server = createApp({ db, credentials: BASE_CREDENTIALS, now });
    dispatchServer = createApp({ db, credentials: DISPATCH_CREDENTIALS, now });
    await server.ready();
    await dispatchServer.ready();

    const one = async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) =>
      (await db.pool.query<T>(sql, params)).rows[0] as T;
    const main = await one<{ id: string }>(
      "SELECT id FROM posts WHERE demo_source_id = 'DEMO-POST-01'",
    );
    const mainShift = await one<{ id: string }>(
      "SELECT id FROM shifts WHERE demo_source_id = 'shift-main-day'",
    );
    const mainLocation = await one<{ id: string }>(
      "SELECT id FROM locations WHERE demo_source_id = 'loc-main'",
    );
    const mainGate = await one<{ id: string }>(
      "SELECT id FROM gates WHERE demo_source_id = 'gate-01'",
    );
    ids = {
      postId: main.id,
      shiftId: mainShift.id,
      locationId: mainLocation.id,
      gateId: mainGate.id,
      templateChallanId: (
        await one<{ id: string }>(
          "SELECT id FROM challans WHERE demo_source_id = 'demo-challan-003'",
        )
      ).id,
      dispatchTemplateChallanId: (
        await one<{ id: string }>(
          "SELECT id FROM challans WHERE demo_source_id = 'demo-challan-005'",
        )
      ).id,
      departmentId: (
        await one<{ id: string }>(
          "SELECT id FROM departments WHERE demo_source_id = 'dept-logistics'",
        )
      ).id,
      vehicleTypeId: (
        await one<{ id: string }>("SELECT id FROM vehicle_types WHERE demo_source_id = 'type-car'")
      ).id,
      contractorId: (
        await one<{ id: string }>(
          "SELECT id FROM contractors WHERE demo_source_id = 'contract-west'",
        )
      ).id,
      violationSeatbeltId: (
        await one<{ id: string }>(
          "SELECT id FROM violation_types WHERE demo_source_id = 'violation-seatbelt'",
        )
      ).id,
      violationRouteId: (
        await one<{ id: string }>(
          "SELECT id FROM violation_types WHERE demo_source_id = 'violation-route'",
        )
      ).id,
      violationRetiredId: (
        await one<{ id: string }>(
          "SELECT id FROM violation_types WHERE demo_source_id = 'violation-retired'",
        )
      ).id,
      violationOtherId: (
        await one<{ id: string }>(
          "SELECT id FROM violation_types WHERE demo_source_id = 'violation-other'",
        )
      ).id,
      departmentOtherId: (
        await one<{ id: string }>("SELECT id FROM departments WHERE demo_source_id = 'dept-other'")
      ).id,
      vehicleTypeOtherId: (
        await one<{ id: string }>(
          "SELECT id FROM vehicle_types WHERE demo_source_id = 'type-other'",
        )
      ).id,
    };
  });

  afterAll(async () => {
    if (dispatchServer) await dispatchServer.close();
    if (server) await server.close();
    if (db) await db.close();
  });

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  async function login(app: FastifyInstance, username: string, password: string): Promise<string> {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username, password },
    });
    expect(response.statusCode, `login failed: ${response.body}`).toBe(200);
    const token = (response.json() as { token?: string }).token;
    expect(token).toBeTruthy();
    return token as string;
  }

  const mainMarshal = () => login(server, 'DEMO-EMP-004', MAIN_MARSHAL_PASSWORD);
  const dispatchMarshal = () =>
    login(dispatchServer, 'DEMO-EMP-005', DISPATCH_CREDENTIALS.marshal.password);
  const admin = () => login(server, 'DEMO-EMP-001', ADMIN_PASSWORD);
  const supervisor = () => login(server, 'DEMO-EMP-002', 'planner-demo-supervisor-secret');

  async function inject(
    app: FastifyInstance,
    method: 'GET' | 'POST',
    url: string,
    options: { token?: string; payload?: unknown } = {},
  ): Promise<{ status: number; json: unknown }> {
    const response = await app.inject({
      method,
      url,
      ...(options.token === undefined
        ? {}
        : { headers: { authorization: `Bearer ${options.token}` } }),
      ...(options.payload === undefined ? {} : { payload: options.payload as object }),
    });
    return { status: response.statusCode, json: response.json() };
  }

  const lookup = (app: FastifyInstance, token: string, field: string, q: string) =>
    inject(app, 'GET', `/registry/lookup?field=${field}&q=${encodeURIComponent(q)}`, { token });

  const draft = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    vehicleRegistration: 'GJ05JP6207',
    gatePassNumber: 'DEMO-GP-0010',
    driverName: 'Kavita Joshi',
    vehicleTypeId: ids.vehicleTypeId,
    departmentId: ids.departmentId,
    contractorId: ids.contractorId,
    violationTypeIds: [ids.violationSeatbeltId],
    remarks: '',
    registry: null,
    ...overrides,
  });

  const validate = (token: string, payload: Record<string, unknown>) =>
    inject(server, 'POST', '/challans/validate', { token, payload });

  const preview = (token: string, payload: Record<string, unknown>) =>
    inject(server, 'POST', '/challans/preview', { token, payload });

  async function insertSyntheticChallan(options: {
    templateId: string;
    registration: string;
    gatePassNumber: string;
    issuedAt: Date;
    status?: 'Issued' | 'Under Review' | 'Resolved' | 'Cancelled';
  }): Promise<string> {
    const id = randomUUID();
    await db.pool.query(
      `INSERT INTO challans (
         id, challan_number, gate_pass_number, vehicle_registration_number, driver_name,
         gate_pass_record_id, department_id, department_label_snapshot, contractor_id,
         contractor_label_snapshot, vehicle_type_id, vehicle_type_label_snapshot,
         location_id, gate_id, post_id, shift_id, issued_by_user_id, status, severity,
         occurrence_number, recommended_action, remarks, issued_at, demo_source_id
       )
       SELECT $1, $2, $3, $4, driver_name, gate_pass_record_id, department_id,
              department_label_snapshot, contractor_id, contractor_label_snapshot,
              vehicle_type_id, vehicle_type_label_snapshot, location_id, gate_id, post_id,
              shift_id, issued_by_user_id, $5, severity, 1, recommended_action, remarks,
              $6, NULL
         FROM challans WHERE id = $7`,
      [
        id,
        `F-BATCH/${id.slice(0, 8)}`,
        options.gatePassNumber,
        options.registration,
        options.status ?? 'Issued',
        options.issuedAt,
        options.templateId,
      ],
    );
    return id;
  }

  /* ------------------------------------------------------------------ */
  /* ENT-02: scoped registry lookup                                      */
  /* ------------------------------------------------------------------ */

  describe('ENT-02 registry lookup', () => {
    it('refuses a search shorter than three trimmed characters', async () => {
      const token = await mainMarshal();
      for (const q of ['GJ', '  GJ  ']) {
        const response = await lookup(server, token, 'registration', q);
        expect(response.status, `q="${q}"`).toBe(400);
        expect((response.json as { error: string }).error).toBe('invalid_request');
      }
    });

    it('lists the location vehicles on an empty query (B-08 list mode)', async () => {
      // B-08 test-baseline revision (owner decision 2026-10-17): the empty
      // query is the vehicle dropdown's list mode, scoped to the session
      // post's location. Two-character searches stay refused above.
      const token = await mainMarshal();
      const response = await lookup(server, token, 'registration', '');
      expect(response.status).toBe(200);
      const matches = parseContract(RegistryLookupResponseSchema, response.json).matches;
      const registrations = matches.map((match) => match.vehicleRegistrationNumber);
      expect(registrations).toContain('GJ05DS4821');
      expect(registrations).toContain('GJ05JP6207');
      expect(
        registrations,
        'dispatch-only vehicles must not appear in the main location list',
      ).not.toContain('MH12RT7306');
      expect(registrations, 'the list must be ordered by registration for stable scanning').toEqual(
        [...registrations].sort((a, b) => a.localeCompare(b)),
      );
    });

    it('scopes matches to the session post location', async () => {
      const main = await mainMarshal();
      const dispatch = await dispatchMarshal();

      const mainSees = await lookup(server, main, 'registration', 'MH12RT7306');
      expect(mainSees.status).toBe(200);
      expect(
        parseContract(RegistryLookupResponseSchema, mainSees.json).matches,
        'dispatch-only passes must not leak to the main marshal',
      ).toHaveLength(0);

      const dispatchSees = await lookup(dispatchServer, dispatch, 'registration', 'MH12RT7306');
      expect(dispatchSees.status).toBe(200);
      expect(parseContract(RegistryLookupResponseSchema, dispatchSees.json).matches).toHaveLength(
        2,
      );

      expect((await lookup(server, main, 'gatePassNumber', 'DEMO-GP-0002')).status).toBe(200);
      expect(
        parseContract(
          RegistryLookupResponseSchema,
          (await lookup(server, main, 'gatePassNumber', 'DEMO-GP-0002')).json,
        ).matches,
      ).toHaveLength(0);
    });

    it('finds a zero-history vehicle from the registry, not from challans', async () => {
      const token = await mainMarshal();
      const history = await db.pool.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM challans WHERE vehicle_registration_number = 'GJ05JP6207'",
      );
      expect(history.rows[0]?.n, 'the fixture vehicle must have zero prior challans').toBe(0);

      const response = await lookup(server, token, 'registration', 'GJ05JP6207');
      expect(response.status).toBe(200);
      const matches = parseContract(RegistryLookupResponseSchema, response.json).matches;
      expect(matches).toHaveLength(1);
      const match = matches[0];
      expect(match?.gatePassNumber).toBe('DEMO-GP-0010');
      expect(match?.driverName).toBe('Kavita Joshi');
      expect(match?.vehicleRegistrationNumber).toBe('GJ05JP6207');
      expect(match?.departmentLabel).toBe('Plant operations');
      expect(match?.vehicleTypeLabel).toBe('Car');
      expect(match?.contractorLabel).toBe('Demo Unity Engineering Works');
      expect(match?.status).toBe('active');
    });

    it('returns one match per pass so a shared vehicle offers an explicit driver choice', async () => {
      const token = await dispatchMarshal();
      const matches = parseContract(
        RegistryLookupResponseSchema,
        (await lookup(dispatchServer, token, 'registration', 'MH12RT7306')).json,
      ).matches;
      expect(matches).toHaveLength(2);
      expect(new Set(matches.map((m) => m.driverName))).toEqual(
        new Set(['Imran Shaikh', 'Sanjay Patil']),
      );
      expect(new Set(matches.map((m) => m.gatePassNumber))).toEqual(
        new Set(['DEMO-GP-0002', 'DEMO-GP-0006']),
      );
    });

    it('returns an expired pass with its status instead of hiding it', async () => {
      const token = await dispatchMarshal();
      const matches = parseContract(
        RegistryLookupResponseSchema,
        (await lookup(dispatchServer, token, 'gatePassNumber', 'DEMO-GP-0008')).json,
      ).matches;
      expect(matches).toHaveLength(1);
      expect(matches[0]?.status).toBe('expired');
      expect(matches[0]?.validUntil).toBeTruthy();
    });

    it('searches by driver name without merging different people who share a name', async () => {
      const token = await mainMarshal();
      const matches = parseContract(
        RegistryLookupResponseSchema,
        (await lookup(server, token, 'driverName', 'Ramesh')).json,
      ).matches;
      expect(matches).toHaveLength(2);
      expect(new Set(matches.map((m) => m.gatePassNumber))).toEqual(
        new Set(['DEMO-GP-0001', 'DEMO-GP-0009']),
      );
    });

    it('requires a marshal session', async () => {
      expect((await lookup(server, 'not-a-token', 'registration', 'GJ05')).status).toBe(401);
      expect((await lookup(server, await supervisor(), 'registration', 'GJ05')).status).toBe(403);
      expect((await lookup(server, await admin(), 'registration', 'GJ05')).status).toBe(403);
    });
  });

  /* ------------------------------------------------------------------ */
  /* ENT-03/04: authoritative draft validation                           */
  /* ------------------------------------------------------------------ */

  describe('ENT-03/04 draft validation', () => {
    it('accepts a valid draft and derives the highest severity', async () => {
      const token = await mainMarshal();
      const response = await validate(
        token,
        draft({ violationTypeIds: [ids.violationSeatbeltId, ids.violationRouteId] }),
      );
      expect(response.status, JSON.stringify(response.json)).toBe(200);
      const body = parseContract(EntryValidationResponseSchema, response.json);
      expect(body.severity).toBe('Critical');
      expect(body.otherFields).toEqual([]);
    });

    it('rejects a client-supplied severity or location', async () => {
      const token = await mainMarshal();
      for (const forged of [{ severity: 'Critical' }, { locationId: ids.locationId }]) {
        const response = await validate(token, draft(forged));
        expect(response.status, JSON.stringify(forged)).toBe(422);
        expect((response.json as { error: string }).error).toBe('invalid_draft');
      }
    });

    it('rejects inactive and unknown masters', async () => {
      const token = await mainMarshal();
      const retired = await validate(token, draft({ violationTypeIds: [ids.violationRetiredId] }));
      expect(retired.status).toBe(422);
      expect(
        (retired.json as { fields: Array<{ field: string; code: string }> }).fields,
      ).toContainEqual(
        expect.objectContaining({ field: 'violationTypeIds', code: 'inactive_master' }),
      );

      const forged = await validate(token, draft({ departmentId: randomUUID() }));
      expect(forged.status).toBe(422);
      expect(
        (forged.json as { fields: Array<{ field: string; code: string }> }).fields,
      ).toContainEqual(expect.objectContaining({ field: 'departmentId', code: 'unknown_master' }));

      // The F-03 admin surface deactivates a master; a deactivated master is refused.
      const adminToken = await admin();
      const created = await inject(server, 'POST', '/admin/masters/departments', {
        token: adminToken,
        payload: { label: 'F-BATCH deactivated department' },
      });
      expect(created.status).toBe(201);
      const departmentId = (created.json as { master: { id: string } }).master.id;
      expect(
        (
          await inject(server, 'POST', `/admin/masters/departments/${departmentId}/deactivate`, {
            token: adminToken,
          })
        ).status,
      ).toBe(200);
      const deactivated = await validate(token, draft({ departmentId }));
      expect(deactivated.status).toBe(422);
      expect(
        (deactivated.json as { fields: Array<{ field: string; code: string }> }).fields,
      ).toContainEqual(expect.objectContaining({ field: 'departmentId', code: 'inactive_master' }));
    });

    it('rejects duplicate or empty violation selections', async () => {
      const token = await mainMarshal();
      for (const violationTypeIds of [[], [ids.violationSeatbeltId, ids.violationSeatbeltId]]) {
        const response = await validate(token, draft({ violationTypeIds }));
        expect(response.status, JSON.stringify(violationTypeIds)).toBe(422);
      }
    });

    it('requires remarks when any applicable Other master is selected', async () => {
      const token = await mainMarshal();
      const adminToken = await admin();

      // Contractor Other is not in the fixture: configure it through the F-03 API.
      const created = await inject(server, 'POST', '/admin/masters/contractors', {
        token: adminToken,
        payload: { label: 'Other' },
      });
      expect(created.status).toBe(201);
      const contractorOtherId = (created.json as { master: { id: string } }).master.id;

      const cases: Array<[Record<string, unknown>, string]> = [
        [{ departmentId: ids.departmentOtherId }, 'department'],
        [{ vehicleTypeId: ids.vehicleTypeOtherId }, 'vehicleType'],
        [{ violationTypeIds: [ids.violationOtherId] }, 'violationType'],
        [{ contractorId: contractorOtherId }, 'contractor'],
      ];
      for (const [overrides, field] of cases) {
        const blank = await validate(token, draft({ ...overrides, remarks: '   ' }));
        expect(blank.status, `blank remarks for ${field}`).toBe(422);
        expect(
          (blank.json as { fields: Array<{ field: string; code: string }> }).fields,
        ).toContainEqual(expect.objectContaining({ field, code: 'other_remarks_required' }));
      }

      const filled = await validate(
        token,
        draft({
          departmentId: ids.departmentOtherId,
          vehicleTypeId: ids.vehicleTypeOtherId,
          contractorId: contractorOtherId,
          violationTypeIds: [ids.violationOtherId],
          remarks: 'Unlisted department, vehicle type, contractor and violation',
        }),
      );
      expect(filled.status).toBe(200);
      expect(parseContract(EntryValidationResponseSchema, filled.json).otherFields.sort()).toEqual(
        ['contractor', 'department', 'vehicleType', 'violationType'].sort(),
      );
    });

    it('rejects registry provenance that is unknown or outside the session scope', async () => {
      const token = await mainMarshal();
      const unknown = await validate(
        token,
        draft({
          registry: {
            gatePassRecordId: randomUUID(),
            driverId: randomUUID(),
            vehicleId: randomUUID(),
          },
        }),
      );
      expect(unknown.status).toBe(422);
      expect(
        (unknown.json as { fields: Array<{ field: string; code: string }> }).fields,
      ).toContainEqual(expect.objectContaining({ field: 'registry', code: 'provenance_mismatch' }));

      // DEMO-GP-0002 is dispatch-only; the main marshal may not claim it.
      const outOfScope = await db.pool.query<{
        gate_pass_record_id: string;
        driver_id: string;
        vehicle_id: string;
      }>(
        `SELECT gpr.id AS gate_pass_record_id, gpr.driver_id, gpr.vehicle_id
           FROM gate_pass_records gpr WHERE gpr.demo_source_id = 'pass-02'`,
      );
      const row = outOfScope.rows[0];
      expect(row).toBeTruthy();
      const scoped = await validate(
        token,
        draft({
          registry: {
            gatePassRecordId: row?.gate_pass_record_id as string,
            driverId: row?.driver_id as string,
            vehicleId: row?.vehicle_id as string,
          },
        }),
      );
      expect(scoped.status).toBe(422);
    });

    it('requires a marshal session', async () => {
      const payload = draft();
      expect((await inject(server, 'POST', '/challans/validate', { payload })).status).toBe(401);
      expect(
        (await inject(server, 'POST', '/challans/validate', { token: await supervisor(), payload }))
          .status,
      ).toBe(403);
    });
  });

  /* ------------------------------------------------------------------ */
  /* REP-01/02: occurrence and recommendation over real history          */
  /* ------------------------------------------------------------------ */

  describe('REP-01/02 preview counting', () => {
    it('counts prior non-cancelled challans for the normalised pass and applies the tier', async () => {
      const token = await mainMarshal();
      const response = await preview(token, {
        draft: draft({
          vehicleRegistration: 'GJ05DS4821',
          gatePassNumber: 'DEMO-GP-0001',
          driverName: 'Ramesh Kumar',
        }),
        warningAcknowledged: false,
      });
      expect(response.status, JSON.stringify(response.json)).toBe(200);
      const body = parseContract(ChallanPreviewResponseSchema, response.json);
      expect(body.occurrenceNumber).toBe(5);
      expect(body.recommendedAction).toBe('referred_to_department_contractor');
      expect(body.duplicateWarning).toEqual({ required: false, matchedCount: 0 });
      expect(body.windowDays).toBe(90);
      expect(body.windowMinutes).toBe(15);
    });

    it('excludes cancelled records without rewriting past occurrences', async () => {
      const token = await mainMarshal();
      const cancelledPass = await preview(token, {
        draft: draft({
          vehicleRegistration: 'DL8CAF6193',
          gatePassNumber: 'DEMO-GP-0005',
          driverName: 'Anita Verma',
        }),
        warningAcknowledged: false,
      });
      expect(parseContract(ChallanPreviewResponseSchema, cancelledPass.json).occurrenceNumber).toBe(
        1,
      );

      await insertSyntheticChallan({
        templateId: ids.templateChallanId,
        registration: 'GJ05DS4821',
        gatePassNumber: 'DEMO-GP-0001',
        issuedAt: new Date(FIXED_NOW.getTime() - 60 * 60 * 1000),
        status: 'Cancelled',
      });
      const stillFive = await preview(token, {
        draft: draft({
          vehicleRegistration: 'GJ05DS4821',
          gatePassNumber: 'DEMO-GP-0001',
          driverName: 'Ramesh Kumar',
        }),
        warningAcknowledged: false,
      });
      expect(parseContract(ChallanPreviewResponseSchema, stillFive.json).occurrenceNumber).toBe(5);
    });

    it('counts a multi-violation challan once and does not merge different passes', async () => {
      const dispatch = await dispatchMarshal();
      const multi = await inject(dispatchServer, 'POST', '/challans/preview', {
        token: dispatch,
        payload: {
          draft: draft({
            vehicleRegistration: 'MH12RT7306',
            gatePassNumber: 'DEMO-GP-0002',
            driverName: 'Imran Shaikh',
          }),
          warningAcknowledged: false,
        },
      });
      expect(parseContract(ChallanPreviewResponseSchema, multi.json).occurrenceNumber).toBe(2);

      const token = await mainMarshal();
      const otherPass = await preview(token, {
        draft: draft({
          vehicleRegistration: 'KA03MN8176',
          gatePassNumber: 'DEMO-GP-0009',
          driverName: 'Ramesh Kumar',
        }),
        warningAcknowledged: false,
      });
      expect(
        parseContract(ChallanPreviewResponseSchema, otherPass.json).occurrenceNumber,
        'the same driver name on a different pass must not merge histories (DEMO-GP-0001 has five priors; a merge would give six)',
      ).toBe(2);
    });

    it('includes exactly the 90-day lower boundary and excludes anything older or at T', async () => {
      const token = await mainMarshal();
      const pass = 'F-BATCH-90D';
      const day = 24 * 60 * 60 * 1000;
      await insertSyntheticChallan({
        templateId: ids.templateChallanId,
        registration: 'GJ05DS4821',
        gatePassNumber: pass,
        issuedAt: new Date(FIXED_NOW.getTime() - 90 * day),
      });
      await insertSyntheticChallan({
        templateId: ids.templateChallanId,
        registration: 'GJ05DS4821',
        gatePassNumber: pass,
        issuedAt: new Date(FIXED_NOW.getTime() - 90 * day - 1000),
      });
      await insertSyntheticChallan({
        templateId: ids.templateChallanId,
        registration: 'GJ05DS4821',
        gatePassNumber: pass,
        issuedAt: FIXED_NOW,
      });

      const response = await preview(token, {
        draft: draft({
          vehicleRegistration: 'GJ05DS4821',
          gatePassNumber: pass,
          driverName: 'Ramesh Kumar',
        }),
        warningAcknowledged: false,
      });
      expect(
        parseContract(ChallanPreviewResponseSchema, response.json).occurrenceNumber,
        'only the record exactly 90 days old counts',
      ).toBe(2);
    });

    it('REP-04 rechecks after new history and updates occurrence and recommendation', async () => {
      const token = await mainMarshal();
      const pass = 'F-BATCH-RECHECK';
      const first = await preview(token, {
        draft: draft({
          vehicleRegistration: 'GJ05DS4821',
          gatePassNumber: pass,
          driverName: 'Ramesh Kumar',
        }),
        warningAcknowledged: false,
      });
      expect(parseContract(ChallanPreviewResponseSchema, first.json)).toMatchObject({
        occurrenceNumber: 1,
        recommendedAction: 'warning_issued',
      });

      await insertSyntheticChallan({
        templateId: ids.templateChallanId,
        registration: 'GJ05DS4821',
        gatePassNumber: pass,
        issuedAt: new Date(FIXED_NOW.getTime() - 5 * 60 * 1000),
      });
      await insertSyntheticChallan({
        templateId: ids.templateChallanId,
        registration: 'GJ05DS4821',
        gatePassNumber: pass,
        issuedAt: new Date(FIXED_NOW.getTime() - 4 * 60 * 1000),
      });

      const second = await preview(token, {
        draft: draft({
          vehicleRegistration: 'GJ05DS4821',
          gatePassNumber: pass,
          driverName: 'Ramesh Kumar',
        }),
        warningAcknowledged: false,
      });
      expect(parseContract(ChallanPreviewResponseSchema, second.json)).toMatchObject({
        occurrenceNumber: 3,
        recommendedAction: 'referred_to_department_contractor',
      });
    });
  });

  /* ------------------------------------------------------------------ */
  /* REP-03: duplicate warning and exact 15-minute boundary              */
  /* ------------------------------------------------------------------ */

  describe('REP-03 duplicate warning', () => {
    it('warns for the same normalised vehicle at the same location and not otherwise', async () => {
      const token = await mainMarshal();
      const registration = 'GJ05ZZ0001';
      await insertSyntheticChallan({
        templateId: ids.templateChallanId,
        registration,
        gatePassNumber: 'F-BATCH-DUP-PASS',
        issuedAt: new Date(FIXED_NOW.getTime() - 10 * 60 * 1000),
      });

      const warned = await preview(token, {
        draft: draft({
          vehicleRegistration: registration,
          gatePassNumber: 'F-BATCH-DUP-PASS',
          driverName: 'Kavita Joshi',
        }),
        warningAcknowledged: false,
      });
      expect(parseContract(ChallanPreviewResponseSchema, warned.json).duplicateWarning).toEqual({
        required: true,
        matchedCount: 1,
      });

      // A different vehicle at the same location is not a duplicate.
      const otherVehicle = await preview(token, {
        draft: draft({
          vehicleRegistration: 'GJ05JP6207',
          gatePassNumber: 'DEMO-GP-0010',
          driverName: 'Kavita Joshi',
        }),
        warningAcknowledged: false,
      });
      expect(
        parseContract(ChallanPreviewResponseSchema, otherVehicle.json).duplicateWarning.required,
      ).toBe(false);

      // The same vehicle at another location does not warn for this marshal.
      const dispatch = await dispatchMarshal();
      const dispatchView = await inject(dispatchServer, 'POST', '/challans/preview', {
        token: dispatch,
        payload: {
          draft: draft({
            vehicleRegistration: registration,
            gatePassNumber: 'F-BATCH-DUP-PASS',
            driverName: 'Kavita Joshi',
          }),
          warningAcknowledged: false,
        },
      });
      expect(
        parseContract(ChallanPreviewResponseSchema, dispatchView.json).duplicateWarning.required,
      ).toBe(false);
    });

    it('includes exactly the 15-minute lower boundary and excludes anything older', async () => {
      const token = await mainMarshal();
      const minute = 60 * 1000;
      const exact = 'GJ05ZZ0002';
      const older = 'GJ05ZZ0003';
      await insertSyntheticChallan({
        templateId: ids.templateChallanId,
        registration: exact,
        gatePassNumber: `${exact}-PASS`,
        issuedAt: new Date(FIXED_NOW.getTime() - 15 * minute),
      });
      await insertSyntheticChallan({
        templateId: ids.templateChallanId,
        registration: older,
        gatePassNumber: `${older}-PASS`,
        issuedAt: new Date(FIXED_NOW.getTime() - 15 * minute - 1000),
      });

      const exactView = await preview(token, {
        draft: draft({
          vehicleRegistration: exact,
          gatePassNumber: `${exact}-PASS`,
          driverName: 'Kavita Joshi',
        }),
        warningAcknowledged: false,
      });
      expect(
        parseContract(ChallanPreviewResponseSchema, exactView.json).duplicateWarning.required,
        'exactly 15 minutes old must warn',
      ).toBe(true);

      const olderView = await preview(token, {
        draft: draft({
          vehicleRegistration: older,
          gatePassNumber: `${older}-PASS`,
          driverName: 'Kavita Joshi',
        }),
        warningAcknowledged: false,
      });
      expect(
        parseContract(ChallanPreviewResponseSchema, olderView.json).duplicateWarning.required,
        'older than 15 minutes must not warn',
      ).toBe(false);
    });

    it('accepts the acknowledgement flag but never writes a record', async () => {
      const token = await mainMarshal();
      const before = await db.pool.query<{ n: number }>('SELECT count(*)::int AS n FROM challans');
      const acknowledged = await preview(token, {
        draft: draft({
          vehicleRegistration: 'GJ05DS4821',
          gatePassNumber: 'DEMO-GP-0001',
          driverName: 'Ramesh Kumar',
        }),
        warningAcknowledged: true,
      });
      expect(acknowledged.status).toBe(200);
      const after = await db.pool.query<{ n: number }>('SELECT count(*)::int AS n FROM challans');
      expect(after.rows[0]?.n, 'a preview is not a reservation or a write').toBe(before.rows[0]?.n);
    });

    it('rejects an invalid draft before previewing', async () => {
      const token = await mainMarshal();
      const response = await preview(token, {
        draft: draft({ violationTypeIds: [ids.violationRetiredId] }),
        warningAcknowledged: false,
      });
      expect(response.status).toBe(422);
      expect((response.json as { error: string }).error).toBe('invalid_draft');
    });

    it('requires a marshal session', async () => {
      const payload = { draft: draft(), warningAcknowledged: false };
      expect((await inject(server, 'POST', '/challans/preview', { payload })).status).toBe(401);
      expect(
        (await inject(server, 'POST', '/challans/preview', { token: await supervisor(), payload }))
          .status,
      ).toBe(403);
    });
  });
});
