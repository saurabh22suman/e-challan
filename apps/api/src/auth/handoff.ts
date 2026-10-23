import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import * as s from '../db/schema.js';
import { HANDOFF_TTL_SECONDS } from '@echallan/contracts';
import { createSession } from './session.js';
import { buildIdentity, type LoginResult } from './service.js';

/**
 * Cross-origin sign-in handoff.
 *
 * The admin dashboard is the single sign-in page. When the username resolves to a
 * Marshal, the dashboard asks the API for a short-lived code and sends the browser
 * to the tablet origin with that code in the URL fragment. The tablet exchanges
 * the code for a fresh session on its own origin.
 *
 * The code is **not** a session token:
 *
 *  - it is signed with a per-process HMAC secret, so it cannot be forged;
 *  - it expires after {@link HANDOFF_TTL_SECONDS};
 *  - it is single-use: exchange revokes the source session, so replaying the code
 *    finds a revoked session and fails;
 *  - it travels in the fragment, so Nginx and the API never receive it in a
 *    request line or access log.
 *
 * The signing secret is intentionally not persisted. A restart, or a deployment
 * with more than one API replica, invalidates an in-flight handoff; the operator
 * simply signs in again. The compose stack runs one API instance.
 */

const SECRET = randomBytes(32);
const PAYLOAD_VERSION = 1;

interface HandoffPayload {
  v: number;
  sid: string;
  exp: number;
  nonce: string;
}

function sign(encoded: string): string {
  return createHmac('sha256', SECRET).update(encoded, 'utf8').digest('base64url');
}

export interface CreatedHandoff {
  code: string;
  expiresAt: Date;
}

export function createHandoff(session: s.Session, now: Date = new Date()): CreatedHandoff {
  const expiresAt = new Date(now.getTime() + HANDOFF_TTL_SECONDS * 1000);
  const payload: HandoffPayload = {
    v: PAYLOAD_VERSION,
    sid: session.id,
    exp: expiresAt.getTime(),
    nonce: randomBytes(12).toString('base64url'),
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return { code: `${encoded}.${sign(encoded)}`, expiresAt };
}

/** Return the source session id for a valid, unexpired code; otherwise null. */
export function verifyHandoff(code: string, now: Date = new Date()): string | null {
  const separator = code.lastIndexOf('.');
  if (separator <= 0 || separator === code.length - 1) return null;

  const encoded = code.slice(0, separator);
  const supplied = code.slice(separator + 1);
  const expected = sign(encoded);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  ) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof payload !== 'object' || payload === null) return null;

  const candidate = payload as Partial<HandoffPayload>;
  if (
    candidate.v !== PAYLOAD_VERSION ||
    typeof candidate.sid !== 'string' ||
    candidate.sid === '' ||
    typeof candidate.exp !== 'number' ||
    candidate.exp <= now.getTime()
  ) {
    return null;
  }
  return candidate.sid;
}

/**
 * Exchange a handoff code for a new session on the target origin.
 *
 * The source session is revoked with a conditional update first, so two concurrent
 * exchanges cannot both succeed. Returns null for an invalid, expired, replayed,
 * idle-expired or revoked source session.
 */
export async function exchangeHandoff(
  db: Db,
  code: string,
  now: Date = new Date(),
): Promise<LoginResult | null> {
  const sessionId = verifyHandoff(code, now);
  if (sessionId === null) return null;

  const rows = await db.orm
    .select({ session: s.sessions, user: s.users })
    .from(s.sessions)
    .innerJoin(s.users, eq(s.users.id, s.sessions.userId))
    .where(
      and(
        eq(s.sessions.id, sessionId),
        isNull(s.sessions.revokedAt),
        gt(s.sessions.absoluteExpiresAt, now),
      ),
    )
    .limit(1);

  const source = rows[0];
  if (source === undefined || !source.user.isActive) return null;

  const idleDeadline =
    source.session.lastSeenAt.getTime() + source.session.idleTimeoutSeconds * 1000;
  if (now.getTime() >= idleDeadline) return null;

  const claimed = await db.orm
    .update(s.sessions)
    .set({ revokedAt: now })
    .where(
      and(
        eq(s.sessions.id, sessionId),
        isNull(s.sessions.revokedAt),
        gt(s.sessions.absoluteExpiresAt, now),
      ),
    )
    .returning({ id: s.sessions.id });
  if (claimed.length === 0) return null;

  const created = await createSession(db, {
    userId: source.session.userId,
    role: source.session.role,
    postId: source.session.postId,
    shiftId: source.session.shiftId,
    now,
  });

  return { ...created, identity: await buildIdentity(db, created.session) };
}
