import { describe, expect, it } from 'vitest';

import { HealthResponseSchema, ReadyResponseSchema } from '../src/index.js';

describe('HealthResponseSchema', () => {
  it('accepts the exact liveness payload', () => {
    const parsed = HealthResponseSchema.safeParse({ status: 'ok' });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ status: 'ok' });
  });

  it('rejects an unknown or degraded status', () => {
    expect(HealthResponseSchema.safeParse({ status: 'degraded' }).success).toBe(false);
  });

  it('rejects a payload carrying a database claim on the liveness route', () => {
    expect(HealthResponseSchema.safeParse({ status: 'ok', database: 'ok' }).success).toBe(false);
  });

  it('rejects missing status and extra unrelated fields', () => {
    expect(HealthResponseSchema.safeParse({}).success).toBe(false);
    expect(HealthResponseSchema.safeParse({ status: 'ok', detail: 'x' }).success).toBe(false);
  });
});

describe('ReadyResponseSchema', () => {
  it('accepts the exact readiness payload', () => {
    const parsed = ReadyResponseSchema.safeParse({ status: 'ok', database: 'ok' });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ status: 'ok', database: 'ok' });
  });

  it('rejects readiness without a database assertion', () => {
    expect(ReadyResponseSchema.safeParse({ status: 'ok' }).success).toBe(false);
  });

  it('rejects a non-ok database state', () => {
    expect(ReadyResponseSchema.safeParse({ status: 'ok', database: 'down' }).success).toBe(false);
  });

  it('reports the failing field for a malformed payload', () => {
    const result = ReadyResponseSchema.safeParse({ status: 'ok', database: 1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join('.'))).toContain('database');
    }
  });
});
