import { describe, expect, it } from 'vitest';
import { ReadyResponseSchema, parseContract } from '@echallan/contracts';

/**
 * Contract guard: a deliberately wrong payload must be rejected by the shared
 * schema, so a drifting implementation cannot pass silently. This proves the
 * shared contract really is strict, not that the API honours it (the API test
 * does that).
 */
describe('shared readiness contract rejects invalid payloads', () => {
  it('rejects a readiness body without the database field', () => {
    expect(() => parseContract(ReadyResponseSchema, { status: 'ok' })).toThrow(
      /Contract violation/,
    );
  });

  it('rejects a readiness body that claims ok while the database is unavailable', () => {
    expect(() =>
      parseContract(ReadyResponseSchema, { status: 'ok', database: 'unavailable' }),
    ).toThrow(/Contract violation/);
  });

  it('rejects extra fields', () => {
    expect(() =>
      parseContract(ReadyResponseSchema, { status: 'ok', database: 'ok', extra: true }),
    ).toThrow(/Contract violation/);
  });

  it('accepts the exact success payload', () => {
    expect(parseContract(ReadyResponseSchema, { status: 'ok', database: 'ok' })).toStrictEqual({
      status: 'ok',
      database: 'ok',
    });
  });
});
