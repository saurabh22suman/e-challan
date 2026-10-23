import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

/**
 * The database port used by the API and by tests.
 *
 * `createDb` never opens a connection eagerly: `pg.Pool` connects on first
 * query, so an application can be constructed (and unit-tested) without
 * PostgreSQL running.
 */
export interface Db {
  readonly pool: pg.Pool;
  readonly orm: NodePgDatabase<typeof schema>;
  /** Runs `SELECT 1` against the real database. Rejects when unreachable. */
  ping(): Promise<void>;
  close(): Promise<void>;
}

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString, max: 4, connectionTimeoutMillis: 5_000 });
}

export function createDb(connectionString: string): Db {
  const pool = createPool(connectionString);
  const orm = drizzle({ client: pool, schema });
  return {
    pool,
    orm,
    ping: async () => {
      await pool.query('SELECT 1');
    },
    close: async () => {
      await pool.end();
    },
  };
}
