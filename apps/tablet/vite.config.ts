import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const DEFAULT_API_ORIGIN = 'http://127.0.0.1:3001';

/**
 * /api is proxied so the browser only ever talks to the dev/preview origin;
 * the API origin itself is a non-secret, explicitly configured value
 * (VITE_API_ORIGIN in .env, see .env.example).
 */
export default defineConfig(({ mode }) => {
  // App-local .env wins over the workspace-root .env; both are optional.
  const env = { ...loadEnv(mode, '../../', 'VITE_'), ...loadEnv(mode, '.', 'VITE_') };
  const apiOrigin = env.VITE_API_ORIGIN ?? DEFAULT_API_ORIGIN;
  // Production is one origin with the tablet under /tablet/. Development keeps
  // the tablet at the origin root so the existing Vite servers and journeys work.
  const configuredBase = process.env['VITE_BASE_PATH'] ?? env.VITE_BASE_PATH;
  const base =
    typeof configuredBase === 'string' && configuredBase.trim() !== '' ? configuredBase : '/';
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
    base,
    plugins: [react()],
    server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true, proxy },
    build: {
      outDir: 'dist',
      // check:tablet-size reads .vite/manifest.json to measure the initial JS.
      manifest: true,
    },
  };
});
