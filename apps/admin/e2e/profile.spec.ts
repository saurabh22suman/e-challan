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
) as { supervisor: { username: string; password: string } };

test('Supervisor sees their own profile and session details', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Username').fill(ACCOUNTS.supervisor.username);
  await page.getByLabel('Password', { exact: true }).fill(ACCOUNTS.supervisor.password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await expect(page.getByRole('heading', { name: 'Demo review workspace' })).toBeVisible();

  await page.getByRole('tab', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(page.getByText('Sunil Deshmukh')).toBeVisible();
  await expect(page.getByText('DEMO-EMP-002').first()).toBeVisible();
  await expect(page.getByText('Demo industrial campus — main entrance')).toBeVisible();
  await expect(page.getByText(/session ends/i)).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});
