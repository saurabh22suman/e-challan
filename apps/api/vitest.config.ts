import { defineConfig } from 'vitest/config';

/**
 * Two named projects so the unit suite can never silently require PostgreSQL and
 * the integration suite can never be skipped quietly:
 *
 *   pnpm --filter @echallan/api run test              -> unit
 *   pnpm --filter @echallan/api run test:integration  -> integration
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
          globals: false,
          testTimeout: 10_000,
          hookTimeout: 10_000,
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          globals: false,
          setupFiles: ['tests/integration/setup.ts'],
          testTimeout: 60_000,
          hookTimeout: 120_000,
          // The real test database is a single shared container: serialise files so
          // runs stay isolated and repeatable.
          fileParallelism: false,
          pool: 'forks',
          maxWorkers: 1,
        },
      },
    ],
  },
});
