import type { FastifyInstance } from 'fastify';
import {
  API_ERROR_CODES,
  ChallanCommitRequestSchema,
  DraftValidationErrorSchema,
  parseContract,
} from '@echallan/contracts';
import type { Db } from '../db/client.js';
import { requireSession, sendError } from '../auth/guard.js';
import { DraftFailure } from '../preIssuance/service.js';
import { createLocalDiskEvidenceStore, type EvidenceStore } from '../evidence/localDisk.js';
import { ChallanCommitFailure, commitChallan } from './service.js';

export interface IssuanceRouteOptions {
  resolveDb: () => Db;
  evidenceStore?: EvidenceStore;
  now?: () => Date;
}

/**
 * The single issuance write (I-06). Every field that can carry authority is
 * resolved from the authenticated marshal session and stored rows; the request
 * cannot name a role, post, location, status, number or timestamp.
 */
export function registerIssuanceRoutes(app: FastifyInstance, options: IssuanceRouteOptions): void {
  const store = options.evidenceStore ?? createLocalDiskEvidenceStore();
  const now = (): Date => options.now?.() ?? new Date();

  app.post('/challans', async (request, reply) => {
    const session = await requireSession(
      app,
      options.resolveDb,
      request.headers.authorization,
      reply,
    );
    if (session === undefined) return reply;

    if (session.role !== 'Marshal') {
      return sendError(
        reply,
        API_ERROR_CODES.forbidden,
        403,
        'Only a marshal may issue a challan from the tablet.',
      );
    }
    if (session.postId === null || session.shiftId === null) {
      return sendError(
        reply,
        API_ERROR_CODES.forbiddenContext,
        403,
        'This session has no authorised post and shift.',
      );
    }

    const parsed = ChallanCommitRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(
        reply,
        API_ERROR_CODES.invalidRequest,
        400,
        'Complete the entry, evidence and driver acknowledgement before issuing.',
      );
    }

    try {
      const result = await commitChallan({
        db: options.resolveDb(),
        store,
        session,
        request: parsed.data,
        now: now(),
      });
      return reply.code(result.replayed ? 200 : 201).send(result);
    } catch (error) {
      if (error instanceof DraftFailure) {
        return reply.code(422).send(
          parseContract(DraftValidationErrorSchema, {
            error: 'invalid_draft',
            message: 'The challan details are not valid.',
            fields: error.fields,
          }),
        );
      }
      if (error instanceof ChallanCommitFailure) {
        if (error.code === 'invalid_draft' && error.fields !== undefined) {
          return reply.code(error.status).send(
            parseContract(DraftValidationErrorSchema, {
              error: 'invalid_draft',
              message: error.message,
              fields: error.fields,
            }),
          );
        }
        return sendError(
          reply,
          error.code as (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES],
          error.status,
          error.message,
        );
      }
      throw error;
    }
  });
}
