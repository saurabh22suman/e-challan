import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as readDotenvFile } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit configuration.
 *
 * `pnpm --filter @echallan/api run db:generate` reads the schema from
 * `src/db/schema.ts` and writes real SQL into `apps/api/drizzle/`, which
 * `src/db/migrate.ts` then applies. Only the development database is configured;
 * the test database is migrated at runtime by the integration suite.
 *
 * The workspace root is found by walking up to `pnpm-workspace.yaml` rather than
 * by a hand-counted relative path, so this file behaves identically under tsx
 * and after a build.
 */
function findWorkspaceRoot(start: string): string {
  let current = start;
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(path.join(current, 'pnpm-workspace.yaml'))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`Unable to locate the workspace root above ${start}`);
}

const packageDirectory = path.dirname(fileURLToPath(import.meta.url));
const envFilePath = path.join(findWorkspaceRoot(packageDirectory), '.env');
if (existsSync(envFilePath)) {
  readDotenvFile({ path: envFilePath, override: false });
}

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error(
    `DATABASE_URL is not set. Copy .env.example to .env at the workspace root ` +
      `(expected ${envFilePath}).`,
  );
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
  dbCredentials: { url: databaseUrl },
});
