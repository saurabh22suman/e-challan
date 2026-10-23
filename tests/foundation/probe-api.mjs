// Planner-owned black-box API smoke probe; run after app + local DB are started.
import assert from 'node:assert/strict';

const origin = process.env.API_ORIGIN ?? 'http://127.0.0.1:3001';
for (const [path, expected] of [
  ['/health', { status: 'ok' }],
  ['/health/ready', { status: 'ok', database: 'ok' }],
]) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200, `${path} must return 200`);
  const body = await response.json();
  assert.deepEqual(body, expected, `${path}: response contract`);
}
console.log('PASS: API liveness/readiness response smoke; persistence and DB-down proof are separate checks.');
