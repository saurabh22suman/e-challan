import { describe, expect, it } from 'vitest';
import {
  DUPLICATE_WINDOW_MINUTES,
  EntryDraftSchema,
  EntryValidationResponseSchema,
  REPEAT_WINDOW_DAYS,
  RegistryLookupResponseSchema,
  RegistryMatchSchema,
  ChallanPreviewResponseSchema,
  duplicateWindowStart,
  isOtherLabel,
  isWithinDuplicateWindow,
  isWithinRepeatWindow,
  repeatWindowStart,
} from '../src/index.js';

/**
 * Planner-owned pre-issuance acceptance (ENT-01/04, REP-01/02/03, contract layer).
 *
 * These are read-only planner inputs. Missing exports are **surface-absence RED**
 * at preparation, labelled as such; they are not behavioural evidence. Do not
 * replace, skip or weaken these assertions.
 */

const UUID = '00000000-0000-4000-8000-000000000001';
const UUID2 = '00000000-0000-4000-8000-000000000002';

const draft = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  vehicleRegistration: 'GJ05DS4821',
  gatePassNumber: 'DEMO-GP-0001',
  driverName: 'Ramesh Kumar',
  vehicleTypeId: UUID,
  departmentId: UUID2,
  contractorId: null,
  violationTypeIds: [UUID],
  remarks: '',
  registry: null,
  ...overrides,
});

describe('ENT-01: registration and text normalisation contracts', () => {
  it.each([
    ['gj 05 ds 4821', 'GJ05DS4821'],
    ['GJ05DS4821', 'GJ05DS4821'],
    ['26bh1234aa', '26BH1234AA'],
  ])('normalises %s to %s', (raw, expected) => {
    const parsed = EntryDraftSchema.safeParse(draft({ vehicleRegistration: raw }));
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.vehicleRegistration).toBe(expected);
  });

  it.each(['GJ05DS', 'GJ-05-DS-4821', '1234', ''])('rejects the unsupported form %s', (raw) => {
    expect(EntryDraftSchema.safeParse(draft({ vehicleRegistration: raw })).success).toBe(false);
  });

  it('trims the driver name, gate-pass number and remarks', () => {
    const parsed = EntryDraftSchema.safeParse(
      draft({ driverName: '  Ramesh Kumar ', gatePassNumber: ' demo-gp-0001 ', remarks: '  x  ' }),
    );
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.driverName).toBe('Ramesh Kumar');
    expect(parsed.success && parsed.data.gatePassNumber).toBe('DEMO-GP-0001');
    expect(parsed.success && parsed.data.remarks).toBe('x');
  });
});

describe('ENT-03/04: the draft never accepts server authorities', () => {
  it('rejects a client-supplied severity, status, number, location or actor', () => {
    for (const field of ['severity', 'status', 'challanNumber', 'locationId', 'issuedByUserId']) {
      expect(
        EntryDraftSchema.safeParse(draft({ [field]: 'forged' })).success,
        `${field} must be rejected`,
      ).toBe(false);
    }
  });

  it('requires at least one distinct violation and an approved master set', () => {
    expect(EntryDraftSchema.safeParse(draft({ violationTypeIds: [] })).success).toBe(false);
    expect(EntryDraftSchema.safeParse(draft({ violationTypeIds: [UUID, UUID] })).success).toBe(
      false,
    );
    expect(EntryDraftSchema.safeParse(draft({ vehicleTypeId: 'not-a-uuid' })).success).toBe(false);
    expect(EntryDraftSchema.safeParse(draft({ departmentId: undefined })).success).toBe(false);
  });

  it('accepts only a registry provenance object with all three references', () => {
    expect(
      EntryDraftSchema.safeParse(
        draft({ registry: { gatePassRecordId: UUID, driverId: UUID2, vehicleId: UUID } }),
      ).success,
    ).toBe(true);
    expect(
      EntryDraftSchema.safeParse(draft({ registry: { gatePassRecordId: UUID } })).success,
    ).toBe(false);
    expect(
      EntryDraftSchema.safeParse(
        draft({ registry: { gatePassRecordId: UUID, driverId: UUID2, vehicleId: UUID, extra: 1 } }),
      ).success,
    ).toBe(false);
  });
});

describe('ENT-04: the Other-label rule', () => {
  it('recognises exactly the trimmed Other label', () => {
    expect(isOtherLabel('Other')).toBe(true);
    expect(isOtherLabel('  Other  ')).toBe(true);
    expect(isOtherLabel('other')).toBe(false);
    expect(isOtherLabel('Other contractor')).toBe(false);
    expect(isOtherLabel('')).toBe(false);
  });
});

describe('REP-01/03: window helpers and exact inclusive lower boundaries', () => {
  const now = new Date('2026-10-07T12:00:00.000Z');

  it('defines the approved window lengths', () => {
    expect(REPEAT_WINDOW_DAYS).toBe(90);
    expect(DUPLICATE_WINDOW_MINUTES).toBe(15);
  });

  it('starts the repeat window exactly 90 days before T and includes it', () => {
    const start = repeatWindowStart(now);
    expect(start.toISOString()).toBe('2026-07-09T12:00:00.000Z');
    expect(isWithinRepeatWindow(start, now), 'exactly 90 days old is included').toBe(true);
    expect(
      isWithinRepeatWindow(new Date(start.getTime() - 1), now),
      'older than 90 days is excluded',
    ).toBe(false);
    expect(isWithinRepeatWindow(new Date(start.getTime() + 1), now)).toBe(true);
    expect(isWithinRepeatWindow(now, now), 'T itself is excluded (upper bound)').toBe(false);
  });

  it('starts the duplicate window exactly 15 minutes before T and includes it', () => {
    const start = duplicateWindowStart(now);
    expect(start.toISOString()).toBe('2026-10-07T11:45:00.000Z');
    expect(isWithinDuplicateWindow(start, now), 'exactly 15 minutes old is included').toBe(true);
    expect(
      isWithinDuplicateWindow(new Date(start.getTime() - 1), now),
      'older than 15 minutes is excluded',
    ).toBe(false);
    expect(isWithinDuplicateWindow(now, now)).toBe(false);
  });
});

describe('ENT-02/REP-05: response contracts are strict', () => {
  it('accepts a complete registry match and rejects unknown fields', () => {
    const match = {
      gatePassRecordId: UUID,
      gatePassNumber: 'DEMO-GP-0001',
      driverId: UUID2,
      driverName: 'Ramesh Kumar',
      vehicleId: UUID,
      vehicleRegistrationNumber: 'GJ05DS4821',
      vehicleTypeId: UUID2,
      vehicleTypeLabel: 'Car',
      departmentId: UUID,
      departmentLabel: 'Logistics',
      contractorId: null,
      contractorLabel: null,
      status: 'active',
      validUntil: null,
    };
    expect(RegistryMatchSchema.safeParse(match).success).toBe(true);
    expect(RegistryMatchSchema.safeParse({ ...match, invented: true }).success).toBe(false);
    expect(RegistryMatchSchema.safeParse({ ...match, status: 'unknown' }).success).toBe(false);
    expect(RegistryLookupResponseSchema.safeParse({ matches: [match] }).success).toBe(true);
  });

  it('validates the entry-validation and preview response shapes', () => {
    expect(
      EntryValidationResponseSchema.safeParse({
        severity: 'Major',
        otherFields: ['department', 'contractor'],
      }).success,
    ).toBe(true);
    expect(
      EntryValidationResponseSchema.safeParse({ severity: 'Unknown', otherFields: [] }).success,
    ).toBe(false);

    expect(
      ChallanPreviewResponseSchema.safeParse({
        severity: 'Major',
        occurrenceNumber: 5,
        recommendedAction: 'referred_to_department_contractor',
        duplicateWarning: { required: true, matchedCount: 1 },
        windowDays: 90,
        windowMinutes: 15,
      }).success,
    ).toBe(true);
    expect(
      ChallanPreviewResponseSchema.safeParse({
        severity: 'Major',
        occurrenceNumber: 0,
        recommendedAction: 'warning_issued',
        duplicateWarning: { required: false, matchedCount: 0 },
        windowDays: 90,
        windowMinutes: 15,
      }).success,
      'occurrence numbers start at one',
    ).toBe(false);
  });
});
