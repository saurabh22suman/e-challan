#!/usr/bin/env node
/**
 * Initial-JavaScript budget gate for the marshal tablet PWA.
 *
 * Usage: node tools/check-tablet-size.mjs [--dist <directory>] [--budget <bytes>]
 *
 * Reads the Vite build manifest (`<dist>/.vite/manifest.json`), selects the
 * initial entry chunk, walks its *static* import graph, gzips every unique
 * initial JavaScript asset and sums the results. Lazy (dynamic) route chunks are
 * excluded, because they are not part of the initial payload.
 *
 * Fails when the total is >= the 250000-byte budget, when the manifest is missing
 * or malformed, or when an asset referenced by the manifest is missing. Always
 * reports the measured initial bytes and the threshold.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const DEFAULT_BUDGET_BYTES = 250_000;

function parseArguments(argv) {
  let dist = path.resolve('apps/tablet/dist');
  let budget = DEFAULT_BUDGET_BYTES;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dist') {
      const value = argv[index + 1];
      if (value === undefined) throw new Error('--dist requires a directory');
      dist = path.resolve(value);
      index += 1;
    } else if (argument.startsWith('--dist=')) {
      dist = path.resolve(argument.slice('--dist='.length));
    } else if (argument === '--budget') {
      const value = argv[index + 1];
      if (value === undefined) throw new Error('--budget requires a byte count');
      budget = Number.parseInt(value, 10);
      index += 1;
    } else if (argument.startsWith('--budget=')) {
      budget = Number.parseInt(argument.slice('--budget='.length), 10);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!Number.isInteger(budget) || budget <= 0)
    throw new Error(`Invalid --budget value: ${budget}`);
  return { dist, budget };
}

function readManifest(dist) {
  const manifestPath = path.join(dist, '.vite', 'manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing Vite manifest: ${manifestPath} (run the production build first)`);
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid/malformed Vite manifest ${manifestPath}: ${error.message}`, {
      cause: error,
    });
  }
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error(`Invalid/malformed Vite manifest ${manifestPath}: expected an object`);
  }
  return manifest;
}

function manifestEntryFile(entry, key) {
  const file = entry?.file;
  if (typeof file !== 'string' || file === '') {
    throw new Error(`Invalid manifest entry "${key}": missing "file"`);
  }
  return file;
}

function entryChunks(manifest) {
  const chunks = manifest;
  const entries = [];
  for (const [key, value] of Object.entries(chunks)) {
    if (value && typeof value === 'object' && value.isEntry === true) entries.push(key);
  }
  if (entries.length === 0) {
    throw new Error('Invalid manifest: no chunk is marked "isEntry"; cannot identify initial JS');
  }
  return entries;
}

function gzipSize(file) {
  return gzipSync(readFileSync(file), { level: 9 }).byteLength;
}

/**
 * Walk the static import graph from the initial entries, deduplicating by
 * manifest key and asset path. Dynamic imports are intentionally not followed.
 */
function collectInitialChunks(manifest, entries) {
  const visitedKeys = new Set();
  const visitedFiles = new Set();
  const queue = [...entries];
  while (queue.length > 0) {
    const key = queue.shift();
    if (visitedKeys.has(key)) continue;
    visitedKeys.add(key);
    const entry = manifest[key];
    if (entry === undefined || entry === null || typeof entry !== 'object') {
      throw new Error(
        `Invalid manifest: entry "${key}" referenced by the initial graph is missing`,
      );
    }
    const file = manifestEntryFile(entry, key);
    if (!visitedFiles.has(file)) {
      visitedFiles.add(file);
      const imports = entry.imports;
      if (imports !== undefined) {
        if (!Array.isArray(imports)) {
          throw new Error(`Invalid manifest: entry "${key}" has a non-array "imports"`);
        }
        for (const imported of imports) {
          if (typeof imported !== 'string') {
            throw new Error(`Invalid manifest: entry "${key}" has a non-string import reference`);
          }
          if (!visitedKeys.has(imported)) queue.push(imported);
        }
      }
    }
  }
  return [...visitedFiles];
}

function main() {
  const { dist, budget } = parseArguments(process.argv.slice(2));
  const manifest = readManifest(dist);
  const entries = entryChunks(manifest);
  const chunks = collectInitialChunks(manifest, entries);

  let total = 0;
  const measured = [];
  for (const file of chunks) {
    const absolute = path.join(dist, file);
    if (!existsSync(absolute)) {
      throw new Error(`Missing initial asset referenced by the manifest: ${absolute}`);
    }
    const bytes = gzipSize(absolute);
    measured.push({ file, bytes });
    total += bytes;
  }

  for (const { file, bytes } of measured) {
    process.stdout.write(`  ${file}: ${bytes} B gzip\n`);
  }
  process.stdout.write(
    `check:tablet-size: initial JS ${total} B gzip across ${chunks.length} asset(s) ` +
      `(threshold ${budget} B, entry ${entries.join(', ')})\n`,
  );

  if (total >= budget) {
    process.stderr.write(
      `check:tablet-size: BUDGET EXCEEDED: initial JS ${total} B gzip is not below the ${budget} B budget\n`,
    );
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `check:tablet-size: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
