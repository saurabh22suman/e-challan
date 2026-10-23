import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/**
 * CHAR-01 planner acceptance (revision 2): catalogue failure states at the
 * browser boundary.
 *
 * A rejected transport may show the crossed-Wi-Fi character; an HTTP 500/503
 * response must show an honest service-error message with Retry and never claim
 * the tablet cannot reach the server. Auth refusal and malformed bodies stay
 * distinct, and Retry recovers the real catalogue without fabricated choices.
 *
 * Read-only planner input prepared before the correction. Do not weaken.
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

const SERVICE_BODY = JSON.stringify({ error: 'internal_error', message: 'Something went wrong.' });

test('CHAR-01: a rejected catalogue transport shows the connection character and Retry', async ({
  page,
}) => {
  await page.route('**/masters/**', (route) => route.abort('failed'));
  await signIn(page);

  const connection = page.getByTestId('marshal-connection');
  await expect(connection).toBeVisible();
  await expect(connection).toContainText(/can't reach the server/i);
  await expect(connection).toContainText(/couldn't load/i);
  await expect(page.getByTestId('marshal-service-error')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(page.getByLabel('Vehicle registration')).toHaveCount(0);
});

test('CHAR-01: HTTP 500 shows an honest server error, not the network illustration', async ({
  page,
}) => {
  await page.route('**/masters/**', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: SERVICE_BODY }),
  );
  await signIn(page);

  const serviceError = page.getByTestId('marshal-service-error');
  await expect(serviceError).toBeVisible();
  await expect(serviceError).toContainText(/server returned an error/i);
  await expect(serviceError).toContainText('HTTP 500');
  await expect(serviceError).toContainText(/couldn't load/i);
  await expect(serviceError).toContainText(/tablet reached the server/i);
  await expect(page.getByTestId('marshal-connection')).toHaveCount(0);
  await expect(page.getByText(/can't reach the server/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(page.getByLabel('Vehicle registration')).toHaveCount(0);
});

test('CHAR-01: HTTP 503 shows the service status and Retry', async ({ page }) => {
  await page.route('**/masters/**', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: SERVICE_BODY }),
  );
  await signIn(page);

  const serviceError = page.getByTestId('marshal-service-error');
  await expect(serviceError).toBeVisible();
  await expect(serviceError).toContainText('HTTP 503');
  await expect(serviceError).toContainText(/tablet reached the server/i);
  await expect(page.getByTestId('marshal-connection')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});

test('CHAR-01: an auth refusal stays a session message without any character', async ({ page }) => {
  await page.route('**/masters/**', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'unauthenticated', message: 'Sign in required.' }),
    }),
  );
  await signIn(page);

  await expect(page.getByText('Your session is no longer valid. Sign in again.')).toBeVisible();
  await expect(page.getByTestId('marshal-connection')).toHaveCount(0);
  await expect(page.getByTestId('marshal-service-error')).toHaveCount(0);
  await expect(page.getByLabel('Vehicle registration')).toHaveCount(0);
});

test('CHAR-01: a malformed successful response stays a contract error without any character', async ({
  page,
}) => {
  await page.route('**/masters/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'not json' }),
  );
  await signIn(page);

  await expect(page.getByText(/did not match the expected contract/i)).toBeVisible();
  await expect(page.getByTestId('marshal-connection')).toHaveCount(0);
  await expect(page.getByTestId('marshal-service-error')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});

test('CHAR-01: Retry recovers the real catalogue after a transient HTTP 500', async ({ page }) => {
  // React StrictMode runs the catalogue effect twice in development, so the
  // failure must persist until the test deliberately releases it for Retry.
  let failing = true;
  await page.route('**/masters/**', async (route) => {
    if (failing) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: SERVICE_BODY });
      return;
    }
    await route.continue();
  });
  await signIn(page);

  await expect(page.getByTestId('marshal-service-error')).toBeVisible();
  await expect(page.getByLabel('Vehicle registration')).toHaveCount(0);
  failing = false;
  await page.getByRole('button', { name: 'Retry' }).click();

  await expect(page.getByLabel('Vehicle registration')).toBeVisible();
  await expect(
    page.getByLabel('Department', { exact: true }).locator('option', { hasText: 'Logistics' }),
  ).toHaveCount(1);
  await expect(page.getByLabel('Vehicle type').locator('option', { hasText: 'Car' })).toHaveCount(
    1,
  );
  await expect(page.getByRole('checkbox', { name: 'Not wearing a seat belt' })).toBeVisible();
  await expect(page.getByTestId('marshal-service-error')).toHaveCount(0);
});

test('CHAR-01: Retry recovers the real catalogue after a transient transport rejection', async ({
  page,
}) => {
  let failing = true;
  await page.route('**/masters/**', async (route) => {
    if (failing) {
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  await signIn(page);

  await expect(page.getByTestId('marshal-connection')).toBeVisible();
  await expect(page.getByLabel('Vehicle registration')).toHaveCount(0);
  failing = false;
  await page.getByRole('button', { name: 'Retry' }).click();

  await expect(page.getByLabel('Vehicle registration')).toBeVisible();
  await expect(
    page.getByLabel('Department', { exact: true }).locator('option', { hasText: 'Logistics' }),
  ).toHaveCount(1);
  await expect(page.getByTestId('marshal-connection')).toHaveCount(0);
});
