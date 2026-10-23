import type { FastifyInstance } from 'fastify';
import {
  API_ERROR_CODES,
  ChallanDetailResponseSchema,
  ChallanListQuerySchema,
  ChallanListResponseSchema,
  ReviewTransitionSchema,
  parseContract,
} from '@echallan/contracts';
import type { Db } from '../db/client.js';
import { requireSession, sendError, UUID_PATTERN } from '../auth/guard.js';
import { getChallanDetail, listChallans, reviewChallan } from './service.js';

export interface ChallanRouteOptions {
  resolveDb: () => Db;
}

/**
 * Review workspace routes.
 *
 * The scoped detail read formerly lived in `auth/routes.ts`; it moved here so the
 * list, detail and transition share one service and one response contract. Its
 * 401/403/404 behavior is unchanged.
 */
export function registerChallanRoutes(app: FastifyInstance, options: ChallanRouteOptions): void {
  app.get('/challans', async (request, reply) => {
    const session = await requireSession(
      app,
      options.resolveDb,
      request.headers.authorization,
      reply,
    );
    if (session === undefined) return reply;

    if (session.role !== 'Supervisor' && session.role !== 'Admin') {
      return sendError(
        reply,
        API_ERROR_CODES.forbidden,
        403,
        'The review list is available to supervisors and admins only.',
      );
    }

    const query = ChallanListQuerySchema.safeParse(request.query);
    if (!query.success) {
      return sendError(reply, API_ERROR_CODES.invalidRequest, 400, 'Choose a valid status filter.');
    }

    const items = await listChallans(options.resolveDb(), session, query.data);
    return reply.code(200).send(parseContract(ChallanListResponseSchema, { items }));
  });

  app.get('/challans/:id', async (request, reply) => {
    const session = await requireSession(
      app,
      options.resolveDb,
      request.headers.authorization,
      reply,
    );
    if (session === undefined) return reply;

    const { id } = request.params as { id: string };
    if (!UUID_PATTERN.test(id)) {
      return sendError(reply, API_ERROR_CODES.notFound, 404, 'No such challan.');
    }

    const result = await getChallanDetail(options.resolveDb(), session, id);
    if (result.kind === 'not_found') {
      return sendError(reply, API_ERROR_CODES.notFound, 404, 'No such challan.');
    }
    if (result.kind === 'forbidden') {
      return sendError(
        reply,
        API_ERROR_CODES.forbidden,
        403,
        'That challan is outside your authorised location.',
      );
    }
    return reply.code(200).send(parseContract(ChallanDetailResponseSchema, result.detail));
  });

  app.post('/challans/:id/review', async (request, reply) => {
    const session = await requireSession(
      app,
      options.resolveDb,
      request.headers.authorization,
      reply,
    );
    if (session === undefined) return reply;

    const { id } = request.params as { id: string };
    if (!UUID_PATTERN.test(id)) {
      return sendError(reply, API_ERROR_CODES.notFound, 404, 'No such challan.');
    }

    const parsed = ReviewTransitionSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(
        reply,
        API_ERROR_CODES.invalidRequest,
        400,
        'Choose an action and enter remarks before resolving.',
      );
    }

    const result = await reviewChallan(options.resolveDb(), session, id, parsed.data);
    if (result.kind === 'not_found') {
      return sendError(reply, API_ERROR_CODES.notFound, 404, 'No such challan.');
    }
    if (result.kind === 'forbidden') {
      return sendError(
        reply,
        API_ERROR_CODES.forbidden,
        403,
        'You are not authorised to review that challan.',
      );
    }
    if (result.kind === 'invalid_request') {
      return sendError(reply, API_ERROR_CODES.invalidRequest, 400, result.message);
    }
    if (result.kind === 'invalid_transition') {
      return sendError(reply, API_ERROR_CODES.invalidTransition, 409, result.message);
    }
    return reply.code(200).send(parseContract(ChallanDetailResponseSchema, result.detail));
  });
}
