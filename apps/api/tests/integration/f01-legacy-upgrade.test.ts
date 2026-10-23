import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb, type Db } from '../../src/db/client.js';
import { runMigrations } from '../../src/db/migrate.js';
import { WORKSPACE_ROOT } from '../../src/env.js';
import { resolveTestDatabaseUrl } from './helpers/testTarget.js';

/**
 * Planner-owned additive acceptance for the F-01 **legacy upgrade path**.
 *
 * Added after `docs/reviews/F-01-correction-followup.md` found that corrective
 * migration `0003` backfilled `posts.gate_id` with
 *
 *   UPDATE posts AS p SET gate_id = g.id FROM gates AS g
 *    WHERE g.location_id = p.location_id AND p.gate_id IS NULL
 *
 * which, when a location has **two** gates, lets PostgreSQL pick one matching row
 * silently. The `DO` guard in `0003` only checks for a leftover NULL *after* the
 * UPDATE, so it cannot detect that a gate was guessed.
 *
 * These tests drive the **real** supported entrypoint (`runMigrations`) from a
 * genuine legacy state built by applying only migrations 0000-0002, rather than
 * asserting against hand-written SQL. They cover:
 *
 *  1. an ambiguous legacy mapping (two gates at one location, one unmapped post)
 *     must be **refused**, and no gate may be associated with the post;
 *  2. an unambiguous legacy mapping must upgrade cleanly, retaining existing rows;
 *  3. the upgrade path must be idempotent on repeat runs.
 *
 * Read-only with respect to the repository: migrations are copied into a temporary
 * directory under the system temp dir, and only the guarded isolated test database
 * is rebuilt.
 */

const MIGRATIONS_FOLDER = path.join(WORKSPACE_ROOT, 'apps/api/drizzle');
/** Entries applied to build the legacy state: 0000, 0001, 0002. */
const LEGACY_ENTRY_COUNT = 3;
const FOUNDATION_PROBE_ID = 'f01-legacy-upgrade-probe';

describe('F-01 legacy upgrade path: post/gate association', () => {
  let db: Db;

  beforeAll(async () => {
    db = createDb(resolveTestDatabaseUrl());
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  afterEach(async () => {
    // Leave the isolated database on the current migrations so later integration
    // files start from the same state this suite found.
    await db.pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
    await db.pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await db.pool.query('CREATE SCHEMA public');
    await runMigrations(db.orm);
  });

  /** Copy only the first `count` journal entries and their SQL into a temp folder. */
  async function legacyMigrationsFolder(count: number): Promise<string> {
    const temporary = await mkdtemp(path.join(tmpdir(), 'f01-legacy-'));
    const journal = JSON.parse(
      await readFile(path.join(MIGRATIONS_FOLDER, 'meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ tag: string }> };
    const entries = journal.entries.slice(0, count);
    expect(entries.length, 'fewer migrations than the legacy baseline expects').toBe(count);
    for (const entry of entries) {
      expect(entry.tag).not.toContain('0003');
    }

    await mkdir(path.join(temporary, 'meta'));
    await writeFile(
      path.join(temporary, 'meta/_journal.json'),
      JSON.stringify({ ...journal, entries }),
    );
    for (const entry of entries) {
      await copyFile(
        path.join(MIGRATIONS_FOLDER, `${entry.tag}.sql`),
        path.join(temporary, `${entry.tag}.sql`),
      );
    }
    return temporary;
  }

  /** Rebuild the isolated database at the genuine legacy migration level. */
  async function loadLegacyState(count: number): Promise<void> {
    const temporary = await legacyMigrationsFolder(count);
    try {
      await db.pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
      await db.pool.query('DROP SCHEMA IF EXISTS public CASCADE');
      await db.pool.query('CREATE SCHEMA public');
      await migrate(db.orm, { migrationsFolder: temporary });
      // The legacy level genuinely has no post->gate column at all.
      const columns = await db.pool.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'posts'`,
      );
      expect(columns.rows.map((row) => row.column_name)).not.toContain('gate_id');
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }

  it('refuses an ambiguous legacy post/gate mapping instead of guessing a gate', async () => {
    await loadLegacyState(LEGACY_ENTRY_COUNT);

    // One location, TWO gates, and a legacy post that cannot be mapped to either.
    await db.pool.query(
      "INSERT INTO locations(id, label) VALUES ('00000000-0000-4000-8000-00000000d001','Planner legacy shared location')",
    );
    await db.pool.query(
      "INSERT INTO gates(id, location_id, label) VALUES ('00000000-0000-4000-8000-00000000d002','00000000-0000-4000-8000-00000000d001','Planner legacy gate A'), ('00000000-0000-4000-8000-00000000d003','00000000-0000-4000-8000-00000000d001','Planner legacy gate B')",
    );
    await db.pool.query(
      "INSERT INTO posts(id, location_id, label) VALUES ('00000000-0000-4000-8000-00000000d004','00000000-0000-4000-8000-00000000d001','Planner legacy unmapped post')",
    );

    let failure: unknown;
    try {
      await runMigrations(db.orm);
    } catch (error) {
      failure = error;
    }

    expect(
      failure,
      'an ambiguous legacy post/gate mapping must be refused, not silently resolved',
    ).toBeDefined();
    expect(String((failure as Error)?.message ?? failure)).toMatch(
      /ambiguous|unmappable|cannot be resolved|exactly one gate|guess/i,
    );

    // Whatever the mechanism, no gate may have been associated with the post: the
    // legacy level has no gate_id column, so a successful upgrade would have added
    // it, and a refused one must not have left a guessed value behind.
    const columns = await db.pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'posts'`,
    );
    const columnNames = columns.rows.map((row) => row.column_name);
    if (columnNames.includes('gate_id')) {
      const posts = await db.pool.query<{ gate_id: string | null }>(
        'SELECT gate_id FROM posts WHERE id = $1',
        ['00000000-0000-4000-8000-00000000d004'],
      );
      expect(
        posts.rows[0]?.gate_id,
        'the refused upgrade must not have guessed a gate for the ambiguous post',
      ).toBeNull();
    } else {
      // The upgrade was refused before the column existed, which is also correct.
      expect(columnNames).not.toContain('gate_id');
    }
  });

  it('upgrades a legacy shared-gate mapping: one gate serving two posts, with foundation data retained', async () => {
    // The approved cardinality allows several posts to resolve the same gate, and the
    // legacy 0000-0002 schema also permits several posts at one location. When that
    // location has exactly one gate, every post maps unambiguously, so the upgrade
    // MUST succeed. This case is what an obsolete *intermediate* constraint
    // (0003 creating UNIQUE(posts.gate_id), removed later by 0005) would break, and it
    // cannot be detected by testing the final schema alone.
    await loadLegacyState(LEGACY_ENTRY_COUNT);

    const locationId = '00000000-0000-4000-8000-00000000f001';
    const gateId = '00000000-0000-4000-8000-00000000f002';
    const firstPostId = '00000000-0000-4000-8000-00000000f003';
    const secondPostId = '00000000-0000-4000-8000-00000000f004';

    await db.pool.query('INSERT INTO locations(id, label) VALUES ($1,$2)', [
      locationId,
      'Planner legacy shared-gate location',
    ]);
    await db.pool.query('INSERT INTO gates(id, location_id, label) VALUES ($1,$2,$3)', [
      gateId,
      locationId,
      'Planner legacy only gate',
    ]);
    await db.pool.query('INSERT INTO posts(id, location_id, label) VALUES ($1,$2,$3), ($4,$2,$5)', [
      firstPostId,
      locationId,
      'Planner legacy first post on the shared gate',
      secondPostId,
      'Planner legacy second post on the shared gate',
    ]);
    await db.pool.query(
      'INSERT INTO foundation_demo_fixture (id, source, payload) VALUES ($1,$2,$3)',
      [FOUNDATION_PROBE_ID, 'planner', JSON.stringify({ synthetic: true })],
    );

    let failure: unknown;
    try {
      await runMigrations(db.orm);
      await runMigrations(db.orm);
    } catch (error) {
      failure = error;
    }
    expect(
      failure,
      'a legacy shared-gate mapping is valid data under the approved cardinality and must upgrade',
    ).toBeUndefined();

    // Both posts survive with their original identities, and both resolve the gate.
    const posts = await db.pool.query<{ id: string; gate_id: string }>(
      'SELECT id, gate_id FROM posts ORDER BY id',
    );
    expect(posts.rows.map((row) => row.id)).toEqual([firstPostId, secondPostId]);
    for (const row of posts.rows) {
      expect(row.gate_id, `post ${row.id} must resolve the shared gate`).toBe(gateId);
    }

    // Idempotence: nothing was duplicated by the repeat run.
    const counts = await db.pool.query<{ posts: number; gates: number; foundation: number }>(
      'SELECT (SELECT count(*) FROM posts)::int AS posts, (SELECT count(*) FROM gates)::int AS gates, (SELECT count(*) FROM foundation_demo_fixture)::int AS foundation',
    );
    expect(counts.rows[0]).toMatchObject({ posts: 2, gates: 1, foundation: 1 });

    const retained = await db.pool.query<{ payload: unknown }>(
      'SELECT payload FROM foundation_demo_fixture WHERE id = $1',
      [FOUNDATION_PROBE_ID],
    );
    expect(retained.rows).toHaveLength(1);
    expect(retained.rows[0]?.payload).toEqual({ synthetic: true });
  });

  it('upgrades an unambiguous legacy mapping, retains existing rows, and is idempotent', async () => {
    await loadLegacyState(LEGACY_ENTRY_COUNT);

    await db.pool.query(
      "INSERT INTO locations(id, label) VALUES ('00000000-0000-4000-8000-00000000e001','Planner legacy single location')",
    );
    await db.pool.query(
      "INSERT INTO gates(id, location_id, label) VALUES ('00000000-0000-4000-8000-00000000e002','00000000-0000-4000-8000-00000000e001','Planner legacy only gate')",
    );
    await db.pool.query(
      "INSERT INTO posts(id, location_id, label) VALUES ('00000000-0000-4000-8000-00000000e003','00000000-0000-4000-8000-00000000e001','Planner legacy mapped post')",
    );
    await db.pool.query(
      `INSERT INTO foundation_demo_fixture (id, source, payload) VALUES ($1,$2,$3)`,
      [FOUNDATION_PROBE_ID, 'planner', JSON.stringify({ synthetic: true })],
    );

    await runMigrations(db.orm);
    await runMigrations(db.orm);

    // Queried by primary key: at the legacy level `demo_source_id` was never
    // populated for these probe rows.
    const posts = await db.pool.query<{ id: string; gate_id: string }>(
      'SELECT id, gate_id FROM posts WHERE id = $1',
      ['00000000-0000-4000-8000-00000000e003'],
    );
    expect(posts.rows).toHaveLength(1);
    expect(posts.rows[0]?.gate_id).toBe('00000000-0000-4000-8000-00000000e002');

    const counts = await db.pool.query<{ posts: number; gates: number; foundation: number }>(
      'SELECT (SELECT count(*) FROM posts)::int AS posts, (SELECT count(*) FROM gates)::int AS gates, (SELECT count(*) FROM foundation_demo_fixture)::int AS foundation',
    );
    expect(counts.rows[0]).toMatchObject({ posts: 1, gates: 1, foundation: 1 });

    const retained = await db.pool.query<{ payload: unknown }>(
      'SELECT payload FROM foundation_demo_fixture WHERE id = $1',
      [FOUNDATION_PROBE_ID],
    );
    expect(retained.rows).toHaveLength(1);
    expect(retained.rows[0]?.payload).toEqual({ synthetic: true });
  });
});
