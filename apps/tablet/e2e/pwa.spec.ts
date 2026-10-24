import { expect, test } from '@playwright/test';

/**
 * Development-server shell check for the tablet bundle. Production uses the
 * single root manifest and root service worker from the admin image (the tablet
 * is served at /tablet/), so the production PWA is covered by the admin check and
 * the container smoke journey.
 */
test('serves an installable tablet manifest and shell worker', async ({ request }) => {
  const manifestResponse = await request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  const manifest = (await manifestResponse.json()) as {
    name?: string;
    short_name?: string;
    start_url?: string;
    scope?: string;
    display?: string;
    icons?: Array<{ sizes?: string }>;
  };

  expect(manifest.name).toContain('e-Challan');
  expect(manifest.short_name).toBeTruthy();
  expect(manifest.start_url).toBe('/');
  expect(manifest.scope).toBe('/');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons?.map((icon) => icon.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  );

  const worker = await request.get('/sw.js');
  expect(worker.ok()).toBe(true);
  expect(await worker.text()).toContain("addEventListener('fetch'");
});
