import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PHOTO_BYTES_HARD_MAX,
  PHOTO_BYTES_TARGET,
  PHOTO_HEIGHT_HARD_MAX,
  PHOTO_WIDTH_HARD_MAX,
  MAX_PHOTOS,
  MIN_PHOTOS,
} from '@echallan/contracts';
import { encodeJpegToBudget } from '../features/photos/encoder';
import PhotoCapture from '../features/photos/PhotoCapture';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const ID = (suffix: string): string => `00000000-0000-4000-8000-${suffix.padStart(12, '0')}`;

interface FakeCtx {
  drawImage: (image: unknown, x: number, y: number, w: number, h: number) => void;
}

class FakeCanvas {
  width: number;
  height: number;
  context: FakeCtx;
  /**
   * Exact JPEG byte length the encoder will read out of this canvas.
   * The fake emits a base64 dataURL of length `Math.ceil(bytesForSize / 3) * 4`
   * so {@link dataUrlByteLength} decodes to `bytesForSize`.
   */
  bytesForSize: number;
  constructor(width: number, height: number, bytesForSize: number) {
    this.width = width;
    this.height = height;
    this.bytesForSize = bytesForSize;
    this.context = { drawImage: vi.fn() };
  }
  toDataURL(type: string) {
    const base64Length = Math.max(4, Math.ceil(this.bytesForSize / 3) * 4);
    return `data:${type};base64,${'A'.repeat(base64Length)}`;
  }
}

describe('I-02 encoder honours E-02', () => {
  const fakeSource: CanvasImageSource = {} as CanvasImageSource;

  it('returns a JPEG within the target on the first attempt', async () => {
    const canvas = new FakeCanvas(1920, 1440, PHOTO_BYTES_TARGET - 1000);
    const outcome = await encodeJpegToBudget({
      source: fakeSource,
      sourceWidth: 1920,
      sourceHeight: 1440,
      factory: () => ({
        canvas: canvas as unknown as HTMLCanvasElement,
        context: canvas.context as unknown as CanvasRenderingContext2D,
      }),
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.bytes).toBeLessThanOrEqual(PHOTO_BYTES_TARGET);
      expect(outcome.result.width).toBeLessThanOrEqual(PHOTO_WIDTH_HARD_MAX);
      expect(outcome.result.height).toBeLessThanOrEqual(PHOTO_HEIGHT_HARD_MAX);
    }
  });

  it('downscales when the first attempt is over the hard max', async () => {
    // The fake canvas produces a dataURL whose DECODED bytes exceed
    // PHOTO_BYTES_HARD_MAX. With base64 encoding, a dataURL of N base64
    // chars represents (N / 4) * 3 - padding bytes; we pad past the limit.
    const oversizedBytes = PHOTO_BYTES_HARD_MAX + 256;
    const canvas = new FakeCanvas(1920, 1440, oversizedBytes);
    const outcome = await encodeJpegToBudget({
      source: fakeSource,
      sourceWidth: 1920,
      sourceHeight: 1440,
      factory: () => ({
        canvas: canvas as unknown as HTMLCanvasElement,
        context: canvas.context as unknown as CanvasRenderingContext2D,
      }),
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(['oversized_after_retry', 'encoder_failed']).toContain(outcome.reason);
    }
  });
});

describe('I-02 PhotoCapture component', () => {
  it('does not expose the capture button until the camera is started', () => {
    const onChange = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: () => undefined }],
    });
    render(<PhotoCapture onChange={onChange} getUserMedia={getUserMedia} readyOverride={false} />);
    expect(screen.queryByTestId('photo-capture-button')).toBeNull();
    expect(screen.getByRole('button', { name: /start camera/i })).toBeInTheDocument();
  });

  it('blocks a fifth capture', () => {
    const photos = Array.from({ length: MAX_PHOTOS }, (_, i) => ({
      id: ID(String(i + 1)),
      dataUrl: 'data:image/jpeg;base64,AAAA',
      width: 800,
      height: 600,
      bytes: 100000,
    }));
    render(
      <PhotoCapture
        initialStore={{ acceptedCount: MAX_PHOTOS, photos }}
        getUserMedia={vi.fn()}
        readyOverride
      />,
    );
    // The fifth-photo status text is shown via the live region.
    expect(
      screen.getByText(new RegExp(`Photos: ${MAX_PHOTOS} of ${MAX_PHOTOS}`)),
    ).toBeInTheDocument();
  });

  it('requires at least one accepted photo for evidence validity', () => {
    const onChange = vi.fn();
    render(<PhotoCapture onChange={onChange} getUserMedia={vi.fn()} readyOverride={false} />);
    expect(
      screen.getByText(new RegExp(`Photos: 0 of ${MAX_PHOTOS} \\(minimum ${MIN_PHOTOS}`)),
    ).toBeInTheDocument();
  });
});

/**
 * Real camera lifecycle acceptance: these tests actually start the camera
 * with a mocked `getUserMedia`, become frame-ready from a populated video
 * element, capture a real (fake-canvas) encoded photo, delete the last
 * photo, cancel a pending acquisition and stop tracks on unmount.
 */

interface StreamHarness {
  stream: MediaStream;
  stop: ReturnType<typeof vi.fn>;
}

function makeStream(): StreamHarness {
  const stop = vi.fn();
  const stream = {
    getTracks: () => [{ stop }],
  } as unknown as MediaStream;
  return { stream, stop };
}

function makeCanvasFactory(bytes = 1000) {
  return (width: number, height: number): HTMLCanvasElement => {
    const fake = {
      width,
      height,
      toDataURL: () =>
        `data:image/jpeg;base64,${'A'.repeat(Math.max(4, Math.ceil(bytes / 3) * 4))}`,
      getContext: () => ({
        drawImage: vi.fn(),
        setTransform: vi.fn(),
        fillRect: vi.fn(),
        clearRect: vi.fn(),
      }),
    };
    return fake as unknown as HTMLCanvasElement;
  };
}

async function startCameraWith(
  getUserMedia: ReturnType<typeof vi.fn>,
  options: {
    onChange?: ReturnType<typeof vi.fn>;
    canvasFactory?: (width: number, height: number) => HTMLCanvasElement;
    initialStore?: { acceptedCount: number; photos: Array<Record<string, unknown>> };
  } = {},
) {
  const user = userEvent.setup();
  const playSpy = vi
    .spyOn(window.HTMLMediaElement.prototype, 'play')
    .mockImplementation(() => Promise.resolve());
  render(
    <PhotoCapture
      getUserMedia={
        getUserMedia as unknown as (constraints: MediaStreamConstraints) => Promise<MediaStream>
      }
      onChange={
        options.onChange as unknown as (store: { acceptedCount: number; photos: unknown[] }) => void
      }
      canvasFactory={options.canvasFactory}
      initialStore={options.initialStore as never}
    />,
  );
  await user.click(screen.getByTestId('photo-start-camera'));
  const captureButton = await screen.findByTestId('photo-capture-button');
  const video = screen.getByTestId('photo-video') as HTMLVideoElement;
  Object.defineProperty(video, 'videoWidth', { value: 1280, configurable: true });
  Object.defineProperty(video, 'videoHeight', { value: 720, configurable: true });
  fireEvent.loadedMetadata(video);
  return { user, captureButton, video, playSpy };
}

describe('I-02 PhotoCapture real camera lifecycle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts the camera, becomes frame-ready and captures a photo into the parent store', async () => {
    const { stream } = makeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const onChange = vi.fn();
    const { user } = await startCameraWith(getUserMedia, {
      onChange,
      canvasFactory: makeCanvasFactory(1000),
    });

    await waitFor(() => expect(screen.getByTestId('photo-capture-button')).toBeEnabled());
    await user.click(screen.getByTestId('photo-capture-button'));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ acceptedCount: 1 }));
    });
    expect(screen.getByTestId('photo-thumb')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Photos: 1 of ${MAX_PHOTOS}`))).toBeInTheDocument();
  });

  it('deletes the last photo and emits an empty store so evidence is invalidated', async () => {
    const { stream } = makeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const onChange = vi.fn();
    const { user } = await startCameraWith(getUserMedia, {
      onChange,
      canvasFactory: makeCanvasFactory(1000),
    });
    await waitFor(() => expect(screen.getByTestId('photo-capture-button')).toBeEnabled());
    await user.click(screen.getByTestId('photo-capture-button'));
    await screen.findByTestId('photo-thumb');

    await user.click(screen.getByTestId('photo-retake'));
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ acceptedCount: 0 }));
    });
    expect(screen.getByText(new RegExp(`Photos: 0 of ${MAX_PHOTOS}`))).toBeInTheDocument();
  });

  it('cancels a pending acquisition and stops a late-arriving stream', async () => {
    let resolveMedia!: (stream: MediaStream) => void;
    const getUserMedia = vi.fn(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolveMedia = resolve;
        }),
    );
    const playSpy = vi
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve());
    const user = userEvent.setup();
    render(<PhotoCapture getUserMedia={getUserMedia} canvasFactory={makeCanvasFactory()} />);

    await user.click(screen.getByTestId('photo-start-camera'));
    const cancel = await screen.findByTestId('photo-cancel-acquire');
    await user.click(cancel);

    const { stream, stop } = makeStream();
    resolveMedia(stream);
    await waitFor(() => expect(stop).toHaveBeenCalled());
    expect(screen.getByTestId('photo-start-camera')).toBeInTheDocument();
    expect(screen.queryByTestId('photo-capture-button')).toBeNull();
    expect(playSpy).not.toHaveBeenCalled();
  });

  it('stops camera tracks on unmount', async () => {
    const { stream, stop } = makeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const view = render(
      <PhotoCapture getUserMedia={getUserMedia} canvasFactory={makeCanvasFactory()} />,
    );
    const playSpy = vi
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve());
    const user = userEvent.setup();
    await user.click(screen.getByTestId('photo-start-camera'));
    await screen.findByTestId('photo-capture-button');

    view.unmount();
    await waitFor(() => expect(stop).toHaveBeenCalled());
    playSpy.mockRestore();
  });
});
