import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as readDotenvFile } from 'dotenv';
import { z } from 'zod';

/**
 * Explicit environment loading for the API process.
 *
 * Local setup copies the repository root `.env.example` to the workspace root
 * `.env` (`cp .env.example .env`); that file is the documented source of local
 * values. It is loaded explicitly from an absolute path derived from this
 * module rather than relying on whatever ambient environment a caller happens
 * to export, so `tsx`, `node dist/server.js` and the integration runner all see
 * the same values.
 *
 * Importing this module never throws: validation only happens when `loadEnv()`
 * is called (or lazily through `getEnv()`), so unit tests that do not touch a
 * database can import application modules without any environment configured.
 */

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));

/**
 * Walk up from this module to the workspace root (the directory holding
 * `pnpm-workspace.yaml`). Works from `src/` under tsx and from `dist/` after a
 * build, so there is no hand-counted relative path to get wrong.
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

export const WORKSPACE_ROOT = findWorkspaceRoot(MODULE_DIRECTORY);

/** Absolute path of the root environment file (copy of `.env.example`). */
export const ENV_FILE_PATH = path.join(WORKSPACE_ROOT, '.env');

/** Absolute path of the synthetic demo fixture consumed by the seed adapter. */
export const DEMO_DATA_PATH = path.join(WORKSPACE_ROOT, 'docs', 'demo-data.json');

export const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (development/demo database)'),
  TEST_DATABASE_URL: z
    .string()
    .min(1)
    .optional()
    .describe('Isolated test database; the integration suite refuses anything else'),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().min(1).default('127.0.0.1'),
  API_ORIGIN: z.string().min(1, 'API_ORIGIN is required'),
});

export type Env = z.infer<typeof EnvSchema>;

export interface LoadEnvOptions {
  /**
   * Environment file to read. Defaults to the root `.env`; `null` loads from
   * process variables only. Tests pass `null` so their result cannot depend on
   * whether a developer happens to have a local `.env` file.
   */
  envFilePath?: string | null;
}

/**
 * Load and validate the environment. Existing process variables win over the
 * root `.env` file, so CI service configuration can override local defaults.
 */
export function loadEnv(options: LoadEnvOptions = {}): Env {
  const envFilePath = options.envFilePath === undefined ? ENV_FILE_PATH : options.envFilePath;
  if (envFilePath !== null && existsSync(envFilePath)) {
    readDotenvFile({ path: envFilePath, override: false });
  }
  return EnvSchema.parse({
    DATABASE_URL: process.env['DATABASE_URL'],
    TEST_DATABASE_URL: process.env['TEST_DATABASE_URL'],
    PORT: process.env['PORT'],
    HOST: process.env['HOST'],
    API_ORIGIN: process.env['API_ORIGIN'],
  });
}

let cached: Env | undefined;

/** Memoised {@link loadEnv}, evaluated on first use only. */
export function getEnv(): Env {
  cached ??= loadEnv();
  return cached;
}

/** Test-only hook to drop the memoised environment. */
export function resetEnvCache(): void {
  cached = undefined;
}
