import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  API_ERROR_CODES,
  ChallanPreviewRequestSchema,
  ChallanPreviewResponseSchema,
  DraftValidationErrorSchema,
  EntryDraftSchema,
  EntryValidationResponseSchema,
  RegistryLookupQuerySchema,
  RegistryLookupResponseSchema,
  parseContract,
  type DraftErrorCode,
  type DraftFieldError,
  type EntryDraft,
} from '@echallan/contracts';
import type { Db } from '../db/client.js';
import * as s from '../db/schema.js';
import { requireSession, sendError } from '../auth/guard.js';
import {
  DraftFailure,
  lookupRegistry,
  previewChallan,
  recentVehicles,
  validateDraft,
} from './service.js';

/**
 * Pre-issuance routes (I-01/I-05), mounted at the root beside `/health`, the F-02
 * auth routes and the F-03 master routes.
 *
 * Every route is Marshal-only and bound to the marshal's session post: the actual
 * location is never taken from the request body. There is deliberately no issuance
 * or submission route here — that is I-06.
 */

export interface PreIssuanceRouteOptions {
  resolveDb: () => Db;
  /** Injected clock; defaults to the real one. Kept as a function so tests fix T. */
  now?: () => Date;
}

/** Map shared-contract issues onto the field-error vocabulary. */
function mapIssues(
  issues: ReadonlyArray<{ path: PropertyKey[]; code: string; message: string }>,
): DraftFieldError[] {
  return issues.map((issue) => {
    const field = String(issue.path[0] ?? 'draft');
    let code: DraftErrorCode = 'format';
    if (issue.code === 'too_small') code = 'required';
    else if (issue.code === 'too_big') code = 'too_long';
    else if (issue.message === 'Violations must be distinct') code = 'not_distinct';
    return { field, code, message: issue.message };
  });
}

function invalidDraft(reply: FastifyReply, fields: DraftFieldError[]): FastifyReply {
  return reply.code(422).send(
    parseContract(DraftValidationErrorSchema, {
      error: 'invalid_draft',
      message: 'The draft is not valid.',
      fields,
    }),
  );
}

export function registerPreIssuanceRoutes(
  app: FastifyInstance,
  options: PreIssuanceRouteOptions,
): void {
  const now = (): Date => options.now?.() ?? new Date();

  /** Authenticate, require the Marshal role and resolve the session location. */
  const requireMarshalLocation = async (
    authorization: string | undefined,
    reply: FastifyReply,
  ): Promise<string | undefined> => {
    const session = await requireSession(app, options.resolveDb, authorization, reply);
    if (session === undefined) return undefined;
    if (session.role !== 'Marshal') {
      sendError(
        reply,
        API_ERROR_CODES.forbidden,
        403,
        'Only a marshal may use the issuance entry.',
      );
      return undefined;
    }
    if (session.postId === null) {
      sendError(
        reply,
        API_ERROR_CODES.forbiddenContext,
        403,
        'This session has no authorised post. Sign in again at a configured post.',
      );
      return undefined;
    }
    const rows = await options
      .resolveDb()
      .orm.select({ locationId: s.posts.locationId })
      .from(s.posts)
      .where(eq(s.posts.id, session.postId))
      .limit(1);
    const locationId = rows[0]?.locationId;
    if (locationId === undefined) {
      sendError(reply, API_ERROR_CODES.forbiddenContext, 403, 'The session post no longer exists.');
      return undefined;
    }
    return locationId;
  };

  app.get('/registry/recent', async (request, reply) => {
    const locationId = await requireMarshalLocation(request.headers.authorization, reply);
    if (locationId === undefined) return reply;
    const matches = await recentVehicles(options.resolveDb(), locationId, now());
    return reply.send(parseContract(RegistryLookupResponseSchema, { matches }));
  });

  app.get('/registry/lookup', async (request, reply) => {
    const locationId = await requireMarshalLocation(request.headers.authorization, reply);
    if (locationId === undefined) return reply;

    const query = request.query as { field?: string; q?: string };
    const parsed = RegistryLookupQuerySchema.safeParse({ field: query.field, query: query.q });
    if (!parsed.success) {
      return sendError(
        reply,
        API_ERROR_CODES.invalidRequest,
        400,
        'Enter at least three characters to search the registry.',
      );
    }

    const matches = await lookupRegistry(options.resolveDb(), locationId, parsed.data, now());
    return reply.send(parseContract(RegistryLookupResponseSchema, { matches }));
  });

  app.post('/challans/validate', async (request, reply) => {
    const locationId = await requireMarshalLocation(request.headers.authorization, reply);
    if (locationId === undefined) return reply;

    const parsed = EntryDraftSchema.safeParse(request.body);
    if (!parsed.success) return invalidDraft(reply, mapIssues(parsed.error.issues));

    try {
      const result = await validateDraft(
        options.resolveDb(),
        locationId,
        parsed.data as EntryDraft,
      );
      return reply.send(parseContract(EntryValidationResponseSchema, result));
    } catch (error) {
      if (error instanceof DraftFailure) return invalidDraft(reply, error.fields);
      throw error;
    }
  });

  app.post('/challans/preview', async (request, reply) => {
    const locationId = await requireMarshalLocation(request.headers.authorization, reply);
    if (locationId === undefined) return reply;

    const parsed = ChallanPreviewRequestSchema.safeParse(request.body);
    if (!parsed.success) return invalidDraft(reply, mapIssues(parsed.error.issues));

    try {
      const result = await previewChallan(
        options.resolveDb(),
        locationId,
        parsed.data.draft,
        now(),
      );
      return reply.send(parseContract(ChallanPreviewResponseSchema, result));
    } catch (error) {
      if (error instanceof DraftFailure) return invalidDraft(reply, error.fields);
      throw error;
    }
  });
}
