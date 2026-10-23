import { describe, expect, it } from 'vitest';
import {
  ChallanCommitRequestSchema,
  ChallanCommitResponseSchema,
  type ChallanCommitRequest,
} from '../src/index.js';

const ID = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, '0')}`;

const base = {
  operationId: ID('1'),
  draft: {
    vehicleRegistration: 'GJ05JP6207',
    gatePassNumber: 'AUDIT-GP-0001',
    driverName: 'Kavita Joshi',
    vehicleTypeId: ID('2'),
    departmentId: ID('3'),
    contractorId: null,
    violationTypeIds: [ID('4')],
    remarks: '',
    registry: null,
  },
  photos: [
    {
      id: ID('5'),
      dataUrl: 'data:image/jpeg;base64,/9j/4AAQ',
      width: 640,
      height: 480,
      bytes: 4,
    },
  ],
  signature: {
    dataUrl: 'data:image/png;base64,iVBORw0KGgo',
    width: 800,
    height: 300,
    bytes: 8,
  },
  refusal: null,
  summaryRevision: 'revision-1',
  duplicateWarningAcknowledged: false,
} satisfies ChallanCommitRequest;

describe('I-06 commit contract', () => {
  it('accepts exactly one signature acknowledgement', () => {
    expect(ChallanCommitRequestSchema.safeParse(base).success).toBe(true);
  });

  it('accepts exactly one refusal acknowledgement', () => {
    expect(
      ChallanCommitRequestSchema.safeParse({
        ...base,
        signature: null,
        refusal: { reason: 'Refused', witnessName: 'Witness', witnessStaffId: 'EMP-1' },
      }).success,
    ).toBe(true);
  });

  it('rejects both acknowledgement modes', () => {
    expect(
      ChallanCommitRequestSchema.safeParse({
        ...base,
        refusal: { reason: 'Refused', witnessName: 'Witness', witnessStaffId: 'EMP-1' },
      }).success,
    ).toBe(false);
  });

  it('rejects zero photos', () => {
    expect(ChallanCommitRequestSchema.safeParse({ ...base, photos: [] }).success).toBe(false);
  });

  it('parses the confirmation shape', () => {
    expect(
      ChallanCommitResponseSchema.safeParse({
        id: ID('1'),
        challanNumber: 'DEMO/2026/10/0007',
        status: 'Issued',
        severity: 'Minor',
        occurrenceNumber: 1,
        recommendedAction: 'warning_issued',
        issuedAt: '2026-10-07T12:00:00.000Z',
        replayed: false,
      }).success,
    ).toBe(true);
  });
});
