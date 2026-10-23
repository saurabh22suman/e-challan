import type { FastifyInstance, FastifyReply } from 'fastify';
import { API_ERROR_CODES, ApiErrorSchema } from '@echallan/contracts';
import type { Db } from '../db/client.js';
import * as s from '../db/schema.js';
import { resolveSession } from './session.js';

/**
 * Shared HTTP guards for authenticated routes.
 *
 * Authentication and the one scoped read live in `routes.ts`; F-03's master routes
 * reuse these helpers so a protected route cannot drift into a second, weaker
 * definition of "who is the caller".
 */

/** Record ids are UUIDs; anything else is refused before any database call. */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SIGN_IN_REQUIRED = 'Sign in required.';

/** Send a shared-contract error body. */
export function sendError(
  reply: FastifyReply,
  code: (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES],
  status: number,
  message: string,
): FastifyReply {
  return reply.code(status).send(ApiErrorSchema.parse({ error: code, message }));
}

/** Extract a bearer token, or `undefined` when the header is absent or malformed. */
export function bearerToken(authorization: string | undefined): string | undefined {
  if (authorization === undefined) return undefined;
  return /^Bearer\s+(\S+)$/.exec(authorization.trim())?.[1];
}

/**
 * Resolve the caller for a protected route.
 *
 * Returns the live session, or `undefined` after answering 401. Unknown, revoked,
 * idle-expired, absolute-expired and malformed tokens are indistinguishable to the
 * caller by design.
 */
export async function requireSession(
  app: FastifyInstance,
  resolveDb: () => Db,
  authorization: string | undefined,
  reply: FastifyReply,
): Promise<s.Session | undefined> {
  const token = bearerToken(authorization);
  if (token === undefined) {
    sendError(reply, API_ERROR_CODES.unauthenticated, 401, SIGN_IN_REQUIRED);
    return undefined;
  }
  try {
    const session = await resolveSession(resolveDb(), token);
    if (session === null) {
      sendError(reply, API_ERROR_CODES.unauthenticated, 401, SIGN_IN_REQUIRED);
      return undefined;
    }
    return session;
  } catch (error) {
    app.log.error({ err: error }, 'session resolution failed');
    sendError(reply, API_ERROR_CODES.unauthenticated, 401, SIGN_IN_REQUIRED);
    return undefined;
  }
}
