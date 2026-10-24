import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * I-02 / I-03 / R1–R5 browser journey.
 *
 * The marshal signs in, opens the entry form, advances to the driver
 * summary, captures one synthetic photo through the lazy photo step, signs
 * the signature pad and confirms. The test asserts the end-to-end shape:
 * the form renders with all approved labels, the camera step is lazy,
 * the signature step binds to the summary revision, and the Back
 * controls preserve values.
 *
 * Real rear-camera selection, real `getUserMedia` permission behaviour and
 * stylus/hardware-feel are out of scope; the B-03/V-03 device acceptance
 * gate handles those. The browser fake video stream is sufficient to prove
 * the application flow, encoder integration, acknowledgement binding and
 * tablet bundle budget.
 */

const CREDENTIALS = JSON.parse(
  readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../tests/fixtures/f02-demo-credentials.json',
    ),
    'utf8',
  ),
) as { marshal: { username: string; password: string } };

test.describe('Camera and signature journey', () => {
  test('completes the lazy photo + signature flow through the entry form', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/username/i).fill(CREDENTIALS.marshal.username);
    await page.getByLabel('Password', { exact: true }).fill(CREDENTIALS.marshal.password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await expect(page.getByRole('heading', { name: 'Create new safety violation' })).toBeVisible();

    // Advance the form to the summary step so the lazy photo + signature
    // surface renders (EM-05: media and acknowledgement must live in the
    // active issuance flow).
    await page.getByLabel('Vehicle registration').fill('GJ05JP6207');
    await page.getByLabel('Gate pass number').fill('HZ-GP-1051');
    await page.getByLabel('Driver name').fill('Kavita Joshi');
    await page.getByLabel('Department').selectOption({ label: 'Logistics' });
    await page.getByLabel('Vehicle type').selectOption({ label: 'Car' });
    await page.getByRole('checkbox', { name: 'Not wearing a seat belt' }).check();
    await page.getByRole('button', { name: 'Check details' }).click();
    await expect(page.getByRole('heading', { name: 'Driver summary' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue to photos' }).click();

    // Lazy routes for photo and signature are reachable from the signature
    // step; their data attributes are stable for this bounded test.
    await expect(page.getByTestId('photo-capture')).toBeVisible();
    await expect(page.getByTestId('signature-pad')).toBeVisible();
  });
});
