import type { FastifyInstance } from 'fastify';
import {
  API_ERROR_CODES,
  MasterKindSchema,
  MasterListResponseSchema,
  MasterResponseSchema,
  masterRequestSchema,
  parseContract,
  type MasterKind,
} from '@echallan/contracts';
import type { Db } from '../db/client.js';
import * as s from '../db/schema.js';
import { requireSession, sendError, UUID_PATTERN } from '../auth/guard.js';
import {
  MasterFailure,
  createMaster,
  deactivateMaster,
  listMasters,
  updateMaster,
  type MasterCreatePayload,
  type MasterUpdatePayload,
} from './service.js';

/**
 * F-03 master-data API.
 *
 * `GET /masters/:kind` is the active-only selection catalogue for any authenticated
 * role; `/admin/masters/**` is Admin-only management. Routes are mounted at the root
 * beside `/health` and the F-02 auth routes, so the verified Vite `/api` proxy keeps
 * working unchanged. There is deliberately **no delete route**: masters are
 * deactivated, never deleted (E5.3).
 */

export interface MasterRouteOptions {
  /** Resolves the database lazily; every master route is authenticated. */
  resolveDb: () => Db;
}

export function registerMasterRoutes(app: FastifyInstance, options: MasterRouteOptions): void {
  /** Parse the kind segment, answering 404 for anything unapproved. */
  const parseKind = (
    params: unknown,
    reply: Parameters<typeof sendError>[0],
  ): MasterKind | undefined => {
    const raw = (params as { kind?: string }).kind ?? '';
    const parsed = MasterKindSchema.safeParse(raw);
    if (!parsed.success) {
      sendError(reply, API_ERROR_CODES.notFound, 404, 'Unknown master kind.');
      return undefined;
    }
    return parsed.data;
  };

  /** Authenticate and require the Admin role; answers the refusal itself. */
  const requireAdmin = async (
    authorization: string | undefined,
    reply: Parameters<typeof sendError>[0],
  ): Promise<s.Session | undefined> => {
    const session = await requireSession(app, options.resolveDb, authorization, reply);
    if (session === undefined) return undefined;
    if (session.role !== 'Admin') {
      sendError(
        reply,
        API_ERROR_CODES.forbidden,
        403,
        'Only an administrator may manage master data.',
      );
      return undefined;
    }
    return session;
  };

  const handleFailure = (
    error: unknown,
    reply: Parameters<typeof sendError>[0],
  ): never | unknown => {
    if (error instanceof MasterFailure) {
      return sendError(reply, error.code, error.status, error.message);
    }
    throw error;
  };

  /** Active-only selection catalogue: any authenticated session may read it. */
  app.get('/masters/:kind', async (request, reply) => {
    const session = await requireSession(
      app,
      options.resolveDb,
      request.headers.authorization,
      reply,
    );
    if (session === undefined) return reply;
    const kind = parseKind(request.params, reply);
    if (kind === undefined) return reply;

    const masters = await listMasters(options.resolveDb(), kind, { activeOnly: true });
    return reply.send(parseContract(MasterListResponseSchema, { kind, masters }));
  });

  /** Management list: every entry, active and inactive. */
  app.get('/admin/masters/:kind', async (request, reply) => {
    const session = await requireAdmin(request.headers.authorization, reply);
    if (session === undefined) return reply;
    const kind = parseKind(request.params, reply);
    if (kind === undefined) return reply;

    const masters = await listMasters(options.resolveDb(), kind, { activeOnly: false });
    return reply.send(parseContract(MasterListResponseSchema, { kind, masters }));
  });

  app.post('/admin/masters/:kind', async (request, reply) => {
    const session = await requireAdmin(request.headers.authorization, reply);
    if (session === undefined) return reply;
    const kind = parseKind(request.params, reply);
    if (kind === undefined) return reply;

    const parsed = masterRequestSchema(kind, 'create').safeParse(request.body);
    if (!parsed.success) {
      return sendError(
        reply,
        API_ERROR_CODES.invalidRequest,
        400,
        'The master payload is not valid for this kind.',
      );
    }

    try {
      const master = await createMaster(
        options.resolveDb(),
        kind,
        parsed.data as MasterCreatePayload,
      );
      return reply.code(201).send(parseContract(MasterResponseSchema, { master }));
    } catch (error) {
      return handleFailure(error, reply);
    }
  });

  app.patch('/admin/masters/:kind/:id', async (request, reply) => {
    const session = await requireAdmin(request.headers.authorization, reply);
    if (session === undefined) return reply;
    const kind = parseKind(request.params, reply);
    if (kind === undefined) return reply;

    const { id } = request.params as { id: string };
    if (!UUID_PATTERN.test(id)) {
      return sendError(reply, API_ERROR_CODES.notFound, 404, 'No such master entry.');
    }

    const parsed = masterRequestSchema(kind, 'update').safeParse(request.body);
    if (!parsed.success) {
      return sendError(
        reply,
        API_ERROR_CODES.invalidRequest,
        400,
        'The master payload is not valid for this kind.',
      );
    }

    try {
      const master = await updateMaster(
        options.resolveDb(),
        kind,
        id,
        parsed.data as MasterUpdatePayload,
      );
      return reply.send(parseContract(MasterResponseSchema, { master }));
    } catch (error) {
      return handleFailure(error, reply);
    }
  });

  /** Idempotent deactivation; the row and its history are retained. */
  app.post('/admin/masters/:kind/:id/deactivate', async (request, reply) => {
    const session = await requireAdmin(request.headers.authorization, reply);
    if (session === undefined) return reply;
    const kind = parseKind(request.params, reply);
    if (kind === undefined) return reply;

    const { id } = request.params as { id: string };
    if (!UUID_PATTERN.test(id)) {
      return sendError(reply, API_ERROR_CODES.notFound, 404, 'No such master entry.');
    }

    try {
      const master = await deactivateMaster(options.resolveDb(), kind, id);
      return reply.send(parseContract(MasterResponseSchema, { master }));
    } catch (error) {
      return handleFailure(error, reply);
    }
  });
}
