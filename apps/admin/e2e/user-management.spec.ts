import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/**
 * Planner-owned browser journey for `specs/010-user-management`: Admin creates a
 * Supervisor through the real UI, the new credential signs in, deactivation
 * blocks it, and reactivation restores it. Each run uses a unique synthetic
 * username; the record is left inactive so no duplicate blocks the next run.
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

/**
 * Narrow visual-assumption correction after the 2026-10-25 redesign: list cards
 * no longer use a blue CardHeader, so the old card-vs-dialog chrome comparison is
 * no longer a valid invariant. The dialog still keeps the shared blue default and
 * a visibly distinct destructive tone; behavioural assertions are untouched.
 */
const DEFAULT_DIALOG_BLUE = 'rgb(10, 79, 175)';

async function expectDialogTone(
  _page: Page,
  dialog: ReturnType<Page['getByRole']>,
  tone: 'default' | 'danger',
): Promise<void> {
  const title = dialog.locator('.MuiDialogTitle-root');
  await expect(title).toHaveAttribute('data-tone', tone);

  const chrome = await title.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, color: style.color };
  });

  expect(chrome.color).toBe('rgb(255, 255, 255)');
  if (tone === 'default') {
    expect(chrome.background).toBe(DEFAULT_DIALOG_BLUE);
  } else {
    expect(chrome.background).not.toBe(DEFAULT_DIALOG_BLUE);
  }
}

async function signIn(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Username').fill(ACCOUNTS.admin.username);
  await page.getByLabel('Password', { exact: true }).fill(ACCOUNTS.admin.password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await expect(page.getByRole('heading', { name: 'Review workspace' })).toBeVisible();
  await page.getByRole('tab', { name: 'Users' }).click();
  await expect(page.getByRole('table', { name: 'Users' })).toBeVisible();
}

test('Admin creates, deactivates and reactivates a Supervisor through the UI', async ({ page }) => {
  const username = `E2E-SUP-${Date.now()}`;
  const password = 'e2e-created-supervisor-password';
  await signIn(page);

  await page.getByRole('button', { name: 'Create user' }).click();
  const create = page.getByRole('dialog', { name: /create user/i });
  await expectDialogTone(page, create, 'default');
  await create.getByLabel(/^username/i).fill(username);
  await create.getByLabel(/^display name/i).fill('E2E Supervisor');
  await create.getByLabel(/employee id/i).fill('E2E-EMP');

  await create.getByLabel(/^role/i).click();
  await page.getByRole('option', { name: 'Supervisor' }).click();

  await create.getByLabel(/^locations/i).click();
  await page.getByRole('option', { name: 'Hazira Industrial Estate — Main Gate' }).click();
  await page.keyboard.press('Escape');

  await create.getByLabel(/^initial password/i).fill(password);
  await create.getByLabel(/^confirm initial password/i).fill(password);
  await create.getByRole('button', { name: 'Create user' }).click();

  await expect(page.getByText(/user created/i)).toBeVisible();
  await expect(page.getByRole('cell', { name: username, exact: true })).toBeVisible();

  const firstLogin = await page.request.post('/api/auth/login', {
    data: { username, password },
  });
  expect(firstLogin.status()).toBe(200);
  expect(((await firstLogin.json()) as { user: { role: string } }).user.role).toBe('Supervisor');

  await page.getByRole('button', { name: `Deactivate ${username}` }).click();
  const confirm = page.getByRole('dialog', { name: /deactivate user/i });
  await expectDialogTone(page, confirm, 'danger');
  await expect(confirm.getByText(/retained/i)).toBeVisible();
  await confirm.getByRole('button', { name: 'Deactivate user' }).click();

  await expect(page.getByText(/user deactivated/i)).toBeVisible();
  const refused = await page.request.post('/api/auth/login', {
    data: { username, password },
  });
  expect(refused.status()).toBe(401);

  await page.getByRole('button', { name: `Reactivate ${username}` }).click();
  await expect(page.getByText(/user reactivated/i)).toBeVisible();
  const after = await page.request.post('/api/auth/login', {
    data: { username, password },
  });
  expect(after.status()).toBe(200);

  // Leave the synthetic account inactive so repeated browser runs add no active
  // account and no login path.
  await page.getByRole('button', { name: `Deactivate ${username}` }).click();
  await page
    .getByRole('dialog', { name: /deactivate user/i })
    .getByRole('button', { name: 'Deactivate user' })
    .click();
  await expect(page.getByRole('button', { name: `Reactivate ${username}` })).toBeVisible();
});
