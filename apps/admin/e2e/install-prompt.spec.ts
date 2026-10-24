import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/**
 * The install affordance is device-gated: a phone/tablet viewport sees our
 * labelled banner and desktop does not. The browser's own prompt is never opened
 * by these tests; they verify our banner and its dismissal only.
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

async function openDashboard(page: Page): Promise<void> {
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

async function offerInstall(page: Page): Promise<void> {
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt');
    Object.assign(event, {
      prompt: async () => undefined,
      userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
    });
    window.dispatchEvent(event);
  });
}

test.describe('mobile/tablet install prompt', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('shows the install banner and dismisses it', async ({ page }) => {
    await openDashboard(page);
    await offerInstall(page);

    const banner = page.getByRole('region', { name: 'Install e-Challan' });
    await expect(banner).toBeVisible();
    await expect(banner.getByText('Install e-Challan')).toBeVisible();

    await banner.getByRole('button', { name: 'Not now' }).click();
    await expect(banner).toHaveCount(0);
  });
});

test.describe('desktop install prompt', () => {
  test('does not show the install banner on desktop', async ({ page }) => {
    await openDashboard(page);
    await offerInstall(page);
    await expect(page.getByRole('region', { name: 'Install e-Challan' })).toHaveCount(0);
  });
});
