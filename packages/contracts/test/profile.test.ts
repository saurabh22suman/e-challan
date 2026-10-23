import { describe, expect, it } from 'vitest';
import { ChallanDetailResponseSchema, ProfileResponseSchema } from '@echallan/contracts';

/**
 * Planner-owned profile/tracking contract acceptance (`specs/011-profile-tracking`).
 * Structural strictness matters here because a password or another user's data must
 * never become representable in the self-service profile payload.
 */

const USER_ID = '00000000-0000-4000-8000-0000000000a1';
const LOCATION_ID = '00000000-0000-4000-8000-0000000000c1';

const PROFILE = {
  user: {
    id: USER_ID,
    username: 'DEMO-EMP-002',
    displayName: 'Sunil Deshmukh',
    employeeId: 'DEMO-EMP-002',
    role: 'Supervisor',
    isActive: true,
    locationLabels: ['Demo industrial campus — main entrance'],
  },
  session: {
    expiresAt: '2099-01-01T00:00:00.000Z',
    post: null,
    shift: null,
  },
};

describe('profile contract', () => {
  it('accepts the exact own-profile shape for a desktop role', () => {
    expect(ProfileResponseSchema.parse(PROFILE)).toStrictEqual(PROFILE);
  });

  it('accepts a Marshal session with post and shift context', () => {
    const marshal = {
      user: {
        ...PROFILE.user,
        username: 'DEMO-EMP-004',
        displayName: 'Ravi Patel',
        role: 'Marshal',
      },
      session: {
        expiresAt: '2099-01-01T00:00:00.000Z',
        post: { id: '00000000-0000-4000-8000-0000000000b1', label: 'DEMO-POST-01' },
        shift: { id: '00000000-0000-4000-8000-0000000000b2', label: 'Day shift' },
      },
    };
    expect(ProfileResponseSchema.parse(marshal)).toStrictEqual(marshal);
  });

  it('rejects password material and extra fields in the profile', () => {
    expect(
      ProfileResponseSchema.safeParse({
        ...PROFILE,
        user: { ...PROFILE.user, passwordHash: '$argon2id$fake' },
      }).success,
    ).toBe(false);
    expect(
      ProfileResponseSchema.safeParse({ ...PROFILE, session: { ...PROFILE.session, token: 'x' } })
        .success,
    ).toBe(false);
  });

  it('requires the public session expiry and nullable post/shift', () => {
    expect(ProfileResponseSchema.safeParse({ user: PROFILE.user }).success).toBe(false);
    expect(
      ProfileResponseSchema.safeParse({
        ...PROFILE,
        session: { expiresAt: PROFILE.session.expiresAt },
      }).success,
    ).toBe(false);
  });
});

describe('challan tracking contract', () => {
  const detail = {
    id: '00000000-0000-4000-8000-0000000000d1',
    challanNumber: 'DEMO/2026/10/0001',
    status: 'Issued',
    severity: 'Major',
    occurrenceNumber: 1,
    recommendedAction: 'warning_issued',
    gatePassNumber: 'DEMO-GP-0001',
    vehicleRegistrationNumber: 'GJ05DS4821',
    driverName: 'Ramesh Kumar',
    locationId: LOCATION_ID,
    locationLabel: 'Demo industrial campus — main entrance',
    issuedAt: '2026-10-01T05:30:00.000Z',
    issuedBy: {
      id: USER_ID,
      username: 'DEMO-EMP-004',
      displayName: 'Ravi Patel',
    },
    departmentLabel: 'Logistics',
    contractorLabel: null,
    vehicleTypeLabel: 'Car',
    gateLabel: 'Gate 1 — main entry',
    remarks: null,
    violations: [{ label: 'No seatbelt', severity: 'Major' }],
    actions: [],
    reopenedAt: null,
    reopenedByUserId: null,
    reopeningReason: null,
    cancellationReason: null,
  };

  it('accepts an issuer on the detail', () => {
    expect(ChallanDetailResponseSchema.parse(detail)).toStrictEqual(detail);
  });

  it('rejects a detail without the issuer', () => {
    const missing: Record<string, unknown> = { ...detail };
    delete missing['issuedBy'];
    expect(ChallanDetailResponseSchema.safeParse(missing).success).toBe(false);
  });
});
