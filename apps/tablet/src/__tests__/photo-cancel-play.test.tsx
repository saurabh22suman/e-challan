import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PhotoCapture from '../features/photos/PhotoCapture';

/**
 * C1 correction acceptance (entry-media V1–V6 re-review, 2026-10-17).
 *
 * Reviewer reproduction adopted from
 * `docs/reviews/entry-media-cancel-play-probe.txt` without weakening its
 * immediate-stop assertion: `getUserMedia` resolves, `video.play()` is held
 * pending, and Cancel must stop the acquired tracks and detach the video
 * immediately — not only once the pending `play()` settles. The late
 * settlement must then be discarded without disturbing a later acquisition.
 *
 * Read-only planner input. Do not replace, skip or weaken these assertions.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeStream() {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  return { stream, stop };
}

/**
 * Holds the first `play()` call pending and resolves every later call
 * immediately, so one render can exercise both the pending-play cancel and a
 * normal re-open.
 */
function holdFirstPlay() {
  let finishPlay: (() => void) | null = null;
  const play = vi
    .spyOn(window.HTMLMediaElement.prototype, 'play')
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishPlay = () => resolve();
        }),
    )
    .mockImplementation(() => Promise.resolve());
  return {
    play,
    finishPlay: () => {
      if (finishPlay === null) throw new Error('play() was never called');
      finishPlay();
    },
  };
}

describe('C1 acquired-camera cancellation during a pending play()', () => {
  it('stops the acquired stream and detaches the video immediately on Cancel', async () => {
    const { play, finishPlay } = holdFirstPlay();
    const { stream, stop } = makeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const user = userEvent.setup();
    render(<PhotoCapture getUserMedia={getUserMedia} />);

    await user.click(screen.getByTestId('photo-start-camera'));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    const video = screen.getByTestId('photo-video') as HTMLVideoElement;
    expect(video.srcObject).toBe(stream);

    try {
      await user.click(screen.getByTestId('photo-cancel-acquire'));
      expect(stop).toHaveBeenCalled();
      expect(video.srcObject).toBeNull();
      expect(screen.queryByTestId('photo-capture-button')).toBeNull();
      expect(screen.getByTestId('photo-start-camera')).toBeInTheDocument();
    } finally {
      finishPlay();
    }
  });

  it('discards the late play settlement and allows a normal re-open', async () => {
    const { play, finishPlay } = holdFirstPlay();
    const first = makeStream();
    const second = makeStream();
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(first.stream)
      .mockResolvedValueOnce(second.stream);
    const user = userEvent.setup();
    render(<PhotoCapture getUserMedia={getUserMedia} />);

    await user.click(screen.getByTestId('photo-start-camera'));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    await user.click(screen.getByTestId('photo-cancel-acquire'));
    expect(first.stop).toHaveBeenCalled();
    finishPlay();

    await user.click(screen.getByTestId('photo-start-camera'));
    await screen.findByTestId('photo-capture-button');
    const video = screen.getByTestId('photo-video') as HTMLVideoElement;
    expect(video.srcObject).toBe(second.stream);
    expect(second.stop).not.toHaveBeenCalled();
    expect(play).toHaveBeenCalledTimes(2);
  });
});
