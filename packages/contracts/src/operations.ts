import { z } from 'zod';
import {
  ChallanStatusSchema,
  ResolutionActionCodeSchema,
  RoleSchema,
  SeveritySchema,
} from './domain.js';

/**
 * Shared contracts for the bounded supervisor/admin slice
 * (`specs/009-review-admin-basics`, owner-authorised 2026-10-21).
 *
 * Scope: read-only challan lists/details for the review workspace, the approved
 * D3 transition request, and Admin user listing/password reset. Create/disable
 * users, cancellation, totals, pagination and export remain out of scope.
 *
 * Lists and details never carry password material, evidence binaries or a
 * client-supplied performer. The performer is the authenticated session.
 */

/** Optional exact status filter. Unknown statuses are a contract violation. */
export const ChallanListQuerySchema = z.strictObject({
  status: ChallanStatusSchema.optional(),
});
export type ChallanListQuery = z.infer<typeof ChallanListQuerySchema>;

const IsoDateTimeSchema = z.iso.datetime();

/** One row in the role-scoped review list. */
export const ChallanSummarySchema = z.strictObject({
  id: z.uuid(),
  challanNumber: z.string().min(1),
  status: ChallanStatusSchema,
  severity: SeveritySchema,
  occurrenceNumber: z.number().int().min(1),
  recommendedAction: ResolutionActionCodeSchema,
  gatePassNumber: z.string().min(1),
  vehicleRegistrationNumber: z.string().min(1),
  driverName: z.string().min(1),
  locationId: z.uuid(),
  locationLabel: z.string().min(1),
  issuedAt: IsoDateTimeSchema,
});
export type ChallanSummary = z.infer<typeof ChallanSummarySchema>;

/** Newest-issued-first list. The demo caps the result set server-side. */
export const ChallanListResponseSchema = z.strictObject({
  items: z.array(ChallanSummarySchema),
});
export type ChallanListResponse = z.infer<typeof ChallanListResponseSchema>;

/** One append-only review-history row. */
export const ChallanActionRecordSchema = z.strictObject({
  id: z.uuid(),
  toStatus: ChallanStatusSchema,
  action: ResolutionActionCodeSchema.nullable(),
  remarks: z.string().nullable(),
  reason: z.string().nullable(),
  performerUserId: z.uuid(),
  performerUsername: z.string().min(1),
  performerDisplayName: z.string().min(1),
  createdAt: IsoDateTimeSchema,
});
export type ChallanActionRecord = z.infer<typeof ChallanActionRecordSchema>;

/** Detail fields plus issued snapshots, violations and append-only history. */
export const ChallanDetailResponseSchema = z.strictObject({
  ...ChallanSummarySchema.shape,
  departmentLabel: z.string().min(1),
  contractorLabel: z.string().nullable(),
  vehicleTypeLabel: z.string().min(1),
  gateLabel: z.string().min(1),
  /** The marshal identity captured on the issued record. */
  issuedBy: z.strictObject({
    id: z.uuid(),
    username: z.string().min(1),
    displayName: z.string().min(1),
  }),
  remarks: z.string().nullable(),
  violations: z.array(
    z.strictObject({
      label: z.string().min(1),
      severity: SeveritySchema,
    }),
  ),
  actions: z.array(ChallanActionRecordSchema),
  reopenedAt: IsoDateTimeSchema.nullable(),
  reopenedByUserId: z.uuid().nullable(),
  reopeningReason: z.string().nullable(),
  cancellationReason: z.string().nullable(),
});
export type ChallanDetailResponse = z.infer<typeof ChallanDetailResponseSchema>;

/** Admin user-list row. Deliberately has no password/hash field. */
export const AdminUserSchema = z.strictObject({
  id: z.uuid(),
  username: z.string().min(1),
  displayName: z.string().min(1),
  role: RoleSchema,
  isActive: z.boolean(),
  locationLabels: z.array(z.string().min(1)),
});
export type AdminUser = z.infer<typeof AdminUserSchema>;

export const AdminUserListResponseSchema = z.strictObject({
  users: z.array(AdminUserSchema),
});
export type AdminUserListResponse = z.infer<typeof AdminUserListResponseSchema>;

/** 201 response for Admin user creation; never carries password material. */
export const AdminUserResponseSchema = z.strictObject({
  user: AdminUserSchema,
});
export type AdminUserResponse = z.infer<typeof AdminUserResponseSchema>;

/**
 * Admin create-user request (PRD E1.4, E5.3).
 *
 * Usernames are the sign-in identifier; they are trimmed and limited to a safe
 * character set. Marshal and Supervisor need at least one location so the new
 * account can actually be authorised; Admin reads across locations. The password
 * is stored only as an Argon2id hash and is never returned.
 */
export const CreateUserRequestSchema = z
  .strictObject({
    username: z
      .string()
      .transform((value) => value.trim())
      .refine(
        (value) => /^[A-Za-z0-9._-]{3,64}$/u.test(value),
        'Username must be 3–64 letters, digits, dots, underscores or hyphens',
      ),
    displayName: z
      .string()
      .transform((value) => value.trim())
      .refine((value) => value.length >= 1 && value.length <= 120, 'Display name is required'),
    employeeId: z
      .string()
      .transform((value) => value.trim())
      .refine(
        (value) => value.length >= 1 && value.length <= 64,
        'Employee ID must be 1–64 characters',
      )
      .optional(),
    role: RoleSchema,
    locationIds: z
      .array(z.uuid())
      .max(50)
      .default([])
      .refine((values) => new Set(values).size === values.length, 'Locations must be distinct'),
    password: z
      .string()
      .max(200, 'Password may be at most 200 characters')
      .refine((value) => value.trim().length >= 12, 'Password must be at least 12 characters'),
  })
  .superRefine((value, ctx) => {
    if (
      (value.role === 'Marshal' || value.role === 'Supervisor') &&
      value.locationIds.length === 0
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['locationIds'],
        message: 'Choose at least one location for this role',
      });
    }
  });
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

/**
 * Admin reset body. The 12-character minimum is a delegated security default
 * for this demo; the exact string is hashed, never trimmed into the hash. The
 * confirmation field is client-only and therefore rejected here.
 */
export const ResetPasswordRequestSchema = z.strictObject({
  password: z
    .string()
    .max(200, 'Password may be at most 200 characters')
    .refine((value) => value.trim().length >= 12, 'Password must be at least 12 characters'),
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

/** Approved display labels for the stable resolution action codes. */
export const RESOLUTION_ACTION_LABELS = {
  warning_issued: 'Warning issued',
  safety_counselling_completed: 'Safety counselling completed',
  referred_to_department_contractor: 'Referred to department/contractor',
  custom: 'Custom',
} as const satisfies Record<z.infer<typeof ResolutionActionCodeSchema>, string>;

/* -------------------------------------------------------------------------- */
/* Reporting                                                                   */
/* -------------------------------------------------------------------------- */

export const CHALLAN_SORT_FIELDS = ['issuedAt', 'challanNumber', 'status', 'severity'] as const;
export const ChallanSortFieldSchema = z.enum(CHALLAN_SORT_FIELDS);
export type ChallanSortField = z.infer<typeof ChallanSortFieldSchema>;
export const SortDirectionSchema = z.enum(['asc', 'desc']);

/**
 * Server-side report query. All filters are optional; dates are Kolkata calendar
 * dates (inclusive). `page`/`pageSize` apply only to the table, not the export.
 */
export const ChallanReportQuerySchema = z.strictObject({
  status: ChallanStatusSchema.optional(),
  severity: SeveritySchema.optional(),
  locationId: z.uuid().optional(),
  departmentId: z.uuid().optional(),
  violationTypeId: z.uuid().optional(),
  issuedByUserId: z.uuid().optional(),
  search: z.string().trim().min(1).max(120).optional(),
  vehicle: z.string().trim().min(1).max(32).optional(),
  gatePass: z.string().trim().min(1).max(64).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  sort: ChallanSortFieldSchema.default('issuedAt'),
  direction: SortDirectionSchema.default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type ChallanReportQuery = z.infer<typeof ChallanReportQuerySchema>;

export const ChallanReportTotalsSchema = z.strictObject({
  total: z.number().int().min(0),
  issuedToday: z.number().int().min(0),
  pending: z.number().int().min(0),
  resolved: z.number().int().min(0),
  repeatOffenders: z.number().int().min(0),
});
export type ChallanReportTotals = z.infer<typeof ChallanReportTotalsSchema>;

export const ChallanReportResponseSchema = z.strictObject({
  items: z.array(ChallanSummarySchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totals: ChallanReportTotalsSchema,
});
export type ChallanReportResponse = z.infer<typeof ChallanReportResponseSchema>;
