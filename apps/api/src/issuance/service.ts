import { createHash, randomUUID } from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import {
  ChallanCommitResponseSchema,
  deriveSummaryRevision,
  recommendedActionForOccurrence,
  type ChallanCommitRequest,
  type ChallanCommitResponse,
  type DraftFieldError,
} from '@echallan/contracts';
import type { Db } from '../db/client.js';
import * as s from '../db/schema.js';
import { loadChallanDetail } from '../challans/service.js';
import { previewChallan, validateDraft } from '../preIssuance/service.js';
import type { EvidenceStore } from '../evidence/localDisk.js';

/**
 * I-06 atomic submission.
 *
 * The server owns the number, attribution, snapshots, occurrence/recommendation,
 * severity and timestamps. Evidence bytes are written before the database
 * transaction and removed if the transaction fails; the database stores object
 * keys only. The operation id makes a lost-response retry return the same record.
 */

export class ChallanCommitFailure extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: DraftFieldError[];

  constructor(status: number, code: string, message: string, fields?: DraftFieldError[]) {
    super(message);
    this.name = 'ChallanCommitFailure';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

interface CommitContext {
  db: Db;
  store: EvidenceStore;
  session: s.Session;
  request: ChallanCommitRequest;
  now: Date;
}

const NUMBER_PREFIX = 'DEMO';

function operationHash(request: ChallanCommitRequest): string {
  return createHash('sha256').update(JSON.stringify(request), 'utf8').digest('hex');
}

function kolkataPeriod(now: Date): { year: string; month: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';
  return { year: get('year'), month: get('month') };
}

async function allocateChallanNumber(
  tx: Parameters<Parameters<Db['orm']['transaction']>[0]>[0],
  now: Date,
): Promise<string> {
  const { year, month } = kolkataPeriod(now);
  const period = `${year}/${month}`;
  const prefix = `${NUMBER_PREFIX}/${period}/`;

  // Serialise number allocation per period. The unique constraint remains the
  // final guard; gaps are explicitly allowed by the approved specification.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'echallan:number:' + prefix}))`);
  const result = await tx.execute<{ next: number }>(sql`
    SELECT COALESCE(
      MAX((regexp_match(challan_number, '^DEMO/[0-9]{4}/[0-9]{2}/([0-9]+)$'))[1]::int),
      0
    ) + 1 AS next
      FROM challans
     WHERE challan_number LIKE ${prefix + '%'}
  `);
  const next = Number(result.rows[0]?.next ?? 1);
  return `${prefix}${String(next).padStart(4, '0')}`;
}

function decodeDataUrl(dataUrl: string, mediaType: 'image/jpeg' | 'image/png'): Buffer {
  const expected = `data:${mediaType};base64,`;
  if (!dataUrl.startsWith(expected)) {
    throw new ChallanCommitFailure(400, 'invalid_request', 'The captured evidence is not valid.');
  }
  try {
    const bytes = Buffer.from(dataUrl.slice(expected.length), 'base64');
    const hasSignature =
      mediaType === 'image/jpeg'
        ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : bytes.length >= 8 &&
          bytes
            .subarray(0, 8)
            .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (!hasSignature) {
      throw new ChallanCommitFailure(400, 'invalid_request', 'The captured evidence is not valid.');
    }
    return bytes;
  } catch (error) {
    if (error instanceof ChallanCommitFailure) throw error;
    throw new ChallanCommitFailure(400, 'invalid_request', 'The captured evidence is not valid.');
  }
}

async function masterLabel(
  db: Db,
  table: typeof s.departments | typeof s.vehicleTypes | typeof s.contractors,
  id: string,
  field: string,
): Promise<{ label: string; isActive: boolean }> {
  const rows = await db.orm
    .select({ label: table.label, isActive: table.isActive })
    .from(table)
    .where(eq(table.id, id))
    .limit(1);
  const row = rows[0];
  if (row === undefined || !row.isActive) {
    throw new ChallanCommitFailure(422, 'invalid_draft', 'Choose active master data.', [
      { field, code: 'inactive_master', message: 'Choose active master data.' },
    ]);
  }
  return row;
}

function toResponse(
  detail: Awaited<ReturnType<typeof loadChallanDetail>>,
  replayed: boolean,
): ChallanCommitResponse {
  if (detail === null) {
    throw new ChallanCommitFailure(500, 'internal_error', 'The issued challan could not be read.');
  }
  return ChallanCommitResponseSchema.parse({
    id: detail.id,
    challanNumber: detail.challanNumber,
    status: detail.status,
    severity: detail.severity,
    occurrenceNumber: detail.occurrenceNumber,
    recommendedAction: detail.recommendedAction,
    issuedAt: detail.issuedAt,
    replayed,
  });
}

async function findExisting(db: Db, request: ChallanCommitRequest) {
  const rows = await db.orm
    .select({
      id: s.challans.id,
      operationHash: s.challans.operationHash,
      issuedByUserId: s.challans.issuedByUserId,
    })
    .from(s.challans)
    .where(eq(s.challans.operationId, request.operationId))
    .limit(1);
  return rows[0];
}

async function removeFiles(store: EvidenceStore, keys: readonly string[]): Promise<void> {
  await Promise.all(keys.map((key) => store.remove(key).catch(() => undefined)));
}

export async function commitChallan(context: CommitContext): Promise<ChallanCommitResponse> {
  const { db, store, session, request, now } = context;
  if (session.role !== 'Marshal' || session.postId === null || session.shiftId === null) {
    throw new ChallanCommitFailure(
      403,
      'forbidden_context',
      'Only a marshal with an authorised post and shift may issue a challan.',
    );
  }

  const hash = operationHash(request);
  const existing = await findExisting(db, request);
  if (existing !== undefined) {
    if (existing.operationHash !== hash || existing.issuedByUserId !== session.userId) {
      throw new ChallanCommitFailure(
        409,
        'conflict',
        'That submission operation cannot be replayed by this session.',
      );
    }
    return toResponse(await loadChallanDetail(db, existing.id), true);
  }

  const postRows = await db.orm
    .select({
      id: s.posts.id,
      locationId: s.posts.locationId,
      gateId: s.posts.gateId,
      isActive: s.posts.isActive,
    })
    .from(s.posts)
    .where(eq(s.posts.id, session.postId))
    .limit(1);
  const post = postRows[0];
  const shiftRows = await db.orm
    .select({ id: s.shifts.id, gateId: s.shifts.gateId, isActive: s.shifts.isActive })
    .from(s.shifts)
    .where(eq(s.shifts.id, session.shiftId))
    .limit(1);
  const shift = shiftRows[0];
  if (
    post === undefined ||
    shift === undefined ||
    !post.isActive ||
    !shift.isActive ||
    shift.gateId !== post.gateId
  ) {
    throw new ChallanCommitFailure(
      403,
      'forbidden_context',
      'The session post and shift are no longer authorised.',
    );
  }

  const draft = request.draft;
  const validation = await validateDraft(db, post.locationId, draft);
  const preview = await previewChallan(db, post.locationId, draft, now);
  const expectedRevision = deriveSummaryRevision({
    // The frozen summary helper models an absent contractor as `''`; the API
    // draft uses `null` for the same state.
    draft: { ...draft, contractorId: draft.contractorId ?? '' },
    preview,
    // The tablet's frozen summary helper binds the session context to the post
    // id it receives from the login response. Use the same stable value server-side
    // so a valid acknowledgement cannot be rejected by an id-vocabulary mismatch.
    locationId: session.postId,
  });
  if (expectedRevision !== request.summaryRevision) {
    throw new ChallanCommitFailure(
      409,
      'conflict',
      'The repeat check changed while you were signing. Review the summary and sign again.',
    );
  }
  if (preview.duplicateWarning.required && !request.duplicateWarningAcknowledged) {
    throw new ChallanCommitFailure(
      409,
      'conflict',
      'A recent duplicate was found. Review the repeat warning and acknowledge it before issuing.',
    );
  }

  const department = await masterLabel(db, s.departments, draft.departmentId, 'departmentId');
  const vehicleType = await masterLabel(db, s.vehicleTypes, draft.vehicleTypeId, 'vehicleTypeId');
  const contractor =
    draft.contractorId === null
      ? null
      : await masterLabel(db, s.contractors, draft.contractorId, 'contractorId');

  const violationRows = await db.orm
    .select({
      id: s.violationTypes.id,
      label: s.violationTypes.label,
      severity: s.violationTypes.severity,
      defaultAction: s.violationTypes.defaultAction,
      isActive: s.violationTypes.isActive,
    })
    .from(s.violationTypes)
    .where(inArray(s.violationTypes.id, draft.violationTypeIds));
  const violationsById = new Map(violationRows.map((row) => [row.id, row]));
  const violations = draft.violationTypeIds.map((id) => {
    const row = violationsById.get(id);
    if (row === undefined || !row.isActive) {
      throw new ChallanCommitFailure(422, 'invalid_draft', 'Choose active violations.', [
        {
          field: 'violationTypeIds',
          code: 'inactive_master',
          message: 'Choose active violations.',
        },
      ]);
    }
    return row;
  });

  const challanId = randomUUID();
  const files: Array<{ key: string; bytes: Buffer }> = [];
  request.photos.forEach((photo, index) => {
    const bytes = decodeDataUrl(photo.dataUrl, 'image/jpeg');
    if (bytes.length !== photo.bytes) {
      throw new ChallanCommitFailure(
        400,
        'invalid_request',
        'The captured photo size does not match the upload.',
      );
    }
    files.push({ key: `${challanId}/photo-${index + 1}.jpg`, bytes });
  });
  if (request.signature !== null) {
    const bytes = decodeDataUrl(request.signature.dataUrl, 'image/png');
    if (bytes.length !== request.signature.bytes) {
      throw new ChallanCommitFailure(
        400,
        'invalid_request',
        'The signature size does not match the upload.',
      );
    }
    files.push({ key: `${challanId}/signature.png`, bytes });
  }

  try {
    for (const file of files) await store.put(file.key, file.bytes);
  } catch (error) {
    await removeFiles(
      store,
      files.map((file) => file.key),
    );
    throw error;
  }

  try {
    await db.orm.transaction(async (tx) => {
      const challanNumber = await allocateChallanNumber(tx, now);
      await tx.insert(s.challans).values({
        id: challanId,
        challanNumber,
        gatePassNumber: draft.gatePassNumber,
        vehicleRegistrationNumber: draft.vehicleRegistration,
        driverName: draft.driverName,
        gatePassRecordId: draft.registry?.gatePassRecordId ?? null,
        departmentId: draft.departmentId,
        departmentLabelSnapshot: department.label,
        contractorId: draft.contractorId,
        contractorLabelSnapshot: contractor?.label ?? null,
        vehicleTypeId: draft.vehicleTypeId,
        vehicleTypeLabelSnapshot: vehicleType.label,
        locationId: post.locationId,
        gateId: post.gateId,
        postId: post.id,
        shiftId: shift.id,
        issuedByUserId: session.userId,
        status: 'Issued',
        severity: validation.severity,
        occurrenceNumber: preview.occurrenceNumber,
        recommendedAction: recommendedActionForOccurrence(preview.occurrenceNumber),
        remarks: draft.remarks === '' ? null : draft.remarks,
        operationId: request.operationId,
        operationHash: hash,
        issuedAt: now,
      });

      await tx.insert(s.challanViolations).values(
        violations.map((violation) => ({
          challanId,
          violationTypeId: violation.id,
          labelSnapshot: violation.label,
          severitySnapshot: violation.severity,
          defaultActionSnapshot: violation.defaultAction,
        })),
      );

      await tx.insert(s.evidence).values(
        request.photos.map((photo, index) => ({
          id: randomUUID(),
          challanId,
          objectKey: `${challanId}/photo-${index + 1}.jpg`,
          mediaKind: 'photo',
          ordinal: index + 1,
          byteSize: photo.bytes,
          contentType: 'image/jpeg',
          capturedAt: now,
        })),
      );

      if (request.signature !== null) {
        await tx.insert(s.signatures).values({
          id: randomUUID(),
          challanId,
          objectKey: `${challanId}/signature.png`,
          contentType: 'image/png',
          byteSize: request.signature.bytes,
          acknowledgedPayloadHash: request.summaryRevision,
          signedAt: now,
        });
      } else if (request.refusal !== null) {
        await tx.insert(s.refusals).values({
          id: randomUUID(),
          challanId,
          reason: request.refusal.reason,
          witnessName: request.refusal.witnessName,
          witnessStaffId: request.refusal.witnessStaffId,
          recordedByUserId: session.userId,
          refusedAt: now,
        });
      }

      await tx.insert(s.auditEvents).values({
        id: randomUUID(),
        challanId,
        actorUserId: session.userId,
        eventType: 'challan.issued',
        source: 'tablet',
        payload: {
          challanNumber,
          operationId: request.operationId,
          occurrenceNumber: preview.occurrenceNumber,
          severity: validation.severity,
          photoCount: request.photos.length,
          acknowledgementKind: request.signature !== null ? 'signature' : 'refusal',
        },
      });
    });
  } catch (error) {
    await removeFiles(
      store,
      files.map((file) => file.key),
    );
    if (isUniqueViolation(error)) {
      const raced = await findExisting(db, request);
      if (
        raced !== undefined &&
        raced.operationHash === hash &&
        raced.issuedByUserId === session.userId
      ) {
        return toResponse(await loadChallanDetail(db, raced.id), true);
      }
      throw new ChallanCommitFailure(
        409,
        'conflict',
        'That submission operation was already used with different details.',
      );
    }
    throw error;
  }

  return toResponse(await loadChallanDetail(db, challanId), false);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

/** Exported for tests; the same period/key format is used by the allocator. */
export function challanNumberPeriod(now: Date): string {
  const { year, month } = kolkataPeriod(now);
  return `${NUMBER_PREFIX}/${year}/${month}`;
}
