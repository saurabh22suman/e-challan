import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import SyncStatusBar from '../features/sync/SyncStatusBar';
import { setSyncState } from '../features/sync/syncStatus';

/**
 * The sync store is a plain external store, so tone states can be driven
 * synchronously; no fake timers or network waits are involved.
 */

function toneSurface(): HTMLElement {
  const status = screen.getByRole('status');
  const surface = status.closest<HTMLElement>('[data-tone]');
  expect(surface).not.toBeNull();
  return surface as HTMLElement;
}

afterEach(() => {
  cleanup();
  act(() => {
    setSyncState('idle');
    window.dispatchEvent(new Event('online'));
  });
});

describe('SyncStatusBar semantic tones', () => {
  it('uses warning while offline and keeps the draft wording', () => {
    render(<SyncStatusBar />);

    act(() => {
      setSyncState('saved');
      window.dispatchEvent(new Event('offline'));
    });

    expect(toneSurface()).toHaveAttribute('data-tone', 'warning');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Offline — draft kept on this device. Issuance needs a connection.',
    );
  });

  it('uses info while sending and for a saved draft', () => {
    render(<SyncStatusBar />);

    act(() => setSyncState('sending'));
    expect(toneSurface()).toHaveAttribute('data-tone', 'info');
    expect(screen.getByRole('status')).toHaveTextContent('Sending challan…');

    act(() => setSyncState('saved'));
    expect(toneSurface()).toHaveAttribute('data-tone', 'info');
    expect(screen.getByRole('status')).toHaveTextContent('Draft saved on this device.');
  });

  it('uses success when sent and when online', () => {
    render(<SyncStatusBar />);

    act(() => setSyncState('sent'));
    expect(toneSurface()).toHaveAttribute('data-tone', 'success');
    expect(screen.getByRole('status')).toHaveTextContent('Challan sent to the server.');

    act(() => setSyncState('idle'));
    expect(toneSurface()).toHaveAttribute('data-tone', 'success');
    expect(screen.getByRole('status')).toHaveTextContent('Online');
  });

  it('uses danger for a failed send', () => {
    render(<SyncStatusBar />);

    act(() => setSyncState('error'));

    expect(toneSurface()).toHaveAttribute('data-tone', 'danger');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Send failed — your draft is still on this device.',
    );
  });
});
