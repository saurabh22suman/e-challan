import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  API_ERROR_CODES,
  AmbiguousContextResponseSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  SessionResponseSchema,
  parseContract,
} from '@echallan/contracts';
import type { Db } from '../db/client.js';
import type { DemoCredentials } from './config.js';
import { AuthFailure, buildIdentity, login } from './service.js';
import { revokeSession } from './session.js';
import { bearerToken, requireSession, sendError, SIGN_IN_REQUIRED } from './guard.js';

/**
 * Authentication (addendum A v0.2).
 *
 * Routes are mounted **at the root**, beside the existing `/health` probes and
 * the challan review routes,
 * because the verified Vite proxy strips the `/api` prefix. The browser therefore
 * calls `/api/auth/login` while Fastify's own `inject` calls `/auth/login`; that
 * difference is deliberate and is recorded in `specs/003-demo-auth/spec.md`.
 *
 * Every refusal returns the shared error schema with a stable code, so a client
 * branches on the code and never on prose.
 */

export interface AuthRouteOptions {
  /** Resolves the database lazily; only a protected route needs one. */
  resolveDb: () => Db;
  /**
   * Demo credentials for this instance, or `undefined` when none are configured.
   * An instance without credentials **fails closed**: every login attempt is
   * refused rather than allowed.
   */
  credentials: DemoCredentials | undefined;
}

const SIGN_IN_FAILED = 'Sign in failed. Check the username and password and try again.';

/** Send a refusal, logging the code only. Credential material is never logged. */
function sendFailure(
  reply: FastifyReply,
  app: FastifyInstance,
  failure: AuthFailure,
): FastifyReply {
  app.log.info({ code: failure.code, status: failure.status }, 'request refused');
  if (failure.options !== undefined) {
    // The one richer refusal: stored candidates for explicit selection. Validated
    // against the shared contract so an option set can never drift.
    return reply.code(failure.status).send(
      parseContract(AmbiguousContextResponseSchema, {
        error: failure.code,
        message: failure.message,
        postOptions: failure.options.postOptions,
        shiftOptions: failure.options.shiftOptions,
      }),
    );
  }
  return reply.code(failure.status).send(failure.toBody());
}

export function registerAuthRoutes(app: FastifyInstance, options: AuthRouteOptions): void {
  /**
   * `POST /auth/login` — constant-time env credential check, stored identity,
   * optional post/shift context, then a server-side session.
   */
  app.post('/auth/login', async (request, reply) => {
    // Fail closed on an instance with no configured accounts, indistinguishably
    // from a wrong password: it must never authenticate anybody.
    if (options.credentials === undefined) {
      return sendError(reply, API_ERROR_CODES.invalidCredentials, 401, SIGN_IN_FAILED);
    }

    const parsed = LoginRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(
        reply,
        API_ERROR_CODES.invalidRequest,
        400,
        'Enter a username and a password.',
      );
    }

    try {
      const result = await login(options.resolveDb(), options.credentials, parsed.data);
      return reply
        .code(200)
        .send(parseContract(LoginResponseSchema, { token: result.token, ...result.identity }));
    } catch (error) {
      if (error instanceof AuthFailure) return sendFailure(reply, app, error);
      throw error;
    }
  });

  /** `POST /auth/logout` — revokes server-side; repeating it grants nothing. */
  app.post('/auth/logout', async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (token === undefined) {
      return sendError(reply, API_ERROR_CODES.unauthenticated, 401, SIGN_IN_REQUIRED);
    }
    await revokeSession(options.resolveDb(), token);
    // 204 with no body: a logout has nothing to say and nothing to leak.
    return reply.code(204).send();
  });

  /** `GET /auth/session` — the current identity; never a re-issued token. */
  app.get('/auth/session', async (request, reply) => {
    const session = await requireSession(
      app,
      options.resolveDb,
      request.headers.authorization,
      reply,
    );
    if (session === undefined) return reply;
    try {
      const identity = await buildIdentity(options.resolveDb(), session);
      return reply.code(200).send(parseContract(SessionResponseSchema, identity));
    } catch (error) {
      if (error instanceof AuthFailure) return sendFailure(reply, app, error);
      throw error;
    }
  });
}
