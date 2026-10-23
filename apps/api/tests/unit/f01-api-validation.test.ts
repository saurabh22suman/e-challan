import { describe, expect, it } from 'vitest';
import * as contracts from '@echallan/contracts';
import type { z } from 'zod';

// Dynamic import uses a variable to keep the absent adapter from turning the
// prepared suite into an import-time error. The first assertion identifies
// surface absence explicitly; behavioural assertions run once wiring exists.
async function adapter(): Promise<(input: unknown) => unknown> {
  const path = '../../src/domain/validation.js';
  let loaded: Record<string, unknown> = {};
  try {
    loaded = (await import(path)) as Record<string, unknown>;
  } catch {
    /* surface absent */
  }
  expect(typeof loaded['validateChallanSubmission'], 'F-01 API adapter surface absent').toBe(
    'function',
  );
  return loaded['validateChallanSubmission'] as (input: unknown) => unknown;
}

describe('DOM-01: API consumes the shared contract', () => {
  it('rejects forged-authority/incomplete input in both API adapter and shared schema', async () => {
    const validate = await adapter();
    const shared = (contracts as unknown as Record<string, unknown>)[
      'ChallanSubmissionSchema'
    ] as z.ZodType;
    const input = { vehicleNumber: 'GJ05DS4821', severity: 'Minor', marshalId: 'forged' };
    expect(shared.safeParse(input).success).toBe(false);
    expect(() => validate(input)).toThrow();
  });

  it('returns exactly the canonical shared object for valid structure', async () => {
    const validate = await adapter();
    const shared = (contracts as unknown as Record<string, unknown>)[
      'ChallanSubmissionSchema'
    ] as z.ZodType;
    const id = '00000000-0000-4000-8000-000000000001';
    const input = {
      operationId: id,
      vehicleNumber: ' gj 05 ds 4821 ',
      gatePassNumber: 'demo-gp-0001',
      driverName: ' Demo Driver ',
      departmentId: id,
      vehicleTypeId: id,
      violationIds: [id],
      photoIds: [id],
      acknowledgement: { kind: 'signed', signatureId: id },
    };
    expect(validate(input)).toStrictEqual(shared.parse(input));
  });
});
