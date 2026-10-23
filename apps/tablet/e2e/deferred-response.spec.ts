import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Deferred-response EntryFlow integration acceptance.
 *
 * These tests hold real API responses until after a material draft edit,
 * then release them and assert the stale response cannot advance the
 * flow. The response bodies come from the real API via `route.fetch()`;
 * the proxy only delays the fulfillment, so the deferred payload is the
 * response the server produced for the pre-edit draft.
 *
 * R1 correction coverage (inclusive-ux review, 2026-10-19): a superseded
 * review must not leave the next action stuck; pending state must finish
 * on every settlement; a newer request's pending state must survive an
 * older completion; and an edited draft must be checkable afresh.
 * Completion is synchronised through observable state, not fixed waits.
 */

const credentials = JSON.parse(
  readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../tests/fixtures/f02-demo-credentials.json',
    ),
    'utf8',
  ),
).marshal as { username: string; password: string };

async function signInAndFill(page: Page) {
  await page.goto('/');
  await page.getByLabel(/username/i).fill(credentials.username);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.getByLabel('Vehicle registration').fill('GJ05JP6207');
  await page.getByLabel('Gate pass number').fill('DEMO-GP-0010');
  await page.getByLabel('Driver name').fill('Kavita Joshi');
  await page.getByLabel('Department', { exact: true }).selectOption({ label: 'Logistics' });
  await page.getByLabel('Vehicle type').selectOption({ label: 'Car' });
  await page.getByRole('checkbox', { name: 'Not wearing a seat belt' }).check();
}

test('a held validation response cannot advance an edited draft, and Check details recovers', async ({
  page,
}) => {
  let releaseGate: () => void = () => undefined;
  let releaseValidation: () => Promise<void> = async () => undefined;
  let validateCalls = 0;
  await page.route('**/challans/validate', async (route) => {
    validateCalls += 1;
    if (validateCalls > 1) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const body = await response.json();
    await new Promise<void>((resolve) => {
      releaseGate = resolve;
      releaseValidation = async () => {
        await route.fulfill({ response, json: body });
      };
    });
  });

  await signInAndFill(page);
  const checkButton = page.getByTestId('check-details');
  const validateIssued = page.waitForRequest('**/challans/validate');
  await checkButton.click();
  await validateIssued;
  await expect(checkButton).toBeDisabled();

  // Material edit while the validation response is still held.
  await page.getByLabel('Driver name').fill('Kavita edited while checking');

  // R1: the superseded review must release the next action immediately.
  await expect(checkButton).toBeEnabled();
  await expect(checkButton).toHaveText('Check details');

  // Release the stale response: it is rejected and must not advance.
  releaseGate();
  await releaseValidation();
  await expect(checkButton).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Driver summary' })).toHaveCount(0);

  // The edited draft can be checked successfully on a fresh request.
  await checkButton.click();
  await expect(page.getByRole('heading', { name: 'Driver summary' })).toBeVisible();
});

test('a held preview response cannot advance an edited draft, and Check details recovers', async ({
  page,
}) => {
  let releaseGate: () => void = () => undefined;
  let releasePreview: () => Promise<void> = async () => undefined;
  let previewCalls = 0;
  await page.route('**/challans/preview', async (route) => {
    previewCalls += 1;
    if (previewCalls > 1) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const body = await response.json();
    await new Promise<void>((resolve) => {
      releaseGate = resolve;
      releasePreview = async () => {
        await route.fulfill({ response, json: body });
      };
    });
  });

  await signInAndFill(page);
  const checkButton = page.getByTestId('check-details');
  const previewIssued = page.waitForRequest('**/challans/preview');
  await checkButton.click();
  await previewIssued;
  await expect(checkButton).toBeDisabled();

  // Material edit while the preview response is still held.
  await page.getByLabel('Remarks').fill('Edited while the preview was pending');
  await expect(checkButton).toBeEnabled();

  releaseGate();
  await releasePreview();
  await expect(checkButton).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Driver summary' })).toHaveCount(0);

  await checkButton.click();
  await expect(page.getByRole('heading', { name: 'Driver summary' })).toBeVisible();
});

test('a held validation settling with a server error leaves the action usable and shows the error', async ({
  page,
}) => {
  let releaseGate: () => void = () => undefined;
  let validateCalls = 0;
  await page.route('**/challans/validate', async (route) => {
    validateCalls += 1;
    if (validateCalls > 1) {
      await route.continue();
      return;
    }
    await new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    await route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'invalid_draft',
        message: 'Some details need attention.',
        fields: [{ field: 'driverName', code: 'format', message: 'Check the driver name format.' }],
      }),
    });
  });

  await signInAndFill(page);
  const checkButton = page.getByTestId('check-details');
  const validateIssued = page.waitForRequest('**/challans/validate');
  await checkButton.click();
  await validateIssued;
  await expect(checkButton).toBeDisabled();

  // The held response settles with a server error for the current draft.
  releaseGate();
  await expect(checkButton).toBeEnabled();
  const summary = page.getByTestId('error-summary');
  await expect(summary).toContainText('Check the driver name format.');
  await expect(summary).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Driver summary' })).toHaveCount(0);

  // Correcting the flagged field clears only that error; a fresh check succeeds.
  await page.getByLabel('Driver name').fill('Kavita J.');
  await expect(page.getByText('Check the driver name format.')).toHaveCount(0);
  await checkButton.click();
  await expect(page.getByRole('heading', { name: 'Driver summary' })).toBeVisible();
});

test('a stale held validation settling after a newer successful check cannot disturb it', async ({
  page,
}) => {
  let releaseGate: () => void = () => undefined;
  let releaseValidation: () => Promise<void> = async () => undefined;
  let validateCalls = 0;
  await page.route('**/challans/validate', async (route) => {
    validateCalls += 1;
    if (validateCalls > 1) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const body = await response.json();
    await new Promise<void>((resolve) => {
      releaseGate = resolve;
      releaseValidation = async () => {
        await route.fulfill({ response, json: body });
      };
    });
  });

  await signInAndFill(page);
  const checkButton = page.getByTestId('check-details');
  const validateIssued = page.waitForRequest('**/challans/validate');
  await checkButton.click();
  await validateIssued;
  await expect(checkButton).toBeDisabled();

  await page.getByLabel('Driver name').fill('Kavita J.');
  await expect(checkButton).toBeEnabled();

  // A newer check succeeds while the first response is still held.
  await checkButton.click();
  await expect(page.getByRole('heading', { name: 'Driver summary' })).toBeVisible();

  // The older completion settles last and must not disturb the newer state.
  releaseGate();
  await releaseValidation();
  await expect(page.getByRole('heading', { name: 'Driver summary' })).toBeVisible();
  await expect(checkButton).toHaveCount(0);
});
