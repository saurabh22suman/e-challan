import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/**
 * Planner-owned browser journey for the bounded review/user-administration
 * slice (`specs/009-review-admin-basics`).
 *
 * The list/detail/reset journeys run against the real API, PostgreSQL and Vite
 * proxy. Review mutations are deliberately not driven here because they change
 * seeded statuses and would make a repeated browser run non-repeatable; the
 * real-DB integration and component suites cover them. This limitation is
 * recorded in the feature specification.
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
  supervisor: { username: string; password: string };
  admin: { username: string; password: string };
};

async function signIn(page: Page, account: 'supervisor' | 'admin'): Promise<void> {
  const { username, password } = ACCOUNTS[account];
  await page.goto('/');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await expect(page.getByRole('heading', { name: 'Review workspace' })).toBeVisible();
}

test.describe('review and user administration', () => {
  test('Supervisor sees the scoped list, filters and opens a seeded detail', async ({ page }) => {
    await signIn(page, 'supervisor');

    await expect(page.getByText('HZL/EC/2026/10/0005')).toBeVisible();

    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByLabel('Filter by status').click();
    await page.getByRole('option', { name: 'Issued' }).click();
    await expect(page.getByText('HZL/EC/2026/10/0005')).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();

    await page.getByRole('button', { name: 'Open HZL/EC/2026/10/0005' }).click();
    const dialog = page.getByRole('dialog', { name: /challan details/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Ramesh Kumar')).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /tracking history/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Start review' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('keeps the desktop dashboard layout, labelled filter and dialog in view', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page, 'supervisor');

    await page.getByRole('button', { name: 'Filters' }).click();
    const filter = page.getByLabel('Filter by status');
    await expect(filter).toBeVisible();
    await expect(filter).toHaveText('All statuses');
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('table', { name: 'Challans' })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.getByRole('button', { name: 'Open HZL/EC/2026/10/0005' }).click();
    const dialog = page.getByRole('dialog', { name: /challan details/i });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(1280);
    expect(box?.x ?? 0).toBeGreaterThanOrEqual(0);
  });

  test('Admin resets a user password and the new credential signs in', async ({ page }) => {
    await signIn(page, 'admin');

    await page.getByRole('tab', { name: 'Users' }).click();
    await page.getByRole('button', { name: 'Reset password for EMP-2284' }).click();

    const dialog = page.getByRole('dialog', { name: /reset password/i });
    const newPassword = 'e2e-dispatch-supervisor-reset-2026';
    await dialog.getByRole('textbox', { name: 'New password', exact: true }).fill(newPassword);
    await dialog
      .getByRole('textbox', { name: 'Confirm new password', exact: true })
      .fill(newPassword);
    await dialog.getByRole('button', { name: 'Reset password' }).click();

    await expect(page.getByText(/password reset/i)).toBeVisible();

    const login = await page.request.post('/api/auth/login', {
      data: { username: 'EMP-2284', password: newPassword },
    });
    expect(login.status()).toBe(200);
    const body = (await login.json()) as { user?: { username?: string; role?: string } };
    expect(body.user?.username).toBe('EMP-2284');
    expect(body.user?.role).toBe('Supervisor');
  });
});
