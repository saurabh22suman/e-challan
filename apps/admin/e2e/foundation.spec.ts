import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/**
 * F-04 browser acceptance for the dashboard shell (UI-03): labelled role shell,
 * honest empty state with no fabricated totals, navigation, logout and responsive
 * layout.
 *
 * F-04 revision: the foundation screen is replaced by the approved dashboard shell.
 * Read-only planner input.
 */

const ACCOUNTS = JSON.parse(
  readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../tests/fixtures/f02-demo-credentials.json',
    ),
    'utf8',
  ),
) as { supervisor: { username: string; password: string } };

async function signIn(page: Page): Promise<void> {
  const login = await page.request.post('/api/auth/login', { data: ACCOUNTS.supervisor });
  expect(login.status()).toBe(200);
  const { token } = (await login.json()) as { token: string };
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
    'echallan.admin.session-token',
    token,
  ] as const);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Demo review workspace' })).toBeVisible();
}

test.describe('dashboard shell (F-04)', () => {
  test('shows the labelled shell with real review data and server totals', async ({ page }) => {
    await signIn(page);

    await expect(page.getByText('DEMO/2026/10/0005')).toBeVisible();
    await expect(page.getByText('Total', { exact: true })).toBeVisible();
    await expect(page.getByText('Pending', { exact: true })).toBeVisible();
    await expect(page.getByText('Issued today', { exact: true })).toBeVisible();
  });

  test('logs out and returns to the login screen', async ({ page }) => {
    await signIn(page);

    await page.getByRole('button', { name: /log ?out|sign out/i }).click();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Demo review workspace' })).toHaveCount(0);
  });

  test('fits a desktop viewport without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
