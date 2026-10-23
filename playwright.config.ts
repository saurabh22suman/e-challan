import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Browser journey configuration (S-01 foundation, F-02 authentication).
 *
 * Real services are wired, not stubbed: the Fastify API, the PostgreSQL 16
 * containers (`pnpm db:up`) and both Vite dev servers. The tablet/admin specs
 * live in the apps they exercise; `tests/e2e` holds the coordinator-owned check
 * that the browser reaches the real API through the Vite `/api` proxy.
 *
 * Ports: API 3001, tablet dev 5173 / preview 4173, admin dev 5174 / preview 4174,
 * PostgreSQL demo 5432 and test 5433. Existing servers are reused locally and
 * never in CI.
 *
 * F-02: authentication needs demo credentials in the **API process**, and the
 * browser worker and the API are separate processes, so a value in the root `.env`
 * alone would not reach both ends of one command. The API `webServer` entry
 * therefore receives the committed synthetic acceptance fixture through its `env`
 * option, which makes `pnpm run test:e2e` reproducible from a clean checkout with
 * no dependence on an operator's private `.env`. The fixture is demo-only and is
 * never a runtime default; see `tests/fixtures/f02-demo-credentials.json`.
 */

/**
 * Synthetic, demo-only acceptance credentials. Never real user credentials.
 *
 * Resolved from this file's own directory rather than the process working
 * directory, because Playwright loads the root config as CommonJS: `import.meta`
 * is unavailable here even though the e2e specs themselves run as modules.
 */
const DEMO_ACCOUNTS = JSON.parse(
  readFileSync(path.join(__dirname, 'tests/fixtures/f02-demo-credentials.json'), 'utf8'),
) as Record<string, { username: string; password: string }>;

function demoCredentialEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const role of ['marshal', 'supervisor', 'admin']) {
    const account = DEMO_ACCOUNTS[role];
    if (account === undefined) {
      throw new Error(`tests/fixtures/f02-demo-credentials.json is missing the "${role}" account`);
    }
    env[`DEMO_${role.toUpperCase()}_USERNAME`] = account.username;
    env[`DEMO_${role.toUpperCase()}_PASSWORD`] = account.password;
  }
  return env;
}

/** Inherited environment plus the fixture values, with no undefined entries. */
function apiEnvironment(): Record<string, string> {
  const inherited: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) inherited[key] = value;
  }
  return { ...inherited, ...demoCredentialEnv() };
}

const API_ORIGIN = 'http://127.0.0.1:3001';
const TABLET_ORIGIN = 'http://127.0.0.1:5173';
const ADMIN_ORIGIN = 'http://127.0.0.1:5174';
const isCi = process.env['CI'] === 'true' || process.env['CI'] === '1';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  forbidOnly: isCi,
  retries: 0,
  workers: 1,
  reporter: isCi ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Foundation only: no camera/signature hardware claims are made here.
    permissions: [],
  },
  projects: [
    {
      name: 'tablet',
      testDir: 'apps/tablet/e2e',
      use: { ...devices['Desktop Chrome'], baseURL: TABLET_ORIGIN },
    },
    {
      name: 'admin',
      testDir: 'apps/admin/e2e',
      use: { ...devices['Desktop Chrome'], baseURL: ADMIN_ORIGIN },
    },
    {
      name: 'api-proxy',
      testDir: 'tests/e2e',
      use: { ...devices['Desktop Chrome'], baseURL: TABLET_ORIGIN },
    },
  ],
  webServer: [
    {
      // Migrate and seed before starting: the F-02 browser journeys authenticate
      // against real seeded `users`, `posts` and `shifts` rows, so the demo
      // database must exist and be populated for the run to mean anything. Both
      // steps are idempotent.
      command:
        'pnpm run db:migrate && pnpm run db:seed:domain && pnpm --filter @echallan/api run dev',
      url: `${API_ORIGIN}/health`,
      env: apiEnvironment(),
      reuseExistingServer: !isCi,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'pnpm --filter @echallan/tablet run dev',
      url: TABLET_ORIGIN,
      reuseExistingServer: !isCi,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'pnpm --filter @echallan/admin run dev',
      url: ADMIN_ORIGIN,
      reuseExistingServer: !isCi,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
