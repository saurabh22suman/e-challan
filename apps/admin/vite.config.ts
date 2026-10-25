import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const DEFAULT_API_ORIGIN = 'http://127.0.0.1:3001';

const DEV_WATCHDOG = `(function () {
  if (!/^(127\\.0\\.0\\.1|localhost)$/.test(window.location.hostname)) return;
  var key = 'echallan.dev.boot-retry';
  var attempt = Number(window.sessionStorage.getItem(key) || '0');
  var handoffPending = window.location.hash.indexOf('handoff=') !== -1;
  window.setTimeout(function () {
    var root = document.getElementById('root');
    if (root && root.childElementCount > 0) {
      window.sessionStorage.removeItem(key);
      return;
    }
    if (!handoffPending && attempt < 1) {
      window.sessionStorage.setItem(key, String(attempt + 1));
      window.location.reload();
      return;
    }
    if (!root) return;
    root.innerHTML =
      '<main style="font:15px/1.5 sans-serif;max-width:520px;margin:12vh auto;padding:24px;border:1px solid #C9D4E2;border-radius:12px;background:#fff;color:#0E1D33">' +
      '<h1 style="font-size:22px;margin:0 0 8px">The app did not load</h1>' +
      '<p style="margin:0 0 16px;color:#445268">Reload the page. If it stays empty, restart the local Vite server so its module cache is rebuilt.</p>' +
      '<button style="min-height:44px;padding:0 18px;border:0;border-radius:10px;background:#0A4FAF;color:#fff;font:600 15px sans-serif" onclick="location.reload()">Reload</button>' +
      '</main>';
  }, handoffPending ? 8000 : 3000 + attempt * 2000);
})();`;

function devBootWatchdog(): Plugin {
  return {
    name: 'echallan-dev-boot-watchdog',
    apply: 'serve',
    transformIndexHtml() {
      return [{ tag: 'script', children: DEV_WATCHDOG, injectTo: 'head-prepend' }];
    },
  };
}

/**
 * /api is proxied so the browser only ever talks to the dev/preview origin;
 * the API origin itself is a non-secret, explicitly configured value
 * (VITE_API_ORIGIN in .env, see .env.example). The admin uses port 5174/4174
 * so it can run alongside the tablet dev server.
 */
export default defineConfig(({ mode }) => {
  // App-local .env wins over the workspace-root .env; both are optional.
  const env = { ...loadEnv(mode, '../../', 'VITE_'), ...loadEnv(mode, '.', 'VITE_') };
  const apiOrigin = env.VITE_API_ORIGIN ?? DEFAULT_API_ORIGIN;
  // The browser only ever calls same-origin /api/... ; the prefix is stripped
  // here because the API serves /health and /health/ready at the root. If the
  // API ever mounts under /api, delete this rewrite.
  const proxy = {
    '/api': {
      target: apiOrigin,
      changeOrigin: false,
      rewrite: (path: string) => path.replace(/^\/api/, ''),
    },
  };

  return {
    plugins: [react(), devBootWatchdog()],
    server: {
      host: '127.0.0.1',
      port: 5174,
      strictPort: true,
      proxy,
      hmr: { host: '127.0.0.1', protocol: 'ws' },
    },
    preview: { host: '127.0.0.1', port: 4174, strictPort: true, proxy },
    build: {
      outDir: 'dist',
      manifest: true,
    },
  };
});
