import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { DEMO_DATA_PATH, loadEnv } from '../env.js';
import { foundationDemoFixture } from './schema.js';
import { createDb } from './client.js';
import { assertIsSeedAllowedDatabase } from './testDatabase.js';

const FIXTURE_ID = 'synthetic-demo-data';
const FIXTURE_SOURCE = 'docs/demo-data.json';

/**
 * Repeatable seed adapter for the S-01 foundation.
 *
 * It stores the raw synthetic `docs/demo-data.json` document in the harness
 * table `foundation_demo_fixture` so the demo/seed path is exercised end to end.
 * It models no domain rules: nothing here interprets the fixture, derives
 * business meaning, or decides production behaviour. See `docs/demo-data.md`
 * item 6 (isolate, repeatable, refuse production targets).
 *
 * Safety: refuses to write unless the target database name is one of the
 * explicitly allowed local demo/test names from `docker-compose.yml`
 * (`echallan_demo`, `echallan_test`).
 *
 * Idempotency: the whole table is replaced inside one transaction, so repeated
 * runs converge on exactly one row and never duplicate.
 */
export async function seedDemoDatabase(connectionString: string): Promise<{ rows: number }> {
  const databaseName = assertIsSeedAllowedDatabase(connectionString);
  const raw = await readFile(DEMO_DATA_PATH, 'utf8');
  const payload: unknown = JSON.parse(raw);

  const db = createDb(connectionString);
  try {
    await db.orm.transaction(async (tx) => {
      await tx.delete(foundationDemoFixture);
      await tx.insert(foundationDemoFixture).values({
        id: FIXTURE_ID,
        source: FIXTURE_SOURCE,
        payload: payload as Record<string, unknown>,
      });
    });
    const rows = await db.orm.select({ id: foundationDemoFixture.id }).from(foundationDemoFixture);
    console.log(
      `db:seed:demo: seeded ${rows.length} row(s) into ${databaseName} from ${FIXTURE_SOURCE}`,
    );
    return { rows: rows.length };
  } finally {
    await db.close();
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  try {
    await seedDemoDatabase(loadEnv().DATABASE_URL);
  } catch (error) {
    console.error('db:seed:demo: failed', error);
    process.exit(1);
  }
}
