import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * CR-rereview R1 / R2 regression probes.
 *
 * The reviewer's saved source at
 *   docs/reviews/entry-media-signature-probe.txt
 * is adopted here verbatim. These probes assert that a confirmable signature
 * canvas either preserves its ink OR has its Confirm button disabled. Both
 * probes were reported as failing on the previous checkpoint.
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

async function openPad(page: Page) {
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
  await page.getByRole('button', { name: 'Continue to photos', exact: true }).click();
  const canvas = page.getByTestId('signature-canvas');
  await expect(canvas).toBeVisible();
  // B-09 baseline revision: the capture step's viewfinder is taller, so the
  // canvas can sit below the fold at 720px height. Scroll it into view before
  // raw mouse geometry is measured, exactly as a human signer would.
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('missing canvas geometry');
  await page.mouse.move(box.x + 30, box.y + 70);
  await page.mouse.down();
  await page.mouse.move(box.x + 180, box.y + 130, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByTestId('signature-confirm')).toBeEnabled();
  await page.getByTestId('signature-confirm').click();
}

async function inkPixels(page: Page) {
  return page.getByTestId('signature-canvas').evaluate((node: Element | null): number => {
    if (node === null) return 0;
    const canvas = node as unknown as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return 0;
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = image.data;
    let ink = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const a = pixels[i + 3] ?? 0;
      const r = pixels[i] ?? 0;
      const g = pixels[i + 1] ?? 0;
      const b = pixels[i + 2] ?? 0;
      if (a > 0 && r < 200 && g < 200 && b < 200) {
        ink += 1;
      }
    }
    return ink;
  });
}

test('R1: same-size resize preserves ink or invalidates signature', async ({ page }) => {
  await openPad(page);
  expect(await inkPixels(page)).toBeGreaterThan(0);
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  const ink = await inkPixels(page);
  const enabled = await page.getByTestId('signature-confirm').isEnabled();
  expect(ink > 0 || !enabled).toBe(true);
});

test('R2: remounted captured signature has visible ink', async ({ page }) => {
  await openPad(page);
  expect(await inkPixels(page)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Back to summary' }).click();
  await page.getByRole('button', { name: 'Continue to photos', exact: true }).click();
  await expect(page.getByTestId('signature-canvas')).toBeVisible();
  const ink = await inkPixels(page);
  const enabled = await page.getByTestId('signature-confirm').isEnabled();
  expect(ink > 0 || !enabled).toBe(true);
});
