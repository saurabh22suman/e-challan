import { z } from 'zod';
import { SessionContextRefSchema } from './auth.js';
import { RoleSchema } from './domain.js';

/**
 * Self-service profile contract (`specs/011-profile-tracking`).
 *
 * A signed-in user may read only their own profile. The payload deliberately has
 * no password/hash/token field and no field for another user's identity, so a
 * credential leak or cross-user read cannot be expressed by a valid response.
 */

export const ProfileUserSchema = z.strictObject({
  id: z.uuid(),
  username: z.string().min(1),
  displayName: z.string().min(1),
  employeeId: z.string().nullable(),
  role: RoleSchema,
  isActive: z.boolean(),
  locationLabels: z.array(z.string().min(1)),
});
export type ProfileUser = z.infer<typeof ProfileUserSchema>;

export const ProfileSessionSchema = z.strictObject({
  expiresAt: z.iso.datetime(),
  post: SessionContextRefSchema.nullable(),
  shift: SessionContextRefSchema.nullable(),
});
export type ProfileSession = z.infer<typeof ProfileSessionSchema>;

export const ProfileResponseSchema = z.strictObject({
  user: ProfileUserSchema,
  session: ProfileSessionSchema,
});
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;
