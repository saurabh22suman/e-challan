import {
  PHOTO_BYTES_HARD_MAX,
  PHOTO_BYTES_TARGET,
  PHOTO_DOWNSCALE_FACTOR,
  PHOTO_HEIGHT_HARD_MAX,
  PHOTO_QUALITY_FLOOR,
  PHOTO_QUALITY_INITIAL,
  PHOTO_WIDTH_HARD_MAX,
} from '@echallan/contracts';

/**
 * E-02 / I-02 photo JPEG encoder.
 *
 * Approved policy (E-02 owner approval 2026-10-15): target approximately
 * 300 KB, hard maximum 800 KB. The target is soft and the hard maximum is
 * strict:
 *
 *  - the encoder tries to reach the target with quality reduction first,
 *    then proportional downscale;
 *  - the best result at or below the hard maximum is retained across
 *    attempts; when the target is unreachable within the attempt budget
 *    the best under-hard-maximum result is returned successfully (with
 *    its actual byte count reported so callers can disclose it);
 *  - `oversized_after_retry` is only returned when no attempt produced a
 *    result at or below the hard maximum.
 *
 * Width and height are scaled together (proportional scaling), and
 * factory / drawImage / toDataURL failures are caught per attempt and
 * surfaced as recoverable outcomes.
 */

export interface EncoderResult {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
}

export type EncodeOutcome =
  | { ok: true; result: EncoderResult }
  | { ok: false; reason: 'encoder_failed' | 'oversized_after_retry'; message: string };

type PaintTarget = {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
};

type CanvasFactory = (width: number, height: number) => PaintTarget;

export interface EncodeOptions {
  source: CanvasImageSource;
  sourceWidth: number;
  sourceHeight: number;
  factory: CanvasFactory;
}

export async function encodeJpegToBudget(options: EncodeOptions): Promise<EncodeOutcome> {
  if (options.sourceWidth <= 0 || options.sourceHeight <= 0) {
    return {
      ok: false,
      reason: 'encoder_failed',
      message: "Couldn't read the captured frame dimensions.",
    };
  }
  const initialScale = Math.min(
    1,
    PHOTO_WIDTH_HARD_MAX / options.sourceWidth,
    PHOTO_HEIGHT_HARD_MAX / options.sourceHeight,
  );
  let width = Math.max(1, Math.round(options.sourceWidth * initialScale));
  let height = Math.max(1, Math.round(options.sourceHeight * initialScale));
  let quality = PHOTO_QUALITY_INITIAL;
  let bestUnderHardMax: EncoderResult | null = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    let paint: PaintTarget;
    try {
      paint = options.factory(width, height);
      paint.context.drawImage(options.source, 0, 0, width, height);
    } catch {
      return {
        ok: false,
        reason: 'encoder_failed',
        message: "Couldn't paint the captured frame for compression.",
      };
    }

    let dataUrl: string;
    try {
      dataUrl = await canvasToDataUrl(paint.canvas, 'image/jpeg', quality);
    } catch {
      return {
        ok: false,
        reason: 'encoder_failed',
        message: "Couldn't encode the captured frame.",
      };
    }
    const bytes = dataUrlByteLength(dataUrl);
    // Happy path: at or under the 300 KB target.
    if (bytes <= PHOTO_BYTES_TARGET) {
      return { ok: true, result: { dataUrl, width, height, bytes } };
    }
    if (bytes <= PHOTO_BYTES_HARD_MAX) {
      // Approved policy: retain the best result at or below the hard
      // maximum. If the target turns out to be unreachable within the
      // attempt budget, this result is returned successfully with its
      // actual byte count.
      if (bestUnderHardMax === null || bytes < bestUnderHardMax.bytes) {
        bestUnderHardMax = { dataUrl, width, height, bytes };
      }
      if (quality > PHOTO_QUALITY_FLOOR + 0.01) {
        quality = Math.max(PHOTO_QUALITY_FLOOR, quality - 0.1);
        continue;
      }
      if (width <= 320 || height <= 240) {
        break;
      }
      width = Math.max(1, Math.round(width * PHOTO_DOWNSCALE_FACTOR));
      height = Math.max(1, Math.round(height * PHOTO_DOWNSCALE_FACTOR));
      quality = PHOTO_QUALITY_INITIAL;
      continue;
    }
    // Above the hard maximum: the target attempt chain continues until
    // the attempt budget or the minimum dimension is reached.
    if (width <= 320 || height <= 240) {
      break;
    }
    width = Math.max(1, Math.round(width * PHOTO_DOWNSCALE_FACTOR));
    height = Math.max(1, Math.round(height * PHOTO_DOWNSCALE_FACTOR));
    quality = PHOTO_QUALITY_INITIAL;
  }

  if (bestUnderHardMax !== null) {
    return { ok: true, result: bestUnderHardMax };
  }
  return {
    ok: false,
    reason: 'oversized_after_retry',
    message: `Couldn't compress the capture to ${formatBytes(PHOTO_BYTES_HARD_MAX)}.`,
  };
}

function canvasToDataUrl(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  type: string,
  quality: number,
): Promise<string> {
  if ('toDataURL' in canvas) {
    return Promise.resolve(canvas.toDataURL(type, quality));
  }
  return new Promise((resolve, reject) => {
    canvas
      .convertToBlob({ type: 'image/jpeg', quality })
      .then((blob) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('reader failed'));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
      })
      .catch((error) => reject(error));
  });
}

function dataUrlByteLength(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) return dataUrl.length;
  const base64 = dataUrl.slice(commaIndex + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function formatBytes(value: number): string {
  return `${Math.round(value / 1024)} KB`;
}
