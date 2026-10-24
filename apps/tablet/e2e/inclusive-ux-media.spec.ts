import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * R2 external-invalidation acceptance: removing the last photo clears the
 * parent acknowledgement and the mounted signature pad must reconcile its
 * confirmed presentation to the invalidated state (inclusive-ux review
 * 2026-10-19). Uses Chromium's fake camera device; this proves application
 * flow, not camera hardware (B-03/V-03 remains the device gate).
 */

test.use({
  permissions: ['camera'],
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
});

const credentials = JSON.parse(
  readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../tests/fixtures/f02-demo-credentials.json',
    ),
    'utf8',
  ),
).marshal as { username: string; password: string };

async function openSignatureStep(page: Page) {
  await page.goto('/');
  await page.getByLabel(/username/i).fill(credentials.username);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.getByLabel('Vehicle registration').fill('GJ05JP6207');
  await page.getByLabel('Gate pass number').fill('HZ-GP-1051');
  await page.getByLabel('Driver name').fill('Kavita Joshi');
  await page.getByLabel('Department', { exact: true }).selectOption({ label: 'Logistics' });
  await page.getByLabel('Vehicle type').selectOption({ label: 'Car' });
  await page.getByRole('checkbox', { name: 'Not wearing a seat belt' }).check();
  await page.getByTestId('check-details').click();
  await expect(page.getByRole('heading', { name: 'Driver summary' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to photos' }).click();
  await expect(page.getByTestId('photo-capture')).toBeVisible();
}

test('UXA-23: removing the last photo reconciles the mounted signature pad in place', async ({
  page,
}) => {
  await openSignatureStep(page);

  await page.getByTestId('photo-start-camera').click();
  const takePhoto = page.getByTestId('photo-capture-button');
  await expect(takePhoto).toBeEnabled({ timeout: 15000 });
  await takePhoto.click();
  await expect(page.getByText(/Photos: 1 of 4/u)).toBeVisible();

  const canvas = page.getByTestId('signature-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('missing canvas geometry');
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.35);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6, { steps: 12 });
  await page.mouse.up();
  await page.getByTestId('signature-confirm').click();
  await expect(page.getByText('Signature confirmed', { exact: true })).toBeVisible();

  await page.getByTestId('photo-retake').click();
  await expect(page.getByText(/Photos: 0 of 4/u)).toBeVisible();

  // The mounted pad must show the invalidated state, not a stale confirmation.
  await expect(page.getByText('Signature confirmed', { exact: true })).toHaveCount(0);
  await expect(
    page.getByText('Signature captured on this device. No challan has been submitted.'),
  ).toHaveCount(0);
  await expect(page.getByTestId('signature-confirm')).toBeDisabled();
  await expect(
    page.getByText(/Signature cleared because the evidence photos changed/u),
  ).toBeVisible();

  // Parent and child agree: the summary no longer reports a captured signature.
  await page.getByRole('button', { name: 'Back to summary' }).click();
  await expect(page.getByText('Driver signature captured.', { exact: true })).toHaveCount(0);
});
