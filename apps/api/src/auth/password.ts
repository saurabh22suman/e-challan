import { hash, verify } from '@node-rs/argon2';

/**
 * Password hashing for the Admin reset slice (PRD E1.5, AUTH-06 reset subset).
 *
 * A reset stores only an Argon2id hash. The plaintext exists in the request and
 * in this function's local scope, and is never logged, audited or returned.
 *
 * The package's default algorithm is Argon2id; `hashPassword` asserts the
 * resulting prefix so a dependency default change cannot silently downgrade the
 * format. This module deliberately has no "compare with env" logic: login owns
 * the demo bootstrap fallback.
 */

/**
 * A valid Argon2id hash of a value no account uses. It exists so a login for an
 * unknown username can perform the same expensive verification work as a known
 * account, reducing the obvious timing difference between "no such user" and
 * "wrong password". It is not a credential and never verifies a real password.
 */
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c9V8afUk3cdnIN6KHJIBwA$2pkFk/X88r8PqieIXcVBy8l3aumtbPk9yWgO+gj3iSc';

/** Hash a new password with Argon2id. Throws on an unexpected algorithm. */
export async function hashPassword(password: string): Promise<string> {
  const hashed = await hash(password);
  if (!hashed.startsWith('$argon2id$')) {
    throw new Error('Password hashing did not produce an Argon2id hash');
  }
  return hashed;
}

/**
 * Verify a password against a stored hash. A malformed or unreadable hash is a
 * failed verification, never a thrown error that could leak storage detail.
 */
export async function verifyPassword(password: string, hashed: string): Promise<boolean> {
  try {
    return await verify(hashed, password);
  } catch {
    return false;
  }
}

/**
 * Perform the same verification cost when no stored hash exists, so a caller
 * cannot distinguish an unknown username by timing alone. Always false.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  await verifyPassword(password, DUMMY_PASSWORD_HASH);
  return false;
}
