import { resolveTestDatabaseUrl } from './helpers/testTarget.js';

// Fail the whole integration project before any test runs if the test database
// is unset or unguarded. This must throw, never silently skip.
resolveTestDatabaseUrl();
