import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/**
 * Planner-owned F-02 browser journey for the single sign-in flow as entered from
 * the tablet: the tablet sends anonymous visitors to the dashboard sign-in page,
 * a real Marshal login hands them back to the field workspace, and logout revokes
 * the server-side session before the single sign-in page returns.
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

const ADMIN_ORIGIN = 'http://127.0.0.1:5174';
const TABLET_TOKEN_KEY = 'echallan.tablet.session-token';

/** Genuine authentication through the real proxy; no bypass, no client-side stub. */
async function signInAtAdmin(page: Page, account: 'marshal' | 'supervisor' | 'admin') {
  const { username, password } = ACCOUNTS[account];
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
}

test.describe('F-02 single sign-in as entered from the tablet', () => {
  test('redirects to the single sign-in page and returns a Marshal to the tablet', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page).toHaveURL(new RegExp(`${ADMIN_ORIGIN.replaceAll('.', '\\.')}/`));
    await expect(page.getByRole('heading', { level: 1, name: /^sign in$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create new safety violation' })).toHaveCount(0);

    await signInAtAdmin(page, 'marshal');

    await expect(page.getByRole('heading', { name: 'Create new safety violation' })).toBeVisible();
    await expect(page.getByLabel('Vehicle registration')).toBeVisible();
  });

  test('shows a credential error on the single sign-in page and stays out of the tablet', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /^sign in$/i })).toBeVisible();

    await page.getByLabel('Username').fill(ACCOUNTS.marshal.username);
    await page.getByLabel('Password', { exact: true }).fill('definitely-not-the-demo-password');
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create new safety violation' })).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${ADMIN_ORIGIN.replaceAll('.', '\\.')}/`));
  });

  test('logs out, revokes the tablet session and returns to the single sign-in page', async ({
    page,
  }) => {
    await page.goto('/');
    await signInAtAdmin(page, 'marshal');
    await expect(page.getByRole('heading', { name: 'Create new safety violation' })).toBeVisible();

    const token = await page.evaluate((key) => window.localStorage.getItem(key), TABLET_TOKEN_KEY);
    expect(token, 'the tablet must hold a real API-issued session').toBeTruthy();

    const during = await page.request.get('/api/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(during.status()).toBe(200);

    await page.getByRole('button', { name: /log ?out|sign out/i }).click();
    await expect(page).toHaveURL(new RegExp(`${ADMIN_ORIGIN.replaceAll('.', '\\.')}/`));
    await expect(page.getByRole('heading', { level: 1, name: /^sign in$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create new safety violation' })).toHaveCount(0);
    await expect
      .poll(() => page.evaluate((key) => window.localStorage.getItem(key), TABLET_TOKEN_KEY))
      .toBeNull();

    const after = await page.request.get('/api/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(after.status(), 'logout must revoke the session on the API').toBe(401);

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: /^sign in$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create new safety violation' })).toHaveCount(0);
  });

  test('a Supervisor who starts at the tablet continues to the dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /^sign in$/i })).toBeVisible();

    await signInAtAdmin(page, 'supervisor');

    await expect(page.getByRole('heading', { name: 'Review workspace' })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${ADMIN_ORIGIN.replaceAll('.', '\\.')}/`));

    const token = await page.evaluate(() =>
      window.localStorage.getItem('echallan.admin.session-token'),
    );
    expect(token, 'the dashboard must hold a real API-issued session').toBeTruthy();
    const session = await page.request.get('/api/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(session.status()).toBe(200);
  });

  test('hands a restored Supervisor session from the tablet to the dashboard', async ({ page }) => {
    const login = await page.request.post('/api/auth/login', {
      data: { username: ACCOUNTS.supervisor.username, password: ACCOUNTS.supervisor.password },
    });
    expect(login.status()).toBe(200);
    const { token } = (await login.json()) as { token: string };

    // Seed the real API-issued token BEFORE the first navigation. Writing it under
    // a running anonymous page is racy: the pending restoration can complete
    // afterwards and clear the externally seeded value.
    await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
      TABLET_TOKEN_KEY,
      token,
    ] as const);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Review workspace' })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${ADMIN_ORIGIN.replaceAll('.', '\\.')}/`));

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
