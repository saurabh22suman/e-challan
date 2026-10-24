import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Marshal character acceptance (specs/008-marshal-character, MC-01–MC-08).
 *
 * Planner-owned acceptance prepared before implementation. Do not replace,
 * skip or weaken these assertions. The fake-camera local-acknowledgement case
 * lives in marshal-character-media.spec.ts so its launch flags stay file-local.
 *
 * Images are decorative illustrations beside text. These tests prove browser
 * behaviour, not reading comfort or representative-user comprehension.
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

async function signIn(page: Page, waitUntil: 'load' | 'domcontentloaded' = 'load') {
  const login = await page.request.post('/api/auth/login', { data: credentials });
  expect(login.status()).toBe(200);
  const { token } = (await login.json()) as { token: string };
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
    'echallan.tablet.session-token',
    token,
  ] as const);
  await page.goto('/', { waitUntil });
  await expect(page.getByRole('heading', { name: 'Create new safety violation' })).toBeVisible();
}

async function fillDraft(page: Page) {
  await page.getByLabel('Vehicle registration').fill('GJ05JP6207');
  await page.getByLabel('Gate pass number').fill('HZ-GP-1051');
  await page.getByLabel('Driver name').fill('Kavita Joshi');
  await page.getByLabel('Department', { exact: true }).selectOption({ label: 'Logistics' });
  await page.getByLabel('Vehicle type').selectOption({ label: 'Car' });
  await page.getByRole('checkbox', { name: 'Not wearing a seat belt' }).check();
}

async function openSummary(page: Page) {
  await fillDraft(page);
  await page.getByTestId('check-details').click();
  await expect(page.getByRole('heading', { name: 'Driver summary' })).toBeVisible();
}

async function openSignatureStep(page: Page) {
  await openSummary(page);
  await page.getByRole('button', { name: 'Continue to photos' }).click();
  await expect(page.getByTestId('signature-pad')).toBeVisible();
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

async function animationInfo(locator: Locator) {
  return locator.evaluate((node) => {
    const style = window.getComputedStyle(node);
    return {
      name: style.animationName,
      iteration: style.animationIterationCount,
      duration: style.animationDuration,
    };
  });
}

test('MC-02/MC-05: welcome guides, is decorative, and does not preload other states', async ({
  page,
}) => {
  const characterRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/characters/')) {
      characterRequests.push(new URL(request.url()).pathname);
    }
  });

  await signIn(page);
  const welcome = page.getByTestId('marshal-welcome');
  await expect(welcome).toBeVisible();
  await expect(welcome).toContainText('Welcome');
  await expect(welcome).toContainText(/vehicle number or gate pass/i);

  const image = welcome.getByTestId('marshal-character-image');
  await expect(image).toHaveAttribute('alt', '');
  await expect(image).toHaveAttribute('aria-hidden', 'true');
  await expect(image).toHaveAttribute('loading', 'eager');
  await expect(image).toHaveAttribute('width', '640');
  await expect(image).toHaveAttribute('height', '640');
  await expect
    .poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  expect(
    characterRequests.filter((requestPath) => requestPath !== '/characters/welcome-full.webp'),
  ).toEqual([]);

  expect(await image.evaluate((node) => (node as HTMLImageElement).tabIndex)).toBe(-1);
  await page.getByRole('button', { name: 'Go to vehicle number' }).click();
  await expect(page.locator('#vehicle-registration')).toBeFocused();
});

test('MC-07: reserved image space keeps the form stable while welcome loads', async ({ page }) => {
  let releaseImage: () => void = () => undefined;
  const heldImage = new Promise<void>((resolve) => {
    releaseImage = resolve;
  });
  await page.route('**/characters/welcome-full.webp', async (route) => {
    const response = await route.fetch();
    await heldImage;
    await route.fulfill({ response });
  });

  await signIn(page, 'domcontentloaded');
  const field = page.locator('#vehicle-registration');
  const character = page.getByTestId('marshal-character');
  await expect(field).toBeVisible();
  const fieldBefore = await field.boundingBox();
  const characterBefore = await character.boundingBox();

  releaseImage();
  const image = page.getByTestId('marshal-character-image');
  await expect
    .poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  const fieldAfter = await field.boundingBox();
  const characterAfter = await character.boundingBox();

  expect(Math.abs((fieldAfter?.y ?? 0) - (fieldBefore?.y ?? 0))).toBeLessThanOrEqual(1);
  expect(
    Math.abs((characterAfter?.height ?? 0) - (characterBefore?.height ?? 0)),
  ).toBeLessThanOrEqual(1);
});

test('MC-07: text, actions and validation survive image-load failure at 390px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/characters/*.webp', (route) => route.abort());

  await signIn(page);
  const welcome = page.getByTestId('marshal-welcome');
  await expect(welcome).toBeVisible();
  await expect(welcome).toHaveAttribute('data-failed', 'true');
  await expect(welcome.getByTestId('marshal-character-image')).toBeHidden();
  await expect(welcome).toContainText('Welcome');
  await expect(page.getByRole('button', { name: 'Go to vehicle number' })).toBeEnabled();

  await page.getByRole('button', { name: 'Go to vehicle number' }).click();
  await expect(page.locator('#vehicle-registration')).toBeFocused();
  await page.getByTestId('check-details').click();

  const error = page.getByTestId('marshal-error');
  await expect(error).toBeVisible();
  await expect(error).toContainText(/some details need attention/i);
  await expect(error.getByTestId('marshal-character-image')).toBeHidden();
  await expect(page.getByTestId('error-summary')).toBeFocused();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('MC-03: pending review shows restrained motion and a real progress indicator, then guidance', async ({
  page,
}) => {
  let releaseValidation: () => void = () => undefined;
  const heldValidation = new Promise<void>((resolve) => {
    releaseValidation = resolve;
  });
  await page.route('**/challans/validate', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await heldValidation;
    await route.fulfill({ response, json: body });
  });

  await signIn(page);
  await fillDraft(page);
  const validateIssued = page.waitForRequest('**/challans/validate');
  await page.getByTestId('check-details').click();
  await validateIssued;

  const processing = page.getByTestId('marshal-processing');
  await expect(processing).toBeVisible();
  await expect(processing).toHaveAttribute('role', 'status');
  await expect(processing).toContainText(/checking the details/i);
  await expect(processing).toContainText(/please wait/i);
  await expect(page.getByRole('progressbar', { name: 'Checking details' })).toBeVisible();

  const processingImage = processing.getByTestId('marshal-character-image');
  await expect(processingImage).toHaveAttribute('alt', '');
  const processingAnimation = await animationInfo(processingImage);
  expect(processingAnimation.name).toContain('marshal-breathe');
  expect(processingAnimation.iteration).toContain('infinite');

  releaseValidation();
  await expect(page.getByRole('heading', { name: 'Driver summary' })).toBeVisible();
  await expect(page.getByTestId('marshal-processing')).toHaveCount(0);

  const guidance = page.getByTestId('marshal-check-details');
  await expect(guidance).toBeVisible();
  await expect(guidance).toContainText(/check these details with the driver/i);
  await expect(guidance).toContainText(/change details/i);
  const guidanceImage = guidance.getByTestId('marshal-character-image');
  await expect(guidanceImage).toHaveAttribute('alt', '');
  await expect(guidanceImage).toHaveAttribute('loading', 'lazy');
  await expect
    .poll(() => guidanceImage.evaluate((node) => (node as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
});

test('MC-04/MC-06: validation errors use the concerned illustration, never the network one', async ({
  page,
}) => {
  await signIn(page);
  await page.getByTestId('check-details').click();

  const error = page.getByTestId('marshal-error');
  await expect(error).toBeVisible();
  await expect(error).toContainText(/some details need attention/i);
  await expect(error.getByTestId('marshal-character')).toHaveAttribute('data-kind', 'error');
  await expect(page.getByTestId('marshal-connection')).toHaveCount(0);
  const errorAnimation = await animationInfo(error.getByTestId('marshal-character-image'));
  expect(errorAnimation.name).toMatch(/marshal-(enter|fade-in)/);
  expect(errorAnimation.iteration).not.toContain('infinite');

  await page.route('**/challans/validate', (route) =>
    route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'invalid_draft',
        message: 'Some details need attention.',
        fields: [
          {
            field: 'contractorId',
            code: 'inactive_master',
            message: 'Choose an active contractor.',
          },
        ],
      }),
    }),
  );
  await fillDraft(page);
  await page.getByTestId('check-details').click();
  await expect(page.getByTestId('error-summary')).toContainText('Choose an active contractor.');
  await expect(page.getByTestId('marshal-error')).toBeVisible();
  await expect(page.getByTestId('marshal-connection')).toHaveCount(0);
});

test('MC-04/MC-06: a real connection failure uses the crossed-Wi-Fi illustration and retry recovers', async ({
  page,
}) => {
  await page.route('**/challans/validate', (route) => route.abort('failed'));
  await signIn(page);
  await fillDraft(page);
  await page.getByTestId('check-details').click();

  const connection = page.getByTestId('marshal-connection');
  await expect(connection).toBeVisible();
  await expect(connection.getByTestId('marshal-character')).toHaveAttribute(
    'data-kind',
    'connection',
  );
  await expect(connection).toContainText(/can't reach the server/i);
  await expect(connection).toContainText("Couldn't reach the API. Try again.");
  await expect(connection.getByTestId('marshal-character-image')).toHaveAttribute('alt', '');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByText(/challan issued|submitted successfully|receipt/i)).toHaveCount(0);

  await page.unroute('**/challans/validate');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Driver summary' })).toBeVisible();
  await expect(page.getByTestId('marshal-connection')).toHaveCount(0);
});

test('MC-06: camera-permission failure never displays the network illustration', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (navigator.mediaDevices) {
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        configurable: true,
        value: () => Promise.reject(new DOMException('denied', 'NotAllowedError')),
      });
    }
  });

  await signIn(page);
  await openSignatureStep(page);
  await page.getByTestId('photo-start-camera').click();

  await expect(page.getByText(/Camera permission was denied/i)).toBeVisible();
  await expect(page.getByTestId('marshal-connection')).toHaveCount(0);
  await expect(page.getByTestId('marshal-acknowledgement')).toHaveCount(0);
});

test('MC-03/MC-04: reduced motion leaves every illustration static without hiding status', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signIn(page);

  const welcome = page.getByTestId('marshal-welcome');
  await expect(welcome).toBeVisible();
  expect((await animationInfo(welcome.getByTestId('marshal-character-image'))).name).toBe('none');

  let releaseValidation: () => void = () => undefined;
  const heldValidation = new Promise<void>((resolve) => {
    releaseValidation = resolve;
  });
  await page.route('**/challans/validate', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await heldValidation;
    await route.fulfill({ response, json: body });
  });

  await fillDraft(page);
  const validateIssued = page.waitForRequest('**/challans/validate');
  await page.getByTestId('check-details').click();
  await validateIssued;

  const processing = page.getByTestId('marshal-processing');
  await expect(processing).toBeVisible();
  expect((await animationInfo(processing.getByTestId('marshal-character-image'))).name).toBe(
    'none',
  );

  releaseValidation();
  await expect(page.getByRole('heading', { name: 'Driver summary' })).toBeVisible();
  const guidance = page.getByTestId('marshal-check-details');
  await expect(guidance).toBeVisible();
  expect((await animationInfo(guidance.getByTestId('marshal-character-image'))).name).toBe('none');

  await page.getByRole('button', { name: 'Continue to photos' }).click();
  await expect(page.getByTestId('signature-pad')).toBeVisible();
  await drawStroke(page);
  await page.getByTestId('signature-confirm').click();

  const acknowledgement = page.getByTestId('marshal-acknowledgement');
  await expect(acknowledgement).toBeVisible();
  await expect(acknowledgement).toContainText(/signature confirmed locally/i);
  expect((await animationInfo(acknowledgement.getByTestId('marshal-character-image'))).name).toBe(
    'none',
  );
});
