import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SignaturePad as SignatureCapture } from '@echallan/contracts';
import SignaturePadControl from '../features/signature/SignaturePad';

/**
 * C2 correction acceptance (entry-media V1–V6 re-review, 2026-10-17).
 *
 * The reviewer requires that a new stroke after Confirm immediately
 * invalidates the parent's confirmed capture and any outstanding image
 * hydration, while preserving the visible strokes and the single stable
 * mount lifetime. `signature_pad` is replaced with a controllable fake so
 * the component's own invalidation logic is what is exercised;
 * real-browser canvas behaviour is covered by
 * `apps/tablet/e2e/entry-media-invalidation.spec.ts`.
 *
 * Read-only planner input. Do not replace, skip or weaken these assertions.
 */

interface FakePadLike {
  handlers: Record<string, () => void>;
  cleared: number;
  drawn: boolean;
  dataUrl: string;
}

const padState = vi.hoisted(() => ({ instances: [] as FakePadLike[] }));

vi.mock('signature_pad', () => {
  class FakeSignaturePad {
    handlers: Record<string, () => void> = {};
    cleared = 0;
    drawn = false;
    dataUrl = 'data:image/png;base64,QUJD';
    constructor() {
      padState.instances.push(this as unknown as FakePadLike);
    }
    addEventListener(name: string, handler: () => void) {
      this.handlers[name] = handler;
    }
    off() {}
    clear() {
      this.cleared += 1;
      this.drawn = false;
    }
    isEmpty() {
      return !this.drawn;
    }
    toDataURL() {
      return this.dataUrl;
    }
  }
  return { default: FakeSignaturePad };
});

afterEach(() => {
  cleanup();
  padState.instances.length = 0;
  vi.unstubAllGlobals();
});

const REVISION = 'c1c2-revision-1';

function currentPad(): FakePadLike {
  const pad = padState.instances[padState.instances.length - 1];
  if (pad === undefined) throw new Error('the signature pad instance was not created');
  return pad;
}

async function drawStroke(pad: FakePadLike, dataUrl: string) {
  pad.drawn = true;
  pad.dataUrl = dataUrl;
  await act(async () => {
    pad.handlers['beginStroke']?.();
    pad.handlers['endStroke']?.();
  });
}

describe('C2 signature confirmation invalidation', () => {
  it('notifies the parent that a confirmed capture is obsolete as soon as a new stroke is drawn', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SignaturePadControl summaryRevision={REVISION} onChange={onChange} />);
    const pad = currentPad();
    const clearsAfterMount = pad.cleared;

    await drawStroke(pad, 'data:image/png;base64,QUJD');
    await user.click(screen.getByTestId('signature-confirm'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toMatchObject({ dataUrl: 'data:image/png;base64,QUJD' });

    await drawStroke(pad, 'data:image/png;base64,QkI=');
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('signature-confirm')).toBeEnabled();

    await user.click(screen.getByTestId('signature-confirm'));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ dataUrl: 'data:image/png;base64,QkI=' }),
    );
    // Stable mount lifetime and preserved visible strokes: no remount and no
    // additional clear while the superseded confirmation is invalidated.
    expect(padState.instances).toHaveLength(1);
    expect(pad.cleared).toBe(clearsAfterMount);
  });

  it('drops a delayed image decode that settles after a new stroke', async () => {
    const ctx = {
      setTransform: vi.fn(),
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    const heldImages: Array<{ onload: (() => void) | null }> = [];
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private source = '';
      set src(value: string) {
        this.source = value;
        heldImages.push(this);
      }
      get src() {
        return this.source;
      }
    }
    vi.stubGlobal('Image', FakeImage);

    const user = userEvent.setup();
    const onChange = vi.fn();
    const initialCapture: SignatureCapture = {
      dataUrl: 'data:image/png;base64,QUFB',
      width: 8,
      height: 8,
      bytes: 3,
    };
    render(
      <SignaturePadControl
        summaryRevision={REVISION}
        initialCapture={initialCapture}
        onChange={onChange}
      />,
    );
    expect(heldImages).toHaveLength(1);

    const pad = currentPad();
    await drawStroke(pad, 'data:image/png;base64,QkI=');
    // The parent's confirmed capture is superseded as soon as the stroke
    // starts, even though its decode has not settled yet.
    expect(onChange).toHaveBeenCalledWith(null);
    ctx.drawImage.mockClear();
    ctx.clearRect.mockClear();

    const image = heldImages[0];
    if (image === undefined) throw new Error('hydration image was not requested');
    await act(async () => {
      image.onload?.();
    });
    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(ctx.clearRect).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('signature-confirm'));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ dataUrl: 'data:image/png;base64,QkI=' }),
    );
  });

  it('invalidates a restored parent capture after a remount when a stroke starts', async () => {
    const heldImages: Array<{ onload: (() => void) | null }> = [];
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private source = '';
      set src(value: string) {
        this.source = value;
        heldImages.push(this);
      }
      get src() {
        return this.source;
      }
    }
    vi.stubGlobal('Image', FakeImage);

    const onChange = vi.fn();
    const restored: SignatureCapture = {
      dataUrl: 'data:image/png;base64,QUFB',
      width: 8,
      height: 8,
      bytes: 3,
    };
    // The parent passes a confirmed capture back on the remounted pad.
    render(
      <SignaturePadControl
        summaryRevision={REVISION}
        initialCapture={restored}
        onChange={onChange}
      />,
    );
    const image = heldImages[0];
    if (image === undefined) throw new Error('hydration image was not requested');
    await act(async () => {
      image.onload?.();
    });
    // R2 planner revision: a restored parent capture is an existing
    // confirmation, so the pad shows the confirmed presentation and does not
    // invite a repeat confirm. The test's purpose is unchanged: a stroke on
    // the restored pad immediately invalidates the parent acknowledgement.
    expect(screen.getByText('Signature confirmed')).toBeInTheDocument();
    expect(screen.getByTestId('signature-confirm')).toBeDisabled();

    const pad = currentPad();
    await drawStroke(pad, 'data:image/png;base64,QkI=');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
