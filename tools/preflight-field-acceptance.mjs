#!/usr/bin/env node
/**
 * Field-acceptance lab preflight.
 *
 * Usage: node tools/preflight-field-acceptance.mjs --base <origin>
 *
 * Checks network/API/catalogue/asset readiness against the target origin before
 * a device or representative-user session. It cannot check the camera, gloves,
 * sunlight, rotation hardware, signature feel or human comprehension.
 *
 * Exits non-zero on FAIL. WARN findings need a conductor decision and must be
 * recorded in the session notes.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const MASTER_KINDS = [
  'violation-types',
  'departments',
  'contractors',
  'locations',
  'gates',
  'vehicle-types',
];

const ASSET_BYTES = {
  'welcome-full.webp': 35418,
  'check-details.webp': 27228,
  'processing.webp': 25870,
  'success.webp': 26860,
  'error.webp': 25970,
  'connection.webp': 36794,
};

function parseArgs(argv) {
  let base = 'http://127.0.0.1:5173';
  let timeoutMs = 15000;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--base') {
      base = argv[index + 1];
      index += 1;
    } else if (argument.startsWith('--base=')) {
      base = argument.slice('--base='.length);
    } else if (argument === '--timeout') {
      timeoutMs = Number.parseInt(argv[index + 1], 10);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return { base: base.replace(/\/+$/, ''), timeoutMs };
}

function loadCredentials() {
  const fixturePath = path.join(ROOT, 'tests/fixtures/f02-demo-credentials.json');
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')).marshal;
  return {
    username: process.env.DEMO_MARSHAL_USERNAME ?? fixture.username,
    password: process.env.DEMO_MARSHAL_PASSWORD ?? fixture.password,
  };
}

const results = [];

function record(status, name, detail = '') {
  results.push({ status, name, detail });
  const line = `${status.padEnd(4)} ${name}${detail === '' ? '' : ` — ${detail}`}`;
  process.stdout.write(`${line}\n`);
}

async function request(url, init, timeoutMs) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  return response;
}

async function checkBase({ base, timeoutMs }) {
  const url = new URL(base);
  const local =
    url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  if (url.protocol === 'https:') {
    record('PASS', 'trusted HTTPS origin', base);
  } else if (local) {
    record('WARN', 'secure context', `${base} is localhost (browser-secure but not trusted HTTPS)`);
  } else {
    record('FAIL', 'secure context', `${base} is HTTP on a network host; camera will be blocked`);
  }

  const response = await request(base, {}, timeoutMs);
  const html = await response.text();
  if (response.ok && html.includes('id="root"')) {
    record('PASS', 'tablet HTML reachable', `HTTP ${response.status}`);
  } else {
    record('FAIL', 'tablet HTML reachable', `HTTP ${response.status}`);
  }
}

async function checkHealth({ base, timeoutMs }) {
  for (const endpoint of ['/api/health', '/api/health/ready']) {
    try {
      const response = await request(`${base}${endpoint}`, {}, timeoutMs);
      record(
        response.ok ? 'PASS' : 'FAIL',
        `API ${endpoint}`,
        `HTTP ${response.status} ${(await response.text()).slice(0, 80)}`,
      );
    } catch (error) {
      record('FAIL', `API ${endpoint}`, error instanceof Error ? error.message : String(error));
    }
  }
}

async function checkSession({ base, timeoutMs }, credentials) {
  let token;
  try {
    const login = await request(
      `${base}/api/auth/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      },
      timeoutMs,
    );
    const body = await login.json();
    token = typeof body.token === 'string' ? body.token : null;
    record(
      login.status === 200 && token ? 'PASS' : 'FAIL',
      'synthetic marshal login',
      `HTTP ${login.status}`,
    );
  } catch (error) {
    record(
      'FAIL',
      'synthetic marshal login',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }

  try {
    const session = await request(
      `${base}/api/auth/session`,
      { headers: { Authorization: `Bearer ${token}` } },
      timeoutMs,
    );
    const body = await session.json();
    const role = body?.user?.role;
    record(
      session.ok && role === 'Marshal' ? 'PASS' : 'FAIL',
      'session identity is Marshal',
      `HTTP ${session.status} role ${role ?? 'missing'}`,
    );
  } catch (error) {
    record(
      'FAIL',
      'session identity is Marshal',
      error instanceof Error ? error.message : String(error),
    );
  }
  return token;
}

async function checkCatalogues({ base, timeoutMs }, token) {
  if (!token) {
    record('FAIL', 'catalogue endpoints', 'skipped: no session token');
    return;
  }
  for (const kind of MASTER_KINDS) {
    try {
      const response = await request(
        `${base}/api/masters/${kind}`,
        { headers: { Authorization: `Bearer ${token}` } },
        timeoutMs,
      );
      const body = await response.json();
      const active = Array.isArray(body?.masters)
        ? body.masters.filter((record) => record.isActive === true).length
        : -1;
      const ok = response.ok && body?.kind === kind && active >= 0;
      record(
        ok ? 'PASS' : 'FAIL',
        `catalogue ${kind}`,
        `HTTP ${response.status}, ${active} active`,
      );
    } catch (error) {
      record('FAIL', `catalogue ${kind}`, error instanceof Error ? error.message : String(error));
    }
  }
}

async function checkAssets({ base, timeoutMs }) {
  for (const [name, expectedBytes] of Object.entries(ASSET_BYTES)) {
    try {
      const response = await request(`${base}/characters/${name}`, {}, timeoutMs);
      const bytes = (await response.arrayBuffer()).byteLength;
      const ok = response.ok && bytes === expectedBytes;
      record(ok ? 'PASS' : 'FAIL', `asset ${name}`, `HTTP ${response.status}, ${bytes} B`);
    } catch (error) {
      record('FAIL', `asset ${name}`, error instanceof Error ? error.message : String(error));
    }
  }
}

async function main() {
  const { base, timeoutMs } = parseArgs(process.argv.slice(2));
  const credentials = loadCredentials();
  process.stdout.write(`Field-acceptance preflight against ${base}\n\n`);

  await checkBase({ base, timeoutMs });
  await checkHealth({ base, timeoutMs });
  const token = await checkSession({ base, timeoutMs }, credentials);
  await checkCatalogues({ base, timeoutMs }, token);
  await checkAssets({ base, timeoutMs });

  const failures = results.filter((result) => result.status === 'FAIL');
  const warnings = results.filter((result) => result.status === 'WARN');
  process.stdout.write(
    `\n${results.length - failures.length - warnings.length} PASS, ${warnings.length} WARN, ${failures.length} FAIL\n`,
  );
  process.stdout.write(
    '\nThis preflight cannot verify the rear camera, gloves, sunlight, rotation\n' +
      'hardware, signature feel or human comprehension. Those require\n' +
      'device-checklist.md and scenarios.md. It is not device/user acceptance.\n',
  );
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(
    `preflight failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
