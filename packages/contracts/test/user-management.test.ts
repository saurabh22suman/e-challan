import { describe, expect, it } from 'vitest';
import {
  API_ERROR_CODES,
  AdminUserResponseSchema,
  CreateUserRequestSchema,
} from '@echallan/contracts';

/**
 * Planner-owned acceptance for the Admin user-management slice
 * (`specs/010-user-management`). Structure only; role/location authorization,
 * duplicates and account behavior are proven against the real API.
 */

const LOCATION = '00000000-0000-4000-8000-0000000000c1';

const VALID = {
  username: 'SUP-EMP-010',
  displayName: 'New Supervisor',
  employeeId: 'EMP-010',
  role: 'Supervisor',
  locationIds: [LOCATION],
  password: 'a-valid-initial-password',
};

describe('create-user contract', () => {
  it('accepts a valid Marshal, Supervisor and Admin payload', () => {
    expect(CreateUserRequestSchema.parse(VALID).username).toBe('SUP-EMP-010');
    expect(CreateUserRequestSchema.parse({ ...VALID, role: 'Marshal' }).role).toBe('Marshal');
    expect(
      CreateUserRequestSchema.parse({
        ...VALID,
        role: 'Admin',
        username: 'ADM-EMP-011',
        locationIds: [],
      }).role,
    ).toBe('Admin');
  });

  it('requires at least one location for a Marshal and Supervisor, but not an Admin', () => {
    for (const role of ['Marshal', 'Supervisor']) {
      expect(CreateUserRequestSchema.safeParse({ ...VALID, role, locationIds: [] }).success).toBe(
        false,
      );
    }
    expect(
      CreateUserRequestSchema.safeParse({ ...VALID, role: 'Admin', locationIds: [] }).success,
    ).toBe(true);
  });

  it('rejects duplicate locations, unknown roles, weak passwords and extra fields', () => {
    expect(
      CreateUserRequestSchema.safeParse({ ...VALID, locationIds: [LOCATION, LOCATION] }).success,
    ).toBe(false);
    expect(CreateUserRequestSchema.safeParse({ ...VALID, role: 'Owner' }).success).toBe(false);
    expect(CreateUserRequestSchema.safeParse({ ...VALID, password: 'short' }).success).toBe(false);
    expect(
      CreateUserRequestSchema.safeParse({ ...VALID, passwordHash: '$argon2id$fake' }).success,
    ).toBe(false);
  });

  it('trims the username, display name and employee id but keeps the password exact', () => {
    const parsed = CreateUserRequestSchema.parse({
      ...VALID,
      username: '  SUP-EMP-010  ',
      displayName: '  New Supervisor ',
      employeeId: ' EMP-010 ',
      password: '  a-valid-initial-password  ',
    });
    expect(parsed.username).toBe('SUP-EMP-010');
    expect(parsed.displayName).toBe('New Supervisor');
    expect(parsed.employeeId).toBe('EMP-010');
    expect(parsed.password).toBe('  a-valid-initial-password  ');
  });

  it('rejects a username with spaces or unsupported punctuation', () => {
    for (const username of ['bad name', 'bad/name', 'bad@name', 'ab']) {
      expect(CreateUserRequestSchema.safeParse({ ...VALID, username }).success).toBe(false);
    }
  });

  it('returns a public user shape with no password material', () => {
    const body = {
      user: {
        id: '00000000-0000-4000-8000-0000000000a1',
        username: 'SUP-EMP-010',
        displayName: 'New Supervisor',
        role: 'Supervisor',
        isActive: true,
        locationLabels: ['Main gate'],
      },
    };
    expect(AdminUserResponseSchema.parse(body)).toStrictEqual(body);
    expect(
      AdminUserResponseSchema.safeParse({
        user: { ...body.user, passwordHash: '$argon2id$fake' },
      }).success,
    ).toBe(false);
  });

  it('defines a stable duplicate/conflict code', () => {
    expect(API_ERROR_CODES.conflict).toBe('conflict');
  });
});
