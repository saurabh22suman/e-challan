import { useSyncExternalStore } from 'react';

/**
 * Small external store for the tablet's honest sync/connection status.
 *
 * This is not an offline queue. It reports whether the tab is online and how far
 * the current draft/commit has got, so the marshal never has to guess whether
 * the challan was saved or sent.
 */
export type SyncState = 'idle' | 'saved' | 'sending' | 'sent' | 'error';

let syncState: SyncState = 'idle';
let online = typeof navigator === 'undefined' ? true : navigator.onLine;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function setSyncState(next: SyncState): void {
  if (next === syncState) return;
  syncState = next;
  emit();
}

function setOnline(next: boolean): void {
  if (next === online) return;
  online = next;
  emit();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => setOnline(true));
  window.addEventListener('offline', () => setOnline(false));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSyncStatus(): { state: SyncState; online: boolean } {
  const state = useSyncExternalStore(
    subscribe,
    () => syncState,
    () => syncState,
  );
  const isOnline = useSyncExternalStore(
    subscribe,
    () => online,
    () => online,
  );
  return { state, online: isOnline };
}
