import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/**
 * Local-acknowledgement acceptance with Chromium's synthetic camera
 * (specs/008-marshal-character, MC-04/MC-06). This proves application flow and
 * wording, not rear-camera hardware or signature feel (B-03/V-03 remains the
 * device gate).
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

async function signIn(page: Page) {
  const login = await page.request.post('/api/auth/login', { data: credentials });
  expect(login.status()).toBe(200);
  const { token } = (await login.json()) as { token: string };
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
    'echallan.tablet.session-token',
    token,
  ] as const);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Create new safety violation' })).toBeVisible();
}

async function openSignatureStep(page: Page) {
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

async function drawStroke(page: Page) {
  const canvas = page.getByTestId('signature-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('missing canvas geometry');
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.35);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6, { steps: 12 });
  await page.mouse.up();
}

test('MC-04/MC-06: photo and signature acknowledgement stay local, distinct and brief', async ({
  page,
}) => {
  await signIn(page);
  await openSignatureStep(page);

  await page.getByTestId('photo-start-camera').click();
  const capture = page.getByTestId('photo-capture-button');
  await expect(capture).toBeEnabled({ timeout: 15_000 });
  await capture.click();

  const acknowledgement = page.getByTestId('marshal-acknowledgement');
  await expect(acknowledgement).toBeVisible();
  await expect(acknowledgement).toContainText(/photo captured/i);
  await expect(acknowledgement).toContainText(/no challan has been submitted/i);
  await expect(acknowledgement).not.toContainText(/signature confirmed/i);

  const successImage = acknowledgement.getByTestId('marshal-character-image');
  await expect(successImage).toHaveAttribute('alt', '');
  await expect(acknowledgement.getByTestId('marshal-character')).toHaveAttribute(
    'data-kind',
    'success',
  );
  const successAnimation = await successImage.evaluate((node) => {
    const style = window.getComputedStyle(node);
    return {
      name: style.animationName,
      iteration: style.animationIterationCount,
      duration: style.animationDuration,
    };
  });
  expect(successAnimation.name).toContain('marshal-success');
  expect(successAnimation.iteration).toContain('1');
  const durations = successAnimation.duration.split(',').map((value) => Number.parseFloat(value));
  expect(Math.max(...durations)).toBeLessThanOrEqual(0.6);

  await drawStroke(page);
  await page.getByTestId('signature-confirm').click();

  await expect(acknowledgement).toContainText(/signature confirmed locally/i);
  await expect(acknowledgement).toContainText(/no challan has been submitted/i);
  const signatureAnimation = await acknowledgement
    .getByTestId('marshal-character-image')
    .evaluate((node) => {
      const style = window.getComputedStyle(node);
      return { name: style.animationName, iteration: style.animationIterationCount };
    });
  expect(signatureAnimation.name).toContain('marshal-success');
  expect(signatureAnimation.iteration).toContain('1');

  await expect(
    page.getByText('Signature captured on this device. No challan has been submitted.'),
  ).toBeVisible();
  await expect(page.getByText(/challan issued|submitted successfully|receipt/i)).toHaveCount(0);
});
