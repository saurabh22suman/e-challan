import { useSyncExternalStore } from 'react';

/**
 * Session-scoped unsent state for the tablet.
 *
 * PRD E1.3 requires the tablet to return to login after 10 idle minutes **and to
 * clear unsent state**. Keeping that state in a session-scoped store (rather than
 * in a component or in `localStorage`) is what makes "cleared" mean cleared: the
 * store is emptied when the session ends, so re-authenticating cannot restore a
 * half-entered challan.
 *
 * The challan draft itself arrives with the issuance feature (I-01); today this
 * holds only the foundation screen's in-progress input, and no draft is claimed.
 */

const listeners = new Set<() => void>();

/** Session-tab draft key; cleared on logout/idle and after successful reset. */
export const TABLET_DRAFT_STORAGE_KEY = 'echallan.tablet.draft-v1';

/** Initial demo value for the foundation screen's scratch field. */
let draft = 'GP-01';

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getUnsentState(): string {
  return draft;
}

export function setUnsentState(value: string): void {
  if (value === draft) return;
  draft = value;
  emit();
}

/** Discard every unsent value. Called on logout and on idle logout. */
export function clearUnsentState(): void {
  setUnsentState('');
  try {
    window.sessionStorage.removeItem(TABLET_DRAFT_STORAGE_KEY);
  } catch {
    /* storage unavailable: nothing to clear */
  }
}

/** Subscribe a component to the session-scoped unsent value. */
export function useUnsentState(): [string, (value: string) => void] {
  const value = useSyncExternalStore(subscribe, getUnsentState, getUnsentState);
  return [value, setUnsentState];
}
