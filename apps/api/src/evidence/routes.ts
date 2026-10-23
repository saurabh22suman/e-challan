import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { asc, eq } from 'drizzle-orm';
import { API_ERROR_CODES, ChallanEvidenceResponseSchema, parseContract } from '@echallan/contracts';
import type { Db } from '../db/client.js';
import * as s from '../db/schema.js';
import { getChallanDetail } from '../challans/service.js';
import { requireSession, sendError, UUID_PATTERN } from '../auth/guard.js';
import type { EvidenceStore } from './localDisk.js';

export interface EvidenceRouteOptions {
  resolveDb: () => Db;
  store: EvidenceStore;
}

function iso(value: Date): string {
  return value.toISOString();
}

/** Authorisation is the same scoped detail rule used by the review workspace. */
async function authorisedDetail(
  db: Db,
  session: s.Session,
  id: string,
  reply: Parameters<typeof sendError>[0],
) {
  if (!UUID_PATTERN.test(id)) {
    sendError(reply, API_ERROR_CODES.notFound, 404, 'No such challan.');
    return undefined;
  }
  const result = await getChallanDetail(db, session, id);
  if (result.kind === 'not_found') {
    sendError(reply, API_ERROR_CODES.notFound, 404, 'No such challan.');
    return undefined;
  }
  if (result.kind === 'forbidden') {
    sendError(
      reply,
      API_ERROR_CODES.forbidden,
      403,
      'That challan is outside your authorised location.',
    );
    return undefined;
  }
  return result.detail;
}

export function registerEvidenceRoutes(app: FastifyInstance, options: EvidenceRouteOptions): void {
  app.get('/challans/:id/evidence', async (request, reply) => {
    const session = await requireSession(
      app,
      options.resolveDb,
      request.headers.authorization,
      reply,
    );
    if (session === undefined) return reply;
    const { id } = request.params as { id: string };
    const db = options.resolveDb();
    const detail = await authorisedDetail(db, session, id, reply);
    if (detail === undefined) return reply;

    const photos = await db.orm
      .select({
        id: s.evidence.id,
        ordinal: s.evidence.ordinal,
        contentType: s.evidence.contentType,
        byteSize: s.evidence.byteSize,
        capturedAt: s.evidence.capturedAt,
      })
      .from(s.evidence)
      .where(eq(s.evidence.challanId, id))
      .orderBy(asc(s.evidence.ordinal));
    const signature = (
      await db.orm
        .select({
          id: s.signatures.id,
          contentType: s.signatures.contentType,
          byteSize: s.signatures.byteSize,
          signedAt: s.signatures.signedAt,
        })
        .from(s.signatures)
        .where(eq(s.signatures.challanId, id))
        .limit(1)
    )[0];
    const refusal = (
      await db.orm
        .select({
          id: s.refusals.id,
          reason: s.refusals.reason,
          witnessName: s.refusals.witnessName,
          witnessStaffId: s.refusals.witnessStaffId,
          refusedAt: s.refusals.refusedAt,
        })
        .from(s.refusals)
        .where(eq(s.refusals.challanId, id))
        .limit(1)
    )[0];

    return reply.code(200).send(
      parseContract(ChallanEvidenceResponseSchema, {
        photos: photos.map((photo) => ({
          id: photo.id,
          ordinal: photo.ordinal,
          contentType: photo.contentType ?? 'application/octet-stream',
          byteSize: photo.byteSize,
          capturedAt: iso(photo.capturedAt),
        })),
        signature:
          signature === undefined
            ? null
            : {
                id: signature.id,
                contentType: signature.contentType ?? 'application/octet-stream',
                byteSize: signature.byteSize,
                signedAt: iso(signature.signedAt),
              },
        refusal:
          refusal === undefined
            ? null
            : {
                id: refusal.id,
                reason: refusal.reason,
                witnessName: refusal.witnessName,
                witnessStaffId: refusal.witnessStaffId,
                refusedAt: iso(refusal.refusedAt),
              },
      }),
    );
  });

  app.get('/challans/:id/evidence/:evidenceId', async (request, reply) => {
    const session = await requireSession(
      app,
      options.resolveDb,
      request.headers.authorization,
      reply,
    );
    if (session === undefined) return reply;
    const { id, evidenceId } = request.params as { id: string; evidenceId: string };
    const db = options.resolveDb();
    const detail = await authorisedDetail(db, session, id, reply);
    if (detail === undefined) return reply;
    if (!UUID_PATTERN.test(evidenceId)) {
      return sendError(reply, API_ERROR_CODES.notFound, 404, 'No such evidence.');
    }

    const rows = await db.orm
      .select({
        id: s.evidence.id,
        objectKey: s.evidence.objectKey,
        contentType: s.evidence.contentType,
        byteSize: s.evidence.byteSize,
        ordinal: s.evidence.ordinal,
      })
      .from(s.evidence)
      .where(eq(s.evidence.id, evidenceId))
      .limit(1);
    const item = rows[0];
    if (item === undefined || item.objectKey.split('/')[0] !== id) {
      return sendError(reply, API_ERROR_CODES.notFound, 404, 'No such evidence.');
    }

    let bytes: Buffer;
    try {
      bytes = await options.store.get(item.objectKey);
    } catch {
      app.log.warn(
        { challanId: id, evidenceId, objectKey: item.objectKey },
        'evidence file missing',
      );
      return sendError(reply, API_ERROR_CODES.notFound, 404, 'The evidence file is unavailable.');
    }

    await db.orm.insert(s.auditEvents).values({
      id: randomUUID(),
      challanId: id,
      actorUserId: session.userId,
      eventType: 'evidence.viewed',
      source: session.role === 'Marshal' ? 'tablet' : 'admin',
      payload: {
        evidenceId: item.id,
        kind: 'photo',
        ordinal: item.ordinal,
        byteSize: item.byteSize,
      },
    });

    return reply
      .code(200)
      .header('Content-Type', item.contentType ?? 'application/octet-stream')
      .header('Cache-Control', 'private, no-store')
      .header('Content-Disposition', `inline; filename="photo-${item.ordinal}.jpg"`)
      .send(bytes);
  });

  app.get('/challans/:id/signature', async (request, reply) => {
    const session = await requireSession(
      app,
      options.resolveDb,
      request.headers.authorization,
      reply,
    );
    if (session === undefined) return reply;
    const { id } = request.params as { id: string };
    const db = options.resolveDb();
    const detail = await authorisedDetail(db, session, id, reply);
    if (detail === undefined) return reply;

    const rows = await db.orm
      .select({
        id: s.signatures.id,
        objectKey: s.signatures.objectKey,
        contentType: s.signatures.contentType,
        byteSize: s.signatures.byteSize,
      })
      .from(s.signatures)
      .where(eq(s.signatures.challanId, id))
      .limit(1);
    const item = rows[0];
    if (item === undefined) {
      return sendError(reply, API_ERROR_CODES.notFound, 404, 'No signature is recorded.');
    }
    let bytes: Buffer;
    try {
      bytes = await options.store.get(item.objectKey);
    } catch {
      app.log.warn({ challanId: id, signatureId: item.id }, 'signature file missing');
      return sendError(reply, API_ERROR_CODES.notFound, 404, 'The signature file is unavailable.');
    }

    await db.orm.insert(s.auditEvents).values({
      id: randomUUID(),
      challanId: id,
      actorUserId: session.userId,
      eventType: 'evidence.viewed',
      source: session.role === 'Marshal' ? 'tablet' : 'admin',
      payload: { kind: 'signature', signatureId: item.id, byteSize: item.byteSize },
    });

    return reply
      .code(200)
      .header('Content-Type', item.contentType ?? 'image/png')
      .header('Cache-Control', 'private, no-store')
      .header('Content-Disposition', 'inline; filename="signature.png"')
      .send(bytes);
  });
}
