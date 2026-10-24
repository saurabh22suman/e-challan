import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const ACCOUNTS = JSON.parse(
  readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../tests/fixtures/f02-demo-credentials.json',
    ),
    'utf8',
  ),
) as { marshal: { username: string; password: string } };

test('Marshal opens their own profile from the tablet toolbar', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Username').fill(ACCOUNTS.marshal.username);
  await page.getByLabel('Password', { exact: true }).fill(ACCOUNTS.marshal.password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await expect(page.getByLabel('Vehicle registration')).toBeVisible();

  await page.getByRole('button', { name: 'Profile' }).click();
  const dialog = page.getByRole('dialog', { name: /profile/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Ravi Patel')).toBeVisible();
  await expect(dialog.getByText('EMP-3106').first()).toBeVisible();
  await expect(dialog.getByText('Marshal')).toBeVisible();
  await expect(dialog.getByText('Main Gate Post')).toBeVisible();
  await expect(dialog.getByText(/Hazira Industrial Estate — Main Gate/)).toBeVisible();
  await expect(dialog.getByText(/password/i)).toHaveCount(0);

  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toHaveCount(0);
});
