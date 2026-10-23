/**
 * Test-database guard.
 *
 * Integration work (migrations, fixtures, seed adapters) must never be able to
 * point at the development/demo database or at anything that was not declared a
 * test target. Both helpers parse the database name out of the PostgreSQL
 * connection string and refuse everything else loudly - they never skip.
 */

/** Explicitly permitted test database names (all also end with `_test`). */
export const TEST_DATABASE_ALLOWLIST: readonly string[] = ['echallan_test'];

/** Never a valid test target, even though its name is otherwise harmless. */
export const NON_TEST_DATABASE_NAMES: readonly string[] = ['echallan_demo'];

/**
 * The only databases the demo/test seed adapter may write to. Local names from
 * `docker-compose.yml`; a production or shared database is refused.
 */
export const SEED_ALLOWED_DATABASE_NAMES: readonly string[] = ['echallan_demo', 'echallan_test'];

const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);

/** Extract the database name from a PostgreSQL connection string. */
export function parseDatabaseName(connectionString: string): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(`Invalid PostgreSQL connection string: ${connectionString}`);
  }
  if (!POSTGRES_PROTOCOLS.has(url.protocol)) {
    throw new Error(
      `Invalid PostgreSQL connection string (expected postgres/postgresql): ${connectionString}`,
    );
  }
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (name === '') {
    throw new Error(
      `Invalid PostgreSQL connection string: no database name in ${connectionString}`,
    );
  }
  return name;
}

/**
 * Throws unless the connection string targets an isolated test database. Returns
 * the validated database name on success.
 */
export function assertIsTestDatabase(connectionString: string): string {
  const name = parseDatabaseName(connectionString);
  if (NON_TEST_DATABASE_NAMES.includes(name)) {
    throw new Error(
      `Refusing to use database "${name}" as a test target: it is a development/demo database. ` +
        'Use TEST_DATABASE_URL.',
    );
  }
  const allowed = name.endsWith('_test') || TEST_DATABASE_ALLOWLIST.includes(name);
  if (!allowed) {
    throw new Error(
      `Refusing to use database "${name}" as a test target: the name must end with "_test" ` +
        `or be listed in ${TEST_DATABASE_ALLOWLIST.join(', ')}.`,
    );
  }
  return name;
}

/**
 * Throws unless the connection string targets one of the explicitly allowed
 * local demo/test databases. Used by the seed adapter before it writes.
 */
export function assertIsSeedAllowedDatabase(connectionString: string): string {
  const name = parseDatabaseName(connectionString);
  if (!SEED_ALLOWED_DATABASE_NAMES.includes(name)) {
    throw new Error(
      `Refusing to seed database "${name}": only ${SEED_ALLOWED_DATABASE_NAMES.join(', ')} are ` +
        'allowed local demo/test targets.',
    );
  }
  return name;
}
