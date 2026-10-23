import { describe, expect, it, vi } from 'vitest';
import { ReadyResponseSchema, parseContract } from '@echallan/contracts';
import { createApp } from '../../src/app.js';
import { createSpyDb } from '../helpers/spyDb.js';

describe('GET /health/ready (readiness, unit)', () => {
  it('returns 200 and the exact contract body when the database answers', async () => {
    const db = createSpyDb();
    const app = createApp({ db });

    const response = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toStrictEqual({ status: 'ok', database: 'ok' });
    expect(() => parseContract(ReadyResponseSchema, response.json())).not.toThrow();

    await app.close();
  });

  it('actually queries the database before reporting readiness', async () => {
    const db = createSpyDb();
    const app = createApp({ db });

    await app.inject({ method: 'GET', url: '/health/ready' });

    expect(db.calls.ping).toBe(1);

    await app.close();
  });

  it('never returns 200 when the database query fails', async () => {
    const db = createSpyDb({ failPing: new Error('connection refused') });
    const app = createApp({ db });

    const response = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toStrictEqual({ status: 'error', database: 'unavailable' });
    expect(db.calls.ping).toBe(1);

    await app.close();
  });

  it('logs the cause of an unavailable database', async () => {
    const db = createSpyDb({ failPing: new Error('econnrefused 127.0.0.1:5433') });
    const errorSink = vi.fn();
    const app = createApp({ db, onReadinessError: errorSink });

    await app.inject({ method: 'GET', url: '/health/ready' });

    expect(errorSink).toHaveBeenCalledTimes(1);
    const logged = errorSink.mock.calls[0]?.[0] as Error | undefined;
    expect(logged?.message).toContain('econnrefused');

    await app.close();
  });

  it('reports unavailable when the database cannot even be constructed', async () => {
    const app = createApp({
      createDb: () => {
        throw new Error('DATABASE_URL is required');
      },
    });

    const response = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toStrictEqual({ status: 'error', database: 'unavailable' });

    await app.close();
  });
});
