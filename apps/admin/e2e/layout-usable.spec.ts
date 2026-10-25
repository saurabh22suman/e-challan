import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const ACCOUNTS = JSON.parse(
  readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../tests/fixtures/f02-demo-credentials.json',
    ),
    'utf8',
  ),
) as { admin: { username: string; password: string } };

async function signIn(page: Page): Promise<void> {
  const login = await page.request.post('/api/auth/login', { data: ACCOUNTS.admin });
  expect(login.status()).toBe(200);
  const { token } = (await login.json()) as { token: string };
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
    'echallan.admin.session-token',
    token,
  ] as const);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Review workspace' })).toBeVisible();
  await expect(page.getByText('HZL/EC/2026/10/0005')).toBeVisible();
}

async function fitsViewport(page: Page, selector: ReturnType<Page['getByRole']>) {
  await expect(selector).toBeVisible();
  const box = await selector.boundingBox();
  expect(box).not.toBeNull();
  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewportWidth + 1);
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('usable laptop queue layout', () => {
  for (const width of [1100, 1152]) {
    test(`uses readable cards and keeps row actions visible at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await signIn(page);
      await expect(page.getByRole('table', { name: 'Challans' })).toHaveCount(0);
      await fitsViewport(page, page.getByRole('button', { name: /^Open / }).first());
      await expectNoPageOverflow(page);

      await page.getByRole('tab', { name: 'Users' }).click();
      await expect(page.getByRole('table', { name: 'Users' })).toHaveCount(0);
      await fitsViewport(page, page.getByRole('button', { name: /^Reset password for / }).first());
      await expectNoPageOverflow(page);
    });
  }

  for (const width of [1280, 1366, 1440]) {
    test(`keeps the table action in view at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await signIn(page);
      await expect(page.getByRole('table', { name: 'Challans' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Action' })).toBeVisible();
      await fitsViewport(page, page.getByRole('button', { name: /^Open / }).first());
      await expectNoPageOverflow(page);

      await page.getByRole('tab', { name: 'Users' }).click();
      await expect(page.getByRole('table', { name: 'Users' })).toBeVisible();
      await fitsViewport(page, page.getByRole('button', { name: /^Reset password for / }).first());
      await expectNoPageOverflow(page);
    });
  }
});
