import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/env.js';

const KEYS = ['DATABASE_URL', 'TEST_DATABASE_URL', 'PORT', 'API_ORIGIN'] as const;

/**
 * These cases set exactly the variables they assert on, so they load from
 * process variables only (`envFilePath: null`). Without that seam the result
 * would depend on whether a developer happens to have a root `.env` file.
 */
const hermetic = { envFilePath: null } as const;

describe('loadEnv', () => {
  const saved = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of KEYS) saved.set(key, process.env[key]);
    for (const key of KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const key of KEYS) {
      const value = saved.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('defaults PORT to 3001 when unset', () => {
    process.env['DATABASE_URL'] = 'postgresql://challan@127.0.0.1:5432/echallan_demo';
    process.env['API_ORIGIN'] = 'http://127.0.0.1:3001';

    expect(loadEnv(hermetic).PORT).toBe(3001);
  });

  it('coerces a numeric PORT string', () => {
    process.env['DATABASE_URL'] = 'postgresql://challan@127.0.0.1:5432/echallan_demo';
    process.env['API_ORIGIN'] = 'http://127.0.0.1:3001';
    process.env['PORT'] = '4321';

    expect(loadEnv(hermetic).PORT).toBe(4321);
  });

  it('fails loudly when a required value is missing', () => {
    process.env['API_ORIGIN'] = 'http://127.0.0.1:3001';

    expect(() => loadEnv(hermetic)).toThrow();
  });

  it('fails loudly on a non-numeric PORT', () => {
    process.env['DATABASE_URL'] = 'postgresql://challan@127.0.0.1:5432/echallan_demo';
    process.env['API_ORIGIN'] = 'http://127.0.0.1:3001';
    process.env['PORT'] = 'not-a-port';

    expect(() => loadEnv(hermetic)).toThrow();
  });

  it('exposes TEST_DATABASE_URL when present', () => {
    process.env['DATABASE_URL'] = 'postgresql://challan@127.0.0.1:5432/echallan_demo';
    process.env['TEST_DATABASE_URL'] = 'postgresql://challan@127.0.0.1:5433/echallan_test';
    process.env['API_ORIGIN'] = 'http://127.0.0.1:3001';

    expect(loadEnv(hermetic).TEST_DATABASE_URL).toBe(
      'postgresql://challan@127.0.0.1:5433/echallan_test',
    );
  });

  it('reads the given environment file without overriding process variables', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'echallan-env-'));
    const envFilePath = path.join(directory, '.env');
    writeFileSync(
      envFilePath,
      'DATABASE_URL=postgresql://from-file@127.0.0.1:5432/from_file\nAPI_ORIGIN=http://127.0.0.1:9999\nPORT=4321\n',
    );

    try {
      const fromFile = loadEnv({ envFilePath });
      expect(fromFile.DATABASE_URL).toBe('postgresql://from-file@127.0.0.1:5432/from_file');
      expect(fromFile.PORT).toBe(4321);

      process.env['DATABASE_URL'] = 'postgresql://challan@127.0.0.1:5432/echallan_demo';
      expect(loadEnv({ envFilePath }).DATABASE_URL).toBe(
        'postgresql://challan@127.0.0.1:5432/echallan_demo',
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
