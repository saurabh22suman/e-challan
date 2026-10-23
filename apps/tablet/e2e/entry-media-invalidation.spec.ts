import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * C2 correction browser acceptance (entry-media V1–V6 re-review, 2026-10-17).
 *
 * C2a: an edit after confirmation — a new stroke on the remounted pad — must
 * immediately clear the parent's confirmed acknowledgement, and returning to
 * the signature step must not restore the superseded capture as confirmed.
 *
 * C2b (regression guard): reconfirming after a second stroke must export every
 * stroke. The component re-decodes and re-renders the confirmed PNG when the
 * step is remounted, so both stroke regions must contain ink.
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
).marshal as { username: string; password: string };

async function openSignatureStep(page: Page) {
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
  await page.getByRole('button', { name: 'Check details' }).click();
  await expect(page.getByRole('heading', { name: 'Driver summary' })).toBeVisible();
  const continueButton = page.getByRole('button', { name: 'Continue to photos', exact: true });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await expect(page.getByTestId('signature-canvas')).toBeVisible();
  await page.getByTestId('signature-canvas').scrollIntoViewIfNeeded();
}

/** Draws a stroke between two canvas-relative points (fractions of the box). */
async function stroke(page: Page, x0: number, y0: number, x1: number, y1: number) {
  const canvas = page.getByTestId('signature-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('missing canvas geometry');
  await page.mouse.move(box.x + box.width * x0, box.y + box.height * y0);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * x1, box.y + box.height * y1, { steps: 15 });
  await page.mouse.up();
}

async function inkByHalf(page: Page) {
  return page.getByTestId('signature-canvas').evaluate((node: Element | null) => {
    if (node === null) return { left: 0, right: 0 };
    const canvas = node as unknown as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return { left: 0, right: 0 };
    const measure = (x0: number, x1: number) => {
      const data = ctx.getImageData(x0, 0, x1 - x0, canvas.height).data;
      let ink = 0;
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3] ?? 0;
        const r = data[i] ?? 0;
        const g = data[i + 1] ?? 0;
        const b = data[i + 2] ?? 0;
        if (a > 0 && r < 200 && g < 200 && b < 200) ink += 1;
      }
      return ink;
    };
    const midpoint = Math.floor(canvas.width / 2);
    return { left: measure(0, midpoint), right: measure(midpoint, canvas.width) };
  });
}

test('C2a: an edit after confirmation clears the parent acknowledgement', async ({ page }) => {
  await openSignatureStep(page);
  await stroke(page, 0.1, 0.3, 0.35, 0.5);
  await expect(page.getByTestId('signature-confirm')).toBeEnabled();
  await page.getByTestId('signature-confirm').click();
  await page.getByRole('button', { name: 'Back to summary' }).click();
  await expect(page.getByText('Driver signature captured.', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Continue to photos', exact: true }).click();
  await expect(page.getByTestId('signature-canvas')).toBeVisible();
  // The confirmed capture is rehydrated onto the pad before the edit.
  await expect
    .poll(async () => {
      const halves = await inkByHalf(page);
      return halves.left + halves.right;
    })
    .toBeGreaterThan(0);

  await stroke(page, 0.6, 0.6, 0.9, 0.8);
  await page.getByRole('button', { name: 'Back to summary' }).click();
  await expect(page.getByText('Driver signature captured.', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Continue to photos', exact: true }).click();
  await expect(page.getByTestId('signature-canvas')).toBeVisible();
  await expect(page.getByTestId('signature-confirm')).toBeDisabled();
  await expect
    .poll(async () => {
      const halves = await inkByHalf(page);
      return halves.left + halves.right;
    })
    .toBe(0);
});

test('C2b: a reconfirmed signature keeps every stroke when restored', async ({ page }) => {
  await openSignatureStep(page);
  await stroke(page, 0.1, 0.3, 0.35, 0.5);
  await page.getByTestId('signature-confirm').click();
  await stroke(page, 0.6, 0.6, 0.9, 0.8);
  await expect(page.getByTestId('signature-confirm')).toBeEnabled();
  await page.getByTestId('signature-confirm').click();
  await page.getByRole('button', { name: 'Back to summary' }).click();
  await expect(page.getByText('Driver signature captured.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to photos', exact: true }).click();
  await expect(page.getByTestId('signature-canvas')).toBeVisible();
  await expect
    .poll(async () => {
      const halves = await inkByHalf(page);
      return halves.left;
    })
    .toBeGreaterThan(0);
  const halves = await inkByHalf(page);
  expect(halves.left).toBeGreaterThan(0);
  expect(halves.right).toBeGreaterThan(0);
});
