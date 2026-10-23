import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { ABSOLUTE_SESSION_LIFETIME_SECONDS, IDLE_TIMEOUT_SECONDS } from '@echallan/contracts';
import type { Db } from '../db/client.js';
import * as s from '../db/schema.js';

/**
 * Server-side session store (addendum A v0.2 section 2.2).
 *
 * This module is the **single place** where session validity is decided. Every
 * protected route resolves its caller through {@link resolveSession}, so an
 * unknown, revoked, idle-expired or absolute-expired token can never be
 * accepted by one route and rejected by another.
 *
 * The raw token is generated here, returned to the caller once and never
 * persisted: only its SHA-256 digest is stored.
 */

/** 32 random bytes, hex-encoded: 64 lowercase hex characters. */
export const SESSION_TOKEN_BYTES = 32;

export interface CreateSessionInput {
  userId: string;
  role: (typeof s.ROLE_VALUES)[number];
  /** Null for roles that need no post (Supervisor, Admin). */
  postId?: string | null;
  shiftId?: string | null;
  /** Overrides the role's approved idle window; used by tests and tooling. */
  idleTimeoutSeconds?: number;
  /** Injected clock, so expiry behaviour is testable without sleeping. */
  now?: Date;
  absoluteExpiresAt?: Date;
}

export interface CreatedSession {
  /** The raw token. Returned to the client exactly once and never stored. */
  token: string;
  session: s.Session;
}

/** SHA-256 hex digest. The stored representation of a token. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Approved idle window for a role, in seconds. */
export function idleTimeoutForRole(role: (typeof s.ROLE_VALUES)[number]): number {
  return IDLE_TIMEOUT_SECONDS[role];
}

export async function createSession(db: Db, input: CreateSessionInput): Promise<CreatedSession> {
  const now = input.now ?? new Date();
  const token = randomBytes(SESSION_TOKEN_BYTES).toString('hex');
  const idleTimeoutSeconds = input.idleTimeoutSeconds ?? idleTimeoutForRole(input.role);
  const absoluteExpiresAt =
    input.absoluteExpiresAt ?? new Date(now.getTime() + ABSOLUTE_SESSION_LIFETIME_SECONDS * 1000);

  const [session] = await db.orm
    .insert(s.sessions)
    .values({
      id: randomUUID(),
      userId: input.userId,
      tokenHash: hashSessionToken(token),
      role: input.role,
      postId: input.postId ?? null,
      shiftId: input.shiftId ?? null,
      createdAt: now,
      lastSeenAt: now,
      idleTimeoutSeconds,
      absoluteExpiresAt,
      revokedAt: null,
    })
    .returning();

  if (session === undefined) throw new Error('Failed to create a session row');
  return { token, session };
}

/**
 * Resolve a token to a live session, or `null`.
 *
 * Refused, all as `null` so a caller cannot tell them apart: an unknown token, a
 * revoked session, a session past its absolute expiry, and a session idle beyond
 * its stored window. On success `last_seen_at` is refreshed to `now`, which is
 * what makes allowed activity reset the idle clock.
 *
 * The idle rule is `now - last_seen_at >= idleTimeoutSeconds`, evaluated in the
 * database against the same clock, so a test can move `last_seen_at` and observe
 * the decision.
 */
export async function resolveSession(
  db: Db,
  token: string,
  now: Date = new Date(),
): Promise<s.Session | null> {
  const rows = await db.orm
    .select()
    .from(s.sessions)
    .where(
      and(
        eq(s.sessions.tokenHash, hashSessionToken(token)),
        isNull(s.sessions.revokedAt),
        // The two windows are compared in SQL against the same instant the caller
        // passed, so a test can move `last_seen_at` and observe the decision
        // without the API and the assertion disagreeing about "now".
        sql`${s.sessions.absoluteExpiresAt} > ${now}`,
        sql`(${now} - ${s.sessions.lastSeenAt}) < (${s.sessions.idleTimeoutSeconds} * interval '1 second')`,
      ),
    )
    .limit(1);

  const session = rows[0];
  if (session === undefined) return null;

  // Refresh the idle clock, re-asserting the live-session conditions in the same
  // statement so a request that raced with a revocation or an expiry cannot
  // resurrect the row it just matched.
  const refreshed = await db.orm
    .update(s.sessions)
    .set({ lastSeenAt: now })
    .where(
      and(
        eq(s.sessions.id, session.id),
        isNull(s.sessions.revokedAt),
        sql`${s.sessions.absoluteExpiresAt} > ${now}`,
        sql`(${now} - ${s.sessions.lastSeenAt}) < (${s.sessions.idleTimeoutSeconds} * interval '1 second')`,
      ),
    )
    .returning();

  return refreshed[0] ?? null;
}

/**
 * Revoke a session server-side so its token cannot regain access.
 *
 * Returns true when a live session was revoked. Revoking an unknown, already
 * revoked or expired token is a no-op rather than an error, because logout is
 * idempotent and must never grant anything.
 */
export async function revokeSession(
  db: Db,
  token: string,
  now: Date = new Date(),
): Promise<boolean> {
  const rows = await db.orm
    .update(s.sessions)
    .set({ revokedAt: now })
    .where(and(eq(s.sessions.tokenHash, hashSessionToken(token)), isNull(s.sessions.revokedAt)))
    .returning({ id: s.sessions.id });
  return rows.length > 0;
}

/** Absolute expiry as an ISO instant, for the login/session response contract. */
export function sessionExpiryIso(session: s.Session): string {
  return session.absoluteExpiresAt.toISOString();
}
