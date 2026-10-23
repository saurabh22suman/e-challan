import { describe, expect, it } from 'vitest';
import { HealthResponseSchema, parseContract } from '@echallan/contracts';
import { createApp } from '../../src/app.js';
import { createSpyDb } from '../helpers/spyDb.js';

describe('GET /health (liveness, unit)', () => {
  it('returns 200 and exactly the shared health contract body', async () => {
    const app = createApp();

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    expect(() => parseContract(HealthResponseSchema, response.json())).not.toThrow();

    await app.close();
  });

  it('never touches the database', async () => {
    const db = createSpyDb();
    const app = createApp({ db });

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(db.calls.ping).toBe(0);

    await app.close();
  });

  it('works without any database and without environment variables', async () => {
    // No db injected, and no .env file is required for liveness.
    const app = createApp();

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toStrictEqual({ status: 'ok' });

    await app.close();
  });
});
