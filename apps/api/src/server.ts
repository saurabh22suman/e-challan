import { createApp } from './app.js';
import { loadDemoCredentials } from './auth/config.js';
import { createDb } from './db/client.js';
import { getEnv } from './env.js';

/**
 * API process entry point (`pnpm --filter @echallan/api run dev` / `start`).
 *
 * Binds HOST (127.0.0.1 by default, 0.0.0.0 in containers), closes the database
 * pool on SIGINT/SIGTERM, and exits non-zero when it cannot listen.
 *
 * Demo credentials are validated **fatally** here: a missing, blank or ambiguous
 * `DEMO_*` configuration stops the process rather than starting an API that would
 * silently refuse every login. The app factory's fail-closed behaviour is a test
 * seam, never the production path.
 */
async function main(): Promise<void> {
  const env = getEnv();
  const credentials = loadDemoCredentials(process.env);
  const db = createDb(env.DATABASE_URL);
  const app = createApp({ db, credentials, logger: { level: 'info' } });
  app.log.info({ port: env.PORT }, 'starting @echallan/api');

  let closing = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, 'shutting down');
    app
      .close()
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        app.log.error({ err: error }, 'shutdown failed');
        process.exit(1);
      });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (error) {
    app.log.error({ err: error }, 'failed to listen');
    process.exitCode = 1;
    process.exit(1);
  }
}

await main();
