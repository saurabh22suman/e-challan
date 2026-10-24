import { describe, expect, it } from 'vitest';
import * as contracts from '@echallan/contracts';
import type { z } from 'zod';

// Planner-owned F-01 acceptance. Missing exports are surface-absence failures,
// not behavioural RED. Do not replace, skip or weaken these assertions.
const exported = contracts as unknown as Record<string, unknown>;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function schema(name: string): z.ZodType {
  const candidate = exported[name] as z.ZodType | undefined;
  expect(candidate, `F-01 surface absent: ${name}`).toBeDefined();
  expect(typeof candidate?.safeParse).toBe('function');
  return candidate as z.ZodType;
}

const valid = () => ({
  operationId: id(1),
  vehicleNumber: 'GJ05DS4821',
  gatePassNumber: 'HZ-GP-1042',
  driverName: 'Ramesh Kumar',
  departmentId: id(2),
  vehicleTypeId: id(3),
  violationIds: [id(4)],
  photoIds: [id(5)],
  acknowledgement: { kind: 'signed', signatureId: id(6) },
});

describe('DOM-01: approved demo contracts', () => {
  it('accepts a structurally complete signed request and canonicalises user input', () => {
    const request = {
      ...valid(),
      vehicleNumber: ' gj 05 ds 4821 ',
      driverName: ' Ramesh Kumar ',
      gatePassNumber: ' hz-gp-1042 ',
    };
    const parsed = schema('ChallanSubmissionSchema').parse(request) as Record<string, unknown>;
    expect(parsed['vehicleNumber']).toBe('GJ05DS4821');
    expect(parsed['driverName']).toBe('Ramesh Kumar');
    expect(parsed['gatePassNumber']).toBe('HZ-GP-1042');
  });

  it('accepts refusal with mandatory reason and witnessing-supervisor identity', () => {
    const request = {
      ...valid(),
      acknowledgement: {
        kind: 'refused',
        reason: 'Driver declines',
        witnessName: 'Demo Supervisor',
        witnessStaffId: 'DEMO-SUP-01',
      },
    };
    expect(schema('ChallanSubmissionSchema').safeParse(request).success).toBe(true);
  });

  it.each(['severity', 'status', 'challanNumber', 'issuedAt', 'marshalId', 'locationId'])(
    'rejects client-supplied authoritative %s rather than silently stripping it',
    (field) => {
      expect(
        schema('ChallanSubmissionSchema').safeParse({ ...valid(), [field]: 'forged' }).success,
      ).toBe(false);
    },
  );

  it.each([
    { vehicleNumber: 'not-a-registration' },
    { driverName: '   ' },
    { gatePassNumber: 'pass with spaces' },
    { departmentId: 'not-a-uuid' },
    { violationIds: [] },
    { violationIds: [id(4), id(4)] },
    { photoIds: [] },
    { photoIds: [id(5), id(5)] },
    { photoIds: [id(5), id(6), id(7), id(8), id(9)] },
    { acknowledgement: { kind: 'signed' } },
    {
      acknowledgement: {
        kind: 'refused',
        reason: '',
        witnessName: 'Demo Supervisor',
        witnessStaffId: 'S1',
      },
    },
    {
      acknowledgement: {
        kind: 'refused',
        reason: 'Declined',
        witnessName: ' ',
        witnessStaffId: 'S1',
      },
    },
    {
      acknowledgement: {
        kind: 'refused',
        reason: 'Declined',
        witnessName: 'Demo Supervisor',
        witnessStaffId: '',
      },
    },
    { acknowledgement: { kind: 'signed', signatureId: id(6), reason: 'both modes' } },
    { remarks: 'x'.repeat(2001) },
  ])('rejects malformed or incomplete issuance structure: %j', (patch) => {
    expect(schema('ChallanSubmissionSchema').safeParse({ ...valid(), ...patch }).success).toBe(
      false,
    );
  });

  it('accepts BH registration and exactly four distinct photos', () => {
    expect(
      schema('ChallanSubmissionSchema').safeParse({
        ...valid(),
        vehicleNumber: '26BH1234AA',
        photoIds: [id(5), id(6), id(7), id(8)],
      }).success,
    ).toBe(true);
  });

  it.each([
    'warning_issued',
    'safety_counselling_completed',
    'referred_to_department_contractor',
    'custom',
  ])('requires remarks for action %s, including Custom without an extra name', (action) => {
    const contract = schema('ResolutionActionSchema');
    expect(contract.safeParse({ action, remarks: 'Completed follow-up' }).success).toBe(true);
    expect(contract.safeParse({ action, remarks: '  ' }).success).toBe(false);
    expect(
      contract.safeParse({ action, remarks: 'Done', customActionName: 'Unneeded' }).success,
    ).toBe(false);
  });

  it('keeps role, status and severity vocabulary strict', () => {
    expect(schema('RoleSchema').safeParse('Admin').success).toBe(true);
    expect(schema('RoleSchema').safeParse('Guest').success).toBe(false);
    expect(schema('ChallanStatusSchema').safeParse('Cancelled').success).toBe(true);
    expect(schema('ChallanStatusSchema').safeParse('Pending').success).toBe(false);
    expect(schema('SeveritySchema').safeParse('Critical').success).toBe(true);
    expect(schema('SeveritySchema').safeParse('Extreme').success).toBe(false);
  });

  it('requires resolution action/remarks and cancellation reason in transition payloads', () => {
    const contract = schema('ReviewTransitionSchema');
    expect(
      contract.safeParse({ to: 'Resolved', action: 'custom', remarks: 'Completed' }).success,
    ).toBe(true);
    expect(contract.safeParse({ to: 'Resolved' }).success).toBe(false);
    expect(contract.safeParse({ to: 'Cancelled', reason: 'Duplicate entry' }).success).toBe(true);
    expect(contract.safeParse({ to: 'Cancelled', reason: ' ' }).success).toBe(false);
    expect(contract.safeParse({ to: 'Under Review', reason: 'Admin reopens' }).success).toBe(true);
  });

  it('derives highest selected severity regardless of order; rejects empty/invalid input', () => {
    const derive = exported['deriveChallanSeverity'] as ((values: string[]) => string) | undefined;
    expect(typeof derive, 'F-01 surface absent: deriveChallanSeverity').toBe('function');
    expect(derive?.(['Minor', 'Critical', 'Major'])).toBe('Critical');
    expect(derive?.(['Major', 'Minor'])).toBe('Major');
    expect(() => derive?.([])).toThrow();
    expect(() => derive?.(['Extreme'])).toThrow();
  });

  it('maps approved occurrence tiers and rejects nonpositive/fractional counts', () => {
    const recommend = exported['recommendedActionForOccurrence'] as
      ((value: number) => string) | undefined;
    expect(typeof recommend, 'F-01 surface absent: recommendedActionForOccurrence').toBe(
      'function',
    );
    expect(recommend?.(1)).toBe('warning_issued');
    expect(recommend?.(2)).toBe('safety_counselling_completed');
    expect(recommend?.(3)).toBe('referred_to_department_contractor');
    expect(recommend?.(8)).toBe('referred_to_department_contractor');
    expect(() => recommend?.(0)).toThrow();
    expect(() => recommend?.(1.5)).toThrow();
  });
});
