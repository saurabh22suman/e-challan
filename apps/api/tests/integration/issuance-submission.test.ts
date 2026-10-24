import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  deriveSummaryRevision,
  type ChallanCommitResponse,
  type ChallanPreviewResponse,
  type EntryDraft,
} from '@echallan/contracts';
import { createApp } from '../../src/app.js';
import { createLocalDiskEvidenceStore, type EvidenceStore } from '../../src/evidence/localDisk.js';
import type { Db } from '../../src/db/client.js';
import { resetAndMigrateTestDatabase, resolveTestDatabaseUrl } from './helpers/testTarget.js';

/**
 * I-06 acceptance: signed and refused atomic submission, server numbering,
 * persisted evidence rows, audit history and idempotent retry.
 */

const FIXED_NOW = new Date('2026-10-07T12:00:00.000Z');
const CREDENTIALS = {
  marshal: { username: 'EMP-3106', password: 'planner-demo-marshal-secret' },
  supervisor: { username: 'EMP-2217', password: 'planner-demo-supervisor-secret' },
  admin: { username: 'EMP-1042', password: 'planner-demo-admin-secret' },
} as const;

interface FixtureIds {
  postId: string;
  locationId: string;
  departmentId: string;
  vehicleTypeId: string;
  contractorId: string;
  violationId: string;
}

const PHOTO_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const SIGNATURE_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const photo = {
  id: randomUUID(),
  dataUrl: `data:image/jpeg;base64,${PHOTO_BYTES.toString('base64')}`,
  width: 640,
  height: 480,
  bytes: PHOTO_BYTES.length,
};
const signature = {
  dataUrl: `data:image/png;base64,${SIGNATURE_BYTES.toString('base64')}`,
  width: 800,
  height: 300,
  bytes: SIGNATURE_BYTES.length,
};

describe('I-06 atomic submission over real PostgreSQL', () => {
  let db: Db;
  let server: FastifyInstance;
  let store: EvidenceStore;
  let evidenceRoot: string;
  let ids: FixtureIds;
  let token: string;
  let supervisorToken: string;
  let adminToken: string;
  let signedChallanId: string;

  beforeAll(async () => {
    db = await resetAndMigrateTestDatabase();
    const seed = (await import('../../src/db/seed-domain-demo.js')) as {
      seedDomainDemoDatabase: (url: string) => Promise<unknown>;
    };
    await seed.seedDomainDemoDatabase(resolveTestDatabaseUrl());
    evidenceRoot = await mkdtemp(path.join(tmpdir(), 'echallan-evidence-'));
    store = createLocalDiskEvidenceStore(evidenceRoot);
    server = createApp({
      db,
      credentials: CREDENTIALS,
      now: () => FIXED_NOW,
      evidenceStore: store,
    });
    await server.ready();

    const one = async <T extends Record<string, unknown>>(query: string, params: unknown[] = []) =>
      (await db.pool.query<T>(query, params)).rows[0] as T;
    ids = {
      postId: (
        await one<{ id: string }>("SELECT id FROM posts WHERE demo_source_id = 'Main Gate Post'")
      ).id,
      locationId: (
        await one<{ id: string }>("SELECT id FROM locations WHERE demo_source_id = 'loc-main'")
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
      violationId: (
        await one<{ id: string }>(
          "SELECT id FROM violation_types WHERE demo_source_id = 'violation-seatbelt'",
        )
      ).id,
    };
    const login = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: CREDENTIALS.marshal,
    });
    expect(login.statusCode).toBe(200);
    const loginBody = login.json() as { token: string; post: { id: string } | null };
    token = loginBody.token;
    // The signed summary binds the same post id the client receives at login.
    ids.postId = loginBody.post?.id ?? ids.postId;
    const supervisorLogin = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: CREDENTIALS.supervisor,
    });
    expect(supervisorLogin.statusCode).toBe(200);
    supervisorToken = (supervisorLogin.json() as { token: string }).token;
    const adminLogin = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: CREDENTIALS.admin,
    });
    expect(adminLogin.statusCode).toBe(200);
    adminToken = (adminLogin.json() as { token: string }).token;
  });

  afterAll(async () => {
    if (server) await server.close();
    if (db) await db.close();
    if (evidenceRoot) await rm(evidenceRoot, { recursive: true, force: true });
  });

  function draft(overrides: Partial<EntryDraft> = {}): EntryDraft {
    return {
      vehicleRegistration: 'GJ05JP6207',
      gatePassNumber: 'AUDIT-GP-0001',
      driverName: 'Kavita Joshi',
      vehicleTypeId: ids.vehicleTypeId,
      departmentId: ids.departmentId,
      contractorId: ids.contractorId,
      violationTypeIds: [ids.violationId],
      remarks: '',
      registry: null,
      ...overrides,
    };
  }

  async function preview(value: EntryDraft): Promise<ChallanPreviewResponse> {
    const response = await server.inject({
      method: 'POST',
      url: '/challans/preview',
      headers: { authorization: `Bearer ${token}` },
      payload: { draft: value, warningAcknowledged: false },
    });
    expect(response.statusCode, response.body).toBe(200);
    return response.json() as ChallanPreviewResponse;
  }

  function request(
    value: EntryDraft,
    summary: ChallanPreviewResponse,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      operationId: randomUUID(),
      draft: value,
      photos: [photo],
      signature,
      refusal: null,
      summaryRevision: deriveSummaryRevision({
        draft: { ...value, contractorId: value.contractorId ?? '' },
        preview: summary,
        locationId: ids.postId,
      }),
      duplicateWarningAcknowledged: false,
      ...overrides,
    };
  }

  it('issues a signed challan with a server number, evidence rows, audit row and idempotent replay', async () => {
    const value = draft();
    const summary = await preview(value);
    const payload = request(value, summary);
    const first = await server.inject({
      method: 'POST',
      url: '/challans',
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
    expect(first.statusCode, first.body).toBe(201);
    const issued = first.json() as ChallanCommitResponse;
    signedChallanId = issued.id;
    expect(issued.challanNumber).toMatch(/^HZL\/EC\/2026\/10\/[0-9]{4,}$/);
    expect(issued.challanNumber).toBe('HZL/EC/2026/10/0007');
    expect(issued.replayed).toBe(false);
    expect(issued.status).toBe('Issued');

    const evidence = await db.pool.query<{ object_key: string; byte_size: number }>(
      'SELECT object_key, byte_size FROM evidence WHERE challan_id = $1',
      [issued.id],
    );
    expect(evidence.rows).toHaveLength(1);
    expect(evidence.rows[0]?.object_key).toBe(`${issued.id}/photo-1.jpg`);
    expect(evidence.rows[0]?.byte_size).toBe(PHOTO_BYTES.length);
    expect(await readFile(path.join(evidenceRoot, evidence.rows[0]!.object_key))).toEqual(
      PHOTO_BYTES,
    );

    const signatures = await db.pool.query(
      'SELECT object_key FROM signatures WHERE challan_id = $1',
      [issued.id],
    );
    expect(signatures.rows).toHaveLength(1);
    const audits = await db.pool.query<{ event_type: string }>(
      "SELECT event_type FROM audit_events WHERE challan_id = $1 AND event_type = 'challan.issued'",
      [issued.id],
    );
    expect(audits.rows).toHaveLength(1);

    const replay = await server.inject({
      method: 'POST',
      url: '/challans',
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
    expect(replay.statusCode, replay.body).toBe(200);
    const replayed = replay.json() as ChallanCommitResponse;
    expect(replayed.replayed).toBe(true);
    expect(replayed.id).toBe(issued.id);
    expect(replayed.challanNumber).toBe(issued.challanNumber);

    const count = await db.pool.query<{ n: number }>('SELECT count(*)::int AS n FROM challans');
    expect(Number(count.rows[0]?.n)).toBe(15);
  });

  it('serves evidence metadata and bytes only to authorised viewers and audits the read', async () => {
    const metadataResponse = await server.inject({
      method: 'GET',
      url: `/challans/${signedChallanId}/evidence`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(metadataResponse.statusCode, metadataResponse.body).toBe(200);
    const metadata = metadataResponse.json() as {
      photos: Array<{ id: string; ordinal: number; byteSize: number }>;
      signature: { id: string } | null;
    };
    expect(metadata.photos).toHaveLength(1);
    expect(metadata.signature).not.toBeNull();

    const photoResponse = await server.inject({
      method: 'GET',
      url: `/challans/${signedChallanId}/evidence/${metadata.photos[0]!.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(photoResponse.statusCode).toBe(200);
    expect(photoResponse.rawPayload).toEqual(PHOTO_BYTES);

    const signatureResponse = await server.inject({
      method: 'GET',
      url: `/challans/${signedChallanId}/signature`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(signatureResponse.statusCode).toBe(200);
    expect(signatureResponse.rawPayload).toEqual(SIGNATURE_BYTES);

    const anonymous = await server.inject({
      method: 'GET',
      url: `/challans/${signedChallanId}/evidence`,
    });
    expect(anonymous.statusCode).toBe(401);
    const audits = await db.pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit_events WHERE challan_id = $1 AND event_type = 'evidence.viewed'",
      [signedChallanId],
    );
    expect(Number(audits.rows[0]?.n)).toBe(2);
  });

  it('rejects reusing the operation key with different payload', async () => {
    const value = draft({ gatePassNumber: 'AUDIT-GP-0002' });
    const summary = await preview(value);
    const payload = request(value, summary);
    const first = await server.inject({
      method: 'POST',
      url: '/challans',
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
    expect(first.statusCode, first.body).toBe(201);
    const changed = await server.inject({
      method: 'POST',
      url: '/challans',
      headers: { authorization: `Bearer ${token}` },
      payload: { ...payload, draft: { ...payload.draft, driverName: 'Different Driver' } },
    });
    expect(changed.statusCode).toBe(409);
  });

  it('accepts a refusal as the acknowledgement', async () => {
    const value = draft({ gatePassNumber: 'AUDIT-GP-0003', vehicleRegistration: 'GJ05JP6208' });
    const summary = await preview(value);
    const response = await server.inject({
      method: 'POST',
      url: '/challans',
      headers: { authorization: `Bearer ${token}` },
      payload: request(value, summary, {
        signature: null,
        refusal: {
          reason: 'Driver declined to sign.',
          witnessName: 'Sunil Deshmukh',
          witnessStaffId: 'EMP-2217',
        },
      }),
    });
    expect(response.statusCode, response.body).toBe(201);
    const issued = response.json() as ChallanCommitResponse;
    const refusals = await db.pool.query('SELECT id FROM refusals WHERE challan_id = $1', [
      issued.id,
    ]);
    expect(refusals.rows).toHaveLength(1);
    const signatures = await db.pool.query('SELECT id FROM signatures WHERE challan_id = $1', [
      issued.id,
    ]);
    expect(signatures.rows).toHaveLength(0);
  });

  it('requires acknowledgement of a final duplicate warning and refuses non-marshals', async () => {
    // A prior record 5 minutes before the fixed clock makes the 15-minute
    // duplicate warning required without changing the repeat key.
    const template = (
      await db.pool.query<{ id: string }>(
        "SELECT id FROM challans WHERE demo_source_id = 'demo-challan-003'",
      )
    ).rows[0];
    expect(template).toBeDefined();
    await db.pool.query(
      `INSERT INTO challans (
         id, challan_number, gate_pass_number, vehicle_registration_number, driver_name,
         department_id, department_label_snapshot, contractor_id, contractor_label_snapshot,
         vehicle_type_id, vehicle_type_label_snapshot, location_id, gate_id, post_id, shift_id,
         issued_by_user_id, status, severity, occurrence_number, recommended_action, remarks, issued_at
       )
       SELECT $1, $2, 'AUDIT-GP-0099', 'GJ05JP6207', driver_name, department_id,
              department_label_snapshot, contractor_id, contractor_label_snapshot,
              vehicle_type_id, vehicle_type_label_snapshot, location_id, gate_id, post_id, shift_id,
              issued_by_user_id, 'Issued', severity, 1, recommended_action, remarks,
              $3::timestamptz
         FROM challans WHERE id = $4`,
      [randomUUID(), 'AUDIT-DUP-1', new Date(FIXED_NOW.getTime() - 5 * 60 * 1000), template!.id],
    );
    const value = draft({ gatePassNumber: 'AUDIT-GP-0005' });
    const summary = await preview(value);
    expect(summary.duplicateWarning.required).toBe(true);
    const unacknowledged = await server.inject({
      method: 'POST',
      url: '/challans',
      headers: { authorization: `Bearer ${token}` },
      payload: request(value, summary, { duplicateWarningAcknowledged: false }),
    });
    expect(unacknowledged.statusCode).toBe(409);
    const acknowledged = await server.inject({
      method: 'POST',
      url: '/challans',
      headers: { authorization: `Bearer ${token}` },
      payload: request(value, summary, { duplicateWarningAcknowledged: true }),
    });
    expect(acknowledged.statusCode, acknowledged.body).toBe(201);

    const notMarshal = await server.inject({
      method: 'POST',
      url: '/challans',
      headers: { authorization: `Bearer ${supervisorToken}` },
      payload: request(draft({ gatePassNumber: 'AUDIT-GP-0006' }), summary),
    });
    expect(notMarshal.statusCode).toBe(403);
  });

  it('rejects missing evidence, both acknowledgement modes and a stale summary revision', async () => {
    const value = draft({ gatePassNumber: 'AUDIT-GP-0004' });
    const summary = await preview(value);
    const noPhoto = await server.inject({
      method: 'POST',
      url: '/challans',
      headers: { authorization: `Bearer ${token}` },
      payload: request(value, summary, { photos: [] }),
    });
    expect(noPhoto.statusCode).toBe(400);
    const both = await server.inject({
      method: 'POST',
      url: '/challans',
      headers: { authorization: `Bearer ${token}` },
      payload: request(value, summary, {
        refusal: { reason: 'No', witnessName: 'Witness', witnessStaffId: 'EMP-1' },
      }),
    });
    expect(both.statusCode).toBe(400);
    const stale = await server.inject({
      method: 'POST',
      url: '/challans',
      headers: { authorization: `Bearer ${token}` },
      payload: { ...request(value, summary), summaryRevision: 'stale' },
    });
    expect(stale.statusCode).toBe(409);
  });
});
