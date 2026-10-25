import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/**
 * Focused regression for the 2026-10-25 UI review: on a phone, the first editable
 * field and the driver summary data must be on the first screen. This is stronger
 * than asserting zero page overflow.
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
  await expect(page.getByLabel('Vehicle registration')).toBeVisible();
}

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('task-first phone entry and summary keep the first field and driver data in view', async ({
  page,
}) => {
  await openEntry(page);

  const field = page.getByLabel('Vehicle registration');
  const fieldBox = await field.boundingBox();
  expect(fieldBox, 'the first editable field must render').not.toBeNull();
  expect(fieldBox?.y ?? 0, 'the first editable field must be on the first screen').toBeLessThan(
    844,
  );

  const recent = page.getByRole('button', { name: /GJ05DS4821/ }).first();
  const recentBox = await recent.boundingBox();
  expect(recentBox).not.toBeNull();
  expect(recentBox?.y ?? 0, 'recent shortcuts must follow the first field').toBeGreaterThan(
    fieldBox?.y ?? 0,
  );

  await field.fill('GJ05JP6207');
  await page.getByLabel('Gate pass number').fill('HZ-GP-1051');
  await page.getByLabel('Driver name').fill('Kavita Joshi');
  await page.getByLabel('Department', { exact: true }).selectOption({ label: 'Logistics' });
  await page.getByLabel('Vehicle type').selectOption({ label: 'Car' });
  await page.getByRole('checkbox', { name: 'Not wearing a seat belt' }).check();
  await page.getByRole('button', { name: 'Check details' }).click();
  await page.getByRole('heading', { name: 'Driver summary' }).waitFor();

  for (const [label, locator] of [
    ['driver', page.getByText('Kavita Joshi', { exact: true })],
    ['vehicle', page.getByText('GJ05JP6207', { exact: true })],
    ['violation', page.getByText('Not wearing a seat belt', { exact: true })],
  ] as const) {
    const box = await locator.boundingBox();
    expect(box, `${label} data must render on the summary`).not.toBeNull();
    expect(box?.y ?? 0, `${label} must start on the first summary screen`).toBeGreaterThanOrEqual(
      0,
    );
    expect(
      (box?.y ?? 0) + (box?.height ?? 0),
      `${label} must be fully visible on the first summary screen`,
    ).toBeLessThanOrEqual(844);
  }

  const summaryHeading = await page.getByRole('heading', { name: 'Driver summary' }).boundingBox();
  const guidance = await page.getByText('Check these details with the driver').boundingBox();
  expect(summaryHeading).not.toBeNull();
  expect(guidance).not.toBeNull();
  expect(
    guidance?.y ?? 0,
    'summary data must precede repeated guidance on the phone',
  ).toBeGreaterThan(summaryHeading?.y ?? 0);
});
