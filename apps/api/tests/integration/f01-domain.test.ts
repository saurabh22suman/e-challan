import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Db } from '../../src/db/client.js';
import { runMigrations } from '../../src/db/migrate.js';
import { WORKSPACE_ROOT } from '../../src/env.js';
import { resetAndMigrateTestDatabase, resolveTestDatabaseUrl } from './helpers/testTarget.js';

const requiredTables = [
  'users',
  'locations',
  'gates',
  'posts',
  'shifts',
  'user_locations',
  'departments',
  'contractors',
  'vehicle_types',
  'violation_types',
  'drivers',
  'vehicles',
  'gate_pass_records',
  'gate_pass_locations',
  'challans',
  'challan_violations',
  'evidence',
  'signatures',
  'refusals',
  'challan_actions',
  'audit_events',
];
const unusedId = '00000000-0000-4000-8000-999999999999';

async function seedFunction(): Promise<(url: string) => Promise<unknown>> {
  const path = '../../src/db/seed-domain-demo.js';
  let module: Record<string, unknown> = {};
  try {
    module = (await import(path)) as Record<string, unknown>;
  } catch {
    /* explicit surface absence */
  }
  expect(typeof module['seedDomainDemoDatabase'], 'F-01 domain seed adapter surface absent').toBe(
    'function',
  );
  return module['seedDomainDemoDatabase'] as (url: string) => Promise<unknown>;
}

describe('DOM-02/DOM-03: real PostgreSQL domain foundation', () => {
  let db: Db;
  beforeAll(async () => {
    db = await resetAndMigrateTestDatabase();
  });
  afterAll(async () => {
    if (db) await db.close();
  });

  async function assertTables(): Promise<void> {
    const result = await db.pool.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
    );
    const names = result.rows.map((row) => row.tablename);
    expect(
      names,
      'F-01 surface absence: domain migrations have not created the required tables',
    ).toEqual(expect.arrayContaining(requiredTables));
    expect(names).toContain('foundation_demo_fixture');
  }

  async function seed(): Promise<void> {
    await assertTables();
    await (
      await seedFunction()
    )(resolveTestDatabaseUrl());
  }

  it('creates the domain tables on an empty database and preserves the foundation harness', async () => {
    await assertTables();
  });

  it('upgrades an actual S-01 database and preserves its row when migrations are rerun', async () => {
    const temporary = await mkdtemp(path.join(tmpdir(), 'f01-upgrade-'));
    const migrations = path.join(WORKSPACE_ROOT, 'apps/api/drizzle');
    try {
      const journal = JSON.parse(
        await readFile(path.join(migrations, 'meta/_journal.json'), 'utf8'),
      ) as { entries: Array<{ tag: string }> };
      expect(journal.entries[0]?.tag).toBe('0000_stormy_namor');
      await mkdir(path.join(temporary, 'meta'));
      await writeFile(
        path.join(temporary, 'meta/_journal.json'),
        JSON.stringify({ ...journal, entries: journal.entries.slice(0, 1) }),
      );
      await copyFile(
        path.join(migrations, '0000_stormy_namor.sql'),
        path.join(temporary, '0000_stormy_namor.sql'),
      );
      // The guarded URL was resolved before beforeAll reset; this uses only that
      // same isolated test connection, never DATABASE_URL.
      await db.pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
      await db.pool.query('DROP SCHEMA IF EXISTS public CASCADE');
      await db.pool.query('CREATE SCHEMA public');
      await migrate(db.orm, { migrationsFolder: temporary });
      await db.pool.query(
        "INSERT INTO foundation_demo_fixture (id, source, payload) VALUES ('f01-upgrade-probe','planner','{\"synthetic\":true}')",
      );
      await runMigrations(db.orm);
      await runMigrations(db.orm);
      await assertTables();
      const retained = await db.pool.query(
        "SELECT payload FROM foundation_demo_fixture WHERE id='f01-upgrade-probe'",
      );
      expect(retained.rows).toHaveLength(1);
      expect(retained.rows[0]?.['payload']).toEqual({ synthetic: true });
      await db.pool.query("DELETE FROM foundation_demo_fixture WHERE id='f01-upgrade-probe'");
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  it('seeds the approved fixture twice without duplicates or changed identities', async () => {
    await seed();
    const before = await db.pool.query(
      'SELECT id, gate_pass_number FROM gate_pass_records ORDER BY gate_pass_number',
    );
    await (
      await seedFunction()
    )(resolveTestDatabaseUrl());
    const after = await db.pool.query(
      'SELECT id, gate_pass_number FROM gate_pass_records ORDER BY gate_pass_number',
    );
    expect(before.rows).toHaveLength(10);
    expect(after.rows).toStrictEqual(before.rows);
    const counts = await db.pool.query(
      'SELECT (SELECT count(*) FROM drivers)::int AS drivers, (SELECT count(*) FROM vehicles)::int AS vehicles, (SELECT count(*) FROM challans)::int AS challans',
    );
    expect(counts.rows[0]).toMatchObject({ drivers: 10, vehicles: 9, challans: 14 });
  });

  it('retains a gate pass with no challan history and distinct drivers sharing a vehicle', async () => {
    await seed();
    const zeroHistory = await db.pool.query(
      "SELECT g.gate_pass_number FROM gate_pass_records g LEFT JOIN challans c ON c.gate_pass_number = g.gate_pass_number WHERE g.gate_pass_number = 'DEMO-GP-0010' AND c.id IS NULL",
    );
    expect(zeroHistory.rows).toHaveLength(1);
    const shared = await db.pool.query(
      "SELECT count(DISTINCT g.driver_id)::int AS drivers FROM gate_pass_records g JOIN vehicles v ON g.vehicle_id=v.id WHERE v.registration_number='MH12RT7306'",
    );
    expect(shared.rows[0]?.['drivers']).toBe(2);
  });

  it('refuses a non-demo/non-test seed target before attempting any write', async () => {
    const seedDomain = await seedFunction();
    await expect(
      seedDomain('postgresql://challan:challan@127.0.0.1:5432/production'),
    ).rejects.toThrow(/refus|allowed|demo|test/i);
  });

  it('enforces unique registrations and challan numbers in PostgreSQL', async () => {
    await seed();
    const vehicles = await db.pool.query(
      'SELECT id, registration_number FROM vehicles ORDER BY id LIMIT 2',
    );
    expect(vehicles.rows).toHaveLength(2);
    await expect(
      db.pool.query('UPDATE vehicles SET registration_number=$1 WHERE id=$2', [
        vehicles.rows[0]?.['registration_number'],
        vehicles.rows[1]?.['id'],
      ]),
    ).rejects.toMatchObject({ code: '23505' });
    const challans = await db.pool.query(
      'SELECT id, challan_number FROM challans ORDER BY id LIMIT 2',
    );
    expect(challans.rows).toHaveLength(2);
    await expect(
      db.pool.query('UPDATE challans SET challan_number=$1 WHERE id=$2', [
        challans.rows[0]?.['challan_number'],
        challans.rows[1]?.['id'],
      ]),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('enforces gate-pass uniqueness and foreign-key identity references', async () => {
    await seed();
    const passes = await db.pool.query(
      'SELECT id, gate_pass_number FROM gate_pass_records ORDER BY id LIMIT 2',
    );
    expect(passes.rows).toHaveLength(2);
    await expect(
      db.pool.query('UPDATE gate_pass_records SET gate_pass_number=$1 WHERE id=$2', [
        passes.rows[0]?.['gate_pass_number'],
        passes.rows[1]?.['id'],
      ]),
    ).rejects.toMatchObject({ code: '23505' });
    await expect(
      db.pool.query('UPDATE gate_pass_records SET driver_id=$1 WHERE id=$2', [
        unusedId,
        passes.rows[0]?.['id'],
      ]),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('rejects invalid status and severity values at the database boundary', async () => {
    await seed();
    const challan = await db.pool.query('SELECT id FROM challans LIMIT 1');
    const violation = await db.pool.query('SELECT id FROM violation_types LIMIT 1');
    await expect(
      db.pool.query("UPDATE challans SET status='Pending' WHERE id=$1", [challan.rows[0]?.['id']]),
    ).rejects.toMatchObject({ code: expect.stringMatching(/^(23514|22P02)$/) });
    await expect(
      db.pool.query("UPDATE violation_types SET severity='Extreme' WHERE id=$1", [
        violation.rows[0]?.['id'],
      ]),
    ).rejects.toMatchObject({ code: expect.stringMatching(/^(23514|22P02)$/) });
  });

  it('rejects duplicate violation selection for the same challan in PostgreSQL', async () => {
    await seed();
    const multi = await db.pool.query(
      'SELECT challan_id FROM challan_violations GROUP BY challan_id HAVING count(*) > 1 LIMIT 1',
    );
    expect(multi.rows).toHaveLength(1);
    const selected = await db.pool.query(
      'SELECT violation_type_id FROM challan_violations WHERE challan_id=$1 ORDER BY violation_type_id LIMIT 2',
      [multi.rows[0]?.['challan_id']],
    );
    expect(selected.rows).toHaveLength(2);
    await expect(
      db.pool.query(
        'UPDATE challan_violations SET violation_type_id=$1 WHERE challan_id=$2 AND violation_type_id=$3',
        [
          selected.rows[0]?.['violation_type_id'],
          multi.rows[0]?.['challan_id'],
          selected.rows[1]?.['violation_type_id'],
        ],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('preserves issued label/severity snapshots when their master is edited', async () => {
    await seed();
    const selected = await db.pool.query(
      'SELECT violation_type_id, label_snapshot, severity_snapshot FROM challan_violations ORDER BY challan_id LIMIT 1',
    );
    expect(selected.rows).toHaveLength(1);
    const id = selected.rows[0]?.['violation_type_id'];
    const before = await db.pool.query(
      'SELECT challan_id, label_snapshot, severity_snapshot FROM challan_violations WHERE violation_type_id=$1 ORDER BY challan_id',
      [id],
    );
    await db.pool.query(
      "UPDATE violation_types SET label='Edited after issuance', severity='Critical' WHERE id=$1",
      [id],
    );
    const after = await db.pool.query(
      'SELECT challan_id, label_snapshot, severity_snapshot FROM challan_violations WHERE violation_type_id=$1 ORDER BY challan_id',
      [id],
    );
    expect(after.rows).toStrictEqual(before.rows);
  });

  it('rolls back a partial insert when a later FK operation fails', async () => {
    await seed();
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("INSERT INTO drivers(id,name) VALUES($1,'Synthetic rollback probe')", [
        unusedId,
      ]);
      const pass = await client.query('SELECT id FROM gate_pass_records LIMIT 1');
      await expect(
        client.query('UPDATE gate_pass_records SET vehicle_id=$1 WHERE id=$2', [
          unusedId,
          pass.rows[0]?.['id'],
        ]),
      ).rejects.toMatchObject({ code: '23503' });
      await client.query('ROLLBACK');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
    const remaining = await db.pool.query('SELECT id FROM drivers WHERE id=$1', [unusedId]);
    expect(remaining.rows).toHaveLength(0);
  });
});
