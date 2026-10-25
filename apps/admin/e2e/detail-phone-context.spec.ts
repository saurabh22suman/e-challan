import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/**
 * Focused regression for the 2026-10-25 UI review: on a phone, record context
 * comes before the review action, and the exceptional cancellation form is
 * progressively revealed.
 */
const ACCOUNTS = JSON.parse(
  readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../tests/fixtures/f02-demo-credentials.json',
    ),
    'utf8',
  ),
) as { admin: { username: string; password: string } };

async function signIn(page: Page): Promise<void> {
  const login = await page.request.post('/api/auth/login', { data: ACCOUNTS.admin });
  expect(login.status()).toBe(200);
  const { token } = (await login.json()) as { token: string };
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
    'echallan.admin.session-token',
    token,
  ] as const);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Review workspace' })).toBeVisible();
  await expect(page.getByText('HZL/EC/2026/10/0005')).toBeVisible();
}

test.use({ viewport: { width: 390, height: 844 } });

test('phone detail shows record context before the action and hides cancellation until asked', async ({
  page,
}) => {
  await signIn(page);
  await page
    .getByRole('button', { name: /^Open / })
    .first()
    .click();
  const dialog = page.getByRole('dialog', { name: 'Challan details' });
  await expect(dialog).toBeVisible();

  const driver = dialog.getByText('Ramesh Kumar', { exact: true }).first();
  const action = dialog.getByRole('button', { name: 'Start review' });
  const driverBox = await driver.boundingBox();
  const actionBox = await action.boundingBox();
  expect(driverBox).not.toBeNull();
  expect(actionBox).not.toBeNull();
  expect(driverBox?.y ?? 0, 'driver context must precede the review action').toBeLessThan(
    actionBox?.y ?? 0,
  );

  await expect(dialog.getByLabel('Cancellation reason')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Cancel this challan' }).click();
  await expect(dialog.getByLabel('Cancellation reason')).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep record' }).click();
  await expect(dialog.getByLabel('Cancellation reason')).toHaveCount(0);
});
