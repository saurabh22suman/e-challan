import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Inclusive-UX revamp admin acceptance (specs/007-inclusive-ux, UX-02/UX-07,
 * UXA-06/UXA-28 browser-covered subset). Owner-authorised batch 2026-10-18.
 *
 * Read-only planner input. Do not replace, skip or weaken these assertions.
 */

const credentials = JSON.parse(
  readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../tests/fixtures/f02-demo-credentials.json',
    ),
    'utf8',
  ),
).supervisor as { username: string; password: string };

test('UXA-06/UXA-28: dashboard sign-in toggles the password and states the honest workspace', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: /e-Challan dashboard sign-in/i }),
  ).toBeVisible();
  await expect(page.getByText('Use the account given by your supervisor.')).toBeVisible();
  // Policy consistency (R7): desktop roles use the 3600 s window, not the
  // marshal's 600 s; the copy must state 60 minutes.
  await expect(
    page.getByText(
      'Supervisor and admin accounts only. Sessions end after 60 minutes without activity.',
    ),
  ).toBeVisible();

  const password = page.getByLabel('Password', { exact: true });
  await password.fill(credentials.password);
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue(credentials.password);
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await expect(password).toHaveValue(credentials.password);

  await page.getByLabel(/username/i).fill(credentials.username);
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: /demo review workspace/i }),
  ).toBeVisible();
  await expect(page.getByText('DEMO/2026/10/0005')).toBeVisible();
  await expect(page.getByText(/Signed in as .*\bSupervisor\b/i)).toBeVisible();
  await expect(page.getByText(/R-01/u)).toHaveCount(0);
});
