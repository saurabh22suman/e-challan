import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { capturePwaInstallPrompt } from '@echallan/theme';
import App from './App';
import { exchangeHandoff } from './auth/api';
import { ADMIN_SESSION_STORAGE_KEY } from './auth/session';

const HANDOFF_PREFIX = '#handoff=';

capturePwaInstallPrompt();

/** Read a one-time handoff code from the fragment, if this load carries one. */
function readHandoffCode(): string | null {
  if (!window.location.hash.startsWith(HANDOFF_PREFIX)) return null;
  return decodeURIComponent(window.location.hash.slice(HANDOFF_PREFIX.length));
}

/**
 * Consume a handoff from the tablet before the React tree starts. The code is
 * exchanged for a dashboard session, stored under the dashboard key, and removed
 * from the URL so it cannot be replayed from history.
 */
async function consumeHandoff(): Promise<void> {
  const code = readHandoffCode();
  if (code === null) return;

  let failed = false;
  try {
    const result = await exchangeHandoff(code);
    window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, result.token);
  } catch {
    failed = true;
  }

  const url = new URL(window.location.href);
  url.hash = '';
  if (failed) url.searchParams.set('handoff', 'failed');
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

async function boot(): Promise<void> {
  await consumeHandoff();

  const container = document.getElementById('root');
  if (!container) {
    throw new Error('Root container #root is missing from index.html');
  }

  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  // The shell worker is production-only: it must never cache Vite's dev modules.
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      void navigator.serviceWorker.register('/sw.js').catch(() => {
        /* installability degrades quietly; the dashboard still works online */
      });
    });
  }
}

void boot();
