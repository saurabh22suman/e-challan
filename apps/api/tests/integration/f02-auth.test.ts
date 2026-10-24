import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app.js';
import type { Db } from '../../src/db/client.js';
import { resetAndMigrateTestDatabase, resolveTestDatabaseUrl } from './helpers/testTarget.js';

/**
 * Planner-owned F-02 acceptance against **real PostgreSQL**: AUTH-01, AUTH-02,
 * AUTH-03 (scoped to session validity/expiry/revocation, without a refresh workflow)
 * and AUTH-05 attribution — plus the correction-batch regressions R3 (required and
 * ambiguous context) and R4 (malformed id).
 *
 * AUTH-06 (Admin user CRUD, Argon2id hashing) is deliberately **out of scope** for
 * the demo env-backed mechanism and is not reproduced here; see
 * `docs/eChallan_replacement_spec_v0.2.md` section 4.
 *
 * **Revision 3 (Q1).** Credentials are injected explicitly into every auth app.
 * The factory has no implicit environment fallback, so this suite never depends on
 * `process.env` or the root `.env` for a positive login, and one case proves that an
 * instance constructed without credentials fails closed even when the environment
 * holds valid values.
 *
 * Read-only planner input. Do not replace, skip or weaken these assertions.
 */

/**
 * Valid synthetic credentials matching the seeded users' stored roles.
 *
 * Note the passwords are distinct from the committed browser fixture on purpose:
 * this suite must authenticate only because these values are injected, never because
 * of anything present in the repository or the environment.
 */
const CREDENTIALS = {
  marshal: { username: 'EMP-3106', password: 'planner-demo-marshal-secret' },
  supervisor: { username: 'EMP-2217', password: 'planner-demo-supervisor-secret' },
  admin: { username: 'EMP-1042', password: 'planner-demo-admin-secret' },
} as const;

const MARSHAL_PASSWORD = CREDENTIALS.marshal.password;
const SUPERVISOR_PASSWORD = CREDENTIALS.supervisor.password;
const ADMIN_PASSWORD = CREDENTIALS.admin.password;

/**
 * Q4: a deliberately mismatched but internally valid configuration. Three **distinct**
 * usernames, so the loader cannot refuse it as ambiguous; the marshal account maps to
 * EMP-2217, which is stored as a Supervisor. The only possible refusal is the
 * stored-role guard.
 */
const MISMATCHED_CREDENTIALS = {
  marshal: { username: 'EMP-2217', password: 'mismatch-marshal-secret' },
  supervisor: { username: 'EMP-2284', password: 'mismatch-supervisor-secret' },
  admin: { username: 'EMP-1042', password: 'mismatch-admin-secret' },
} as const;

const DEMO_ENV_KEYS = [
  'DEMO_MARSHAL_USERNAME',
  'DEMO_MARSHAL_PASSWORD',
  'DEMO_SUPERVISOR_USERNAME',
  'DEMO_SUPERVISOR_PASSWORD',
  'DEMO_ADMIN_USERNAME',
  'DEMO_ADMIN_PASSWORD',
] as const;

interface SessionUser {
  id: string;
  username: string;
  role: string;
}

interface SessionBody {
  token?: string;
  expiresAt?: string;
  user: SessionUser;
  post: { id: string; label: string } | null;
  shift: { id: string; label: string } | null;
}

describe('AUTH-01/02/03/05 + R3/R4: demo authentication over real PostgreSQL', () => {
  let db: Db;
  let server: FastifyInstance;

  beforeAll(async () => {
    db = await resetAndMigrateTestDatabase();
    const seed = (await import('../../src/db/seed-domain-demo.js')) as {
      seedDomainDemoDatabase: (url: string) => Promise<unknown>;
    };
    await seed.seedDomainDemoDatabase(resolveTestDatabaseUrl());
    server = createApp({ db, credentials: CREDENTIALS });
    await server.ready();
  });

  afterAll(async () => {
    if (server) await server.close();
    if (db) await db.close();
  });

  async function login(
    body: Record<string, unknown>,
    app: FastifyInstance = server,
  ): Promise<{ status: number; json: unknown }> {
    const response = await app.inject({ method: 'POST', url: '/auth/login', payload: body });
    return { status: response.statusCode, json: response.json() };
  }

  async function loginOk(extra: Record<string, unknown> = {}): Promise<SessionBody> {
    const result = await login({
      username: 'EMP-3106',
      password: MARSHAL_PASSWORD,
      ...extra,
    });
    expect(result.status, `marshal login failed: ${JSON.stringify(result.json)}`).toBe(200);
    return result.json as SessionBody;
  }

  async function tokenFor(username: string, password: string, extra = {}): Promise<string> {
    const result = await login({ username, password, ...extra });
    expect(result.status).toBe(200);
    const body = result.json as SessionBody;
    expect(body.token, 'a successful login must return a session token').toBeTruthy();
    return body.token as string;
  }

  describe('AUTH-01 credentials and identity', () => {
    it('logs in each configured role and returns its stored identity', async () => {
      const marshal = await loginOk();
      expect(marshal.user.role).toBe('Marshal');
      expect(marshal.user.username).toBe('EMP-3106');

      const supervisor = await login({ username: 'EMP-2217', password: SUPERVISOR_PASSWORD });
      expect(supervisor.status).toBe(200);
      expect((supervisor.json as SessionBody).user.role).toBe('Supervisor');

      const admin = await login({ username: 'EMP-1042', password: ADMIN_PASSWORD });
      expect(admin.status).toBe(200);
      expect((admin.json as SessionBody).user.role).toBe('Admin');
    });

    it('never returns the password or any password material in a successful login response', async () => {
      // A successful login is required first: inspecting a generic failure body
      // proves nothing, because a failure body trivially contains no password.
      const result = await login({ username: 'EMP-1042', password: ADMIN_PASSWORD });
      expect(
        result.status,
        `a genuine successful login is required before checking its body: ${JSON.stringify(result.json)}`,
      ).toBe(200);
      const serialised = JSON.stringify(result.json);
      expect(serialised).not.toContain(ADMIN_PASSWORD);
      expect(serialised.toLowerCase()).not.toContain('password');
      expect(serialised.toLowerCase()).not.toContain('$argon2');
      expect(serialised.toLowerCase()).not.toContain('planner-demo');
    });

    it('refuses a wrong password and an unknown username identically', async () => {
      const wrongPassword = await login({ username: 'EMP-1042', password: 'not-the-secret' });
      const unknownUser = await login({ username: 'DEMO-NOBODY', password: ADMIN_PASSWORD });

      expect(wrongPassword.status).toBe(401);
      expect(unknownUser.status).toBe(401);
      // Identical error code: the endpoint must not confirm which usernames exist.
      expect((wrongPassword.json as { error: string }).error).toBe(
        (unknownUser.json as { error: string }).error,
      );
      expect((wrongPassword.json as { error: string }).error).toBe('invalid_credentials');
    });

    it('ignores any client-supplied role and never escalates the session', async () => {
      const result = await login({
        username: 'EMP-3106',
        password: MARSHAL_PASSWORD,
        role: 'Admin',
      });
      // Either the request is rejected outright, or the role is ignored. Never Admin.
      if (result.status === 200) {
        expect((result.json as SessionBody).user.role).toBe('Marshal');
      } else {
        expect([400, 401, 403, 422]).toContain(result.status);
      }
    });

    it('Q4: refuses the role account whose configured username maps to a different stored role', async () => {
      // The fixture itself must not be ambiguous, or the next assertion could pass
      // for the wrong reason.
      const configuredNames = new Set(
        Object.values(MISMATCHED_CREDENTIALS).map((account) => account.username),
      );
      expect(configuredNames.size, 'the mismatched fixture must use three distinct usernames').toBe(
        3,
      );

      // Q4 control: the equivalent valid configuration authenticates first, so a
      // generic or configuration-level failure cannot masquerade as the role guard.
      const control = createApp({ db, credentials: CREDENTIALS });
      await control.ready();
      try {
        const controlLogin = await login(
          { username: 'EMP-3106', password: MARSHAL_PASSWORD },
          control,
        );
        expect(controlLogin.status, 'the valid control must authenticate').toBe(200);
      } finally {
        await control.close();
      }

      // EMP-2217 is stored as a Supervisor but presented as the Marshal account.
      const mismatched = createApp({ db, credentials: MISMATCHED_CREDENTIALS });
      await mismatched.ready();
      try {
        const result = await login(
          { username: 'EMP-2217', password: 'mismatch-marshal-secret' },
          mismatched,
        );
        expect(
          result.status,
          `a role mismatch must be refused specifically, got ${result.status}`,
        ).toBe(403);
        const body = result.json as { error?: string; token?: string };
        expect(
          body.error,
          'the refusal must be the documented role_mismatch code, not an unrelated failure',
        ).toBe('role_mismatch');
        expect(body.token, 'a mismatched role must never be issued a session').toBeUndefined();
      } finally {
        await mismatched.close();
      }
    });

    it('Q1: fails closed without injected credentials even when the environment holds valid ones', async () => {
      const previous = new Map(DEMO_ENV_KEYS.map((key) => [key, process.env[key]]));
      Object.assign(process.env, {
        DEMO_MARSHAL_USERNAME: CREDENTIALS.marshal.username,
        DEMO_MARSHAL_PASSWORD: CREDENTIALS.marshal.password,
        DEMO_SUPERVISOR_USERNAME: CREDENTIALS.supervisor.username,
        DEMO_SUPERVISOR_PASSWORD: CREDENTIALS.supervisor.password,
        DEMO_ADMIN_USERNAME: CREDENTIALS.admin.username,
        DEMO_ADMIN_PASSWORD: CREDENTIALS.admin.password,
      });

      const bare = createApp({ db });
      await bare.ready();
      try {
        const result = await login({ username: 'EMP-3106', password: MARSHAL_PASSWORD }, bare);
        expect(
          result.status,
          'omitting factory credentials must mean "no configured accounts", whatever the environment holds',
        ).toBe(401);
        const body = result.json as { error?: string; token?: string };
        expect(body.error).toBe('invalid_credentials');
        expect(body.token).toBeUndefined();
      } finally {
        await bare.close();
        for (const [key, value] of previous) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
    });
  });

  describe('sessions are server-side and revocable', () => {
    it('stores only a hash of the session token, never the token itself', async () => {
      const token = await tokenFor('EMP-3106', MARSHAL_PASSWORD);
      const rows = await db.pool.query<{ token_hash: string }>(
        'SELECT token_hash FROM sessions ORDER BY created_at DESC LIMIT 1',
      );
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0]?.token_hash).not.toBe(token);
      expect(rows.rows[0]?.token_hash).toMatch(/^[0-9a-f]{64}$/);
      // The raw token must not be recoverable from any stored column.
      const leaked = await db.pool.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM sessions WHERE token_hash = $1',
        [token],
      );
      expect(leaked.rows[0]?.n).toBe(0);
    });

    it('resolves a valid session and rejects an anonymous request', async () => {
      const token = await tokenFor('EMP-3106', MARSHAL_PASSWORD);
      const ok = await server.inject({
        method: 'GET',
        url: '/auth/session',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(ok.statusCode).toBe(200);
      expect((ok.json() as SessionBody).user.role).toBe('Marshal');

      const anonymous = await server.inject({ method: 'GET', url: '/auth/session' });
      expect(anonymous.statusCode).toBe(401);

      const nonsense = await server.inject({
        method: 'GET',
        url: '/auth/session',
        headers: { authorization: 'Bearer not-a-real-token' },
      });
      expect(nonsense.statusCode).toBe(401);
    });

    it('revokes on logout so an old token cannot regain access', async () => {
      const token = await tokenFor('EMP-3106', MARSHAL_PASSWORD);
      const out = await server.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(out.statusCode).toBe(204);

      const reused = await server.inject({
        method: 'GET',
        url: '/auth/session',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(reused.statusCode, 'a revoked token must not be accepted again').toBe(401);
    });

    it('rejects a session idle beyond the approved window and accepts allowed activity inside it', async () => {
      const token = await tokenFor('EMP-3106', MARSHAL_PASSWORD);
      const session = await db.pool.query<{ id: string }>(
        'SELECT id FROM sessions WHERE revoked_at IS NULL ORDER BY created_at DESC LIMIT 1',
      );
      const id = session.rows[0]?.id as string;

      // Inside the window: allowed, and the idle clock is refreshed.
      await db.pool.query(
        "UPDATE sessions SET last_seen_at = now() - interval '9 minutes' WHERE id = $1",
        [id],
      );
      const inside = await server.inject({
        method: 'GET',
        url: '/auth/session',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(inside.statusCode).toBe(200);
      const refreshed = await db.pool.query<{ fresh: boolean }>(
        "SELECT (now() - last_seen_at) < interval '1 minute' AS fresh FROM sessions WHERE id = $1",
        [id],
      );
      expect(refreshed.rows[0]?.fresh, 'allowed activity must refresh the idle clock').toBe(true);

      // Beyond the 10 minute tablet window: refused.
      await db.pool.query(
        "UPDATE sessions SET last_seen_at = now() - interval '11 minutes' WHERE id = $1",
        [id],
      );
      const outside = await server.inject({
        method: 'GET',
        url: '/auth/session',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(outside.statusCode, 'an idle session beyond 10 minutes must be refused').toBe(401);
    });

    it('refuses a session past its absolute expiry', async () => {
      const token = await tokenFor('EMP-3106', MARSHAL_PASSWORD);
      const session = await db.pool.query<{ id: string }>(
        'SELECT id FROM sessions WHERE revoked_at IS NULL ORDER BY created_at DESC LIMIT 1',
      );
      await db.pool.query(
        "UPDATE sessions SET absolute_expires_at = now() - interval '1 minute' WHERE id = $1",
        [session.rows[0]?.id as string],
      );
      const expired = await server.inject({
        method: 'GET',
        url: '/auth/session',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(expired.statusCode).toBe(401);
    });
  });

  describe('AUTH-05 attribution binds user, post and shift', () => {
    it('binds the authorised post and shift to a marshal session', async () => {
      const post = await db.pool.query<{ id: string }>(
        "SELECT id FROM posts WHERE demo_source_id = 'Main Gate Post'",
      );
      const shift = await db.pool.query<{ id: string }>(
        "SELECT id FROM shifts WHERE demo_source_id = 'shift-main-day'",
      );
      const session = await loginOk({
        postId: post.rows[0]?.id,
        shiftId: shift.rows[0]?.id,
      });
      expect(session.post?.id).toBe(post.rows[0]?.id);
      expect(session.shift?.id).toBe(shift.rows[0]?.id);

      const read = await server.inject({
        method: 'GET',
        url: '/auth/session',
        headers: { authorization: `Bearer ${session.token as string}` },
      });
      expect(read.statusCode).toBe(200);
      const body = read.json() as SessionBody;
      expect(body.post?.id).toBe(post.rows[0]?.id);
      expect(body.shift?.id).toBe(shift.rows[0]?.id);
    });

    it('resolves the single authorised post and shift when they are omitted', async () => {
      // P3 default: the one authorised post and its compatible shift are resolved
      // from stored data rather than demanded from the client.
      const session = await loginOk();
      const post = await db.pool.query<{ id: string }>(
        "SELECT id FROM posts WHERE demo_source_id = 'Main Gate Post'",
      );
      const shift = await db.pool.query<{ id: string }>(
        "SELECT id FROM shifts WHERE demo_source_id = 'shift-main-day'",
      );
      expect(session.post?.id).toBe(post.rows[0]?.id);
      expect(session.shift?.id).toBe(shift.rows[0]?.id);
    });

    it('refuses a marshal who supplies a post they are not authorised for', async () => {
      // Prove the known-valid login succeeds first, so a missing-route 404 can never
      // be mistaken for this enforcement.
      const control = await login({ username: 'EMP-3106', password: MARSHAL_PASSWORD });
      expect(control.status, 'the known-valid login must succeed before the refusal case').toBe(
        200,
      );

      const otherPost = await db.pool.query<{ id: string }>(
        "SELECT id FROM posts WHERE demo_source_id = 'Dispatch Gate Post'",
      );
      expect(otherPost.rows, 'a second seeded post is required for this case').toHaveLength(1);

      const result = await login({
        username: 'EMP-3106',
        password: MARSHAL_PASSWORD,
        postId: otherPost.rows[0]?.id,
      });
      expect(
        result.status,
        `an unauthorised post must be refused specifically, got ${result.status}`,
      ).toBe(403);
      expect((result.json as { error: string }).error).toBe('forbidden_context');
      expect(result.status, 'a 404 would mean the route is absent, not enforced').not.toBe(404);
    });

    it('refuses a shift that is not compatible with the bound post', async () => {
      const dispatchShift = await db.pool.query<{ id: string }>(
        "SELECT id FROM shifts WHERE demo_source_id = 'shift-dispatch-day'",
      );
      expect(dispatchShift.rows, 'a dispatch shift is required for this case').toHaveLength(1);

      const result = await login({
        username: 'EMP-3106',
        password: MARSHAL_PASSWORD,
        shiftId: dispatchShift.rows[0]?.id,
      });
      expect(result.status, `an incompatible shift must be refused, got ${result.status}`).toBe(
        403,
      );
      expect((result.json as { error: string }).error).toBe('forbidden_context');
      expect(result.status).not.toBe(404);
    });

    it('R3: refuses a marshal login when no compatible active shift exists', async () => {
      const marshal = await db.pool.query<{ id: string }>(
        "SELECT id FROM users WHERE username = 'EMP-3106'",
      );
      const marshalId = marshal.rows[0]?.id as string;

      await db.pool.query('UPDATE shifts SET is_active = false WHERE marshal_user_id = $1', [
        marshalId,
      ]);
      try {
        const result = await login({ username: 'EMP-3106', password: MARSHAL_PASSWORD });
        expect(
          result.status,
          `a marshal session must never succeed without a shift, got ${result.status}`,
        ).toBe(403);
        const body = result.json as { error?: string; token?: string; shift?: unknown };
        expect(body.error).toBe('forbidden_context');
        expect(body.token, 'a refused login must not issue a session').toBeUndefined();
        expect(body.shift, 'no session may claim a null shift for a marshal').toBeUndefined();
      } finally {
        await db.pool.query('UPDATE shifts SET is_active = true WHERE marshal_user_id = $1', [
          marshalId,
        ]);
      }
    });

    it('R3: refuses ambiguous context with stored candidates and accepts an explicit authorised selection', async () => {
      const location = await db.pool.query<{ id: string }>(
        "SELECT id FROM locations WHERE demo_source_id = 'loc-main'",
      );
      const gate = await db.pool.query<{ id: string }>(
        "SELECT id FROM gates WHERE demo_source_id = 'gate-01'",
      );
      const marshal = await db.pool.query<{ id: string }>(
        "SELECT id FROM users WHERE username = 'EMP-3106'",
      );
      const supervisor = await db.pool.query<{ id: string }>(
        "SELECT id FROM users WHERE username = 'EMP-2217'",
      );
      const post = await db.pool.query<{ id: string }>(
        "SELECT id FROM posts WHERE demo_source_id = 'Main Gate Post'",
      );
      const shift = await db.pool.query<{ id: string }>(
        "SELECT id FROM shifts WHERE demo_source_id = 'shift-main-day'",
      );

      const secondPostId = '00000000-0000-4000-8000-00000000b001';
      const secondShiftId = '00000000-0000-4000-8000-00000000b002';
      await db.pool.query(
        'INSERT INTO posts (id, location_id, gate_id, label, is_active) VALUES ($1, $2, $3, $4, true)',
        [secondPostId, location.rows[0]?.id, gate.rows[0]?.id, 'F-02 ambiguity post B'],
      );
      await db.pool.query(
        'INSERT INTO shifts (id, gate_id, label, marshal_user_id, supervisor_user_id, is_active) VALUES ($1, $2, $3, $4, $5, true)',
        [
          secondShiftId,
          gate.rows[0]?.id,
          'F-02 ambiguity shift B',
          marshal.rows[0]?.id,
          supervisor.rows[0]?.id,
        ],
      );

      // The exact stored option sets this caller may lawfully be offered. Asserting
      // set equality — not mere membership — is what makes a fabricated option, or an
      // option from another location, fail the test.
      const expectedPostOptions = (
        await db.pool.query<{ id: string; label: string }>(
          'SELECT id, label FROM posts WHERE id = ANY($1::uuid[]) ORDER BY id',
          [[post.rows[0]?.id, secondPostId]],
        )
      ).rows;
      const expectedShiftOptions = (
        await db.pool.query<{ id: string; label: string }>(
          'SELECT id, label FROM shifts WHERE id = ANY($1::uuid[]) ORDER BY id',
          [[shift.rows[0]?.id, secondShiftId]],
        )
      ).rows;
      const dispatchPost = await db.pool.query<{ id: string }>(
        "SELECT id FROM posts WHERE demo_source_id = 'Dispatch Gate Post'",
      );
      const dispatchShift = await db.pool.query<{ id: string }>(
        "SELECT id FROM shifts WHERE demo_source_id = 'shift-dispatch-day'",
      );

      try {
        // Step 1: two authorised active posts → the API must refuse and offer the
        // stored candidates rather than guess.
        const ambiguousPost = await login({ username: 'EMP-3106', password: MARSHAL_PASSWORD });
        expect(ambiguousPost.status).toBe(422);
        const postBody = ambiguousPost.json as {
          error?: string;
          postOptions?: Array<{ id: string; label: string }>;
          shiftOptions?: unknown;
        };
        expect(postBody.error).toBe('ambiguous_context');
        const actualPosts = [...(postBody.postOptions ?? [])].sort((left, right) =>
          left.id.localeCompare(right.id),
        );
        expect(
          actualPosts,
          'exactly the authorised stored posts: nothing fabricated, nothing inactive, nothing from another location',
        ).toEqual(expectedPostOptions);
        expect(
          actualPosts.map((option) => option.id),
          'the dispatch post is not authorised for this caller and must never be offered',
        ).not.toContain(dispatchPost.rows[0]?.id);
        expect(
          postBody.shiftOptions,
          'no shift can be offered while the post itself is ambiguous',
        ).toEqual([]);

        // Step 2: choose the post explicitly. Two active shifts now run at its gate,
        // so the API must offer the compatible shifts next.
        const ambiguousShift = await login({
          username: 'EMP-3106',
          password: MARSHAL_PASSWORD,
          postId: post.rows[0]?.id,
        });
        expect(ambiguousShift.status).toBe(422);
        const shiftBody = ambiguousShift.json as {
          error?: string;
          postOptions?: Array<{ id: string }>;
          shiftOptions?: Array<{ id: string; label: string }>;
        };
        expect(shiftBody.error).toBe('ambiguous_context');
        expect(shiftBody.postOptions, 'the chosen post, and only it, is echoed back').toEqual(
          expectedPostOptions.filter((option) => option.id === post.rows[0]?.id),
        );
        const actualShifts = [...(shiftBody.shiftOptions ?? [])].sort((left, right) =>
          left.id.localeCompare(right.id),
        );
        expect(
          actualShifts,
          'exactly the stored active shifts at the chosen post: nothing fabricated, nothing incompatible',
        ).toEqual(expectedShiftOptions);
        expect(
          actualShifts.map((option) => option.id),
          'a dispatch shift is not compatible with this post and must never be offered',
        ).not.toContain(dispatchShift.rows[0]?.id);

        // Step 3: an explicit authorised selection always wins over ambiguity.
        const resolved = await login({
          username: 'EMP-3106',
          password: MARSHAL_PASSWORD,
          postId: post.rows[0]?.id,
          shiftId: shift.rows[0]?.id,
        });
        expect(
          resolved.status,
          `an explicit authorised selection must succeed: ${JSON.stringify(resolved.json)}`,
        ).toBe(200);
        const resolvedBody = resolved.json as SessionBody;
        expect(resolvedBody.post?.id).toBe(post.rows[0]?.id);
        expect(resolvedBody.shift?.id).toBe(shift.rows[0]?.id);
      } finally {
        await db.pool.query('DELETE FROM shifts WHERE id = $1', [secondShiftId]);
        await db.pool.query('DELETE FROM posts WHERE id = $1', [secondPostId]);
      }
    });
  });

  describe('AUTH-02 role and location enforcement on a protected read', () => {
    async function challanIds(): Promise<{ main: string; dispatch: string }> {
      const rows = await db.pool.query<{ id: string; location: string }>(
        `SELECT c.id, l.demo_source_id AS location
           FROM challans c JOIN locations l ON l.id = c.location_id
          ORDER BY c.id`,
      );
      const main = rows.rows.find((row) => row.location === 'loc-main')?.id as string;
      const dispatch = rows.rows.find((row) => row.location === 'loc-dispatch')?.id as string;
      expect(main, 'a main-location challan fixture is required').toBeTruthy();
      expect(dispatch, 'a dispatch-location challan fixture is required').toBeTruthy();
      return { main, dispatch };
    }

    it('refuses an anonymous caller', async () => {
      const ids = await challanIds();
      const response = await server.inject({ method: 'GET', url: `/challans/${ids.main}` });
      expect(response.statusCode).toBe(401);
    });

    it('lets a supervisor read its own location but not another location', async () => {
      const ids = await challanIds();
      const token = await tokenFor('EMP-2217', SUPERVISOR_PASSWORD);

      const own = await server.inject({
        method: 'GET',
        url: `/challans/${ids.main}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(own.statusCode).toBe(200);

      const other = await server.inject({
        method: 'GET',
        url: `/challans/${ids.dispatch}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(other.statusCode, 'a supervisor must not fetch another location by a guessed id').toBe(
        403,
      );
    });

    it('lets an admin read across locations', async () => {
      const ids = await challanIds();
      const token = await tokenFor('EMP-1042', ADMIN_PASSWORD);
      for (const id of [ids.main, ids.dispatch]) {
        const response = await server.inject({
          method: 'GET',
          url: `/challans/${id}`,
          headers: { authorization: `Bearer ${token}` },
        });
        expect(response.statusCode).toBe(200);
      }
    });

    it('scopes a marshal to their own post location', async () => {
      const ids = await challanIds();
      const post = await db.pool.query<{ id: string }>(
        "SELECT id FROM posts WHERE demo_source_id = 'Main Gate Post'",
      );
      const token = await tokenFor('EMP-3106', MARSHAL_PASSWORD, {
        postId: post.rows[0]?.id,
      });

      const own = await server.inject({
        method: 'GET',
        url: `/challans/${ids.main}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(own.statusCode).toBe(200);

      const other = await server.inject({
        method: 'GET',
        url: `/challans/${ids.dispatch}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(other.statusCode).toBe(403);
    });

    it('Q3: returns 404 for an unknown id only after proving the read succeeds for a known record', async () => {
      const token = await tokenFor('EMP-1042', ADMIN_PASSWORD);
      const known = await db.pool.query<{ id: string }>(
        'SELECT id FROM challans ORDER BY id LIMIT 1',
      );
      const knownId = known.rows[0]?.id as string;
      expect(knownId, 'a seeded challan is required for the control read').toBeTruthy();

      // Control: the same authenticated caller and the same handler path must return
      // 200 for a real record, so a 404 for the unknown id is the handler's answer,
      // not Fastify's missing-route default.
      const control = await server.inject({
        method: 'GET',
        url: `/challans/${knownId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(control.statusCode, `the known-record control must succeed: ${control.body}`).toBe(
        200,
      );

      const response = await server.inject({
        method: 'GET',
        url: '/challans/00000000-0000-4000-8000-999999999999',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(404);
      expect((response.json() as { error: string }).error).toBe('not_found');
    });

    it('R4: returns a controlled error for a malformed id without SQL, parameters or internal detail', async () => {
      const token = await tokenFor('EMP-1042', ADMIN_PASSWORD);
      const malformedIds = ['not-a-uuid', "1' OR '1'='1", '00000000-0000-4000-8000', 'challan-1'];

      for (const malformed of malformedIds) {
        const response = await server.inject({
          method: 'GET',
          url: `/challans/${encodeURIComponent(malformed)}`,
          headers: { authorization: `Bearer ${token}` },
        });
        expect(
          response.statusCode,
          `"${malformed}" must be a controlled refusal, got ${response.statusCode}: ${response.body}`,
        ).toBe(404);

        const body = response.json() as { error?: string; message?: string };
        expect(
          Object.keys(body).sort(),
          'the error body must be exactly the contract shape',
        ).toEqual(['error', 'message']);
        expect(body.error).toBe('not_found');

        const serialised = JSON.stringify(body).toLowerCase();
        for (const forbidden of [
          'select',
          'insert',
          'update',
          'delete from',
          'syntax',
          'parameter',
          '$1',
          'pg_',
          'relation',
          'column',
          'invalid input',
        ]) {
          expect(
            serialised,
            `the refusal for "${malformed}" must not leak "${forbidden}"`,
          ).not.toContain(forbidden);
        }
      }
    });

    it('never returns issued fields that the caller may not see to an out-of-scope caller', async () => {
      const ids = await challanIds();
      const token = await tokenFor('EMP-2217', SUPERVISOR_PASSWORD);
      const response = await server.inject({
        method: 'GET',
        url: `/challans/${ids.dispatch}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(403);
      expect(JSON.stringify(response.json())).not.toContain('HZL/EC/2026');
    });
  });
});
