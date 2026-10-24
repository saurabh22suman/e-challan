import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/**
 * Supervisor challan trend browser journey (docs/design.md §8).
 *
 * Runs against the real API, PostgreSQL and Vite proxy. The request assertion is
 * deliberately on the wire: the panel must ask the server for the Kolkata range
 * and render the returned points, not aggregate or invent data in the browser.
 */

const ACCOUNTS = JSON.parse(
  readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../tests/fixtures/f02-demo-credentials.json',
    ),
    'utf8',
  ),
) as { supervisor: { username: string; password: string } };

interface TrendBody {
  timezone: 'Asia/Kolkata';
  granularity: 'day' | 'week';
  from: string;
  to: string;
  points: Array<{
    bucketStart: string;
    issued: number;
    resolved: number;
    cancelled: number;
  }>;
  totals: { issued: number; resolved: number; cancelled: number };
}

async function signIn(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Username').fill(ACCOUNTS.supervisor.username);
  await page.getByLabel('Password', { exact: true }).fill(ACCOUNTS.supervisor.password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await expect(page.getByRole('heading', { name: 'Demo review workspace' })).toBeVisible();
}

test.describe('Supervisor challan trend', () => {
  test('opens the lazy Trend tab and renders the scoped chart, totals and table', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    const scripts: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(request.url());
    });

    await signIn(page);
    expect(
      scripts.some((url) => /echarts|zrender/i.test(url)),
      'the login/dashboard chunks must not load ECharts before the Trend tab',
    ).toBe(false);

    const trendRequestPromise = page.waitForRequest((request) =>
      request.url().includes('/api/challans/report/trend'),
    );
    await page.getByRole('tab', { name: 'Trend' }).click();
    await expect(page.getByRole('heading', { name: 'Challan trend' })).toBeVisible();

    const trendRequest = await trendRequestPromise;
    const params = new URL(trendRequest.url()).searchParams;
    expect(params.get('granularity')).toBe('day');
    expect(params.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(params.get('to')).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect((params.get('from') ?? '') < (params.get('to') ?? '')).toBe(true);

    const response = await trendRequest.response();
    expect(response?.status()).toBe(200);
    if (!response) throw new Error('The trend request has no response');
    const body = (await response.json()) as TrendBody;
    expect(body.timezone).toBe('Asia/Kolkata');
    expect(body.granularity).toBe('day');
    expect(body.totals.issued + body.totals.resolved + body.totals.cancelled).toBeGreaterThan(0);
    expect(body.points.length).toBeGreaterThan(0);

    await expect.poll(() => scripts.some((url) => /echarts|zrender/i.test(url))).toBe(true);

    const chart = page.getByRole('img', { name: /Challan trend.*Issued/i });
    await expect(chart).toBeVisible();
    await expect(chart.locator('canvas')).toHaveCount(1);

    const legend = page.getByRole('list', { name: 'Chart legend' });
    for (const label of ['Issued', 'Resolved', 'Cancelled']) {
      await expect(legend.getByText(label, { exact: true })).toBeVisible();
    }

    await expect(page.getByTestId('trend-total-issued')).toHaveText(String(body.totals.issued));
    await expect(page.getByTestId('trend-total-resolved')).toHaveText(String(body.totals.resolved));
    await expect(page.getByTestId('trend-total-cancelled')).toHaveText(
      String(body.totals.cancelled),
    );
    await expect(page.getByTestId('trend-period')).toContainText('daily buckets');

    await page.getByRole('button', { name: 'View as table' }).click();
    const table = page.getByRole('table', { name: 'Challan trend data' });
    await expect(table).toBeVisible();
    for (const heading of ['Bucket', 'Issued', 'Resolved', 'Cancelled']) {
      await expect(table.getByRole('columnheader', { name: heading })).toBeVisible();
    }
    await expect(table.getByRole('row')).toHaveCount(body.points.length + 1);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('switches to native weekly 90-day buckets at tablet-landscape width', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await signIn(page);
    await page.getByRole('tab', { name: 'Trend' }).click();
    await expect(page.getByRole('heading', { name: 'Challan trend' })).toBeVisible();
    await page.getByTestId('trend-period').waitFor();

    const weeklyRequestPromise = page.waitForRequest((request) => {
      if (!request.url().includes('/api/challans/report/trend')) return false;
      return new URL(request.url()).searchParams.get('granularity') === 'week';
    });
    await page.getByRole('button', { name: '90 days' }).click();

    const weeklyRequest = await weeklyRequestPromise;
    const params = new URL(weeklyRequest.url()).searchParams;
    expect(params.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(params.get('to')).toMatch(/^\d{4}-\d{2}-\d{2}$/u);

    const response = await weeklyRequest.response();
    expect(response?.status()).toBe(200);
    if (!response) throw new Error('The weekly trend request has no response');
    const body = (await response.json()) as TrendBody;
    expect(body.granularity).toBe('week');
    for (const point of body.points) {
      expect(new Date(`${point.bucketStart}T00:00:00.000Z`).getUTCDay()).toBe(1);
    }

    await expect(page.getByTestId('trend-period')).toContainText('weekly buckets');
    await expect(page.getByRole('img', { name: /Challan trend/i })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.getByRole('button', { name: 'View as table' }).click();
    await expect(page.getByRole('table', { name: 'Challan trend data' })).toBeVisible();
  });
});
