import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/**
 * Planner-owned pre-issuance browser journey (ENT-02/05/06, REP-05) against the real
 * API, real synthetic registry and real PostgreSQL through the Vite proxy.
 *
 * Recorded reachability limits (spec section "Recorded reachability limits"): the
 * single demo marshal is bound to loc-main, so the loc-dispatch multiple-driver and
 * expired-pass cases and the duplicate warning are covered by component and real-DB
 * acceptance instead; this journey covers the persistent repeat notice.
 *
 * Read-only planner input. Do not replace, skip or weaken these assertions.
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

const TABLET_HEADING = 'Create new safety violation';

async function signIn(page: Page): Promise<void> {
  const login = await page.request.post('/api/auth/login', { data: ACCOUNTS.marshal });
  expect(login.status()).toBe(200);
  const { token } = (await login.json()) as { token: string };
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
    'echallan.tablet.session-token',
    token,
  ] as const);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: TABLET_HEADING })).toBeVisible();
}

async function selectSuggestion(page: Page, label: RegExp): Promise<void> {
  const option = page.getByRole('option', { name: label });
  await expect(option).toBeVisible();
  await option.click();
}

test.describe('pre-issuance entry journey', () => {
  test('autofills a zero-history vehicle from the registry and keeps fields editable', async ({
    page,
  }) => {
    await signIn(page);

    await page.getByLabel('Vehicle registration').fill('GJ05JP6207');
    await selectSuggestion(page, /Kavita Joshi.*DEMO-GP-0010/);

    await expect(page.getByLabel('Driver name')).toHaveValue('Kavita Joshi');
    await expect(page.getByLabel('Gate pass number')).toHaveValue('DEMO-GP-0010');
    await expect(page.getByLabel('Department')).not.toHaveValue('');
    await expect(page.getByLabel('Vehicle type')).not.toHaveValue('');

    // Known fields stay editable after autofill.
    await page.getByLabel('Driver name').fill('Kavita J.');
    await expect(page.getByLabel('Driver name')).toHaveValue('Kavita J.');
  });

  test('opens the vehicle dropdown scoped to the post and offers new-vehicle entry', async ({
    page,
  }) => {
    await signIn(page);

    await page.getByLabel('Vehicle registration').click();
    const listbox = page.getByRole('listbox', { name: /Registry suggestions/i });
    await expect(listbox).toBeVisible();
    await expect(listbox.getByRole('option', { name: /Kavita Joshi.*DEMO-GP-0010/ })).toBeVisible();
    await expect(listbox.getByRole('option', { name: /Ramesh Kumar.*DEMO-GP-0001/ })).toBeVisible();
    await expect(
      page.getByRole('option', { name: /MH12RT7306/ }),
      'dispatch-location vehicles must not be offered to the main marshal',
    ).toHaveCount(0);

    await page.getByTestId('vehicle-new-entry').click();
    await expect(page.getByText(/manual entry\./i)).toBeVisible();
  });

  test('accepts a one-off new vehicle through the summary without registry provenance', async ({
    page,
  }) => {
    await signIn(page);

    await page.getByLabel('Vehicle registration').click();
    await page.getByTestId('vehicle-new-entry').click();
    await page.getByLabel('Vehicle registration').fill('GJ99XX9999');
    await page.getByLabel('Gate pass number').fill('DEMO-GP-9999');
    await page.getByLabel('Driver name').fill('New Driver');
    await page.getByLabel('Department').selectOption({ label: 'Logistics' });
    await page.getByLabel('Vehicle type').selectOption({ label: 'Car' });
    await page.getByRole('checkbox', { name: 'Not wearing a seat belt' }).check();
    await page.getByRole('button', { name: 'Check details' }).click();

    await expect(page.getByRole('heading', { name: 'Driver summary' })).toBeVisible();
    await expect(page.getByText('Manual entry', { exact: true })).toBeVisible();
  });

  test('does not leak dispatch-location registry records to the main marshal', async ({ page }) => {
    await signIn(page);

    await page.getByLabel('Vehicle registration').fill('MH12RT7306');
    await expect(page.getByText(/no matching gate pass/i)).toBeVisible();
    await expect(
      page.getByRole('listbox', { name: 'Registry suggestions' }),
      'no dispatch-location candidate may be offered',
    ).toHaveCount(0);
  });

  test('blocks invalid input, requires Other remarks, and reaches the summary with Back preserved', async ({
    page,
  }) => {
    await signIn(page);

    // Unsupported registration format blocks the summary.
    await page.getByLabel('Vehicle registration').fill('GJ-05-JP');
    await page.getByLabel('Vehicle registration').blur();
    await expect(
      page.getByText(/should look like GJ05DS4821 or 26BH1234AA/i).first(),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Check details' }).click();
    await expect(page.getByRole('heading', { name: 'Driver summary' })).toHaveCount(0);

    // Complete a valid draft.
    await page.getByLabel('Vehicle registration').fill('GJ05JP6207');
    await page.getByLabel('Gate pass number').fill('DEMO-GP-0010');
    await page.getByLabel('Driver name').fill('Kavita Joshi');
    await page.getByLabel('Vehicle type').selectOption({ label: 'Car' });
    await page.getByLabel('Department').selectOption({ label: 'Other' });
    await page.getByRole('button', { name: 'Check details' }).click();
    await expect(
      page.getByText(/remarks are required when other is selected/i).first(),
    ).toBeVisible();

    await page.getByLabel('Remarks').fill('Unlisted department');
    await page.getByRole('checkbox', { name: 'Not wearing a seat belt' }).check();
    await page.getByRole('button', { name: 'Check details' }).click();

    await expect(page.getByRole('heading', { name: 'Driver summary' })).toBeVisible();
    await expect(page.getByText('Kavita Joshi')).toBeVisible();
    await expect(page.getByText('GJ05JP6207')).toBeVisible();

    await page.getByRole('button', { name: 'Change details' }).click();
    await expect(page.getByLabel('Driver name')).toHaveValue('Kavita Joshi');
    await expect(page.getByLabel('Remarks')).toHaveValue('Unlisted department');
    await expect(page.getByRole('checkbox', { name: 'Not wearing a seat belt' })).toBeChecked();
  });

  test('shows the persistent occurrence and prescribed action before signature', async ({
    page,
  }) => {
    await signIn(page);

    await page.getByLabel('Vehicle registration').fill('GJ05DS4821');
    await page.getByLabel('Gate pass number').fill('DEMO-GP-0001');
    await page.getByLabel('Driver name').fill('Ramesh Kumar');
    await page.getByLabel('Department').selectOption({ label: 'Logistics' });
    await page.getByLabel('Vehicle type').selectOption({ label: 'Car' });
    await page.getByRole('checkbox', { name: 'Not wearing a seat belt' }).check();
    await page.getByRole('button', { name: 'Check details' }).click();

    const notice = page.getByRole('status').filter({ hasText: /occurrence/i });
    await expect(notice).toContainText(/occurrence\s*5/i);
    await expect(page.getByText(/referred to department\/contractor/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Driver summary' })).toBeVisible();

    // Persistent across a settle, not a transient toast.
    await page.waitForTimeout(700);
    await expect(notice).toContainText(/occurrence\s*5/i);
  });
});
