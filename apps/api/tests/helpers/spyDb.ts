import type { Db } from '../../src/db/client.js';

/**
 * Minimal hand-written fake for the `Db` port. It is a recording double, not a
 * database: it lets unit tests prove whether readiness actually queried at all
 * without needing PostgreSQL.
 */
export interface SpyDb extends Db {
  readonly calls: { ping: number; close: number };
}

export interface SpyDbOptions {
  /** When set, every ping rejects with this error. */
  failPing?: Error;
}

export function createSpyDb(options: SpyDbOptions = {}): SpyDb {
  const calls = { ping: 0, close: 0 };
  return {
    calls,
    ping: async () => {
      calls.ping += 1;
      if (options.failPing) throw options.failPing;
    },
    close: async () => {
      calls.close += 1;
    },
  } as unknown as SpyDb;
}
