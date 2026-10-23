import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../../src/db/client.js';
import { foundationDemoFixture } from '../../src/db/schema.js';
import { resetAndMigrateTestDatabase } from './helpers/testTarget.js';

const FIXTURE_ID = 'integration-roundtrip';
const FIXTURE_SOURCE = 'docs/demo-data.json';

const payload = {
  purpose: 'synthetic foundation round-trip probe',
  synthetic: true,
  nested: { counts: [1, 2, 3], flag: false },
  referenceNow: '2026-10-01T12:00:00+05:30',
} as const;

describe('foundation_demo_fixture against real PostgreSQL', () => {
  let db: Db;

  beforeAll(async () => {
    // Real SQL migrations, applied to a freshly reset isolated test database so
    // the run is repeatable and never passes on stale state.
    db = await resetAndMigrateTestDatabase();
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  async function rowCount(): Promise<number> {
    const [row] = await db.orm.select({ value: count() }).from(foundationDemoFixture);
    return row?.value ?? 0;
  }

  it('starts with an empty fixture table (no contamination from a previous run)', async () => {
    await expect(rowCount()).resolves.toBe(0);
  });

  it('inserts a row, reads it back and round-trips the JSON payload', async () => {
    await db.orm.insert(foundationDemoFixture).values({
      id: FIXTURE_ID,
      source: FIXTURE_SOURCE,
      payload,
    });

    const [stored] = await db.orm
      .select()
      .from(foundationDemoFixture)
      .where(eq(foundationDemoFixture.id, FIXTURE_ID));

    expect(stored).toBeDefined();
    expect(stored?.id).toBe(FIXTURE_ID);
    expect(stored?.source).toBe(FIXTURE_SOURCE);
    expect(stored?.payload).toStrictEqual(payload);
    expect(stored?.loadedAt).toBeInstanceOf(Date);

    await expect(rowCount()).resolves.toBe(1);
  });

  it('cleans up everything it created and leaves the table empty', async () => {
    await db.orm.delete(foundationDemoFixture).where(eq(foundationDemoFixture.id, FIXTURE_ID));

    await expect(rowCount()).resolves.toBe(0);
  });
});
