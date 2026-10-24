import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { capturePwaInstallPrompt } from '@echallan/theme';
import App from './App';
import { exchangeHandoff, SESSION_STORAGE_KEY } from './auth/api';
import { dashboardLoginUrl } from './auth/HandoffToAdmin';

const HANDOFF_PREFIX = '#handoff=';

capturePwaInstallPrompt();

/** Read a one-time handoff code from the fragment, if this load carries one. */
function readHandoffCode(): string | null {
  if (!window.location.hash.startsWith(HANDOFF_PREFIX)) return null;
  return decodeURIComponent(window.location.hash.slice(HANDOFF_PREFIX.length));
}

/**
 * Consume a handoff from the dashboard before the React tree starts. The code is
 * exchanged for a tablet session, stored under the tablet key, and removed from
 * the URL so it cannot be replayed from history.
 */
async function consumeHandoff(): Promise<void> {
  const code = readHandoffCode();
  if (code === null) return;

  let failed = false;
  try {
    const result = await exchangeHandoff(code);
    window.localStorage.setItem(SESSION_STORAGE_KEY, result.token);
  } catch {
    failed = true;
  }

  const url = new URL(window.location.href);
  url.hash = '';
  if (failed) {
    const loginUrl = dashboardLoginUrl();
    if (loginUrl !== null) {
      window.location.replace(`${loginUrl}?handoff=failed`);
      return;
    }
    url.searchParams.set('handoff', 'failed');
  }
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
        /* installability degrades quietly; online issuance still works */
      });
    });
  }
}

void boot();
