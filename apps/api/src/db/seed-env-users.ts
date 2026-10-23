import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { eq } from 'drizzle-orm';
import {
  DEMO_ROLES,
  loadDemoCredentials,
  type DemoCredentials,
  type DemoRole,
} from '../auth/config.js';
import { loadEnv } from '../env.js';
import { createDb } from './client.js';
import * as s from './schema.js';

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

export async function seedEnvUsers(
  connectionString: string,
  credentials: DemoCredentials,
): Promise<BootstrapUsersResult> {
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
            id: randomUUID(),
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
