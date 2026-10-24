import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import type { Db } from '../../src/db/client.js';
import { resetAndMigrateTestDatabase, resolveTestDatabaseUrl } from './helpers/testTarget.js';

/**
 * Planner-owned additive correction acceptance for the F-01 review findings
 * R1 (normalised uniqueness), R2 (required master severity) and R3 (persisted
 * authoritative post/gate association).
 *
 * Prepared by the planner/test-owner session after
 * `docs/reviews/F-01.md` returned CHANGES_REQUIRED. These tests are ADDITIVE:
 * the original planner-owned acceptance files and the `docs/handoffs/F-01-tests.sha256`
 * history are untouched, and no original assertion was weakened, narrowed or removed.
 *
 * They are deliberately **mechanism-agnostic**. The approved outcome is asserted
 * at the SQL boundary; the implementer may satisfy it with a canonical-value CHECK,
 * a UNIQUE constraint on a canonical expression, a generated column, or a
 * composite foreign key. No test here dictates a particular DDL shape, because the
 * approved specification fixes the *rule*, not the mechanism.
 *
 * Read-only with respect to the repository: every statement runs against the
 * guarded isolated `TEST_DATABASE_URL` database, which is reset and re-migrated in
 * `beforeAll`. Nothing is written to the development/demo database.
 *
 * Every diagnostic mutation runs inside its own transaction that is rolled back,
 * so the suite neither leaves polluted rows behind nor lets a refused statement
 * poison the next query.
 */

const UNUSED_ID = '00000000-0000-4000-8000-999999999999';

/**
 * Approved normalisation, taken from `packages/contracts/src/domain.ts` and
 * replacement specification section 4. The two rules differ on purpose and the
 * tests must not blur them:
 *
 *  - vehicle registration: uppercase with **all** whitespace removed;
 *  - gate-pass number: uppercase and trimmed, with internal whitespace *invalid*
 *    rather than silently stripped.
 *
 * These build a canonicalising SQL expression for an arbitrary operand, so the
 * same function is applied to the **table column** and to the **supplied
 * parameter**. The lookup tests pass a real values array, so the comparison is a
 * genuinely bound, row-specific normalised lookup.
 */
const canonicalRegistration = (expression: string): string =>
  `upper(regexp_replace(${expression}, ${String.raw`'\s'`}, '', 'g'))`;
const canonicalGatePass = (expression: string): string => `upper(btrim(${expression}))`;

/** Unique violation (23505) or canonical-value check violation (23514). */
const CANONICAL_KEY_CODES = /^(23505|23514)$/;
/** Not-null violation (23502) or check violation (23514). */
const REQUIRED_VALUE_CODES = /^(23502|23514)$/;
/** Foreign-key (23503), unique (23505) or check (23514) relationship violation. */
const RELATIONSHIP_CODES = /^(23503|23505|23514)$/;

describe('F-01 corrections R1/R2/R3: real PostgreSQL invariants', () => {
  let db: Db;

  beforeAll(async () => {
    db = await resetAndMigrateTestDatabase();
    const seedModule = (await import('../../src/db/seed-domain-demo.js')) as {
      seedDomainDemoDatabase?: (url: string) => Promise<unknown>;
    };
    expect(
      typeof seedModule.seedDomainDemoDatabase,
      'F-01 domain seed adapter surface absent; these corrections assume the delivered adapter',
    ).toBe('function');
    await seedModule.seedDomainDemoDatabase?.(resolveTestDatabaseUrl());
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  /**
   * Run one diagnostic statement in its own transaction, inspect the outcome, and
   * always roll back.
   *
   * Two properties matter here:
   *
   *  1. **Nothing is left behind.** A diagnostic mutation that *succeeds* must not
   *     pollute the shared test database for later cases, and the earlier draft's
   *     reliance on that pollution was a self-containment defect.
   *  2. **A refused statement does not poison the transaction.** In PostgreSQL a
   *     failed statement aborts its transaction, so the outcome is captured first
   *     and the mandatory `ROLLBACK` runs in a `finally` block. Each refusal gets
   *     its own transaction, so one refusal cannot cause the next query to fail
   *     with `25P02` and be misread as an invariant result.
   */
  async function diagnostic<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      try {
        return await run(client);
      } finally {
        await client.query('ROLLBACK');
      }
    } finally {
      client.release();
    }
  }

  /**
   * Assert a statement is refused with an acceptable SQLSTATE, inspecting the
   * result before rollback.
   *
   * A bare `rejects.toMatchObject({ code: /regex/ })` form was empirically shown in
   * this workspace to pass for an arbitrary *wrong* code string, which would let an
   * unrelated database error satisfy an invariant. Capturing the SQLSTATE and
   * asserting it with `toMatch` is strict in both directions: a missing code and a
   * wrong code both fail.
   */
  async function expectRefused(
    statement: string,
    values: unknown[],
    allowed: RegExp,
    requirement: string,
  ): Promise<void> {
    const observed = await diagnostic(async (client) => {
      let caught: unknown;
      let code: string | undefined;
      try {
        await client.query(statement, values);
      } catch (error) {
        caught = error;
        code = (error as { code?: string }).code;
      }
      return { caught, code };
    });
    expect(
      observed.caught,
      `${requirement}: the statement was accepted but must be refused`,
    ).toBeDefined();
    expect(
      observed.code,
      `${requirement}: refused with unacceptable SQLSTATE ${String(observed.code)}`,
    ).toMatch(allowed);
  }

  /** Assert a statement is accepted, then discard the change. */
  async function expectAccepted(
    statement: string,
    values: unknown[],
    requirement: string,
  ): Promise<void> {
    let caught: unknown;
    try {
      await diagnostic((client) => client.query(statement, values));
    } catch (error) {
      caught = error;
    }
    expect(
      caught,
      `${requirement}: unexpectedly refused with ${
        caught === undefined ? '' : (caught as { code?: string }).code
      }`,
    ).toBeUndefined();
  }

  /** Pick a seeded row whose identity differs from `exclude`. */
  async function otherRowId(
    table: 'vehicles' | 'gate_pass_records',
    column: string,
    exclude: string,
  ): Promise<string> {
    const result = await db.pool.query<{ id: string }>(
      `SELECT id FROM ${table} WHERE ${column} <> $1 ORDER BY id LIMIT 1`,
      [exclude],
    );
    expect(result.rows, `no candidate row in ${table} other than ${exclude}`).toHaveLength(1);
    return result.rows[0]?.id as string;
  }

  /* ------------------------------------------------------------------ */
  /* R1 - normalised uniqueness is enforced in PostgreSQL, not only in Zod */
  /* ------------------------------------------------------------------ */

  describe('R1 normalised identity uniqueness', () => {
    it('rejects a second registration that differs only by case and surrounding whitespace', async () => {
      const id = await otherRowId('vehicles', 'registration_number', 'TN09BK3542');
      await expectRefused(
        'UPDATE vehicles SET registration_number=$1 WHERE id=$2',
        ['  tn09bk3542  ', id],
        CANONICAL_KEY_CODES,
        'R1: a registration differing only by case/whitespace must be refused',
      );
    });

    it('rejects a second registration that differs only by internal whitespace', async () => {
      // Canonical form removes *all* whitespace, so this is a duplicate too.
      const id = await otherRowId('vehicles', 'registration_number', 'TN09BK3542');
      await expectRefused(
        'UPDATE vehicles SET registration_number=$1 WHERE id=$2',
        ['TN 09BK 3542', id],
        CANONICAL_KEY_CODES,
        'R1: a registration differing only by internal whitespace must be refused',
      );
    });

    it('rejects a second gate-pass number that differs only by case and whitespace', async () => {
      const id = await otherRowId('gate_pass_records', 'gate_pass_number', 'HZ-GP-1048');
      await expectRefused(
        'UPDATE gate_pass_records SET gate_pass_number=$1 WHERE id=$2',
        [' hz-gp-1048 ', id],
        CANONICAL_KEY_CODES,
        'R1: a gate pass differing only by case/whitespace must be refused',
      );
    });

    it('rejects a gate-pass number containing internal whitespace', async () => {
      const id = await otherRowId('gate_pass_records', 'gate_pass_number', 'HZ-GP-1048');
      // The approved rule invalidates internal whitespace rather than stripping it.
      await expectRefused(
        'UPDATE gate_pass_records SET gate_pass_number=$1 WHERE id=$2',
        ['DEMO GP 0007', id],
        CANONICAL_KEY_CODES,
        'R1: a gate pass containing internal whitespace must be refused',
      );
    });

    it('still accepts genuinely distinct canonical registrations and gate passes', async () => {
      // A different canonical identity must remain writable, otherwise the
      // invariant would be satisfied by rejecting everything.
      await expectAccepted(
        'INSERT INTO vehicles(id, registration_number) VALUES ($1,$2)',
        ['00000000-0000-4000-8000-00000000a001', 'UP41XY9876'],
        'R1: a distinct canonical registration must be accepted',
      );
      const driver = await db.pool.query<{ id: string }>(
        'SELECT id FROM drivers ORDER BY id LIMIT 1',
      );
      const vehicle = await db.pool.query<{ id: string }>(
        'SELECT id FROM vehicles ORDER BY id LIMIT 1',
      );
      await expectAccepted(
        'INSERT INTO gate_pass_records(id, gate_pass_number, driver_id, vehicle_id) VALUES ($1,$2,$3,$4)',
        [
          '00000000-0000-4000-8000-00000000a002',
          'HZ-GP-0011',
          driver.rows[0]?.id,
          vehicle.rows[0]?.id,
        ],
        'R1: a distinct canonical gate pass must be accepted',
      );
    });

    it('still resolves exactly one row for a normalised lookup after a refused variant attempt', async () => {
      // Self-contained: this case performs its own variant attempt rather than
      // depending on pollution left by a preceding failing test.
      const id = await otherRowId('vehicles', 'registration_number', 'TN09BK3542');
      await expectRefused(
        'UPDATE vehicles SET registration_number=$1 WHERE id=$2',
        ['  tn09bk3542  ', id],
        CANONICAL_KEY_CODES,
        'R1 (lookup): the variant attempt preceding this lookup must be refused',
      );

      // The lookup compares the canonicalised *table column* against a canonicalised,
      // properly bound parameter.
      const registration = await db.pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM vehicles
          WHERE ${canonicalRegistration('registration_number')} = ${canonicalRegistration('$1')}`,
        ['tn09bk3542'],
      );
      expect(registration.rows[0]?.n, 'R1: normalised registration lookup must match one row').toBe(
        1,
      );

      const pass = await otherRowId('gate_pass_records', 'gate_pass_number', 'HZ-GP-1048');
      await expectRefused(
        'UPDATE gate_pass_records SET gate_pass_number=$1 WHERE id=$2',
        [' hz-gp-1048 ', pass],
        CANONICAL_KEY_CODES,
        'R1 (lookup): the gate-pass variant attempt must be refused',
      );
      const gatePass = await db.pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM gate_pass_records
          WHERE ${canonicalGatePass('gate_pass_number')} = ${canonicalGatePass('$1')}`,
        [' hz-gp-1048 '],
      );
      expect(gatePass.rows[0]?.n, 'R1: normalised gate-pass lookup must match one row').toBe(1);
    });
  });

  /* ------------------------------------------------------------------ */
  /* R2 - a violation master must carry an approved severity             */
  /* ------------------------------------------------------------------ */

  describe('R2 required master severity', () => {
    async function activeMasterId(): Promise<string> {
      const active = await db.pool.query<{ id: string }>(
        'SELECT id FROM violation_types WHERE is_active = true ORDER BY id LIMIT 1',
      );
      expect(active.rows).toHaveLength(1);
      return active.rows[0]?.id as string;
    }

    it('refuses to clear the severity of an active violation master', async () => {
      // The review showed this UPDATE succeeded for all six active masters.
      await expectRefused(
        'UPDATE violation_types SET severity = NULL WHERE id = $1',
        [await activeMasterId()],
        REQUIRED_VALUE_CODES,
        'R2: clearing an active master severity must be refused',
      );
    });

    it('refuses to insert a violation master without a severity', async () => {
      await expectRefused(
        'INSERT INTO violation_types(id, label) VALUES ($1,$2)',
        ['00000000-0000-4000-8000-00000000b001', 'Planner probe master without severity'],
        REQUIRED_VALUE_CODES,
        'R2: inserting a master without severity must be refused',
      );
    });

    it.each(['Minor', 'Major', 'Critical'])(
      'accepts the approved severity %s and still refuses an unapproved one',
      async (severity) => {
        const id = await activeMasterId();
        await expectAccepted(
          'UPDATE violation_types SET severity = $1 WHERE id = $2',
          [severity, id],
          `R2: the approved severity ${severity} must be accepted`,
        );
        await expectRefused(
          'UPDATE violation_types SET severity = $1 WHERE id = $2',
          ['Extreme', id],
          /^(23502|23514|22P02)$/,
          'R2: an unapproved severity must be refused',
        );
      },
    );

    it('leaves the nullable master default action untouched', async () => {
      // R2 is about severity only. `default_action` is deliberately nullable for
      // fixture masters, and that boundary must not be tightened by accident.
      const row = await db.pool.query<{ default_action: string | null }>(
        'SELECT default_action FROM violation_types ORDER BY id LIMIT 1',
      );
      expect(row.rows).toHaveLength(1);
      expect(row.rows[0]?.default_action).toBeNull();
    });
  });

  /* ------------------------------------------------------------------ */
  /* R3 - the authoritative post/gate association is persisted            */
  /* ------------------------------------------------------------------ */

  /**
   * The authoritative association must be persisted on `posts`.
   *
   * Direction is fixed by the approved model, not by taste: replacement
   * specification section 4 says the *authorised current post* determines the
   * actual issuance location and gate, so attribution resolves post -> gate ->
   * location. A reverse `gates.post_id` would leave a post unable to resolve its
   * own gate without a search, reversing the authoritative direction.
   */
  async function assertPostGateAssociationPersisted(): Promise<void> {
    const columns = await db.pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'gate_id'`,
    );
    expect(
      columns.rows.map((row) => row.column_name),
      'R3: no authoritative post-to-gate association is persisted. The fixture supplies ' +
        'gate.postId and the approved model resolves the actual issuance gate from the ' +
        'authorised post, so posts.gate_id must exist rather than a transient seed-time map.',
    ).toEqual(['gate_id']);
  }

  /** Join a challan's post to its gate through the persisted association. */
  const CHALLAN_POST_GATE_JOIN =
    'challans c JOIN posts p ON p.id = c.post_id JOIN gates g ON g.id = p.gate_id';

  it('persists the gate-to-post association supplied by the source fixture', async () => {
    await assertPostGateAssociationPersisted();
    const pairs = await db.pool.query<{ post_source: string; gate_source: string }>(
      'SELECT p.demo_source_id AS post_source, g.demo_source_id AS gate_source FROM posts p JOIN gates g ON g.id = p.gate_id ORDER BY 1',
    );
    // docs/demo-data.json: gate-01 -> Main Gate Post, gate-02 -> Dispatch Gate Post.
    expect(pairs.rows.map((row) => [row.post_source, row.gate_source])).toEqual(
      expect.arrayContaining([
        ['Main Gate Post', 'gate-01'],
        ['Dispatch Gate Post', 'gate-02'],
      ]),
    );
  });

  it('keeps every seeded challan consistent with its post, gate and location', async () => {
    await assertPostGateAssociationPersisted();

    const mismatchedGate = await db.pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ${CHALLAN_POST_GATE_JOIN} WHERE c.gate_id <> g.id`,
    );
    expect(mismatchedGate.rows[0]?.n).toBe(0);

    const mismatchedLocation = await db.pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ${CHALLAN_POST_GATE_JOIN}
        WHERE c.location_id <> g.location_id OR p.location_id <> g.location_id`,
    );
    expect(mismatchedLocation.rows[0]?.n).toBe(0);
  });

  it('resolves one gate per post unambiguously when two gates share a location', async () => {
    await assertPostGateAssociationPersisted();
    const mainLocation = await db.pool.query<{ id: string }>(
      "SELECT id FROM locations WHERE demo_source_id = 'loc-main'",
    );
    expect(mainLocation.rows).toHaveLength(1);
    const locationId = mainLocation.rows[0]?.id as string;

    const existing = await db.pool.query<{ gate_id: string; post_id: string }>(
      'SELECT g.id AS gate_id, p.id AS post_id FROM posts p JOIN gates g ON g.id = p.gate_id WHERE p.location_id = $1 LIMIT 1',
      [locationId],
    );
    expect(existing.rows).toHaveLength(1);

    const probeGateId = '00000000-0000-4000-8000-00000000c001';
    const resolved = await diagnostic(async (client) => {
      // A second gate and a second post at the *same* location: location matching
      // alone can no longer decide which gate a post belongs to.
      await client.query('INSERT INTO gates(id, location_id, label) VALUES ($1,$2,$3)', [
        probeGateId,
        locationId,
        'Planner probe second gate at the same location',
      ]);
      // The new post must name its gate: an unassociated post would defeat the very
      // invariant this finding is about.
      await client.query(
        'INSERT INTO posts(id, location_id, label, gate_id) VALUES ($1,$2,$3,$4)',
        [
          '00000000-0000-4000-8000-00000000c002',
          locationId,
          'Planner probe second post at the same location',
          probeGateId,
        ],
      );
      return client.query<{ post_id: string; gate_id: string }>(
        'SELECT p.id AS post_id, g.id AS gate_id FROM posts p JOIN gates g ON g.id = p.gate_id WHERE p.location_id = $1',
        [locationId],
      );
    });

    // Approved cardinality: each post resolves to exactly ONE gate. The reverse is
    // NOT implied - the approved model binds a marshal session to a post and lets
    // that post determine the gate, and says nothing about how many posts a gate
    // may serve. A gate serving two posts (two tablets at one gate) is legitimate,
    // so injectivity is deliberately NOT asserted here.
    const gatesByPost = new Map(resolved.rows.map((row) => [row.post_id, row.gate_id]));
    expect(gatesByPost.size).toBe(resolved.rows.length);
    for (const row of resolved.rows) {
      expect(gatesByPost.get(row.post_id)).toBe(row.gate_id);
    }
    expect(gatesByPost.get(existing.rows[0]?.post_id ?? '')).toBe(existing.rows[0]?.gate_id);
    expect(gatesByPost.size).toBeGreaterThanOrEqual(2);
  });

  it('allows several posts to share one gate, per the approved post-to-gate cardinality', async () => {
    await assertPostGateAssociationPersisted();
    const mainLocation = await db.pool.query<{ id: string }>(
      "SELECT id FROM locations WHERE demo_source_id = 'loc-main'",
    );
    const locationId = mainLocation.rows[0]?.id as string;
    const gate = await db.pool.query<{ id: string }>(
      'SELECT id FROM gates WHERE location_id = $1 ORDER BY id LIMIT 1',
      [locationId],
    );
    const gateId = gate.rows[0]?.id as string;

    // Two tablets at the same gate is legitimate operational data. If a migration
    // had narrowed this to one post per gate, that would be an unapproved extra
    // restriction rather than an invariant of the approved model.
    await diagnostic(async (client) => {
      await client.query(
        'INSERT INTO posts(id, location_id, label, gate_id) VALUES ($1,$2,$3,$4), ($5,$2,$6,$4)',
        [
          '00000000-0000-4000-8000-00000000c005',
          locationId,
          'Planner probe extra post on a shared gate',
          gateId,
          '00000000-0000-4000-8000-00000000c006',
          'Planner probe second post on the same gate',
        ],
      );
      const shared = await client.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM posts WHERE gate_id = $1',
        [gateId],
      );
      expect(shared.rows[0]?.n, 'a gate must be allowed to serve more than one post').toBe(3);
    });
  });

  it('refuses a post that references an UNCLAIMED gate at a different location', async () => {
    // Isolated location consistency. The gate is created fresh and claimed by no
    // post, so a uniqueness constraint cannot be what refuses this insert: only the
    // gate/location relationship can. That is why 23505 is excluded below.
    const locations = await db.pool.query<{ id: string; demo_source_id: string }>(
      "SELECT id, demo_source_id FROM locations WHERE demo_source_id IN ('loc-main','loc-dispatch')",
    );
    const mainLocation = locations.rows.find((row) => row.demo_source_id === 'loc-main');
    const dispatchLocation = locations.rows.find((row) => row.demo_source_id === 'loc-dispatch');
    expect(mainLocation, 'loc-main is required for this case').toBeDefined();
    expect(dispatchLocation, 'loc-dispatch is required for this case').toBeDefined();
    const mainLocationId = mainLocation?.id as string;
    const dispatchLocationId = dispatchLocation?.id as string;
    const unclaimedGateId = '00000000-0000-4000-8000-00000000c007';
    const postId = '00000000-0000-4000-8000-00000000c008';

    const observed = await diagnostic(async (client) => {
      // The gate lives at loc-dispatch while the post will live at loc-main.
      await client.query('INSERT INTO gates(id, location_id, label) VALUES ($1,$2,$3)', [
        unclaimedGateId,
        dispatchLocationId,
        'Planner probe unclaimed gate at the other location',
      ]);
      const claimants = await client.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM posts WHERE gate_id = $1',
        [unclaimedGateId],
      );
      // The post lives at loc-main but names a gate that lives at loc-dispatch.
      let caught: unknown;
      let code: string | undefined;
      try {
        await client.query(
          'INSERT INTO posts(id, location_id, label, gate_id) VALUES ($1,$2,$3,$4)',
          [postId, mainLocationId, 'Planner probe cross-location association', unclaimedGateId],
        );
      } catch (error) {
        caught = error;
        code = (error as { code?: string }).code;
      }
      return { claimants: claimants.rows[0]?.n, caught, code };
    });

    expect(observed.claimants, 'the probe gate must be unclaimed for this assertion').toBe(0);
    expect(observed.caught, 'an unclaimed cross-location gate must be refused').toBeDefined();
    expect(
      observed.code,
      `cross-location refusal must come from the gate/location relationship, got ${String(
        observed.code,
      )}`,
    ).toMatch(/^(23503|23514)$/);
  });

  it('refuses a post that references a gate which does not exist', async () => {
    const location = await db.pool.query<{ id: string }>(
      'SELECT id FROM locations ORDER BY id LIMIT 1',
    );
    await expectRefused(
      'INSERT INTO posts(id, location_id, label, gate_id) VALUES ($1,$2,$3,$4)',
      [
        '00000000-0000-4000-8000-00000000c004',
        location.rows[0]?.id,
        'Planner probe missing association target',
        UNUSED_ID,
      ],
      RELATIONSHIP_CODES,
      'R3: a post bound to a missing gate must be refused',
    );
  });
});
