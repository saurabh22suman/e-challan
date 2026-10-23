import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app.js';
import type { Db } from '../../src/db/client.js';
import { resetAndMigrateTestDatabase, resolveTestDatabaseUrl } from './helpers/testTarget.js';

/**
 * Planner-owned real-PostgreSQL acceptance for the bounded review and
 * user-administration slice (`specs/009-review-admin-basics`).
 *
 * Cases: REV-01 (scoped list/filter/detail), REV-02 (approved transitions,
 * mandatory action/remarks, performer, immutable issued fields, audit),
 * ADM-01 reset subset, AUTH-02 and AUTH-06 hash/reset subset.
 *
 * The suite proves behavior against real stored assignments, statuses, action
 * history and Argon2id hashes. It does not replace real-device or browser
 * evidence; the browser limitation for review mutations is recorded in the
 * feature specification.
 */

const CREDENTIALS = {
  marshal: { username: 'DEMO-EMP-004', password: 'planner-demo-marshal-secret' },
  supervisor: { username: 'DEMO-EMP-002', password: 'planner-demo-supervisor-secret' },
  admin: { username: 'DEMO-EMP-001', password: 'planner-demo-admin-secret' },
} as const;

const MAIN_ISSUED = 'DEMO/2026/10/0005';
const MAIN_ISSUED_FOR_INVALID = 'DEMO/2026/10/0004';
const MAIN_RESOLVED = 'DEMO/2026/09/0004';
const MAIN_RESOLVED_REOPEN_DENIED = 'DEMO/2026/06/0001';
const MAIN_CANCELLED = 'DEMO/2026/09/0005';
const MAIN_UNDER_REVIEW = 'DEMO/2026/09/0001';
const DISPATCH_ISSUED = 'DEMO/2026/10/0002';
const DISPATCH_ISSUED_FOR_ADMIN = 'DEMO/2026/09/0003';

const DISPATCH_SUPERVISOR = {
  username: 'DEMO-EMP-003',
  password: 'reset-dispatch-supervisor-secret-1',
} as const;

interface LoginBody {
  token: string;
  user: { id: string; username: string; role: string };
}

interface ListItem {
  id: string;
  challanNumber: string;
  status: string;
  severity: string;
  occurrenceNumber: number;
  recommendedAction: string;
  gatePassNumber: string;
  vehicleRegistrationNumber: string;
  driverName: string;
  locationId: string;
  locationLabel: string;
  issuedAt: string;
}

interface DetailBody extends ListItem {
  issuedBy: { id: string; username: string; displayName: string };
  departmentLabel: string;
  contractorLabel: string | null;
  vehicleTypeLabel: string;
  gateLabel: string;
  remarks: string | null;
  violations: Array<{ label: string; severity: string }>;
  actions: Array<{
    id: string;
    toStatus: string;
    action: string | null;
    remarks: string | null;
    reason: string | null;
    performerUserId: string;
    performerUsername: string;
    performerDisplayName: string;
    createdAt: string;
  }>;
  reopenedAt: string | null;
  reopenedByUserId: string | null;
  reopeningReason: string | null;
  cancellationReason: string | null;
}

describe('review and user administration over real PostgreSQL', () => {
  let db: Db;
  let server: FastifyInstance;

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
    username: string,
    password: string,
  ): Promise<{ status: number; body: unknown }> {
    const response = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username, password },
    });
    return { status: response.statusCode, body: response.json() };
  }

  async function tokenFor(role: keyof typeof CREDENTIALS): Promise<string> {
    const result = await login(CREDENTIALS[role].username, CREDENTIALS[role].password);
    expect(result.status, `login failed: ${JSON.stringify(result.body)}`).toBe(200);
    return (result.body as LoginBody).token;
  }

  async function challanId(challanNumber: string): Promise<string> {
    const result = await db.pool.query<{ id: string; status: string }>(
      'SELECT id, status FROM challans WHERE challan_number = $1',
      [challanNumber],
    );
    expect(result.rows[0], `seeded challan ${challanNumber} is required`).toBeDefined();
    return result.rows[0]?.id as string;
  }

  async function statusOf(id: string): Promise<string> {
    const result = await db.pool.query<{ status: string }>(
      'SELECT status FROM challans WHERE id = $1',
      [id],
    );
    return result.rows[0]?.status as string;
  }

  async function list(
    token: string | undefined,
    query = '',
  ): Promise<{ status: number; body: { items?: ListItem[]; error?: string; message?: string } }> {
    const response = await server.inject({
      method: 'GET',
      url: `/challans${query}`,
      ...(token === undefined ? {} : { headers: { authorization: `Bearer ${token}` } }),
    });
    return { status: response.statusCode, body: response.json() };
  }

  async function detail(
    token: string,
    id: string,
  ): Promise<{ status: number; body: DetailBody & { error?: string; message?: string } }> {
    const response = await server.inject({
      method: 'GET',
      url: `/challans/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    return { status: response.statusCode, body: response.json() };
  }

  async function review(
    token: string,
    id: string,
    payload: Record<string, unknown>,
  ): Promise<{ status: number; body: DetailBody & { error?: string; message?: string } }> {
    const response = await server.inject({
      method: 'POST',
      url: `/challans/${id}/review`,
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
    return { status: response.statusCode, body: response.json() };
  }

  describe('REV-01: role-scoped list and detail', () => {
    it('requires a session and refuses a Marshal list', async () => {
      expect((await list(undefined)).status).toBe(401);

      const marshal = await tokenFor('marshal');
      const refused = await list(marshal);
      expect(refused.status).toBe(403);
      expect(refused.body.error).toBe('forbidden');
    });

    it('shows a Supervisor only assigned-location challans and an Admin every location', async () => {
      const supervisor = await tokenFor('supervisor');
      const supervisorList = await list(supervisor);
      expect(supervisorList.status).toBe(200);
      const supervisorItems = supervisorList.body.items as ListItem[];
      expect(supervisorItems).toHaveLength(8);
      expect(
        supervisorItems.every(
          (item) => item.locationLabel === 'Demo industrial campus — main entrance',
        ),
      ).toBe(true);
      expect(supervisorItems.some((item) => item.challanNumber === DISPATCH_ISSUED)).toBe(false);

      const admin = await tokenFor('admin');
      const adminList = await list(admin);
      expect(adminList.status).toBe(200);
      const adminItems = adminList.body.items as ListItem[];
      expect(adminItems).toHaveLength(14);
      expect(new Set(adminItems.map((item) => item.locationLabel)).size).toBe(2);
      expect(adminItems.map((item) => item.challanNumber)).toContain(DISPATCH_ISSUED);
    });

    it('filters by exact status and rejects an unknown filter', async () => {
      const supervisor = await tokenFor('supervisor');
      const issued = await list(supervisor, '?status=Issued');
      expect(issued.status).toBe(200);
      const items = issued.body.items as ListItem[];
      expect(items).toHaveLength(3);
      expect(items.every((item) => item.status === 'Issued')).toBe(true);

      const cancelled = await list(supervisor, '?status=Cancelled');
      expect(cancelled.status).toBe(200);
      expect((cancelled.body.items as ListItem[]).map((item) => item.challanNumber)).toEqual([
        MAIN_CANCELLED,
      ]);

      const invalid = await list(supervisor, '?status=Pending');
      expect(invalid.status).toBe(400);
      expect(invalid.body.error).toBe('invalid_request');
    });

    it('returns violations, location labels and append-only history in detail', async () => {
      const supervisor = await tokenFor('supervisor');
      const resolvedId = await challanId(MAIN_RESOLVED);
      const resolved = await detail(supervisor, resolvedId);
      expect(resolved.status).toBe(200);
      expect(resolved.body.locationLabel).toBe('Demo industrial campus — main entrance');
      expect(resolved.body.issuedBy.username).toBe('DEMO-EMP-004');
      expect(resolved.body.issuedBy.displayName).toBe('Ravi Patel');
      expect(resolved.body.violations.length).toBeGreaterThan(0);
      expect(resolved.body.actions).toHaveLength(1);
      expect(resolved.body.actions[0]?.toStatus).toBe('Resolved');
      expect(resolved.body.actions[0]?.performerUsername).toBe('DEMO-EMP-002');
      expect(resolved.body.remarks).toContain('Synthetic');

      const underReview = await detail(supervisor, await challanId(MAIN_UNDER_REVIEW));
      expect(underReview.status).toBe(200);
      expect(underReview.body.actions).toEqual([]);
    });

    it('keeps detail location-scoped for a Supervisor', async () => {
      const supervisor = await tokenFor('supervisor');
      const refused = await detail(supervisor, await challanId(DISPATCH_ISSUED));
      expect(refused.status).toBe(403);
      expect(refused.body.error).toBe('forbidden');
      expect(JSON.stringify(refused.body)).not.toContain('DEMO/2026');
    });
  });

  describe('REV-02: approved transitions, performer and immutable issued fields', () => {
    it('moves Issued → Under Review → Resolved with action, remarks and the session performer', async () => {
      const supervisor = await tokenFor('supervisor');
      const id = await challanId(MAIN_ISSUED);
      const before = await detail(supervisor, id);
      expect(before.status).toBe(200);
      expect(before.body.status).toBe('Issued');

      const started = await review(supervisor, id, { to: 'Under Review' });
      expect(started.status, JSON.stringify(started.body)).toBe(200);
      expect(started.body.status).toBe('Under Review');
      expect(started.body.actions.map((action) => action.toStatus)).toEqual(['Under Review']);
      expect(started.body.actions[0]?.performerUsername).toBe('DEMO-EMP-002');

      const resolved = await review(supervisor, id, {
        to: 'Resolved',
        action: 'warning_issued',
        remarks: 'Warning issued and acknowledged at the gate.',
      });
      expect(resolved.status, JSON.stringify(resolved.body)).toBe(200);
      expect(resolved.body.status).toBe('Resolved');
      expect(resolved.body.actions.map((action) => action.toStatus)).toEqual([
        'Under Review',
        'Resolved',
      ]);
      expect(resolved.body.actions[1]?.action).toBe('warning_issued');
      expect(resolved.body.actions[1]?.remarks).toBe(
        'Warning issued and acknowledged at the gate.',
      );
      expect(resolved.body.actions[1]?.performerUsername).toBe('DEMO-EMP-002');

      // Issued fields are not rewritten by a review transition.
      for (const field of [
        'challanNumber',
        'severity',
        'occurrenceNumber',
        'recommendedAction',
        'gatePassNumber',
        'vehicleRegistrationNumber',
        'driverName',
        'locationId',
        'locationLabel',
        'issuedAt',
      ] as const) {
        expect(resolved.body[field], `${field} must remain the issued value`).toEqual(
          before.body[field],
        );
      }

      const audits = await db.pool.query<{ event_type: string; payload: Record<string, unknown> }>(
        `SELECT event_type, payload FROM audit_events
         WHERE challan_id = $1 AND event_type = 'challan.status_changed'
         ORDER BY created_at`,
        [id],
      );
      expect(audits.rows).toHaveLength(2);
      expect(audits.rows.map((row) => row.payload['to'])).toEqual(['Under Review', 'Resolved']);
      expect(audits.rows.every((row) => row.payload['synthetic'] !== true)).toBe(true);
    });

    it('rejects a direct Issued → Resolved jump', async () => {
      const supervisor = await tokenFor('supervisor');
      const id = await challanId(MAIN_ISSUED_FOR_INVALID);
      const refused = await review(supervisor, id, {
        to: 'Resolved',
        action: 'warning_issued',
        remarks: 'Skipping Under Review must not work.',
      });
      expect(refused.status).toBe(409);
      expect(refused.body.error).toBe('invalid_transition');
      expect(await statusOf(id)).toBe('Issued');
    });

    it('requires nonblank remarks on resolution', async () => {
      const supervisor = await tokenFor('supervisor');
      const id = await challanId(MAIN_ISSUED_FOR_INVALID);
      const started = await review(supervisor, id, { to: 'Under Review' });
      expect(started.status).toBe(200);

      const blank = await review(supervisor, id, {
        to: 'Resolved',
        action: 'warning_issued',
        remarks: '   ',
      });
      expect(blank.status).toBe(400);
      expect(blank.body.error).toBe('invalid_request');
      expect(await statusOf(id)).toBe('Under Review');

      const valid = await review(supervisor, id, {
        to: 'Resolved',
        action: 'custom',
        remarks: 'Custom follow-up completed with the driver.',
      });
      expect(valid.status).toBe(200);
      expect(valid.body.status).toBe('Resolved');
    });

    it('treats Cancelled as terminal and keeps it unchanged', async () => {
      const supervisor = await tokenFor('supervisor');
      const id = await challanId(MAIN_CANCELLED);
      const refused = await review(supervisor, id, {
        to: 'Resolved',
        action: 'warning_issued',
        remarks: 'A cancelled record must not resolve.',
      });
      expect(refused.status).toBe(409);
      expect(refused.body.error).toBe('invalid_transition');
      expect(await statusOf(id)).toBe('Cancelled');
    });

    it('refuses a Supervisor acting outside an assigned location and a Marshal entirely', async () => {
      const supervisor = await tokenFor('supervisor');
      const dispatchId = await challanId(DISPATCH_ISSUED);
      const outOfScope = await review(supervisor, dispatchId, { to: 'Under Review' });
      expect(outOfScope.status).toBe(403);
      expect(await statusOf(dispatchId)).toBe('Issued');

      const marshal = await tokenFor('marshal');
      const marshalRefused = await review(marshal, await challanId(MAIN_UNDER_REVIEW), {
        to: 'Resolved',
        action: 'warning_issued',
        remarks: 'A marshal must not review.',
      });
      expect(marshalRefused.status).toBe(403);
    });

    it('lets an Admin review across locations', async () => {
      const admin = await tokenFor('admin');
      const id = await challanId(DISPATCH_ISSUED_FOR_ADMIN);
      const started = await review(admin, id, { to: 'Under Review' });
      expect(started.status).toBe(200);
      expect((await detail(admin, id)).body.actions[0]?.performerUsername).toBe('DEMO-EMP-001');
    });

    it('lets only an Admin reopen a Resolved challan, with a mandatory reason', async () => {
      const supervisor = await tokenFor('supervisor');
      const resolvedId = await challanId(MAIN_RESOLVED_REOPEN_DENIED);
      const denied = await review(supervisor, resolvedId, {
        to: 'Under Review',
        reason: 'Supervisor reopen must fail.',
      });
      expect(denied.status).toBe(403);

      const admin = await tokenFor('admin');
      const missingReason = await review(admin, resolvedId, { to: 'Under Review' });
      expect(missingReason.status).toBe(400);
      expect(missingReason.body.error).toBe('invalid_request');

      const reopened = await review(admin, resolvedId, {
        to: 'Under Review',
        reason: 'New evidence requires another review.',
      });
      expect(reopened.status, JSON.stringify(reopened.body)).toBe(200);
      expect(reopened.body.status).toBe('Under Review');
      expect(reopened.body.reopeningReason).toBe('New evidence requires another review.');
      expect(reopened.body.reopenedAt).not.toBeNull();
      expect(reopened.body.actions.at(-1)?.reason).toBe('New evidence requires another review.');
      expect(reopened.body.actions.at(-1)?.performerUsername).toBe('DEMO-EMP-001');
    });

    it('allows only an Admin to cancel with a mandatory reason, retains history and is terminal', async () => {
      const supervisor = await tokenFor('supervisor');
      const id = await challanId(MAIN_ISSUED_FOR_INVALID);
      const denied = await review(supervisor, id, {
        to: 'Cancelled',
        reason: 'A supervisor must not cancel.',
      });
      expect(denied.status).toBe(403);

      const admin = await tokenFor('admin');
      const missingReason = await review(admin, id, { to: 'Cancelled' });
      expect(missingReason.status).toBe(400);
      expect(missingReason.body.error).toBe('invalid_request');

      const cancelled = await review(admin, id, {
        to: 'Cancelled',
        reason: 'Duplicate paper record; retained for audit.',
      });
      expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
      expect(cancelled.body.status).toBe('Cancelled');
      expect(cancelled.body.cancellationReason).toBe('Duplicate paper record; retained for audit.');
      expect(cancelled.body.actions.at(-1)?.toStatus).toBe('Cancelled');
      expect(cancelled.body.actions.at(-1)?.reason).toBe(
        'Duplicate paper record; retained for audit.',
      );
      expect(cancelled.body.actions.at(-1)?.performerUsername).toBe('DEMO-EMP-001');

      const terminal = await review(admin, id, { to: 'Under Review' });
      expect(terminal.status).toBe(409);
      expect(await statusOf(id)).toBe('Cancelled');
    });
  });

  describe('ADM-01/AUTH-06 subset: Admin user list and Argon2id reset', () => {
    it('lists users only for an Admin and never returns password material', async () => {
      for (const role of ['marshal', 'supervisor'] as const) {
        const token = await tokenFor(role);
        const response = await server.inject({
          method: 'GET',
          url: '/admin/users',
          headers: { authorization: `Bearer ${token}` },
        });
        expect(response.statusCode).toBe(403);
      }

      const anonymous = await server.inject({ method: 'GET', url: '/admin/users' });
      expect(anonymous.statusCode).toBe(401);

      const admin = await tokenFor('admin');
      const response = await server.inject({
        method: 'GET',
        url: '/admin/users',
        headers: { authorization: `Bearer ${admin}` },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json() as {
        users: Array<{
          id: string;
          username: string;
          displayName: string;
          role: string;
          isActive: boolean;
          locationLabels: string[];
        }>;
      };
      expect(body.users).toHaveLength(5);
      expect(body.users.map((user) => user.username).sort()).toEqual([
        'DEMO-EMP-001',
        'DEMO-EMP-002',
        'DEMO-EMP-003',
        'DEMO-EMP-004',
        'DEMO-EMP-005',
      ]);
      expect(JSON.stringify(body).toLowerCase()).not.toContain('password');
      expect(JSON.stringify(body)).not.toContain('$argon2');
    });

    it('refuses non-Admins, short passwords, unknown users and malformed ids', async () => {
      const supervisor = await tokenFor('supervisor');
      const target = '00000000-0000-4000-8000-000000000003';
      const denied = await server.inject({
        method: 'POST',
        url: `/admin/users/${target}/reset-password`,
        headers: { authorization: `Bearer ${supervisor}` },
        payload: { password: 'a-long-enough-password' },
      });
      expect(denied.statusCode).toBe(403);

      const admin = await tokenFor('admin');
      const short = await server.inject({
        method: 'POST',
        url: `/admin/users/${target}/reset-password`,
        headers: { authorization: `Bearer ${admin}` },
        payload: { password: 'short' },
      });
      expect(short.statusCode).toBe(400);

      const unknown = await server.inject({
        method: 'POST',
        url: '/admin/users/00000000-0000-4000-8000-999999999999/reset-password',
        headers: { authorization: `Bearer ${admin}` },
        payload: { password: 'a-long-enough-password' },
      });
      expect(unknown.statusCode).toBe(404);

      const malformed = await server.inject({
        method: 'POST',
        url: '/admin/users/not-a-uuid/reset-password',
        headers: { authorization: `Bearer ${admin}` },
        payload: { password: 'a-long-enough-password' },
      });
      expect(malformed.statusCode).toBe(404);
    });

    it('stores Argon2id, lets the reset user sign in, revokes old sessions and takes effect immediately', async () => {
      const admin = await tokenFor('admin');
      const target = await db.pool.query<{ id: string }>(
        'SELECT id FROM users WHERE username = $1',
        [DISPATCH_SUPERVISOR.username],
      );
      const targetId = target.rows[0]?.id as string;

      const firstReset = await server.inject({
        method: 'POST',
        url: `/admin/users/${targetId}/reset-password`,
        headers: { authorization: `Bearer ${admin}` },
        payload: { password: DISPATCH_SUPERVISOR.password },
      });
      expect(firstReset.statusCode).toBe(204);
      expect(firstReset.body).toBe('');

      const stored = await db.pool.query<{ password_hash: string | null }>(
        'SELECT password_hash FROM users WHERE id = $1',
        [targetId],
      );
      const hash = stored.rows[0]?.password_hash as string;
      expect(hash.startsWith('$argon2id$'), `unexpected hash: ${hash}`).toBe(true);
      expect(hash).not.toContain(DISPATCH_SUPERVISOR.password);

      const firstLogin = await login(DISPATCH_SUPERVISOR.username, DISPATCH_SUPERVISOR.password);
      expect(firstLogin.status, JSON.stringify(firstLogin.body)).toBe(200);
      expect((firstLogin.body as LoginBody).user.role).toBe('Supervisor');
      const firstToken = (firstLogin.body as LoginBody).token;

      const secondPassword = 'reset-dispatch-supervisor-secret-2';
      const secondReset = await server.inject({
        method: 'POST',
        url: `/admin/users/${targetId}/reset-password`,
        headers: { authorization: `Bearer ${admin}` },
        payload: { password: secondPassword },
      });
      expect(secondReset.statusCode).toBe(204);

      const revoked = await server.inject({
        method: 'GET',
        url: '/auth/session',
        headers: { authorization: `Bearer ${firstToken}` },
      });
      expect(revoked.statusCode).toBe(401);

      const oldPassword = await login(DISPATCH_SUPERVISOR.username, DISPATCH_SUPERVISOR.password);
      expect(oldPassword.status).toBe(401);
      const newPassword = await login(DISPATCH_SUPERVISOR.username, secondPassword);
      expect(newPassword.status).toBe(200);

      const audit = await db.pool.query<{
        payload: Record<string, unknown>;
        actor_user_id: string;
      }>(
        `SELECT payload, actor_user_id FROM audit_events
         WHERE event_type = 'user.password_reset' AND payload->>'userId' = $1
         ORDER BY created_at`,
        [targetId],
      );
      expect(audit.rows).toHaveLength(2);
      expect(JSON.stringify(audit.rows)).not.toContain(secondPassword);
      expect(JSON.stringify(audit.rows)).not.toContain('$argon2');
      expect(audit.rows[0]?.actor_user_id).toBe(
        (
          await db.pool.query<{ id: string }>('SELECT id FROM users WHERE username = $1', [
            'DEMO-EMP-001',
          ])
        ).rows[0]?.id,
      );
    });

    it('keeps a disabled user unable to sign in even after a reset', async () => {
      const admin = await tokenFor('admin');
      const target = await db.pool.query<{ id: string }>(
        'SELECT id FROM users WHERE username = $1',
        ['DEMO-EMP-005'],
      );
      const targetId = target.rows[0]?.id as string;
      await db.pool.query('UPDATE users SET is_active = false WHERE id = $1', [targetId]);

      const reset = await server.inject({
        method: 'POST',
        url: `/admin/users/${targetId}/reset-password`,
        headers: { authorization: `Bearer ${admin}` },
        payload: { password: 'disabled-user-reset-secret' },
      });
      expect(reset.statusCode).toBe(204);

      const refused = await login('DEMO-EMP-005', 'disabled-user-reset-secret');
      expect(refused.status).toBe(401);

      await db.pool.query('UPDATE users SET is_active = true WHERE id = $1', [targetId]);
    });
  });
});
