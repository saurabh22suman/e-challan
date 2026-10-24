import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/**
 * Marshal mobile layout acceptance. The field app must remain usable on a
 * phone-width browser: no horizontal page overflow, primary actions reach the
 * full content width, and paired summary actions stack instead of squeezing.
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

async function openEntry(page: Page): Promise<void> {
  const login = await page.request.post('/api/auth/login', { data: ACCOUNTS.marshal });
  expect(login.status()).toBe(200);
  const { token } = (await login.json()) as { token: string };
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
    'echallan.tablet.session-token',
    token,
  ] as const);
  await page.goto('/');
  await page.getByLabel('Vehicle registration').waitFor();
}

async function openSummary(page: Page): Promise<void> {
  await page.getByLabel('Vehicle registration').fill('GJ05JP6207');
  await page.getByLabel('Gate pass number').fill('DEMO-GP-0010');
  await page.getByLabel('Driver name').fill('Kavita Joshi');
  await page.getByLabel('Department', { exact: true }).selectOption({ label: 'Logistics' });
  await page.getByLabel('Vehicle type').selectOption({ label: 'Car' });
  await page.getByRole('checkbox', { name: 'Not wearing a seat belt' }).check();
  await page.getByRole('button', { name: 'Check details' }).click();
  await page.getByRole('heading', { name: 'Driver summary' }).waitFor();
}

async function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe('marshal mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('keeps the form and summary actions reachable at 390px and 320px', async ({ page }) => {
    await openEntry(page);

    const check = await page.getByTestId('check-details').boundingBox();
    expect(check, 'Check details must render').not.toBeNull();
    expect(check?.width ?? 0, 'Check details uses the mobile content width').toBeGreaterThan(300);

    const recent = page.getByRole('button', { name: /GJ05DS4821/ }).first();
    await expect(recent).toBeVisible();
    const recentBox = await recent.boundingBox();
    expect(recentBox, 'recent vehicle must render').not.toBeNull();
    expect(
      recentBox?.width ?? 0,
      'recent vehicle cards use the mobile content width',
    ).toBeGreaterThan(300);
    expect(await pageOverflow(page)).toBeLessThanOrEqual(1);

    await openSummary(page);

    const change = await page.getByRole('button', { name: 'Change details' }).boundingBox();
    const next = await page.getByRole('button', { name: 'Continue to photos' }).boundingBox();
    expect(change, 'Change details must render').not.toBeNull();
    expect(next, 'Continue to photos must render').not.toBeNull();
    expect(
      (change?.y ?? 0) + (change?.height ?? 0),
      'summary actions stack on mobile',
    ).toBeLessThanOrEqual(next?.y ?? 0);

    expect(await pageOverflow(page)).toBeLessThanOrEqual(1);

    await page.setViewportSize({ width: 320, height: 844 });
    expect(await pageOverflow(page), 'no overflow at 320px').toBeLessThanOrEqual(1);
    await expect(page.getByRole('button', { name: 'Change details' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue to photos' })).toBeVisible();

    await page.getByRole('button', { name: 'Change details' }).click();
    const recent320 = page.getByRole('button', { name: /GJ05DS4821/ }).first();
    await expect(recent320).toBeVisible();
    const recent320Box = await recent320.boundingBox();
    expect(recent320Box?.width ?? 0, 'recent cards stay full-width at 320px').toBeGreaterThan(240);
    expect(await pageOverflow(page), 'no recent-card overflow at 320px').toBeLessThanOrEqual(1);
  });
});
