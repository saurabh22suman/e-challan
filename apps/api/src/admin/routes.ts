import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
  API_ERROR_CODES,
  AdminUserListResponseSchema,
  AdminUserResponseSchema,
  CreateUserRequestSchema,
  ResetPasswordRequestSchema,
  parseContract,
} from '@echallan/contracts';
import type { Db } from '../db/client.js';
import * as s from '../db/schema.js';
import { hashPassword } from '../auth/password.js';
import { requireSession, sendError, UUID_PATTERN } from '../auth/guard.js';

export interface AdminRouteOptions {
  resolveDb: () => Db;
}

/**
 * Admin-only user administration for the bounded reset slice.
 *
 * A reset writes an Argon2id hash and revokes every live session for that user.
 * It never enables an inactive account, never creates/disables a user (E1.4
 * remainder) and never returns password material.
 */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

export function registerAdminRoutes(app: FastifyInstance, options: AdminRouteOptions): void {
  app.get('/admin/users', async (request, reply) => {
    const session = await requireSession(
      app,
      options.resolveDb,
      request.headers.authorization,
      reply,
    );
    if (session === undefined) return reply;
    if (session.role !== 'Admin') {
      return sendError(
        reply,
        API_ERROR_CODES.forbidden,
        403,
        'User administration is available to admins only.',
      );
    }

    const db = options.resolveDb();
    const users = await db.orm
      .select({
        id: s.users.id,
        username: s.users.username,
        displayName: s.users.displayName,
        role: s.users.role,
        isActive: s.users.isActive,
      })
      .from(s.users)
      .orderBy(asc(s.users.username));

    const assignments = await db.orm
      .select({
        userId: s.userLocations.userId,
        label: s.locations.label,
      })
      .from(s.userLocations)
      .innerJoin(s.locations, eq(s.locations.id, s.userLocations.locationId))
      .orderBy(asc(s.locations.label));

    const labelsByUser = new Map<string, string[]>();
    for (const assignment of assignments) {
      const labels = labelsByUser.get(assignment.userId) ?? [];
      labels.push(assignment.label);
      labelsByUser.set(assignment.userId, labels);
    }

    const body = {
      users: users.map((user) => ({
        ...user,
        locationLabels: labelsByUser.get(user.id) ?? [],
      })),
    };
    return reply.code(200).send(parseContract(AdminUserListResponseSchema, body));
  });

  app.post('/admin/users', async (request, reply) => {
    const session = await requireSession(
      app,
      options.resolveDb,
      request.headers.authorization,
      reply,
    );
    if (session === undefined) return reply;
    if (session.role !== 'Admin') {
      return sendError(
        reply,
        API_ERROR_CODES.forbidden,
        403,
        'User administration is available to admins only.',
      );
    }

    const parsed = CreateUserRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(
        reply,
        API_ERROR_CODES.invalidRequest,
        400,
        'Enter valid user details, locations and an initial password.',
      );
    }
    const input = parsed.data;

    const db = options.resolveDb();
    const existing = await db.orm
      .select({ id: s.users.id })
      .from(s.users)
      .where(sql`lower(${s.users.username}) = lower(${input.username})`)
      .limit(1);
    if (existing.length > 0) {
      return sendError(
        reply,
        API_ERROR_CODES.conflict,
        409,
        'That username is already in use. Choose another.',
      );
    }

    let locationLabels: string[] = [];
    if (input.locationIds.length > 0) {
      const activeLocations = await db.orm
        .select({ id: s.locations.id, label: s.locations.label })
        .from(s.locations)
        .where(and(inArray(s.locations.id, input.locationIds), eq(s.locations.isActive, true)));
      if (activeLocations.length !== input.locationIds.length) {
        return sendError(
          reply,
          API_ERROR_CODES.invalidReference,
          400,
          'Choose existing active locations.',
        );
      }
      locationLabels = activeLocations.map((location) => location.label);
    }

    // Hash before the transaction; the plaintext never leaves this scope.
    const passwordHash = await hashPassword(input.password);
    const userId = randomUUID();
    const created = {
      id: userId,
      username: input.username,
      displayName: input.displayName,
      role: input.role,
      isActive: true,
      locationLabels,
    };

    try {
      await db.orm.transaction(async (tx) => {
        await tx.insert(s.users).values({
          id: userId,
          username: input.username,
          displayName: input.displayName,
          employeeId: input.employeeId ?? null,
          role: input.role,
          isActive: true,
          passwordHash,
        });
        if (input.locationIds.length > 0) {
          await tx.insert(s.userLocations).values(
            input.locationIds.map((locationId) => ({
              userId,
              locationId,
            })),
          );
        }
        await tx.insert(s.auditEvents).values({
          id: randomUUID(),
          challanId: null,
          actorUserId: session.userId,
          eventType: 'user.created',
          source: 'admin',
          payload: {
            userId,
            username: input.username,
            role: input.role,
            locationIds: input.locationIds,
          },
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return sendError(
          reply,
          API_ERROR_CODES.conflict,
          409,
          'That username is already in use. Choose another.',
        );
      }
      throw error;
    }

    return reply.code(201).send(parseContract(AdminUserResponseSchema, { user: created }));
  });

  app.post('/admin/users/:id/deactivate', async (request, reply) => {
    const session = await requireSession(
      app,
      options.resolveDb,
      request.headers.authorization,
      reply,
    );
    if (session === undefined) return reply;
    if (session.role !== 'Admin') {
      return sendError(
        reply,
        API_ERROR_CODES.forbidden,
        403,
        'User administration is available to admins only.',
      );
    }

    const { id } = request.params as { id: string };
    if (!UUID_PATTERN.test(id)) {
      return sendError(reply, API_ERROR_CODES.notFound, 404, 'No such user.');
    }
    if (id === session.userId) {
      return sendError(
        reply,
        API_ERROR_CODES.invalidRequest,
        400,
        'You cannot deactivate your own account.',
      );
    }

    const db = options.resolveDb();
    const rows = await db.orm
      .select({ id: s.users.id, username: s.users.username, isActive: s.users.isActive })
      .from(s.users)
      .where(eq(s.users.id, id))
      .limit(1);
    const target = rows[0];
    if (target === undefined) {
      return sendError(reply, API_ERROR_CODES.notFound, 404, 'No such user.');
    }

    if (target.isActive) {
      await db.orm.transaction(async (tx) => {
        await tx.update(s.users).set({ isActive: false }).where(eq(s.users.id, id));
        await tx
          .update(s.sessions)
          .set({ revokedAt: new Date() })
          .where(and(eq(s.sessions.userId, id), isNull(s.sessions.revokedAt)));
        await tx.insert(s.auditEvents).values({
          id: randomUUID(),
          challanId: null,
          actorUserId: session.userId,
          eventType: 'user.deactivated',
          source: 'admin',
          payload: { userId: target.id, username: target.username },
        });
      });
    }

    return reply.code(204).send();
  });

  app.post('/admin/users/:id/reactivate', async (request, reply) => {
    const session = await requireSession(
      app,
      options.resolveDb,
      request.headers.authorization,
      reply,
    );
    if (session === undefined) return reply;
    if (session.role !== 'Admin') {
      return sendError(
        reply,
        API_ERROR_CODES.forbidden,
        403,
        'User administration is available to admins only.',
      );
    }

    const { id } = request.params as { id: string };
    if (!UUID_PATTERN.test(id)) {
      return sendError(reply, API_ERROR_CODES.notFound, 404, 'No such user.');
    }

    const db = options.resolveDb();
    const rows = await db.orm
      .select({ id: s.users.id, username: s.users.username, isActive: s.users.isActive })
      .from(s.users)
      .where(eq(s.users.id, id))
      .limit(1);
    const target = rows[0];
    if (target === undefined) {
      return sendError(reply, API_ERROR_CODES.notFound, 404, 'No such user.');
    }

    if (!target.isActive) {
      await db.orm.transaction(async (tx) => {
        await tx.update(s.users).set({ isActive: true }).where(eq(s.users.id, id));
        await tx.insert(s.auditEvents).values({
          id: randomUUID(),
          challanId: null,
          actorUserId: session.userId,
          eventType: 'user.reactivated',
          source: 'admin',
          payload: { userId: target.id, username: target.username },
        });
      });
    }

    return reply.code(204).send();
  });

  app.post('/admin/users/:id/reset-password', async (request, reply) => {
    const session = await requireSession(
      app,
      options.resolveDb,
      request.headers.authorization,
      reply,
    );
    if (session === undefined) return reply;
    if (session.role !== 'Admin') {
      return sendError(
        reply,
        API_ERROR_CODES.forbidden,
        403,
        'User administration is available to admins only.',
      );
    }

    const { id } = request.params as { id: string };
    if (!UUID_PATTERN.test(id)) {
      return sendError(reply, API_ERROR_CODES.notFound, 404, 'No such user.');
    }

    const parsed = ResetPasswordRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(
        reply,
        API_ERROR_CODES.invalidRequest,
        400,
        'Enter a password of at least 12 characters.',
      );
    }

    const db = options.resolveDb();
    const rows = await db.orm
      .select({
        id: s.users.id,
        username: s.users.username,
        role: s.users.role,
      })
      .from(s.users)
      .where(eq(s.users.id, id))
      .limit(1);
    const target = rows[0];
    if (target === undefined) {
      return sendError(reply, API_ERROR_CODES.notFound, 404, 'No such user.');
    }

    // Hash before opening the transaction: Argon2 is deliberately slow and must
    // not hold a database lock. The plaintext never leaves this local scope.
    const passwordHash = await hashPassword(parsed.data.password);

    await db.orm.transaction(async (tx) => {
      await tx.update(s.users).set({ passwordHash }).where(eq(s.users.id, id));
      await tx
        .update(s.sessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(s.sessions.userId, id), isNull(s.sessions.revokedAt)));
      await tx.insert(s.auditEvents).values({
        id: randomUUID(),
        challanId: null,
        actorUserId: session.userId,
        eventType: 'user.password_reset',
        source: 'admin',
        payload: {
          userId: target.id,
          username: target.username,
          role: target.role,
        },
      });
    });

    return reply.code(204).send();
  });
}
