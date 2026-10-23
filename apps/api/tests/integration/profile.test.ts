import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { ProfileResponse } from '@echallan/contracts';
import { createApp } from '../../src/app.js';
import type { Db } from '../../src/db/client.js';
import { resetAndMigrateTestDatabase, resolveTestDatabaseUrl } from './helpers/testTarget.js';

/**
 * Planner-owned real-PostgreSQL acceptance for `GET /profile`
 * (`specs/011-profile-tracking`): each role sees only its own stored details and
 * session context, with no password material.
 */

const CREDENTIALS = {
  marshal: { username: 'DEMO-EMP-004', password: 'planner-demo-marshal-secret' },
  supervisor: { username: 'DEMO-EMP-002', password: 'planner-demo-supervisor-secret' },
  admin: { username: 'DEMO-EMP-001', password: 'planner-demo-admin-secret' },
} as const;

interface LoginBody {
  token: string;
}

describe('self-service profile', () => {
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

  async function tokenFor(role: keyof typeof CREDENTIALS): Promise<string> {
    const response = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: CREDENTIALS[role],
    });
    expect(response.statusCode, response.body).toBe(200);
    return (response.json() as LoginBody).token;
  }

  async function profile(
    token?: string,
    query = '',
  ): Promise<{ status: number; body: ProfileResponse & { error?: string } }> {
    const response = await server.inject({
      method: 'GET',
      url: `/profile${query}`,
      ...(token === undefined ? {} : { headers: { authorization: `Bearer ${token}` } }),
    });
    return { status: response.statusCode, body: response.json() };
  }

  it('returns the Supervisor identity, locations and desktop session without a post', async () => {
    const token = await tokenFor('supervisor');
    const result = await profile(token);
    expect(result.status).toBe(200);
    expect(result.body.user).toStrictEqual({
      id: expect.any(String),
      username: 'DEMO-EMP-002',
      displayName: 'Sunil Deshmukh',
      employeeId: 'DEMO-EMP-002',
      role: 'Supervisor',
      isActive: true,
      locationLabels: ['Demo industrial campus — main entrance'],
    });
    expect(result.body.session.post).toBeNull();
    expect(result.body.session.shift).toBeNull();
    expect(new Date(result.body.session.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const serialised = JSON.stringify(result.body).toLowerCase();
    expect(serialised).not.toContain('password');
    expect(serialised).not.toContain('$argon2');
  });

  it('returns the Marshal post and shift context', async () => {
    const token = await tokenFor('marshal');
    const result = await profile(token);
    expect(result.status).toBe(200);
    expect(result.body.user.role).toBe('Marshal');
    expect(result.body.user.username).toBe('DEMO-EMP-004');
    expect(result.body.session.post?.label).toBe('DEMO-POST-01');
    expect(result.body.session.shift?.label).toBeTruthy();
    expect(result.body.user.locationLabels).toEqual(['Demo industrial campus — main entrance']);
  });

  it('returns the Admin with all assigned locations', async () => {
    const token = await tokenFor('admin');
    const result = await profile(token);
    expect(result.status).toBe(200);
    expect(result.body.user.displayName).toBe('Meera Shah');
    expect(result.body.user.role).toBe('Admin');
    expect(result.body.user.locationLabels).toHaveLength(2);
    expect(result.body.session.post).toBeNull();
  });

  it('ignores a query attempt to read another user', async () => {
    const token = await tokenFor('supervisor');
    const admin = await tokenFor('admin');
    const adminProfile = await profile(admin);
    const result = await profile(token, `?userId=${adminProfile.body.user.id}`);
    expect(result.status).toBe(200);
    expect(result.body.user.username).toBe('DEMO-EMP-002');
    expect(result.body.user.id).not.toBe(adminProfile.body.user.id);
  });

  it('refuses an anonymous profile request', async () => {
    const result = await profile();
    expect(result.status).toBe(401);
    expect(result.body.error).toBe('unauthenticated');
  });
});
