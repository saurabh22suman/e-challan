import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { RegistryLookupResponseSchema } from '@echallan/contracts';
import { createApp } from '../../src/app.js';
import type { Db } from '../../src/db/client.js';
import { resetAndMigrateTestDatabase, resolveTestDatabaseUrl } from './helpers/testTarget.js';

const CREDENTIALS = {
  marshal: { username: 'DEMO-EMP-004', password: 'planner-demo-marshal-secret' },
  supervisor: { username: 'DEMO-EMP-002', password: 'planner-demo-supervisor-secret' },
  admin: { username: 'DEMO-EMP-001', password: 'planner-demo-admin-secret' },
} as const;

describe('recent vehicles at the marshal location', () => {
  let db: Db;
  let server: FastifyInstance;
  let marshalToken: string;
  let supervisorToken: string;

  beforeAll(async () => {
    db = await resetAndMigrateTestDatabase();
    const seed = (await import('../../src/db/seed-domain-demo.js')) as {
      seedDomainDemoDatabase: (url: string) => Promise<unknown>;
    };
    await seed.seedDomainDemoDatabase(resolveTestDatabaseUrl());
    server = createApp({ db, credentials: CREDENTIALS });
    await server.ready();
    const login = async (account: { username: string; password: string }) => {
      const response = await server.inject({
        method: 'POST',
        url: '/auth/login',
        payload: account,
      });
      return (response.json() as { token: string }).token;
    };
    marshalToken = await login(CREDENTIALS.marshal);
    supervisorToken = await login(CREDENTIALS.supervisor);
  });

  afterAll(async () => {
    if (server) await server.close();
    if (db) await db.close();
  });

  it('returns at most five recent registry matches for the marshal post', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/registry/recent',
      headers: { authorization: `Bearer ${marshalToken}` },
    });
    expect(response.statusCode, response.body).toBe(200);
    const parsed = RegistryLookupResponseSchema.parse(response.json());
    expect(parsed.matches.length).toBeGreaterThan(0);
    expect(parsed.matches.length).toBeLessThanOrEqual(5);
    expect(parsed.matches[0]?.gatePassNumber).toMatch(/^DEMO-GP-/);
  });

  it('is Marshal-only', async () => {
    const supervisor = await server.inject({
      method: 'GET',
      url: '/registry/recent',
      headers: { authorization: `Bearer ${supervisorToken}` },
    });
    expect(supervisor.statusCode).toBe(403);
    const anonymous = await server.inject({ method: 'GET', url: '/registry/recent' });
    expect(anonymous.statusCode).toBe(401);
  });
});
