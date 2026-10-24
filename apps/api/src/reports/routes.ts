import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  API_ERROR_CODES,
  ChallanReportQuerySchema,
  ChallanReportResponseSchema,
  ChallanTrendQuerySchema,
  ChallanTrendResponseSchema,
  parseContract,
} from '@echallan/contracts';
import type { Db } from '../db/client.js';
import * as s from '../db/schema.js';
import { requireSession, sendError } from '../auth/guard.js';
import { exportChallans, reportChallanTrend, reportChallans } from './service.js';

export interface ReportRouteOptions {
  resolveDb: () => Db;
  now?: () => Date;
}

/**
 * Server-side reporting (E4.1–E4.5). Filters, totals, sorting, pagination and
 * Excel generation happen on the server against the caller's authorised scope.
 */
export function registerReportRoutes(app: FastifyInstance, options: ReportRouteOptions): void {
  const now = (): Date => options.now?.() ?? new Date();

  async function sessionFor(
    authorization: string | undefined,
    reply: Parameters<typeof sendError>[0],
  ) {
    const session = await requireSession(app, options.resolveDb, authorization, reply);
    if (session === undefined) return undefined;
    if (session.role !== 'Supervisor' && session.role !== 'Admin') {
      sendError(
        reply,
        API_ERROR_CODES.forbidden,
        403,
        'Reporting is available to supervisors and admins only.',
      );
      return undefined;
    }
    return session;
  }

  app.get('/challans/report/trend', async (request, reply) => {
    const session = await sessionFor(request.headers.authorization, reply);
    if (session === undefined) return reply;
    const parsed = ChallanTrendQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return sendError(
        reply,
        API_ERROR_CODES.invalidRequest,
        400,
        'Choose a valid trend range and granularity.',
      );
    }
    const result = await reportChallanTrend(options.resolveDb(), session, parsed.data, now());
    if (!result.ok) {
      if (result.reason === 'forbidden') {
        return sendError(
          reply,
          API_ERROR_CODES.forbidden,
          403,
          'No authorised locations match this trend filter.',
        );
      }
      return sendError(
        reply,
        API_ERROR_CODES.invalidRequest,
        400,
        'Choose a date range of 365 days or fewer, with the start on or before the end.',
      );
    }
    return reply.code(200).send(parseContract(ChallanTrendResponseSchema, result.response));
  });

  app.get('/challans/report', async (request, reply) => {
    const session = await sessionFor(request.headers.authorization, reply);
    if (session === undefined) return reply;
    const parsed = ChallanReportQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return sendError(reply, API_ERROR_CODES.invalidRequest, 400, 'Choose a valid report filter.');
    }
    const result = await reportChallans(options.resolveDb(), session, parsed.data, now());
    if (result === null) {
      return reply.code(200).send(
        parseContract(ChallanReportResponseSchema, {
          items: [],
          page: parsed.data.page,
          pageSize: parsed.data.pageSize,
          total: 0,
          totals: {
            total: 0,
            issuedToday: 0,
            pending: 0,
            resolved: 0,
            repeatOffenders: 0,
          },
        }),
      );
    }
    return reply.code(200).send(parseContract(ChallanReportResponseSchema, result));
  });

  app.get('/challans/report/export', async (request, reply) => {
    const session = await sessionFor(request.headers.authorization, reply);
    if (session === undefined) return reply;
    const parsed = ChallanReportQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return sendError(reply, API_ERROR_CODES.invalidRequest, 400, 'Choose a valid export filter.');
    }
    const result = await exportChallans(options.resolveDb(), session, parsed.data, now());
    if (result === null) {
      return sendError(reply, API_ERROR_CODES.forbidden, 403, 'No authorised records to export.');
    }
    const db = options.resolveDb();
    await db.orm.insert(s.auditEvents).values({
      id: randomUUID(),
      challanId: null,
      actorUserId: session.userId,
      eventType: 'challans.exported',
      source: 'admin',
      payload: {
        filters: parsed.data,
        rowCount: result.rowCount,
      },
    });
    return reply
      .code(200)
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="${result.filename}"`)
      .header('Cache-Control', 'private, no-store')
      .send(result.buffer);
  });
}
