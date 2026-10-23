import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/**
 * F-04 browser acceptance for the marshal tablet: UI-01 (labels and touch targets),
 * UI-02 (green-only commit reserved, labelled severity, visible focus, self-hosted
 * fonts, readable contrast) and UI-03 (responsive shell, no admin-only widgets).
 *
 * F-04 revision: the foundation screen is replaced by the approved shell. The
 * substantive checks (labels, touch targets, lazy route) are preserved and extended.
 * Read-only planner input.
 */

const ACCOUNTS = JSON.parse(
  readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../tests/fixtures/f02-demo-credentials.json',
    ),
    'utf8',
  ),
) as { marshal: { username: string; password: string } };

const GREEN = 'rgb(21, 122, 62)';

async function signIn(page: Page): Promise<void> {
  const login = await page.request.post('/api/auth/login', { data: ACCOUNTS.marshal });
  expect(login.status()).toBe(200);
  const { token } = (await login.json()) as { token: string };
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
    'echallan.tablet.session-token',
    token,
  ] as const);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Create new safety violation' })).toBeVisible();
}

function parseRgb(value: string): [number, number, number] {
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value);
  if (match === null) throw new Error(`Unsupported colour: ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number): number => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(parseRgb(foreground));
  const b = relativeLuminance(parseRgb(background));
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

test.describe('tablet shell usability (F-04)', () => {
  test('shows the labelled shell and loads the entry flow lazily', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));

    await signIn(page);

    for (const label of ['Vehicle registration', 'Gate pass number', 'Driver name', 'Remarks']) {
      await expect(page.getByLabel(label)).toBeVisible();
    }
    await expect(page.getByRole('group', { name: 'Violations' })).toBeVisible();
    expect(
      requests.some((url) => url.includes('EntryFlow')),
      'the entry flow must be a separate lazy chunk',
    ).toBe(true);
  });

  test('keeps tablet inputs and secondary actions at least 56px tall with 12px gaps', async ({
    page,
  }) => {
    await signIn(page);

    for (const label of ['Vehicle registration', 'Gate pass number', 'Driver name', 'Department']) {
      const box = await page.getByLabel(label).boundingBox();
      expect(box, `${label} must render`).not.toBeNull();
      expect(box?.height ?? 0, `${label} must be at least 56px tall`).toBeGreaterThanOrEqual(56);
    }
    const action = await page.getByRole('button', { name: 'Check details' }).boundingBox();
    expect(action?.height ?? 0).toBeGreaterThanOrEqual(56);

    const first = await page.getByLabel('Vehicle registration').boundingBox();
    const second = await page.getByLabel('Gate pass number').boundingBox();
    const gap = (second?.y ?? 0) - ((first?.y ?? 0) + (first?.height ?? 0));
    expect(gap, 'adjacent targets must be at least 12px apart').toBeGreaterThanOrEqual(12);
  });

  test('reserves solid green and keeps severity labelled and outlined', async ({ page }) => {
    await signIn(page);

    const backgrounds = await page
      .locator('button')
      .evaluateAll((nodes) => nodes.map((node) => window.getComputedStyle(node).backgroundColor));
    expect(
      backgrounds.some((colour) => colour === GREEN),
      'no action in this batch may be solid green; that is reserved for challan commitment',
    ).toBe(false);

    await page.getByRole('checkbox', { name: 'Not wearing a seat belt' }).check();
    const severity = page.getByText(/severity:\s*minor/i);
    await expect(severity).toBeVisible();
    const style = await severity.evaluate((node) => {
      const computed = window.getComputedStyle(node);
      return { background: computed.backgroundColor, border: computed.borderStyle };
    });
    expect(style.background === GREEN, 'severity must not be a solid green fill').toBe(false);
  });

  test('self-hosts IBM Plex fonts and keeps identifiers in mono', async ({ page }) => {
    const externalFonts: string[] = [];
    page.on('request', (request) => {
      if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) externalFonts.push(request.url());
    });

    await signIn(page);
    // Force and await the two families so the assertion cannot race lazy loading.
    await page.evaluate(async () => {
      await Promise.all([
        document.fonts.load('400 16px "IBM Plex Sans"'),
        document.fonts.load('400 16px "IBM Plex Mono"'),
      ]);
      await document.fonts.ready;
    });

    expect(externalFonts, 'fonts must be self-hosted, not fetched from a CDN').toEqual([]);
    await page.evaluate(() => document.fonts.ready);
    // CR-09 fix: read the computed font on the actual rendered input
    // element. We use Playwright locators (which await the input) so
    // there is no race with the initial render.
    const regFont = await page
      .getByLabel('Vehicle registration')
      .evaluate((node) => window.getComputedStyle(node).fontFamily);
    const gateFont = await page
      .getByLabel('Gate pass number')
      .evaluate((node) => window.getComputedStyle(node).fontFamily);
    const sansLoaded = await page.evaluate(() => document.fonts.check('16px "IBM Plex Sans"'));
    const monoLoaded = await page.evaluate(() => document.fonts.check('16px "IBM Plex Mono"'));
    expect(sansLoaded).toBe(true);
    expect(monoLoaded).toBe(true);
    expect(regFont).toContain('IBM Plex Mono');
    expect(gateFont).toContain('IBM Plex Mono');
  });

  test('shows a visible focus ring and readable body contrast', async ({ page }) => {
    await signIn(page);

    await page.getByLabel('Vehicle registration').focus();
    const outline = await page.getByLabel('Vehicle registration').evaluate((node) => {
      const computed = window.getComputedStyle(node);
      return { width: computed.outlineWidth, style: computed.outlineStyle };
    });
    expect(outline.style, 'focus must be visible').not.toBe('none');
    expect(Number.parseFloat(outline.width)).toBeGreaterThan(0);

    const colours = await page.evaluate(() => {
      const heading = document.querySelector('h1');
      if (heading === null) throw new Error('missing heading');
      const color = window.getComputedStyle(heading).color;
      // Walk to the nearest painted ancestor: the heading sits on the navy app bar,
      // not on the page canvas, so the body background would be the wrong surface.
      let node: Element | null = heading;
      let background = 'rgba(0, 0, 0, 0)';
      while (node !== null) {
        const candidate = window.getComputedStyle(node).backgroundColor;
        if (candidate !== 'rgba(0, 0, 0, 0)' && candidate !== 'transparent') {
          background = candidate;
          break;
        }
        node = node.parentElement;
      }
      return { color, background };
    });
    expect(
      contrastRatio(colours.color, colours.background),
      'body text contrast must be at least 7:1',
    ).toBeGreaterThanOrEqual(7);
  });

  test('is responsive and contains no admin-only widgets', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await signIn(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'the shell must not overflow a tablet viewport').toBeLessThanOrEqual(0);

    await expect(
      page.locator('[class*="MuiDataGrid"], [class*="MuiCharts"], [class*="MuiDatePicker"]'),
    ).toHaveCount(0);
  });
});
