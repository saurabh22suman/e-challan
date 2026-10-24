import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app.js';
import { createHandoff } from '../../src/auth/handoff.js';
import { resolveSession } from '../../src/auth/session.js';
import type { Db } from '../../src/db/client.js';
import { resetAndMigrateTestDatabase, resolveTestDatabaseUrl } from './helpers/testTarget.js';

/**
 * Cross-origin sign-in handoff acceptance.
 *
 * The admin dashboard is the single sign-in page. A Marshal is redirected to the
 * tablet with a short-lived code; the tablet exchanges it for its own session.
 * These checks use real PostgreSQL and the real Fastify routes.
 */

const CREDENTIALS = {
  marshal: { username: 'EMP-3106', password: 'planner-demo-marshal-secret' },
  supervisor: { username: 'EMP-2217', password: 'planner-demo-supervisor-secret' },
  admin: { username: 'EMP-1042', password: 'planner-demo-admin-secret' },
} as const;

interface LoginBody {
  token: string;
  user: { role: string; username: string };
}

interface HandoffBody {
  code: string;
  expiresAt: string;
}

describe('AUTH handoff over real PostgreSQL', () => {
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

  async function login(role: keyof typeof CREDENTIALS): Promise<LoginBody> {
    const response = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: CREDENTIALS[role],
    });
    expect(response.statusCode, response.body).toBe(200);
    return response.json() as LoginBody;
  }

  async function mint(token: string): Promise<HandoffBody> {
    const response = await server.inject({
      method: 'POST',
      url: '/auth/handoff',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode, response.body).toBe(200);
    return response.json() as HandoffBody;
  }

  async function exchange(code: string) {
    return server.inject({
      method: 'POST',
      url: '/auth/handoff/exchange',
      payload: { code },
    });
  }

  async function sessionStatus(token: string): Promise<number> {
    const response = await server.inject({
      method: 'GET',
      url: '/auth/session',
      headers: { authorization: `Bearer ${token}` },
    });
    return response.statusCode;
  }

  it('refuses to mint a handoff without a live session', async () => {
    const response = await server.inject({ method: 'POST', url: '/auth/handoff' });
    expect(response.statusCode).toBe(401);
  });

  it('exchanges a code for a dashboard session, revokes the source and refuses replay', async () => {
    const source = await login('supervisor');
    const handoff = await mint(source.token);
    expect(handoff.code).not.toBe(source.token);
    expect(new Date(handoff.expiresAt).getTime()).toBeGreaterThan(Date.now());

    // A code is not a session token.
    expect(await sessionStatus(handoff.code)).toBe(401);

    const exchanged = await exchange(handoff.code);
    expect(exchanged.statusCode, exchanged.body).toBe(200);
    const target = exchanged.json() as LoginBody;
    expect(target.user.role).toBe('Supervisor');
    expect(target.token).not.toBe(source.token);
    expect(await sessionStatus(target.token)).toBe(200);

    expect(await sessionStatus(source.token)).toBe(401);
    expect((await exchange(handoff.code)).statusCode).toBe(401);
  });

  it('refuses an expired code and leaves the source session live', async () => {
    const source = await login('admin');
    const session = await resolveSession(db, source.token);
    expect(session).not.toBeNull();
    const expired = createHandoff(session!, new Date(Date.now() - 61_000));

    const exchanged = await exchange(expired.code);
    expect(exchanged.statusCode).toBe(401);
    expect(await sessionStatus(source.token)).toBe(200);
  });

  it('refuses a forged code', async () => {
    const source = await login('marshal');
    const handoff = await mint(source.token);
    const forged = `${handoff.code.slice(0, -1)}${handoff.code.endsWith('a') ? 'b' : 'a'}`;

    const exchanged = await exchange(forged);
    expect(exchanged.statusCode).toBe(401);
    expect(await sessionStatus(source.token)).toBe(200);
  });
});
