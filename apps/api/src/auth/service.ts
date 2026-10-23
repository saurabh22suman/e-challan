import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import * as s from '../db/schema.js';
import {
  API_ERROR_CODES,
  ApiErrorSchema,
  type ApiError,
  type ApiErrorCode,
  type LoginRequest,
  type Role,
  type SessionIdentity,
} from '@echallan/contracts';
import { credentialsMatch, matchConfiguredRole, type DemoCredentials } from './config.js';
import { verifyAgainstDummy, verifyPassword } from './password.js';
import { createSession, sessionExpiryIso, type CreatedSession } from './session.js';

/**
 * Demo login, post/shift context resolution and role/location authorisation.
 *
 * Two rules run through every function here:
 *
 *  1. **Identity comes from stored data.** The role is the matched credential's
 *     role *and* the stored user's role, and a mismatch is refused. Nothing is
 *     ever taken from the request body (addendum A sections 2.1 and 5).
 *  2. **Enforcement is server-side.** Scope is decided here from stored
 *     authorisation rows, so hiding a control in a client changes nothing.
 */

/** A stored post or shift a caller may choose from. */
export interface ContextOption {
  id: string;
  label: string;
}

/**
 * The selectable candidates carried by an `ambiguous_context` refusal. Both lists
 * are always present; while the post itself is ambiguous the shift list is empty,
 * because shift options depend on the chosen post.
 */
export interface AmbiguousContextOptions {
  postOptions: ContextOption[];
  shiftOptions: ContextOption[];
}

/** A refusal with its approved code, HTTP status and (for ambiguity) candidates. */
export class AuthFailure extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly options?: AmbiguousContextOptions;

  constructor(
    code: ApiErrorCode,
    status: number,
    message: string,
    options?: AmbiguousContextOptions,
  ) {
    super(message);
    this.name = 'AuthFailure';
    this.code = code;
    this.status = status;
    this.options = options;
  }

  toBody(): ApiError {
    return ApiErrorSchema.parse({ error: this.code, message: this.message });
  }
}

/**
 * The single refusal used for an unknown username and for a wrong password.
 *
 * One code, one message and one status, so the endpoint never confirms which
 * usernames exist (addendum A section 5).
 */
function invalidCredentials(): AuthFailure {
  return new AuthFailure(
    API_ERROR_CODES.invalidCredentials,
    401,
    'Sign in failed. Check the username and password and try again.',
  );
}

export interface LoginResult extends CreatedSession {
  identity: SessionIdentity;
}

/**
 * Authenticate a login request and open a session.
 *
 * Order matters and is deliberate: credentials are checked in constant time
 * before any database lookup result is distinguished, the stored user's role must
 * match the configured role, and only then is post/shift context resolved.
 */
export async function login(
  db: Db,
  credentials: DemoCredentials,
  request: LoginRequest,
  now: Date = new Date(),
): Promise<LoginResult> {
  const user = await findUserByUsername(db, request.username);
  const matchedRole = matchConfiguredRole(credentials, request.username);

  if (user?.passwordHash !== null && user?.passwordHash !== undefined) {
    // An Admin reset is the credential authority for this user. A reset account
    // that is not one of the env-configured roles is still valid; the stored role
    // is the identity. If the username also appears in the env configuration, the
    // F-02 role-mismatch guard still applies.
    const passwordMatches = await verifyPassword(request.password, user.passwordHash);
    if (!passwordMatches || !user.isActive) throw invalidCredentials();
    if (matchedRole !== undefined && user.role !== roleFromDemoRole(matchedRole)) {
      throw new AuthFailure(
        API_ERROR_CODES.roleMismatch,
        403,
        'This account is not configured for the role it was signed in with. Ask an administrator.',
      );
    }
  } else {
    // Preserve the F-02 env-backed demo path. The dummy verification keeps the
    // unknown-username and wrong-password paths comparably expensive.
    await verifyAgainstDummy(request.password);
    const passwordMatches = credentialsMatch(
      request.password,
      matchedRole ? credentials[matchedRole].password : '',
    );

    if (matchedRole === undefined || !passwordMatches) throw invalidCredentials();
    if (user === undefined || !user.isActive) throw invalidCredentials();

    // Configuration guard: an authenticated identity must not gain another role.
    if (user.role !== roleFromDemoRole(matchedRole)) {
      throw new AuthFailure(
        API_ERROR_CODES.roleMismatch,
        403,
        'This account is not configured for the role it was signed in with. Ask an administrator.',
      );
    }
  }

  const context = await resolveSessionContext(db, {
    userId: user.id,
    role: user.role,
    postId: request.postId,
    shiftId: request.shiftId,
  });

  const created = await createSession(db, {
    userId: user.id,
    role: user.role,
    postId: context.post?.id ?? null,
    shiftId: context.shift?.id ?? null,
    now,
  });

  return {
    ...created,
    identity: await buildIdentity(db, created.session),
  };
}

/** Map the configured role key to the stored role vocabulary. */
function roleFromDemoRole(role: 'marshal' | 'supervisor' | 'admin'): Role {
  const map = { marshal: 'Marshal', supervisor: 'Supervisor', admin: 'Admin' } as const;
  return map[role];
}

async function findUserByUsername(db: Db, username: string): Promise<s.User | undefined> {
  const rows = await db.orm.select().from(s.users).where(eq(s.users.username, username)).limit(1);
  return rows[0];
}

/* -------------------------------------------------------------------------- */
/* Post and shift context                                                      */
/* -------------------------------------------------------------------------- */

interface ContextRefs {
  post: { id: string; label: string } | null;
  shift: { id: string; label: string } | null;
}

/**
 * Posts the user may issue from: the active posts at the locations the user is
 * assigned to. This is stored authorisation, not a request field.
 */
async function authorisedPosts(db: Db, userId: string): Promise<{ id: string; label: string }[]> {
  return db.orm
    .selectDistinct({ id: s.posts.id, label: s.posts.label })
    .from(s.posts)
    .innerJoin(s.userLocations, eq(s.userLocations.locationId, s.posts.locationId))
    .where(and(eq(s.userLocations.userId, userId), eq(s.posts.isActive, true)));
}

/** Active shifts at a post's gate: the only shifts compatible with that post. */
async function compatibleShifts(db: Db, postId: string): Promise<{ id: string; label: string }[]> {
  return db.orm
    .selectDistinct({ id: s.shifts.id, label: s.shifts.label })
    .from(s.shifts)
    .innerJoin(s.posts, eq(s.posts.gateId, s.shifts.gateId))
    .where(and(eq(s.posts.id, postId), eq(s.shifts.isActive, true)));
}

/**
 * Resolve the post and shift a session binds.
 *
 * - Omitted `postId`/`shiftId` are resolved from stored data when there is
 *   exactly one candidate; more than one candidate is refused as ambiguous
 *   rather than guessed.
 * - A **supplied** post the user is not authorised for, or a shift that is not
 *   compatible with the resolved post, is refused.
 * - Supervisor and Admin need no post, so they resolve to `null` unless one is
 *   supplied (and a supplied one is still checked).
 */
export async function resolveSessionContext(
  db: Db,
  input: { userId: string; role: Role; postId?: string; shiftId?: string },
): Promise<ContextRefs> {
  const posts = await authorisedPosts(db, input.userId);
  const needsPost = input.role === 'Marshal' || input.postId !== undefined;

  let post: { id: string; label: string } | null = null;
  if (input.postId !== undefined) {
    const match = posts.find((candidate) => candidate.id === input.postId);
    if (match === undefined) {
      throw new AuthFailure(
        API_ERROR_CODES.forbiddenContext,
        403,
        'You are not authorised to work at that post.',
      );
    }
    post = match;
  } else if (needsPost) {
    if (posts.length === 0) {
      throw new AuthFailure(
        API_ERROR_CODES.forbiddenContext,
        403,
        'No authorised post is assigned to this account.',
      );
    }
    if (posts.length > 1) {
      throw new AuthFailure(
        API_ERROR_CODES.ambiguousContext,
        422,
        'More than one post is assigned to this account. Select the post to work at.',
        { postOptions: posts, shiftOptions: [] },
      );
    }
    post = posts[0] ?? null;
  }

  let shift: { id: string; label: string } | null = null;
  if (input.shiftId !== undefined) {
    if (post === null) {
      throw new AuthFailure(
        API_ERROR_CODES.forbiddenContext,
        403,
        'A shift cannot be selected without an authorised post.',
      );
    }
    const compatible = await compatibleShifts(db, post.id);
    const match = compatible.find((candidate) => candidate.id === input.shiftId);
    if (match === undefined) {
      throw new AuthFailure(
        API_ERROR_CODES.forbiddenContext,
        403,
        'That shift does not run at the selected post.',
      );
    }
    shift = match;
  } else if (post !== null) {
    const compatible = await compatibleShifts(db, post.id);
    if (compatible.length === 1) {
      shift = compatible[0] ?? null;
    } else if (compatible.length > 1) {
      throw new AuthFailure(
        API_ERROR_CODES.ambiguousContext,
        422,
        'More than one shift runs at the selected post. Select the shift to work.',
        { postOptions: [post], shiftOptions: compatible },
      );
    } else if (input.role === 'Marshal') {
      // A marshal session is required to bind a shift: with no compatible active
      // shift the login fails closed rather than opening a session with `shift: null`.
      throw new AuthFailure(
        API_ERROR_CODES.forbiddenContext,
        403,
        'No active shift runs at the selected post. Ask an administrator.',
      );
    }
  }

  return { post, shift };
}

/* -------------------------------------------------------------------------- */
/* Identity and scope                                                          */
/* -------------------------------------------------------------------------- */

/** Build the shared session identity from stored rows, never from the request. */
export async function buildIdentity(db: Db, session: s.Session): Promise<SessionIdentity> {
  const [user, post, shift] = await Promise.all([
    findUserById(db, session.userId),
    session.postId === null ? undefined : findLabel(db, s.posts, session.postId),
    session.shiftId === null ? undefined : findLabel(db, s.shifts, session.shiftId),
  ]);
  if (user === undefined) {
    // A session whose user has gone must never resolve to an identity.
    throw new AuthFailure(API_ERROR_CODES.unauthenticated, 401, 'Sign in required.');
  }
  return {
    expiresAt: sessionExpiryIso(session),
    user: { id: user.id, username: user.username, role: user.role },
    post: post ?? null,
    shift: shift ?? null,
  };
}

async function findUserById(db: Db, id: string): Promise<s.User | undefined> {
  const rows = await db.orm.select().from(s.users).where(eq(s.users.id, id)).limit(1);
  return rows[0];
}

async function findLabel(
  db: Db,
  table: typeof s.posts | typeof s.shifts,
  id: string,
): Promise<{ id: string; label: string } | undefined> {
  const rows = await db.orm
    .select({ id: table.id, label: table.label })
    .from(table)
    .where(eq(table.id, id))
    .limit(1);
  return rows[0];
}

/** Locations the user may see, from stored assignments. */
export async function authorisedLocationIds(db: Db, userId: string): Promise<string[]> {
  const rows = await db.orm
    .select({ locationId: s.userLocations.locationId })
    .from(s.userLocations)
    .where(eq(s.userLocations.userId, userId));
  return rows.map((row) => row.locationId);
}

/**
 * Decide whether a session may read a challan.
 *
 *  - **Admin** reads across locations.
 *  - **Supervisor** reads within their assigned locations.
 *  - **Marshal** reads only what belongs to the post their session is bound to.
 *
 * Returning a decision rather than throwing keeps the route readable; `null`
 * means "no such record", which the caller answers with 404 so existence is not
 * leaked to an out-of-scope caller.
 */
export async function canReadChallan(
  db: Db,
  session: s.Session,
  challan: { locationId: string; postId: string },
): Promise<boolean> {
  if (session.role === 'Admin') return true;
  if (session.role === 'Supervisor') {
    const locations = await authorisedLocationIds(db, session.userId);
    return locations.includes(challan.locationId);
  }
  // Marshal: the session must be bound to a post, and it must be this record's post.
  return session.postId !== null && session.postId === challan.postId;
}
