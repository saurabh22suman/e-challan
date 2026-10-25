import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app.js';
import type { Db } from '../../src/db/client.js';
import { resetAndMigrateTestDatabase, resolveTestDatabaseUrl } from './helpers/testTarget.js';

/**
 * Planner-owned real-PostgreSQL acceptance for Admin user management
 * (`specs/010-user-management`): create for every role, duplicate/location
 * validation, deactivation as removal, session revocation, reactivation and the
 * self-lockout guard. Password reset remains covered by the 009 suite.
 */

const CREDENTIALS = {
  marshal: { username: 'EMP-3106', password: 'planner-demo-marshal-secret' },
  supervisor: { username: 'EMP-2217', password: 'planner-demo-supervisor-secret' },
  admin: { username: 'EMP-1042', password: 'planner-demo-admin-secret' },
} as const;

const SUP_USER = 'SUP-CREATE-001';
const SUP_PASSWORD = 'new-supervisor-password-2026';
const ADMIN_USER = 'ADM-CREATE-002';
const ADMIN_PASSWORD = 'new-admin-password-2026';
const MARSHAL_USER = 'MAR-CREATE-003';
const MARSHAL_PASSWORD = 'new-marshal-password-2026';

interface LoginBody {
  token: string;
  user: { id: string; username: string; role: string };
  post: { id: string; label: string } | null;
}

describe('Admin user management over real PostgreSQL', () => {
  let db: Db;
  let server: FastifyInstance;
  let adminToken: string;
  let mainLocationId: string;

  beforeAll(async () => {
    db = await resetAndMigrateTestDatabase();
    const seed = (await import('../../src/db/seed-domain-demo.js')) as {
      seedDomainDemoDatabase: (url: string) => Promise<unknown>;
    };
    await seed.seedDomainDemoDatabase(resolveTestDatabaseUrl());
    server = createApp({ db, credentials: CREDENTIALS });
    await server.ready();

    const location = await db.pool.query<{ id: string }>(
      "SELECT id FROM locations WHERE demo_source_id = 'loc-main'",
    );
    mainLocationId = location.rows[0]?.id as string;
    expect(mainLocationId, 'the seeded main location is required').toBeTruthy();

    const login = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: CREDENTIALS.admin,
    });
    expect(login.statusCode).toBe(200);
    adminToken = (login.json() as LoginBody).token;
  });

  afterAll(async () => {
    if (server) await server.close();
    if (db) await db.close();
  });

  async function login(username: string, password: string) {
    const response = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username, password },
    });
    return { status: response.statusCode, body: response.json() as LoginBody };
  }

  async function tokenFor(role: keyof typeof CREDENTIALS): Promise<string> {
    const result = await login(CREDENTIALS[role].username, CREDENTIALS[role].password);
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    return result.body.token;
  }

  function create(
    token: string,
    payload: Record<string, unknown>,
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    return server
      .inject({
        method: 'POST',
        url: '/admin/users',
        headers: { authorization: `Bearer ${token}` },
        payload,
      })
      .then((response) => ({
        status: response.statusCode,
        body: response.json() as Record<string, unknown>,
      }));
  }

  function action(
    token: string,
    id: string,
    verb: 'deactivate' | 'reactivate',
  ): Promise<{ status: number; body: unknown }> {
    return server
      .inject({
        method: 'POST',
        url: `/admin/users/${id}/${verb}`,
        headers: { authorization: `Bearer ${token}` },
      })
      .then((response) => ({
        status: response.statusCode,
        body: response.statusCode === 204 ? null : response.json(),
      }));
  }

  async function userId(username: string): Promise<string> {
    const result = await db.pool.query<{ id: string }>('SELECT id FROM users WHERE username = $1', [
      username,
    ]);
    return result.rows[0]?.id as string;
  }

  const BASE_SUPERVISOR = {
    username: SUP_USER,
    displayName: 'Nina Rao',
    employeeId: 'EMP-101',
    role: 'Supervisor',
    locationIds: [] as string[],
    password: SUP_PASSWORD,
  };

  describe('create', () => {
    it('creates a Supervisor with an Argon2id password and a usable, scoped session', async () => {
      const created = await create(adminToken, {
        ...BASE_SUPERVISOR,
        locationIds: [mainLocationId],
      });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const user = created.body['user'] as {
        id: string;
        username: string;
        role: string;
        isActive: boolean;
        locationLabels: string[];
      };
      expect(user.username).toBe(SUP_USER);
      expect(user.role).toBe('Supervisor');
      expect(user.isActive).toBe(true);
      expect(user.locationLabels).toEqual(['Hazira Industrial Estate — Main Gate']);
      expect(JSON.stringify(created.body).toLowerCase()).not.toContain('password');
      expect(JSON.stringify(created.body)).not.toContain('$argon2');

      const stored = await db.pool.query<{ password_hash: string }>(
        'SELECT password_hash FROM users WHERE username = $1',
        [SUP_USER],
      );
      expect(stored.rows[0]?.password_hash.startsWith('$argon2id$')).toBe(true);

      const loggedIn = await login(SUP_USER, SUP_PASSWORD);
      expect(loggedIn.status, JSON.stringify(loggedIn.body)).toBe(200);
      expect(loggedIn.body.user.role).toBe('Supervisor');

      const lowerCaseLogin = await login(SUP_USER.toLowerCase(), SUP_PASSWORD);
      expect(lowerCaseLogin.status, JSON.stringify(lowerCaseLogin.body)).toBe(200);
      expect(lowerCaseLogin.body.user.username).toBe(SUP_USER);
      expect(lowerCaseLogin.body.user.role).toBe('Supervisor');

      const list = await server.inject({
        method: 'GET',
        url: '/challans',
        headers: { authorization: `Bearer ${loggedIn.body.token}` },
      });
      expect(list.statusCode).toBe(200);
      const items = (list.json() as { items: Array<{ locationLabel: string }> }).items;
      expect(items).toHaveLength(8);
      expect(
        items.every((item) => item.locationLabel === 'Hazira Industrial Estate — Main Gate'),
      ).toBe(true);
    });

    it('creates an Admin with no location assignment and a Marshal bound to its post', async () => {
      const admin = await create(adminToken, {
        ...BASE_SUPERVISOR,
        username: ADMIN_USER,
        displayName: 'New Admin',
        employeeId: undefined,
        role: 'Admin',
        locationIds: [],
        password: ADMIN_PASSWORD,
      });
      expect(admin.status, JSON.stringify(admin.body)).toBe(201);
      const adminLogin = await login(ADMIN_USER, ADMIN_PASSWORD);
      expect(adminLogin.status).toBe(200);
      expect(adminLogin.body.user.role).toBe('Admin');
      expect(adminLogin.body.post).toBeNull();

      const marshal = await create(adminToken, {
        ...BASE_SUPERVISOR,
        username: MARSHAL_USER,
        displayName: 'New Marshal',
        role: 'Marshal',
        locationIds: [mainLocationId],
        password: MARSHAL_PASSWORD,
      });
      expect(marshal.status, JSON.stringify(marshal.body)).toBe(201);
      const marshalLogin = await login(MARSHAL_USER, MARSHAL_PASSWORD);
      expect(marshalLogin.status).toBe(200);
      expect(marshalLogin.body.user.role).toBe('Marshal');
      expect(marshalLogin.body.post?.label).toBe('Main Gate Post');
    });

    it('refuses duplicates, missing locations, inactive locations and non-Admins', async () => {
      const duplicate = await create(adminToken, {
        ...BASE_SUPERVISOR,
        locationIds: [mainLocationId],
      });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body['error']).toBe('conflict');

      const caseVariant = await create(adminToken, {
        ...BASE_SUPERVISOR,
        username: SUP_USER.toLowerCase(),
        locationIds: [mainLocationId],
      });
      expect(caseVariant.status).toBe(409);
      expect(caseVariant.body['error']).toBe('conflict');

      for (const role of ['Marshal', 'Supervisor']) {
        const missing = await create(adminToken, {
          ...BASE_SUPERVISOR,
          username: `MISSING-${role}`,
          role,
          locationIds: [],
        });
        expect(missing.status).toBe(400);
        expect(missing.body['error']).toBe('invalid_request');
      }

      await db.pool.query('UPDATE locations SET is_active = false WHERE id = $1', [mainLocationId]);
      const inactive = await create(adminToken, {
        ...BASE_SUPERVISOR,
        username: 'INACTIVE-LOC-USER',
        locationIds: [mainLocationId],
      });
      await db.pool.query('UPDATE locations SET is_active = true WHERE id = $1', [mainLocationId]);
      expect(inactive.status).toBe(400);

      const supervisorToken = await tokenFor('supervisor');
      const denied = await create(supervisorToken, {
        ...BASE_SUPERVISOR,
        username: 'DENIED-USER',
        locationIds: [mainLocationId],
      });
      expect(denied.status).toBe(403);

      const anonymous = await server.inject({
        method: 'POST',
        url: '/admin/users',
        payload: { ...BASE_SUPERVISOR, locationIds: [mainLocationId] },
      });
      expect(anonymous.statusCode).toBe(401);
    });

    it('audits creation without password material', async () => {
      const audit = await db.pool.query<{ payload: Record<string, unknown> }>(
        `SELECT payload FROM audit_events
         WHERE event_type = 'user.created' AND payload->>'username' = $1`,
        [SUP_USER],
      );
      expect(audit.rows).toHaveLength(1);
      expect(JSON.stringify(audit.rows)).not.toContain(SUP_PASSWORD);
      expect(JSON.stringify(audit.rows)).not.toContain('$argon2');
    });
  });

  describe('deactivate and reactivate', () => {
    it('deactivates as removal, revokes sessions and blocks sign-in until reactivated', async () => {
      const id = await userId(SUP_USER);
      const live = await login(SUP_USER, SUP_PASSWORD);
      expect(live.status).toBe(200);

      const deactivated = await action(adminToken, id, 'deactivate');
      expect(deactivated.status).toBe(204);

      const session = await server.inject({
        method: 'GET',
        url: '/auth/session',
        headers: { authorization: `Bearer ${live.body.token}` },
      });
      expect(session.statusCode).toBe(401);

      const refused = await login(SUP_USER, SUP_PASSWORD);
      expect(refused.status).toBe(401);

      const row = await db.pool.query<{ is_active: boolean }>(
        'SELECT is_active FROM users WHERE id = $1',
        [id],
      );
      expect(row.rows[0]?.is_active).toBe(false);

      const users = await server.inject({
        method: 'GET',
        url: '/admin/users',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const body = users.json() as { users: Array<{ id: string; isActive: boolean }> };
      expect(body.users.find((user) => user.id === id)?.isActive).toBe(false);

      const repeated = await action(adminToken, id, 'deactivate');
      expect(repeated.status).toBe(204);

      const reactivated = await action(adminToken, id, 'reactivate');
      expect(reactivated.status).toBe(204);
      const after = await login(SUP_USER, SUP_PASSWORD);
      expect(after.status).toBe(200);

      const repeatedReactivate = await action(adminToken, id, 'reactivate');
      expect(repeatedReactivate.status).toBe(204);

      const audit = await db.pool.query<{ event_type: string }>(
        `SELECT event_type FROM audit_events
         WHERE payload->>'userId' = $1 AND event_type IN ('user.deactivated','user.reactivated')
         ORDER BY created_at`,
        [id],
      );
      expect(audit.rows.map((row) => row.event_type)).toEqual([
        'user.deactivated',
        'user.reactivated',
      ]);
    });

    it('refuses self-deactivation and non-Admin callers', async () => {
      const self = await db.pool.query<{ id: string }>('SELECT id FROM users WHERE username = $1', [
        CREDENTIALS.admin.username,
      ]);
      const refused = await action(adminToken, self.rows[0]?.id as string, 'deactivate');
      expect(refused.status).toBe(400);
      expect((refused.body as { error: string }).error).toBe('invalid_request');

      const supervisorToken = await tokenFor('supervisor');
      const denied = await action(supervisorToken, await userId(SUP_USER), 'deactivate');
      expect(denied.status).toBe(403);

      const unknown = await action(
        adminToken,
        '00000000-0000-4000-8000-999999999999',
        'deactivate',
      );
      expect(unknown.status).toBe(404);
      const malformed = await action(adminToken, 'not-a-uuid', 'deactivate');
      expect(malformed.status).toBe(404);
    });

    it('keeps a reset password usable across deactivation and reactivation', async () => {
      const id = await userId(SUP_USER);
      const newPassword = 'reactivated-reset-password-2026';
      const reset = await server.inject({
        method: 'POST',
        url: `/admin/users/${id}/reset-password`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { password: newPassword },
      });
      expect(reset.statusCode).toBe(204);

      expect((await action(adminToken, id, 'deactivate')).status).toBe(204);
      expect((await action(adminToken, id, 'reactivate')).status).toBe(204);
      const loginAfter = await login(SUP_USER, newPassword);
      expect(loginAfter.status).toBe(200);
    });
  });
});
