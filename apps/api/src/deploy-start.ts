import { migrateDevelopmentDatabase } from './db/migrate.js';
import { seedEnvUsersFromEnvironment } from './db/seed-env-users.js';

/**
 * Container entry point: migrate, bootstrap the env-named accounts, then start
 * the API. A migration or bootstrap failure stops the container instead of
 * serving traffic against an unprepared database.
 *
 * The local `start` script still runs `server.js` directly; this path is for a
 * fresh deployment where the schema and login rows may not exist yet.
 */
async function main(): Promise<void> {
  console.log('deploy-start: applying database migrations');
  await migrateDevelopmentDatabase();

  console.log('deploy-start: bootstrapping environment-named accounts');
  const result = await seedEnvUsersFromEnvironment();
  console.log(
    `deploy-start: ${result.created} account(s) created, ${result.existing} already present`,
  );

  if (process.env['SEED_DEMO_DATA'] === 'true') {
    console.log('deploy-start: loading the synthetic demo domain');
    const { seedDeploymentDemo } = await import('./db/seed-demo-deploy.js');
    const seeded = await seedDeploymentDemo();
    const assigned = seeded.assignments.filter((item) => item.reason === 'assigned').length;
    console.log(
      `deploy-start: demo seed complete; ${assigned} environment account(s) assigned a location`,
    );
  }

  await import('./server.js');
}

await main();
