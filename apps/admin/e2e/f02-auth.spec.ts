import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/**
 * Planner-owned F-02 browser journey for the admin dashboard: a real login against
 * the real API and PostgreSQL through the real Vite proxy, and protected content only
 * after a session.
 *
 * This is a read-only planner input. Do not weaken or skip these assertions.
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

test.describe('F-02 admin authentication', () => {
  test('requires a real sign in before showing the dashboard shell', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Review workspace' })).toHaveCount(0);

    await signIn(page, 'supervisor');

    await expect(page.getByRole('heading', { name: 'Review workspace' })).toBeVisible();
  });

  test('shows an error for wrong credentials', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel('Username').fill(ACCOUNTS.supervisor.username);
    await page.getByLabel('Password', { exact: true }).fill('definitely-not-the-demo-password');
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Review workspace' })).toHaveCount(0);
  });

  test('logs out, and the API then rejects the token the browser was holding', async ({ page }) => {
    const issued: string[] = [];
    page.on('response', async (response) => {
      if (response.url().includes('/auth/login') && response.status() === 200) {
        const body = (await response.json()) as { token?: string };
        if (body.token) issued.push(body.token);
      }
    });

    await signIn(page, 'supervisor');
    await expect(page.getByRole('heading', { name: 'Review workspace' })).toBeVisible();
    expect(issued, 'the API must have issued a real session token').toHaveLength(1);
    const token = issued[0] as string;

    await page.getByRole('button', { name: /log ?out|sign out/i }).click();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();

    const after = await page.request.get('/api/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(after.status(), 'logout must revoke the session on the API').toBe(401);
  });

  test('R1: hands a marshal account to the tablet and revokes the dashboard session', async ({
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
    await page.getByLabel('Username').fill(ACCOUNTS.marshal.username);
    await page.getByLabel('Password', { exact: true }).fill(ACCOUNTS.marshal.password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    await expect(page.getByRole('heading', { name: 'Create new safety violation' })).toBeVisible();
    await expect(page).toHaveURL(/127\.0\.0\.1:5173\//);
    expect(issued, 'the dashboard must have logged in through the real API').toHaveLength(1);
    const token = issued[0] as string;

    // The tablet exchange revokes the dashboard session rather than leaving it live.
    await expect
      .poll(async () => {
        const response = await page.request.get('/api/auth/session', {
          headers: { Authorization: `Bearer ${token}` },
        });
        return response.status();
      })
      .toBe(401);
  });

  test('R1: hands a restored marshal session to the tablet', async ({ page }) => {
    const login = await page.request.post('/api/auth/login', {
      data: { username: ACCOUNTS.marshal.username, password: ACCOUNTS.marshal.password },
    });
    expect(login.status()).toBe(200);
    const { token } = (await login.json()) as { token: string };

    // Seed the real API-issued token BEFORE the first navigation. Writing it under
    // a running anonymous page is racy: the pending restoration can complete
    // afterwards and clear the externally seeded value.
    await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
      'echallan.admin.session-token',
      token,
    ] as const);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Create new safety violation' })).toBeVisible();
    await expect(page).toHaveURL(/127\.0\.0\.1:5173\//);

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
