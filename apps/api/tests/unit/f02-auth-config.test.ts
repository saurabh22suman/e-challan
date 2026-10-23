import { describe, expect, it } from 'vitest';

/**
 * Planner-owned F-02 acceptance: demo credential configuration (AUTH-01, and the
 * configuration half of AUTH-03's failure handling).
 *
 * Pure configuration: no database, no HTTP. The loader must refuse to guess.
 *
 * These are read-only planner inputs. Missing exports are **surface-absence RED**,
 * not proof of a behavioural defect: the first assertion of each case names the
 * missing surface explicitly. Do not replace, skip or weaken these assertions.
 */

const VALID = {
  DEMO_MARSHAL_USERNAME: 'marshal-user',
  DEMO_MARSHAL_PASSWORD: 'marshal-secret',
  DEMO_SUPERVISOR_USERNAME: 'supervisor-user',
  DEMO_SUPERVISOR_PASSWORD: 'supervisor-secret',
  DEMO_ADMIN_USERNAME: 'admin-user',
  DEMO_ADMIN_PASSWORD: 'admin-secret',
} as const;

type Loader = (source?: Record<string, unknown>) => {
  marshal: { username: string; password: string };
  supervisor: { username: string; password: string };
  admin: { username: string; password: string };
};

async function loader(): Promise<Loader> {
  const path = '../../src/auth/config.js';
  let module: Record<string, unknown> = {};
  try {
    module = (await import(path)) as Record<string, unknown>;
  } catch {
    /* surface absent */
  }
  expect(
    typeof module['loadDemoCredentials'],
    'F-02 surface absent: apps/api/src/auth/config.ts must export loadDemoCredentials',
  ).toBe('function');
  return module['loadDemoCredentials'] as Loader;
}

const without = (key: keyof typeof VALID): Record<string, unknown> => {
  const copy: Record<string, unknown> = { ...VALID };
  delete copy[key];
  return copy;
};

describe('DOM/AUTH-01: demo credential configuration', () => {
  it('resolves one credential per approved role', async () => {
    const load = await loader();
    const credentials = load({ ...VALID });

    expect(credentials.marshal.username).toBe('marshal-user');
    expect(credentials.supervisor.username).toBe('supervisor-user');
    expect(credentials.admin.username).toBe('admin-user');
    // Passwords are returned to the server for comparison, never logged or returned
    // to a client; the contract and routes are responsible for that boundary.
    expect(credentials.admin.password).toBe('admin-secret');
  });

  it('returns exactly the three approved roles and nothing else', async () => {
    const load = await loader();
    const credentials = load({ ...VALID });

    expect(Object.keys(credentials).sort()).toEqual(['admin', 'marshal', 'supervisor']);
  });

  it.each(Object.keys(VALID))('refuses to start when %s is missing', async (key) => {
    const load = await loader();
    expect(() => load(without(key as keyof typeof VALID))).toThrow();
  });

  it.each(Object.keys(VALID))('refuses to start when %s is blank or whitespace', async (key) => {
    const load = await loader();
    expect(() => load({ ...VALID, [key]: '   ' })).toThrow();
  });

  it('refuses to start when two roles share one username, because no account could be matched unambiguously', async () => {
    const load = await loader();
    expect(() => load({ ...VALID, DEMO_SUPERVISOR_USERNAME: VALID.DEMO_MARSHAL_USERNAME })).toThrow(
      /ambiguous|duplicate|match|unique/i,
    );
  });

  it('must not accept a client-visible VITE_ prefixed secret as the credential', async () => {
    const load = await loader();
    // The amendment forbids shipping credentials to the browser. A VITE_-prefixed
    // value must not satisfy the server-side requirement.
    expect(() =>
      load({
        ...without('DEMO_ADMIN_PASSWORD'),
        VITE_DEMO_ADMIN_PASSWORD: 'browser-visible-secret',
      }),
    ).toThrow();
  });

  it('never invents a default password when configuration is incomplete', async () => {
    const load = await loader();
    let thrown = false;
    try {
      load({ DEMO_ADMIN_USERNAME: 'admin-user' });
    } catch {
      thrown = true;
    }
    expect(thrown, 'a partial configuration must fail rather than fall back to a default').toBe(
      true,
    );
  });

  it('does not expose a role picker: the configuration carries no client-chosen role', async () => {
    const load = await loader();
    const credentials = load({ ...VALID }) as unknown as Record<string, unknown>;
    for (const value of Object.values(credentials)) {
      expect(Object.keys(value as object).sort()).toEqual(['password', 'username']);
    }
  });
});
