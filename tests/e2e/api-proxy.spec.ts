import { expect, test } from '@playwright/test';
import credentials from '../fixtures/f02-demo-credentials.json';

/** Synthetic acceptance credentials; never a runtime demo default. */
const CREDENTIALS = credentials as {
  marshal: { username: string; password: string };
};

/**
 * Coordinator-owned browser check for the foundation wiring.
 *
 * It proves, in a real browser, that the tablet app reaches the real Fastify API
 * through the Vite `/api` proxy and that the shared health contract decides what is
 * rendered. Readiness is deliberately tolerant: with PostgreSQL running the probe
 * answers 200, and without it 503 — both are honest API answers, and neither is
 * faked here.
 *
 * F-04 revision: the foundation screen's "Check API status" control is replaced by
 * the role shell, so the health contract is asserted directly through the real
 * proxy from an authenticated browser context. The substantive proxy assertion is
 * unchanged. Read-only planner input.
 */

test.describe('tablet app through the API proxy', () => {
  test('authenticates through the real proxy and reports live API health', async ({ page }) => {
    const login = await page.request.post('/api/auth/login', { data: CREDENTIALS.marshal });
    expect(login.status()).toBe(200);
    const { token } = (await login.json()) as { token: string };
    await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
      'echallan.tablet.session-token',
      token,
    ] as const);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Create new safety violation' })).toBeVisible();

    const health = await page.request.get('/api/health');
    expect(health.status()).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok' });
  });

  test('reports live API readiness without inventing database success', async ({ request }) => {
    const response = await request.get('/api/health/ready');
    expect([200, 503]).toContain(response.status());
    const body = (await response.json()) as { status: string; database?: string };
    if (response.status() === 200) {
      expect(body).toEqual({ status: 'ok', database: 'ok' });
    } else {
      expect(body).toEqual({ status: 'error', database: 'unavailable' });
    }
  });
});
