import { afterAll, describe, expect, it } from 'vitest';
import { ReadyResponseSchema, parseContract } from '@echallan/contracts';
import { createApp } from '../../src/app.js';
import { createDb, type Db } from '../../src/db/client.js';
import { resolveTestDatabaseUrl } from './helpers/testTarget.js';

describe('GET /health/ready against real PostgreSQL', () => {
  const databases: Db[] = [];

  afterAll(async () => {
    for (const db of databases) await db.close();
  });

  it('reports the real test database as ready', async () => {
    const db = createDb(resolveTestDatabaseUrl());
    databases.push(db);
    const app = createApp({ db });

    const response = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(response.statusCode).toBe(200);
    expect(() => parseContract(ReadyResponseSchema, response.json())).not.toThrow();
    expect(response.json()).toStrictEqual({ status: 'ok', database: 'ok' });

    await app.close();
  });

  it('reports unavailable when PostgreSQL cannot be reached (real refused connection)', async () => {
    // Nothing listens on this port: a real connection failure, not a mock.
    const unreachable = new URL(resolveTestDatabaseUrl());
    unreachable.port = '59999';
    const db = createDb(unreachable.toString());
    databases.push(db);
    const app = createApp({ db });

    const response = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toStrictEqual({ status: 'error', database: 'unavailable' });

    await app.close();
  });

  it('keeps liveness green even while the database is unreachable', async () => {
    const unreachable = new URL(resolveTestDatabaseUrl());
    unreachable.port = '59999';
    const db = createDb(unreachable.toString());
    databases.push(db);
    const app = createApp({ db });

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toStrictEqual({ status: 'ok' });

    await app.close();
  });
});
