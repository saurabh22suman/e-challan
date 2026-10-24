import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * V1 / V2 regression probes.
 *
 * The reviewer's saved source at
 *   docs/reviews/entry-media-preview-binding-probe.txt
 * is adopted here verbatim. These probes assert that a confirmed
 * signature is invalidated when the server preview changes (V1) and
 * that a renewed duplicate acknowledgement is required when
 * occurrence/action changes (V2).
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

async function enterDraft(page: Page, duplicate: boolean) {
  let previews = 0;
  await page.route('**/challans/preview', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    previews += 1;
    body.occurrenceNumber = previews;
    body.recommendedAction = previews === 1 ? 'warning_issued' : 'safety_counselling_completed';
    body.duplicateWarning = { required: duplicate, matchedCount: duplicate ? 1 : 0 };
    await route.fulfill({ response, json: body });
  });
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
  await page.getByRole('button', { name: 'Check details' }).click();
}

test('V1: changed server preview invalidates parent signature', async ({ page }) => {
  await enterDraft(page, false);
  await expect(page.getByRole('heading', { name: 'Driver summary' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to photos', exact: true }).click();
  const canvas = page.getByTestId('signature-canvas');
  await expect(canvas).toBeVisible();
  // B-09 baseline revision: the capture step's viewfinder is taller, so the
  // canvas can sit below the fold at 720px height. Scroll it into view before
  // raw mouse geometry is measured, exactly as a human signer would.
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas missing');
  await page.mouse.move(box.x + 30, box.y + 70);
  await page.mouse.down();
  await page.mouse.move(box.x + 180, box.y + 130, { steps: 15 });
  await page.mouse.up();
  await page.getByTestId('signature-confirm').click();
  await page.getByRole('button', { name: 'Back to summary' }).click();
  await expect(page.getByText('Driver signature captured.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Change details', exact: true }).click();
  await page.getByRole('button', { name: 'Check details' }).click();
  await expect(page.getByText('Occurrence 2.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Driver summary' })).toBeVisible();
  await expect(page.getByText('Driver signature captured.', { exact: true })).toHaveCount(0);
});

test('V2: changed occurrence renews duplicate acknowledgement before summary', async ({ page }) => {
  await enterDraft(page, true);
  await page.getByRole('checkbox', { name: 'I acknowledge the duplicate warning' }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Driver summary' })).toBeVisible();
  await page.getByRole('button', { name: 'Change details', exact: true }).click();
  await page.getByRole('button', { name: 'Check details' }).click();
  await expect(page.getByText('Occurrence 2.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Driver summary' })).toHaveCount(0);
});
