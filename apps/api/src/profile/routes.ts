import { asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { API_ERROR_CODES, ProfileResponseSchema, parseContract } from '@echallan/contracts';
import type { Db } from '../db/client.js';
import * as s from '../db/schema.js';
import { requireSession, sendError, SIGN_IN_REQUIRED } from '../auth/guard.js';
import { buildIdentity } from '../auth/service.js';

export interface ProfileRouteOptions {
  resolveDb: () => Db;
}

/**
 * `GET /profile` — the caller's own login/profile details.
 *
 * Identity comes from the session, never from a request field. The response has
 * no password/hash/token property by contract, and no path exists to request
 * another user's profile.
 */
export function registerProfileRoutes(app: FastifyInstance, options: ProfileRouteOptions): void {
  app.get('/profile', async (request, reply) => {
    const session = await requireSession(
      app,
      options.resolveDb,
      request.headers.authorization,
      reply,
    );
    if (session === undefined) return reply;

    const db = options.resolveDb();
    const identity = await buildIdentity(db, session);
    const rows = await db.orm
      .select({
        displayName: s.users.displayName,
        employeeId: s.users.employeeId,
        isActive: s.users.isActive,
      })
      .from(s.users)
      .where(eq(s.users.id, session.userId))
      .limit(1);
    const user = rows[0];
    if (user === undefined) {
      return sendError(reply, API_ERROR_CODES.unauthenticated, 401, SIGN_IN_REQUIRED);
    }

    const locations = await db.orm
      .select({ label: s.locations.label })
      .from(s.userLocations)
      .innerJoin(s.locations, eq(s.locations.id, s.userLocations.locationId))
      .where(eq(s.userLocations.userId, session.userId))
      .orderBy(asc(s.locations.label));

    const body = {
      user: {
        id: identity.user.id,
        username: identity.user.username,
        displayName: user.displayName,
        employeeId: user.employeeId,
        role: identity.user.role,
        isActive: user.isActive,
        locationLabels: locations.map((location) => location.label),
      },
      session: {
        expiresAt: identity.expiresAt,
        post: identity.post,
        shift: identity.shift,
      },
    };

    return reply.code(200).send(parseContract(ProfileResponseSchema, body));
  });
}
