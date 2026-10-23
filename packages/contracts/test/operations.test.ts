import { describe, expect, it } from 'vitest';
import {
  AdminUserListResponseSchema,
  ChallanDetailResponseSchema,
  ChallanListQuerySchema,
  ChallanListResponseSchema,
  RESOLUTION_ACTION_LABELS,
  ResetPasswordRequestSchema,
  ReviewTransitionSchema,
} from '@echallan/contracts';

/**
 * Planner-owned acceptance for the bounded review/user-administration slice
 * (`specs/009-review-admin-basics`). These schemas are the shared boundary
 * between the API and the admin dashboard, so strictness is asserted directly:
 * a client field that could become authority must be rejected, not stripped.
 */

const ID = (suffix: number): string =>
  `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;

const SUMMARY = {
  id: ID(1),
  challanNumber: 'DEMO/2026/10/0001',
  status: 'Issued',
  severity: 'Major',
  occurrenceNumber: 1,
  recommendedAction: 'warning_issued',
  gatePassNumber: 'DEMO-GP-0001',
  vehicleRegistrationNumber: 'GJ05DS4821',
  driverName: 'Ramesh Kumar',
  locationId: ID(2),
  locationLabel: 'Main gate',
  issuedAt: '2026-10-01T05:30:00.000Z',
} as const;

const ACTION = {
  id: ID(3),
  toStatus: 'Resolved',
  action: 'warning_issued',
  remarks: 'Warning issued and acknowledged by the driver.',
  reason: null,
  performerUserId: ID(4),
  performerUsername: 'DEMO-EMP-002',
  performerDisplayName: 'Sunil Deshmukh',
  createdAt: '2026-10-02T05:30:00.000Z',
} as const;

describe('challan review contracts', () => {
  it('accepts an empty list query and each approved status filter', () => {
    expect(ChallanListQuerySchema.parse({})).toStrictEqual({});
    for (const status of ['Issued', 'Under Review', 'Resolved', 'Cancelled']) {
      expect(ChallanListQuerySchema.parse({ status }).status).toBe(status);
    }
  });

  it('rejects an unknown status, a blank status and an extra query field', () => {
    expect(ChallanListQuerySchema.safeParse({ status: 'Pending' }).success).toBe(false);
    expect(ChallanListQuerySchema.safeParse({ status: '' }).success).toBe(false);
    expect(ChallanListQuerySchema.safeParse({ status: 'Issued', locationId: ID(9) }).success).toBe(
      false,
    );
  });

  it('accepts the exact list response and rejects a missing or extra field', () => {
    const ok = ChallanListResponseSchema.parse({ items: [SUMMARY] });
    expect(ok.items).toHaveLength(1);

    expect(
      ChallanListResponseSchema.safeParse({ items: [{ ...SUMMARY, extra: true }] }).success,
    ).toBe(false);
    const missingDriver: Record<string, unknown> = { ...SUMMARY };
    delete missingDriver['driverName'];
    expect(ChallanListResponseSchema.safeParse({ items: [missingDriver] }).success).toBe(false);
  });

  it('accepts the exact detail response with history and rejects password-like extras', () => {
    const detail = {
      ...SUMMARY,
      issuedBy: { id: ID(4), username: 'DEMO-EMP-004', displayName: 'Ravi Patel' },
      departmentLabel: 'Logistics',
      contractorLabel: 'West Contractors',
      vehicleTypeLabel: 'Truck',
      gateLabel: 'Gate 1',
      remarks: 'Issued at the gate.',
      violations: [{ label: 'No seatbelt', severity: 'Major' }],
      actions: [ACTION],
      reopenedAt: null,
      reopenedByUserId: null,
      reopeningReason: null,
      cancellationReason: null,
    };

    expect(ChallanDetailResponseSchema.parse(detail)).toStrictEqual(detail);
    expect(
      ChallanDetailResponseSchema.safeParse({ ...detail, passwordHash: '$argon2id$fake' }).success,
    ).toBe(false);
  });

  it('accepts only the approved review transitions and their mandatory fields', () => {
    expect(ReviewTransitionSchema.parse({ to: 'Under Review' }).to).toBe('Under Review');
    expect(
      ReviewTransitionSchema.parse({
        to: 'Resolved',
        action: 'safety_counselling_completed',
        remarks: 'Counselling completed with the driver.',
      }).to,
    ).toBe('Resolved');

    expect(
      ReviewTransitionSchema.safeParse({ to: 'Resolved', action: 'warning_issued' }).success,
    ).toBe(false);
    expect(
      ReviewTransitionSchema.safeParse({
        to: 'Resolved',
        action: 'warning_issued',
        remarks: '   ',
      }).success,
    ).toBe(false);
    expect(
      ReviewTransitionSchema.safeParse({
        to: 'Issued',
        action: 'warning_issued',
        remarks: 'Not an approved target.',
      }).success,
    ).toBe(false);
  });

  it('maps every stable action code to a display label', () => {
    expect(RESOLUTION_ACTION_LABELS).toStrictEqual({
      warning_issued: 'Warning issued',
      safety_counselling_completed: 'Safety counselling completed',
      referred_to_department_contractor: 'Referred to department/contractor',
      custom: 'Custom',
    });
  });
});

describe('admin user-administration contracts', () => {
  it('accepts the exact user list shape without password material', () => {
    const body = {
      users: [
        {
          id: ID(1),
          username: 'DEMO-EMP-002',
          displayName: 'Sunil Deshmukh',
          role: 'Supervisor',
          isActive: true,
          locationLabels: ['Main gate'],
        },
      ],
    };
    expect(AdminUserListResponseSchema.parse(body)).toStrictEqual(body);
    expect(
      AdminUserListResponseSchema.safeParse({
        users: [{ ...body.users[0], passwordHash: '$argon2id$fake' }],
      }).success,
    ).toBe(false);
  });

  it('requires a 12–200 character password and rejects unknown confirmation fields', () => {
    expect(ResetPasswordRequestSchema.parse({ password: 'a'.repeat(12) }).password).toHaveLength(
      12,
    );
    expect(ResetPasswordRequestSchema.safeParse({ password: 'short' }).success).toBe(false);
    expect(
      ResetPasswordRequestSchema.safeParse({ password: 'a'.repeat(12), confirmPassword: 'x' })
        .success,
    ).toBe(false);
    expect(ResetPasswordRequestSchema.safeParse({ password: ' '.repeat(12) }).success).toBe(false);
    expect(ResetPasswordRequestSchema.safeParse({ password: 'a'.repeat(201) }).success).toBe(false);
  });
});
