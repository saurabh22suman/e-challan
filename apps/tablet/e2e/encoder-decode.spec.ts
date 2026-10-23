import { test, expect, type Page } from '@playwright/test';

/**
 * Representative decoded synthetic-image acceptance for the E-02 encoder.
 *
 * The production encoder (`apps/tablet/src/features/photos/encoder.ts`) is
 * imported in the real browser through the Vite dev server and executed
 * against synthetic canvases with deterministic content. The returned JPEG
 * dataURL is decoded with a real `Image`, so the assertions cover the actual
 * decoded output, not a mocked or filename-only check:
 *
 *  - the rounded decode dimensions match the encoder-reported dimensions;
 *  - the decoded aspect ratio is preserved within rounding tolerance;
 *  - the decoded byte budget respects the approved hard maximum; and
 *  - a compressible frame lands at or under the approved approximately
 *    300 KB target while an incompressible frame still fits under the hard
 *    maximum after the quality/downscale retry chain.
 *
 * The target and hard-maximum values are the contract constants from
 * `packages/contracts/src/issuance.ts` (`PHOTO_BYTES_TARGET = 300 * 1024`,
 * `PHOTO_BYTES_HARD_MAX = 800 * 1024`); they are duplicated here because the
 * root e2e TypeScript project does not resolve the workspace package.
 */

const PHOTO_BYTES_TARGET = 300 * 1024;
const PHOTO_BYTES_HARD_MAX = 800 * 1024;
const PHOTO_WIDTH_HARD_MAX = 1920;
const PHOTO_HEIGHT_HARD_MAX = 1440;

type Pattern = 'gradient' | 'noise' | 'solid';

interface EncodeProbe {
  ok: boolean;
  reason: string | null;
  message: string | null;
  dataUrl: string | null;
  width: number;
  height: number;
  bytes: number;
  decodedWidth: number;
  decodedHeight: number;
}

async function encodeSynthetic(
  page: Page,
  sourceWidth: number,
  sourceHeight: number,
  pattern: Pattern,
): Promise<EncodeProbe> {
  return page.evaluate(
    async (args): Promise<EncodeProbe> => {
      const modulePath = '/src/features/photos/encoder.ts';
      const mod = (await import(/* @vite-ignore */ modulePath)) as {
        encodeJpegToBudget: (options: {
          source: CanvasImageSource;
          sourceWidth: number;
          sourceHeight: number;
          factory: (
            width: number,
            height: number,
          ) => {
            canvas: HTMLCanvasElement;
            context: CanvasRenderingContext2D;
          };
        }) => Promise<{
          ok: boolean;
          result?: { dataUrl: string; width: number; height: number; bytes: number };
          reason?: string;
          message?: string;
        }>;
      };
      const source = document.createElement('canvas');
      source.width = args.sourceWidth;
      source.height = args.sourceHeight;
      const context = source.getContext('2d');
      if (context === null) throw new Error('synthetic source has no 2d context');
      if (args.pattern === 'noise') {
        const image = context.createImageData(args.sourceWidth, args.sourceHeight);
        let seed = 42;
        for (let i = 0; i < image.data.length; i += 4) {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          image.data[i] = seed & 0xff;
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          image.data[i + 1] = seed & 0xff;
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          image.data[i + 2] = seed & 0xff;
          image.data[i + 3] = 255;
        }
        context.putImageData(image, 0, 0);
      } else if (args.pattern === 'gradient') {
        const gradient = context.createLinearGradient(0, 0, args.sourceWidth, args.sourceHeight);
        gradient.addColorStop(0, '#003A80');
        gradient.addColorStop(0.5, '#EFF4FD');
        gradient.addColorStop(1, '#157A3E');
        context.fillStyle = gradient;
        context.fillRect(0, 0, args.sourceWidth, args.sourceHeight);
      } else {
        context.fillStyle = '#4C5A6C';
        context.fillRect(0, 0, args.sourceWidth, args.sourceHeight);
      }

      const outcome = await mod.encodeJpegToBudget({
        source,
        sourceWidth: args.sourceWidth,
        sourceHeight: args.sourceHeight,
        factory: (width, height) => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx === null) throw new Error('encoder factory has no 2d context');
          return { canvas, context: ctx };
        },
      });
      if (!outcome.ok || outcome.result === undefined) {
        return {
          ok: false,
          reason: outcome.reason ?? 'unknown',
          message: outcome.message ?? null,
          dataUrl: null,
          width: 0,
          height: 0,
          bytes: 0,
          decodedWidth: 0,
          decodedHeight: 0,
        };
      }
      const result = outcome.result;
      const decoded = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error('decoded JPEG did not load'));
        image.src = result.dataUrl;
      });
      return {
        ok: true,
        reason: null,
        message: null,
        dataUrl: result.dataUrl,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        decodedWidth: decoded.width,
        decodedHeight: decoded.height,
      };
    },
    { sourceWidth, sourceHeight, pattern },
  );
}

test.describe('E-02 decoded synthetic-image acceptance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('caps a 3840x2160 gradient to 1920x1080 and lands under the 300 KB target', async ({
    page,
  }) => {
    const probe = await encodeSynthetic(page, 3840, 2160, 'gradient');
    expect(probe.ok).toBe(true);
    expect(probe.dataUrl).not.toBeNull();
    expect(probe.dataUrl?.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(probe.width).toBeLessThanOrEqual(PHOTO_WIDTH_HARD_MAX);
    expect(probe.height).toBeLessThanOrEqual(PHOTO_HEIGHT_HARD_MAX);
    // 3840x2160 is 16:9; the cap produces exactly 1920x1080.
    expect(probe.width).toBe(1920);
    expect(probe.height).toBe(1080);
    // Real decode, not just the encoder's self-report.
    expect(probe.decodedWidth).toBe(probe.width);
    expect(probe.decodedHeight).toBe(probe.height);
    // A smooth gradient compresses well below the target.
    expect(probe.bytes).toBeLessThanOrEqual(PHOTO_BYTES_TARGET);
  });

  test('keeps a 1920x1440 frame at the hard cap and preserves its 4:3 aspect', async ({ page }) => {
    const probe = await encodeSynthetic(page, 1920, 1440, 'gradient');
    expect(probe.ok).toBe(true);
    expect(probe.width).toBe(1920);
    expect(probe.height).toBe(1440);
    expect(probe.decodedWidth).toBe(1920);
    expect(probe.decodedHeight).toBe(1440);
    expect(probe.bytes).toBeLessThanOrEqual(PHOTO_BYTES_HARD_MAX);
  });

  test('preserves the 16:9 aspect ratio for an incompressible 3840x2160 noise frame', async ({
    page,
  }) => {
    const probe = await encodeSynthetic(page, 3840, 2160, 'noise');
    expect(probe.ok).toBe(true);
    const ratio = probe.decodedWidth / probe.decodedHeight;
    expect(Math.abs(ratio - 16 / 9)).toBeLessThan(0.02);
    expect(probe.decodedWidth).toBe(probe.width);
    expect(probe.decodedHeight).toBe(probe.height);
    expect(probe.bytes).toBeLessThanOrEqual(PHOTO_BYTES_HARD_MAX);
  });

  test('encodes a 1080x1080 solid frame under the target without resizing', async ({ page }) => {
    const probe = await encodeSynthetic(page, 1080, 1080, 'solid');
    expect(probe.ok).toBe(true);
    expect(probe.width).toBe(1080);
    expect(probe.height).toBe(1080);
    expect(probe.bytes).toBeLessThanOrEqual(PHOTO_BYTES_TARGET);
  });
});
