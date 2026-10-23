import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../../src/db/client.js';
import { foundationDemoFixture } from '../../src/db/schema.js';
import { assertIsSeedAllowedDatabase } from '../../src/db/testDatabase.js';
import { seedDemoDatabase } from '../../src/db/seed-demo.js';
import { DEMO_DATA_PATH } from '../../src/env.js';
import { readFile } from 'node:fs/promises';
import { resetAndMigrateTestDatabase, resolveTestDatabaseUrl } from './helpers/testTarget.js';

const SEED_ROW_ID = 'synthetic-demo-data';

describe('seed adapter against the isolated test database', () => {
  let db: Db;

  beforeAll(async () => {
    db = await resetAndMigrateTestDatabase();
  });

  afterAll(async () => {
    if (db) {
      await db.orm.delete(foundationDemoFixture);
      await db.close();
    }
  });

  it('stores the raw docs/demo-data.json document in the harness table', async () => {
    await seedDemoDatabase(resolveTestDatabaseUrl());

    const [stored] = await db.orm
      .select()
      .from(foundationDemoFixture)
      .where(eq(foundationDemoFixture.id, SEED_ROW_ID));

    const expected = JSON.parse(await readFile(DEMO_DATA_PATH, 'utf8')) as unknown;

    expect(stored).toBeDefined();
    expect(stored?.source).toBe('docs/demo-data.json');
    expect(stored?.payload).toStrictEqual(expected);
    expect(stored?.loadedAt).toBeInstanceOf(Date);
  });

  it('is idempotent: a second run keeps exactly one row', async () => {
    await seedDemoDatabase(resolveTestDatabaseUrl());
    await seedDemoDatabase(resolveTestDatabaseUrl());

    const rows = await db.orm.select({ id: foundationDemoFixture.id }).from(foundationDemoFixture);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(SEED_ROW_ID);
    const [counted] = await db.orm.select({ value: count() }).from(foundationDemoFixture);
    expect(counted?.value).toBe(1);
  });

  it('refuses to seed anything outside the allowed local demo/test databases', async () => {
    await expect(
      seedDemoDatabase('postgresql://challan:challan@127.0.0.1:5433/some_other_database'),
    ).rejects.toThrow(/Refusing to seed database "some_other_database"/);
    expect(() =>
      assertIsSeedAllowedDatabase(
        'postgresql://challan:challan@127.0.0.1:5433/some_other_database',
      ),
    ).toThrow(/only echallan_demo, echallan_test/);
  });

  it('leaves the table empty after the suite cleans up', async () => {
    await db.orm.delete(foundationDemoFixture).where(eq(foundationDemoFixture.id, SEED_ROW_ID));
    const [counted] = await db.orm.select({ value: count() }).from(foundationDemoFixture);
    expect(counted?.value).toBe(0);
  });
});
