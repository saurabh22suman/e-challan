import { and, eq, sql } from 'drizzle-orm';
import { pathToFileURL } from 'node:url';
import {
  DEMO_ROLES,
  loadDemoCredentials,
  type DemoCredentials,
  type DemoRole,
} from '../auth/config.js';
import { DEPLOYMENT_DATA_PATH, loadEnv } from '../env.js';
import { createDb, type Db } from './client.js';
import * as s from './schema.js';
import { seedDomainDemoDatabase } from './seed-domain-demo.js';

/**
 * Deployment seed for the synthetic demo.
 *
 * It loads the reviewed `docs/demo-data.json` domain and then gives the
 * environment-configured Marshal/Supervisor a demo location when the account has
 * none. The Marshal also needs a post and shift; the chosen location has exactly
 * one active post and one active shift, so login can resolve them without an
 * ambiguous-context prompt.
 *
 * The target database must be named `echallan_demo` or `echallan_test`; the
 * underlying domain seed enforces that guard. Existing rows are never rewritten.
 */

const ROLE_BY_KEY: Record<DemoRole, (typeof s.ROLE_VALUES)[number]> = {
  marshal: 'Marshal',
  supervisor: 'Supervisor',
  admin: 'Admin',
};

export interface DemoAssignment {
  role: DemoRole;
  username: string;
  locationId: string | null;
  reason: 'assigned' | 'already-assigned' | 'not-needed' | 'no-candidate';
}

/** Pick a location with exactly one active post and one active shift. */
async function pickDemoLocation(db: Db): Promise<string | null> {
  const rows = await db.orm
    .select({ locationId: s.locations.id })
    .from(s.locations)
    .innerJoin(s.posts, and(eq(s.posts.locationId, s.locations.id), eq(s.posts.isActive, true)))
    .innerJoin(s.shifts, and(eq(s.shifts.gateId, s.posts.gateId), eq(s.shifts.isActive, true)))
    .where(eq(s.locations.isActive, true))
    .groupBy(s.locations.id)
    .having(sql`count(distinct ${s.posts.id}) = 1 and count(distinct ${s.shifts.id}) = 1`)
    .orderBy(s.locations.label)
    .limit(1);

  return rows[0]?.locationId ?? null;
}

export async function assignEnvUsersToDemoContext(
  db: Db,
  credentials: DemoCredentials,
): Promise<DemoAssignment[]> {
  const candidateLocationId = await pickDemoLocation(db);
  const assignments: DemoAssignment[] = [];

  for (const key of DEMO_ROLES) {
    const username = credentials[key].username;
    const role = ROLE_BY_KEY[key];

    if (role === 'Admin') {
      assignments.push({ role: key, username, locationId: null, reason: 'not-needed' });
      continue;
    }

    const stored = await db.orm
      .select({ id: s.users.id, role: s.users.role })
      .from(s.users)
      .where(sql`lower(${s.users.username}) = lower(${username})`)
      .limit(1);
    const user = stored[0];
    if (user === undefined || user.role !== role) {
      assignments.push({ role: key, username, locationId: null, reason: 'no-candidate' });
      continue;
    }

    const existing = await db.orm
      .select({ locationId: s.userLocations.locationId })
      .from(s.userLocations)
      .where(eq(s.userLocations.userId, user.id))
      .limit(1);
    if (existing[0] !== undefined) {
      assignments.push({
        role: key,
        username,
        locationId: existing[0].locationId,
        reason: 'already-assigned',
      });
      continue;
    }

    if (candidateLocationId === null) {
      assignments.push({ role: key, username, locationId: null, reason: 'no-candidate' });
      continue;
    }

    await db.orm
      .insert(s.userLocations)
      .values({ userId: user.id, locationId: candidateLocationId })
      .onConflictDoNothing();
    assignments.push({
      role: key,
      username,
      locationId: candidateLocationId,
      reason: 'assigned',
    });
  }

  return assignments;
}

export interface DeploymentDemoResult {
  assignments: DemoAssignment[];
}

export async function seedDeploymentDemo(): Promise<DeploymentDemoResult> {
  const env = loadEnv();
  const credentials = loadDemoCredentials(process.env);

  await seedDomainDemoDatabase(env.DATABASE_URL, {
    dataPath: DEPLOYMENT_DATA_PATH,
    sourceLabel: 'docs/deployment-data.json',
    resolutionNote: 'Reviewed and closed at the gate.',
    cancellationNote: 'Cancelled after gate-pass review.',
  });

  const db = createDb(env.DATABASE_URL);
  try {
    return { assignments: await assignEnvUsersToDemoContext(db, credentials) };
  } finally {
    await db.close();
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  try {
    const result = await seedDeploymentDemo();
    const assigned = result.assignments.filter((item) => item.reason === 'assigned');
    const unresolved = result.assignments.filter((item) => item.reason === 'no-candidate');
    console.log(
      `db:seed:deploy: ${assigned.length} account(s) assigned a demo location; ` +
        `${unresolved.length} account(s) could not be resolved`,
    );
    for (const item of result.assignments) {
      console.log(`db:seed:deploy: ${item.role} "${item.username}": ${item.reason}`);
    }
  } catch (error) {
    console.error('db:seed:deploy: failed', error);
    process.exit(1);
  }
}
