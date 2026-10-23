import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { eq } from 'drizzle-orm';
import {
  DEMO_ROLES,
  loadDemoCredentials,
  type DemoCredentials,
  type DemoRole,
} from '../auth/config.js';
import { DEMO_DATA_PATH, loadEnv } from '../env.js';
import { createDb } from './client.js';
import * as s from './schema.js';
import { deterministicUuid } from './seed-domain-demo.js';

/**
 * Bootstrap the accounts named by the DEMO_* environment variables.
 *
 * The F-02 sign-in path authenticates an environment credential against a stored
 * `users` row whose role must match. On a fresh deployment database those rows do
 * not exist, so an operator-supplied admin username would be refused even though
 * the password was configured. This adapter creates the missing rows before the
 * API starts.
 *
 * It writes no password (hash or plaintext): `password_hash` stays NULL, so the
 * environment password remains the credential authority. An Admin reset still
 * takes precedence afterwards, exactly as in the normal sign-in path.
 *
 * Existing rows are never modified. A deliberately deactivated account stays
 * deactivated, and a username already used by another role is refused loudly
 * rather than silently given a second meaning.
 */

const ROLE_BY_KEY: Record<DemoRole, (typeof s.ROLE_VALUES)[number]> = {
  marshal: 'Marshal',
  supervisor: 'Supervisor',
  admin: 'Admin',
};

export interface BootstrapUsersResult {
  created: number;
  existing: number;
}

/**
 * Demo-fixture usernames map to the stable UUIDs the synthetic seed uses.
 *
 * The optional demo seed inserts `user_locations` and shift references with IDs
 * derived from `docs/demo-data.json`; if the bootstrap created the same username
 * under a random id first, the demo seed's foreign keys would fail. Using the
 * fixture's deterministic id when the employee ID matches keeps both seeds
 * composable. Custom operator usernames still get random ids.
 */
async function fixtureUserIds(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  try {
    const raw = await readFile(DEMO_DATA_PATH, 'utf8');
    const fixture = JSON.parse(raw) as {
      staff?: Array<{ id?: unknown; employeeId?: unknown }>;
    };
    for (const person of fixture.staff ?? []) {
      if (typeof person.id === 'string' && typeof person.employeeId === 'string') {
        ids.set(person.employeeId, deterministicUuid(`staff:${person.id}`));
      }
    }
  } catch {
    // The fixture is optional at runtime; a custom deployment simply gets random ids.
  }
  return ids;
}

export async function seedEnvUsers(
  connectionString: string,
  credentials: DemoCredentials,
): Promise<BootstrapUsersResult> {
  const demoUserIds = await fixtureUserIds();
  const db = createDb(connectionString);
  try {
    return await db.orm.transaction(async (tx) => {
      let created = 0;
      let existing = 0;

      for (const key of DEMO_ROLES) {
        const username = credentials[key].username;
        const role = ROLE_BY_KEY[key];
        const stored = await tx
          .select({ id: s.users.id, role: s.users.role, isActive: s.users.isActive })
          .from(s.users)
          .where(eq(s.users.username, username))
          .limit(1);

        const user = stored[0];
        if (user !== undefined) {
          if (user.role !== role) {
            throw new Error(
              `Refusing to bootstrap "${username}": it already exists with role ` +
                `"${user.role}" but the ${key} environment credential requires "${role}". ` +
                'Use a different username or correct the existing account.',
            );
          }
          existing += 1;
          continue;
        }

        await tx
          .insert(s.users)
          .values({
            id: demoUserIds.get(username) ?? randomUUID(),
            username,
            role,
            displayName: username,
            isActive: true,
          })
          .onConflictDoNothing();
        created += 1;
      }

      return { created, existing };
    });
  } finally {
    await db.close();
  }
}

export async function seedEnvUsersFromEnvironment(): Promise<BootstrapUsersResult> {
  return seedEnvUsers(loadEnv().DATABASE_URL, loadDemoCredentials(process.env));
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  try {
    const result = await seedEnvUsersFromEnvironment();
    console.log(
      `db:seed:env-users: ${result.created} account(s) created, ${result.existing} already present`,
    );
  } catch (error) {
    console.error('db:seed:env-users: failed', error);
    process.exit(1);
  }
}
