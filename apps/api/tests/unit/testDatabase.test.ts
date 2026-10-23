import { describe, expect, it } from 'vitest';
import { assertIsTestDatabase, parseDatabaseName } from '../../src/db/testDatabase.js';

const DEV_URL = 'postgresql://challan:challan@127.0.0.1:5432/echallan_demo';
const TEST_URL = 'postgresql://challan:challan@127.0.0.1:5433/echallan_test';

describe('parseDatabaseName', () => {
  it('extracts the database name from a PostgreSQL URL', () => {
    expect(parseDatabaseName(TEST_URL)).toBe('echallan_test');
    expect(parseDatabaseName(DEV_URL)).toBe('echallan_demo');
  });

  it('rejects a non-PostgreSQL or malformed URL', () => {
    expect(() => parseDatabaseName('not-a-url')).toThrow(/connection string/i);
    expect(() => parseDatabaseName('mysql://challan@127.0.0.1:5432/echallan_test')).toThrow(
      /connection string/i,
    );
    expect(() => parseDatabaseName('postgresql://challan@127.0.0.1:5432/')).toThrow(
      /database name/i,
    );
  });
});

describe('assertIsTestDatabase', () => {
  it('accepts the isolated local test database', () => {
    expect(assertIsTestDatabase(TEST_URL)).toBe('echallan_test');
  });

  it('accepts any database name ending in _test', () => {
    expect(assertIsTestDatabase('postgresql://challan@127.0.0.1:5433/anything_test')).toBe(
      'anything_test',
    );
  });

  it('refuses the development/demo database', () => {
    expect(() => assertIsTestDatabase(DEV_URL)).toThrow(/echallan_demo/);
  });

  it('refuses an unrelated database name', () => {
    expect(() =>
      assertIsTestDatabase('postgresql://challan@127.0.0.1:5433/random_database'),
    ).toThrow(/_test/);
  });
});
