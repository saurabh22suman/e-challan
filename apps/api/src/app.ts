import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import {
  API_ERROR_CODES,
  ApiErrorSchema,
  HEALTH_OK,
  HealthResponseSchema,
  READY_OK,
  ReadyResponseSchema,
  parseContract,
} from '@echallan/contracts';
import { createDb, type Db } from './db/client.js';
import { getEnv } from './env.js';
import type { DemoCredentials } from './auth/config.js';
import { registerAdminRoutes } from './admin/routes.js';
import { createLocalDiskEvidenceStore, type EvidenceStore } from './evidence/localDisk.js';
import { registerEvidenceRoutes } from './evidence/routes.js';
import { registerIssuanceRoutes } from './issuance/routes.js';
import { registerAuthRoutes } from './auth/routes.js';
import { registerChallanRoutes } from './challans/routes.js';
import { registerMasterRoutes } from './masters/routes.js';
import { registerPreIssuanceRoutes } from './preIssuance/routes.js';
import { registerProfileRoutes } from './profile/routes.js';
import { registerReportRoutes } from './reports/routes.js';

export interface CreateAppOptions {
  /** Pre-built database dependency. Injected by tests and by `server.ts`. */
  db?: Db;
  /**
   * Lazy database factory. Called at most once, on the first readiness probe,
   * so constructing the app never requires a database or a configured
   * environment. Defaults to building a pool from `DATABASE_URL`.
   */
  createDb?: () => Db;
  /** Extra logging destination (unit tests inject a spy here). */
  onReadinessError?: (error: unknown) => void;
  /** Fastify logger options. Off by default so unit tests stay quiet. */
  logger?: FastifyServerOptions['logger'];
  /**
   * Clock seam for the pre-issuance preview. Defaults to the real clock; tests
   * inject a fixed instant so the 90-day and 15-minute boundaries are exact.
   */
  now?: () => Date;
  /** Injected local evidence store; tests use a temporary directory. */
  evidenceStore?: EvidenceStore;
  /**
   * Demo credentials for this instance.
   *
   * The factory has **no implicit environment fallback**: omitting this means
   * "this instance has no configured demo accounts", whatever is present in
   * `process.env` or the root `.env`. Production startup validates credentials
   * fatally in `server.ts` and passes them in explicitly; a test factory that
   * omits them fails every authentication attempt closed, which is a seam for
   * health-only suites rather than a way to disable authentication.
   */
  credentials?: DemoCredentials;
}

/** Body returned when PostgreSQL cannot be reached. Never validated as ready. */
export const READINESS_UNAVAILABLE = {
  status: 'error',
  database: 'unavailable',
} as const;

/**
 * Foundation Fastify application: liveness, readiness, demo authentication and one
 * scoped protected read.
 *
 * `GET /health` never touches PostgreSQL. `GET /health/ready` queries the real
 * database and reports 503 with the cause logged when it cannot answer; it never
 * returns 200 without having queried. The `/auth/*` routes and `GET /challans/:id`
 * resolve the caller server-side; see `src/auth/`.
 */
export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  // Four 800 KB photos arrive as base64 JSON, so the default 1 MB body limit is
  // smaller than a valid issuance request. Keep a finite, explicit ceiling.
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 12 * 1024 * 1024 });
  let db: Db | undefined;
  let ownsDb = false;

  const evidenceStore = options.evidenceStore ?? createLocalDiskEvidenceStore();
  const resolveDb = (): Db => {
    db ??= options.db ?? (options.createDb ?? defaultDbFactory)();
    ownsDb = options.db === undefined;
    return db;
  };

  // Credentials come only from the caller. The factory never reads the
  // environment, so "no credentials" is unambiguous and testable: every login on
  // such an instance fails closed.
  if (options.credentials === undefined) {
    app.log.error(
      'demo credentials are not configured: authentication fails closed on this instance',
    );
  }

  app.get('/health', async () => parseContract(HealthResponseSchema, HEALTH_OK));

  app.get('/health/ready', async (_request, reply) => {
    try {
      await resolveDb().ping();
      return parseContract(ReadyResponseSchema, READY_OK);
    } catch (error) {
      options.onReadinessError?.(error);
      app.log.error({ err: error }, 'readiness probe failed: PostgreSQL is unavailable');
      return reply.code(503).send(READINESS_UNAVAILABLE);
    }
  });

  // A failed request must never serialise internal detail: Fastify's default
  // handler puts the thrown message (which can contain a query and its parameters)
  // into the response body. Client errors keep their status with a generic message;
  // unexpected errors are logged in full and answered with a stable code.
  app.setErrorHandler<{ statusCode?: number; message?: string }>((error, request, reply) => {
    app.log.error({ err: error, reqId: request.id }, 'request failed');
    const status = typeof error.statusCode === 'number' ? error.statusCode : 500;
    if (status >= 400 && status < 500) {
      return reply.code(status).send(
        ApiErrorSchema.parse({
          error: API_ERROR_CODES.invalidRequest,
          message: 'The request could not be processed.',
        }),
      );
    }
    return reply.code(500).send(
      ApiErrorSchema.parse({
        error: API_ERROR_CODES.internalError,
        message: 'Something went wrong.',
      }),
    );
  });

  registerAuthRoutes(app, { resolveDb, credentials: options.credentials });
  registerChallanRoutes(app, { resolveDb });
  registerAdminRoutes(app, { resolveDb });
  registerProfileRoutes(app, { resolveDb });
  registerMasterRoutes(app, { resolveDb });
  registerPreIssuanceRoutes(app, { resolveDb, now: options.now });
  registerIssuanceRoutes(app, { resolveDb, now: options.now, evidenceStore });
  registerEvidenceRoutes(app, { resolveDb, store: evidenceStore });
  registerReportRoutes(app, { resolveDb, now: options.now });

  app.addHook('onClose', async () => {
    if (db && ownsDb) await db.close();
  });

  return app;
}

function defaultDbFactory(): Db {
  return createDb(getEnv().DATABASE_URL);
}
