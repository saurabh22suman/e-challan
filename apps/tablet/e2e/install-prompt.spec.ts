import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/**
 * The tablet field shell shows the same device-gated install banner. A Marshal
 * landing here after the single sign-in can install the field PWA.
 */
const ACCOUNTS = JSON.parse(
  readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../tests/fixtures/f02-demo-credentials.json',
    ),
    'utf8',
  ),
) as { marshal: { username: string; password: string } };

async function openFieldShell(page: Page): Promise<void> {
  const login = await page.request.post('/api/auth/login', { data: ACCOUNTS.marshal });
  expect(login.status()).toBe(200);
  const { token } = (await login.json()) as { token: string };
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
    'echallan.tablet.session-token',
    token,
  ] as const);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Create new safety violation' })).toBeVisible();
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

test.describe('tablet install prompt', () => {
  test.use({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true });

  test('shows the install banner in the field shell', async ({ page }) => {
    await openFieldShell(page);
    await offerInstall(page);

    await expect(page.getByRole('region', { name: 'Install e-Challan' })).toBeVisible();
    await page.getByRole('button', { name: 'Not now' }).click();
    await expect(page.getByRole('region', { name: 'Install e-Challan' })).toHaveCount(0);
  });
});
