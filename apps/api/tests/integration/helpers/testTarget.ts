import { existsSync } from 'node:fs';
import { createDb, type Db } from '../../../src/db/client.js';
import { runMigrations } from '../../../src/db/migrate.js';
import { assertIsTestDatabase } from '../../../src/db/testDatabase.js';
import { ENV_FILE_PATH, loadEnv } from '../../../src/env.js';

let cached: string | undefined;

/**
 * Resolves and guards the integration test database URL. Throws (never skips)
 * when TEST_DATABASE_URL is missing or points at anything that is not an
 * isolated test database.
 */
export function resolveTestDatabaseUrl(): string {
  if (cached) return cached;
  if (!existsSync(ENV_FILE_PATH) && !process.env['TEST_DATABASE_URL']) {
    throw new Error(
      `TEST_DATABASE_URL is not set and no environment file was found at ${ENV_FILE_PATH}. ` +
        'Copy .env.example to .env at the workspace root; the integration suite refuses to skip.',
    );
  }
  const env = loadEnv();
  if (!env.TEST_DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL is missing from the loaded environment.');
  }
  assertIsTestDatabase(env.TEST_DATABASE_URL);
  cached = env.TEST_DATABASE_URL;
  return cached;
}

/**
 * Drop and recreate the test database's schemas, then re-apply the generated
 * migrations. This makes every integration run start from an identical, empty
 * schema regardless of what a previous run left behind, so the suite is
 * repeatable and cannot pass on stale state.
 *
 * The guard runs before any statement is sent: this is destructive, and it is
 * only ever allowed against an isolated `_test` database.
 */
export async function resetAndMigrateTestDatabase(): Promise<Db> {
  const url = resolveTestDatabaseUrl();
  assertIsTestDatabase(url);
  const db = createDb(url);
  try {
    await db.pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
    await db.pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await db.pool.query('CREATE SCHEMA public');
    await runMigrations(db.orm);
    return db;
  } catch (error) {
    await db.close();
    throw new Error(`Failed to reset the test database at ${url}: ${(error as Error).message}`, {
      cause: error,
    });
  }
}
