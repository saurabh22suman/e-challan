import { expect, test } from '@playwright/test';

/**
 * The dashboard is installable as a PWA on supported devices. These checks cover
 * the manifest and shell worker that make it installable; they do not claim an
 * installed-app or offline-data guarantee.
 */
test('serves an installable dashboard manifest and shell worker', async ({ request }) => {
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
  const workerBody = await worker.text();
  expect(workerBody).toContain("addEventListener('fetch'");
  expect(workerBody).toContain("'/tablet/'");
});
