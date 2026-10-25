import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Demo credential configuration (addendum A v0.2 section 2.1).
 *
 * Exactly one username/password account per approved role, taken from the API's
 * **server-side** environment. This module never invents a default, never
 * accepts a client-visible value and never logs or returns a password to a
 * caller other than the login comparison in `service.ts`.
 *
 * This module remains the demo bootstrap only. Admin password reset and
 * Argon2id storage live in `password.ts` and the Admin routes; user
 * create/disable (the rest of PRD E1.4) remain out of scope.
 */

/** The approved roles, in the order the error messages name them. */
export const DEMO_ROLES = ['marshal', 'supervisor', 'admin'] as const;

export type DemoRole = (typeof DEMO_ROLES)[number];

/** One role's configured account. Exactly these two fields, nothing else. */
export interface DemoCredential {
  username: string;
  password: string;
}

/** One credential per approved role, and no other key. */
export type DemoCredentials = Record<DemoRole, DemoCredential>;

/** Environment variable names, derived so the three roles cannot drift apart. */
export const DEMO_ENV_KEYS: Record<DemoRole, { username: string; password: string }> = {
  marshal: { username: 'DEMO_MARSHAL_USERNAME', password: 'DEMO_MARSHAL_PASSWORD' },
  supervisor: { username: 'DEMO_SUPERVISOR_USERNAME', password: 'DEMO_SUPERVISOR_PASSWORD' },
  admin: { username: 'DEMO_ADMIN_USERNAME', password: 'DEMO_ADMIN_PASSWORD' },
};

/** Any `VITE_`-prefixed variable is browser-visible and can never satisfy these. */
const CLIENT_VISIBLE_PREFIX = 'VITE_';

/**
 * Read one required value: present, a string, and non-blank after trimming.
 *
 * A missing, non-string, empty or whitespace-only value is a configuration
 * error. Nothing is defaulted and no partially configured account is returned.
 */
function requiredValue(source: Record<string, unknown>, key: string, role: DemoRole): string {
  const raw = source[key];
  if (typeof raw !== 'string') {
    throw new Error(
      `Refusing to start: ${key} is missing or not a string. Demo credentials come from the ` +
        `API server environment only; there is no default and no ${CLIENT_VISIBLE_PREFIX}-prefixed ` +
        `fallback. Role "${role}" cannot authenticate.`,
    );
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    throw new Error(
      `Refusing to start: ${key} is blank. Role "${role}" cannot authenticate until a real ` +
        'value is configured.',
    );
  }
  return trimmed;
}

/**
 * Build the credential set from an environment-shaped source.
 *
 * Throws when any of the six values is missing, blank or whitespace-only, and
 * when two roles share one username — an ambiguous account could not be matched
 * to a single role, so the configuration is refused rather than resolved by
 * chance.
 *
 * @param source Defaults to `process.env`. Tests pass an explicit object.
 */
export function loadDemoCredentials(
  source: Record<string, unknown> = process.env,
): DemoCredentials {
  const credentials = {} as DemoCredentials;

  for (const role of DEMO_ROLES) {
    const keys = DEMO_ENV_KEYS[role];
    credentials[role] = {
      username: requiredValue(source, keys.username, role),
      password: requiredValue(source, keys.password, role),
    };
  }

  const seen = new Map<string, DemoRole>();
  for (const role of DEMO_ROLES) {
    const key = credentials[role].username.toLowerCase();
    const previous = seen.get(key);
    if (previous !== undefined) {
      throw new Error(
        `Refusing to start: ambiguous demo configuration. Roles "${previous}" and "${role}" are ` +
          `both configured with the username "${credentials[role].username}", so no account could ` +
          'be matched unambiguously. Each approved role needs a unique username.',
      );
    }
    seen.set(key, role);
  }

  return credentials;
}

/**
/**
 * Constant-time credential comparison.
 *
 * Both values are hashed first so `timingSafeEqual` always receives equal-length
 * buffers (a raw length difference would otherwise throw and leak the length),
 * and so the comparison itself never touches the plaintext. A false result is
 * still produced for an unknown username, so the caller cannot distinguish
 * "no such account" from "wrong password" by timing or by error code.
 */
export function credentialsMatch(candidate: string, expected: string): boolean {
  const digest = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(candidate), digest(expected));
}

/**
 * Find the configured role whose username matches, comparing against **every**
 * role so the work does not depend on which one matched.
 */
export function matchConfiguredRole(
  credentials: DemoCredentials,
  username: string,
): DemoRole | undefined {
  let matched: DemoRole | undefined;
  for (const role of DEMO_ROLES) {
    if (credentialsMatch(credentials[role].username.toLowerCase(), username.toLowerCase())) {
      matched = role;
    }
  }
  return matched;
}
