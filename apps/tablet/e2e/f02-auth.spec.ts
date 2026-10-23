import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/**
 * Planner-owned F-02 browser journey for the tablet: a real login against the real
 * API and PostgreSQL through the real Vite proxy, protected content only after a
 * session, and a real logout whose revoked token the API then rejects.
 *
 * This is a read-only planner input. Do not weaken or skip these assertions.
 */

/**
 * Synthetic acceptance credentials are read from the single committed fixture rather
 * than imported: `tools/check-boundaries.mjs` forbids an app package from importing
 * outside its own package, and duplicating credential values per app would create two
 * sources of truth for the harness. Reading a root test fixture is a harness concern,
 * not a package dependency, and introduces no import specifier.
 */
const ACCOUNTS = JSON.parse(
  readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../tests/fixtures/f02-demo-credentials.json',
    ),
    'utf8',
  ),
) as {
  marshal: { username: string; password: string };
  supervisor: { username: string; password: string };
  admin: { username: string; password: string };
};

/** Genuine authentication through the real proxy; no bypass, no client-side stub. */
async function signIn(page: Page, account: 'marshal' | 'supervisor' | 'admin'): Promise<void> {
  const { username, password } = ACCOUNTS[account];
  await page.goto('/');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
}

test.describe('F-02 tablet authentication', () => {
  test('requires a real sign in before showing the foundation screen', async ({ page }) => {
    await page.goto('/');

    // Protected content is absent before authentication.
    await expect(page.getByRole('heading', { name: 'Create new safety violation' })).toHaveCount(0);

    await signIn(page, 'marshal');

    await expect(page.getByRole('heading', { name: 'Create new safety violation' })).toBeVisible();
  });

  test('shows an error for wrong credentials and stays signed out', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel('Username').fill(ACCOUNTS.marshal.username);
    await page.getByLabel('Password', { exact: true }).fill('definitely-not-the-demo-password');
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create new safety violation' })).toHaveCount(0);
  });

  test('logs out, and the API then rejects the token the browser was holding', async ({ page }) => {
    // Capture the session token the browser actually receives from the real API.
    const issued: string[] = [];
    page.on('response', async (response) => {
      if (response.url().includes('/auth/login') && response.status() === 200) {
        const body = (await response.json()) as { token?: string };
        if (body.token) issued.push(body.token);
      }
    });

    await signIn(page, 'marshal');
    await expect(page.getByRole('heading', { name: 'Create new safety violation' })).toBeVisible();
    expect(issued, 'the API must have issued a real session token').toHaveLength(1);
    const token = issued[0] as string;

    // While signed in, the token works.
    const during = await page.request.get('/api/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(during.status()).toBe(200);

    await page.getByRole('button', { name: /log ?out|sign out/i }).click();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create new safety violation' })).toHaveCount(0);

    // Logout must be server-side: the very same token is now refused.
    const after = await page.request.get('/api/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(after.status(), 'logout must revoke the session on the API').toBe(401);

    // A reload must not resurrect the session from client storage alone.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Create new safety violation' })).toHaveCount(0);
  });

  test('R1: hands a supervisor account to the dashboard and revokes the tablet session', async ({
    page,
  }) => {
    const issued: string[] = [];
    page.on('response', async (response) => {
      if (response.url().includes('/auth/login') && response.status() === 200) {
        const body = (await response.json()) as { token?: string };
        if (body.token) issued.push(body.token);
      }
    });

    await page.goto('/');
    await page.getByLabel('Username').fill(ACCOUNTS.supervisor.username);
    await page.getByLabel('Password', { exact: true }).fill(ACCOUNTS.supervisor.password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    await expect(page.getByRole('heading', { name: 'Demo review workspace' })).toBeVisible();
    await expect(page).toHaveURL(/127\.0\.0\.1:5174\//);
    expect(issued, 'the tablet must have logged in through the real API').toHaveLength(1);
    const token = issued[0] as string;

    // The dashboard exchange revokes the tablet session rather than leaving it live.
    await expect
      .poll(async () => {
        const response = await page.request.get('/api/auth/session', {
          headers: { Authorization: `Bearer ${token}` },
        });
        return response.status();
      })
      .toBe(401);
  });

  test('R1: hands a restored supervisor session to the dashboard', async ({ page }) => {
    const login = await page.request.post('/api/auth/login', {
      data: { username: ACCOUNTS.supervisor.username, password: ACCOUNTS.supervisor.password },
    });
    expect(login.status()).toBe(200);
    const { token } = (await login.json()) as { token: string };

    // Seed the real API-issued token BEFORE the first navigation. Writing it under
    // a running anonymous page is racy: the pending restoration can complete
    // afterwards and clear the externally seeded value.
    await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
      'echallan.tablet.session-token',
      token,
    ] as const);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Demo review workspace' })).toBeVisible();
    await expect(page).toHaveURL(/127\.0\.0\.1:5174\//);

    await expect
      .poll(async () => {
        const response = await page.request.get('/api/auth/session', {
          headers: { Authorization: `Bearer ${token}` },
        });
        return response.status();
      })
      .toBe(401);
  });
});
