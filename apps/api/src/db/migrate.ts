import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createDb } from './client.js';
import * as schema from './schema.js';
import { loadEnv } from '../env.js';

/**
 * Applies the generated SQL migrations in `apps/api/drizzle/` to the development
 * database. Drizzle records applied migrations in `__drizzle_migrations`, so
 * repeated runs are idempotent and never re-run an applied file.
 *
 * Usage: `pnpm --filter @echallan/api run db:migrate` (from the workspace root:
 * `pnpm db:migrate`).
 */
export async function runMigrations(orm: NodePgDatabase<typeof schema>): Promise<void> {
  await assertPostGateMappingIsResolvable(orm);
  await migrate(orm, { migrationsFolder: MIGRATIONS_FOLDER });
}

interface AmbiguousPostGateRow {
  id: string;
  label: string | null;
  location_id: string;
  gates_at_location: number;
}

/**
 * Pre-flight guard: refuse to migrate when a post cannot be mapped to exactly one
 * gate at its location.
 *
 * Corrective migration 0003 backfills `posts.gate_id` from the gate sharing the
 * post's location. That UPDATE joins every gate at that location, so when a location
 * has two or more gates PostgreSQL silently selects one of them and the post ends up
 * bound to an arbitrary gate. The `DO` guard inside 0003 cannot detect this because
 * it only looks for a leftover NULL *after* the guess has already been made.
 *
 * This check therefore runs in the **supported migration entrypoint, before**
 * `migrate()` is called, so the ambiguous data is refused instead of resolved by
 * chance. It is additive and safe to run repeatedly: on an empty database the
 * `posts` table does not exist yet, and once `gate_id` is populated no row is
 * considered unmapped, so both cases are no-ops.
 *
 * Supported entrypoints are {@link runMigrations} and
 * {@link migrateDevelopmentDatabase}, i.e. `pnpm db:migrate` and the integration
 * harness. Limitations: this is a check performed immediately before migration, not
 * a lock held across the migration, so a concurrent writer could introduce ambiguity
 * in that window. The pilot runs migrations as a single explicit operation before
 * seeding, which is the supported workflow; a production rollout would need the
 * check inside the migration transaction or an advisory lock.
 */
export async function assertPostGateMappingIsResolvable(
  orm: NodePgDatabase<typeof schema>,
): Promise<void> {
  const postsExists = await orm.execute(sql`
    SELECT count(*)::int AS present FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'posts'
  `);
  if (Number(postsExists.rows[0]?.present ?? 0) === 0) return;

  // Before corrective migration 0003 the column does not exist, so every post is
  // unmapped and every one of them must resolve unambiguously.
  const gateColumnExists = await orm.execute(sql`
    SELECT count(*)::int AS present FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'gate_id'
  `);
  const unmapped =
    Number(gateColumnExists.rows[0]?.present ?? 0) > 0 ? sql`p.gate_id IS NULL` : sql`true`;

  const conflicts = (
    await orm.execute(sql`
    SELECT p.id, p.label, p.location_id, count(g.id)::int AS gates_at_location
      FROM posts AS p
      LEFT JOIN gates AS g ON g.location_id = p.location_id
     WHERE ${unmapped}
     GROUP BY p.id, p.label, p.location_id
    HAVING count(g.id) <> 1
  `)
  ).rows as unknown as AmbiguousPostGateRow[];

  if (conflicts.length > 0) {
    const detail = conflicts
      .map(
        (row) =>
          `post ${row.id} (${row.label ?? 'unlabelled'}) at location ${row.location_id} matches ` +
          `${row.gates_at_location} gate(s)`,
      )
      .join('; ');
    throw new Error(
      'Refusing to migrate: the post-to-gate mapping is ambiguous and cannot be resolved ' +
        `automatically. A post must belong to exactly one gate at its location. ${detail}. ` +
        'Assign the gate explicitly, or split the location, then migrate again. No gate was ' +
        'guessed and no row was merged or deleted.',
    );
  }
}

/** Run migrations against the development `DATABASE_URL` and report the result. */
export async function migrateDevelopmentDatabase(): Promise<void> {
  const env = loadEnv();
  const db = createDb(env.DATABASE_URL);
  try {
    await runMigrations(db.orm);
  } finally {
    await db.close();
  }
}

/**
 * Locate the generated migrations folder by walking up from this module. Works
 * from `src/db` under tsx and from `dist/db` after a build.
 */
function findMigrationsFolder(): string {
  // `__dirname` is unavailable in ESM; derive the directory from import.meta.url.
  let current = path.dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = path.join(current, 'drizzle');
    if (existsSync(path.join(candidate, 'meta', '_journal.json'))) return candidate;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error('Unable to locate the generated drizzle migrations folder (apps/api/drizzle)');
}

const MIGRATIONS_FOLDER = findMigrationsFolder();

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  try {
    await migrateDevelopmentDatabase();
    console.log('db:migrate: development database migrations applied');
  } catch (error) {
    console.error('db:migrate: failed', error);
    process.exit(1);
  }
}
