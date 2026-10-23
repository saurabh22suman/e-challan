import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/auth/password.js';

/**
 * Planner-owned acceptance for the password primitive used by the Admin reset.
 * PRD E1.5: a modern password hash, never recoverable. The reset slice uses
 * Argon2id through the pinned `@node-rs/argon2` package.
 */

describe('Argon2id password hashing', () => {
  it('stores an Argon2id hash and verifies the exact password only', async () => {
    const password = 'demo-reset-password-2026';
    const hash = await hashPassword(password);

    expect(hash.startsWith('$argon2id$'), `unexpected hash format: ${hash}`).toBe(true);
    expect(hash).not.toContain(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword(`${password} `, hash)).resolves.toBe(false);
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('uses a fresh salt so the same password produces different hashes', async () => {
    const password = 'demo-reset-password-2026';
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(second);
    await expect(verifyPassword(password, first)).resolves.toBe(true);
    await expect(verifyPassword(password, second)).resolves.toBe(true);
  });

  it('returns false rather than throwing for a malformed stored hash', async () => {
    await expect(verifyPassword('anything', 'not-a-password-hash')).resolves.toBe(false);
  });
});
