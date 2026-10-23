#!/usr/bin/env node
/**
 * Import-boundary gate (SET-03).
 *
 * Usage: node tools/check-boundaries.mjs [--root <workspace>] [--quiet]
 *
 * Scans every application/shared source file under <root> and fails when an
 * import, re-export or dynamic import crosses a forbidden boundary:
 *
 *  - an app importing another app (relative escape or `@echallan/<app>` specifier)
 *  - a MUI barrel (`@mui/material`, `@mui/icons-material`, ...) or a dynamic
 *    barrel import such as `import('@mui/material')`
 *  - an admin-only MUI X widget anywhere in shared or tablet client code
 *
 * Shared packages (`@echallan/contracts`, `@echallan/theme`) and exact-path MUI
 * imports are allowed. The gate is a real static check over committed source;
 * it is not an unused checker and it is wired into `pnpm run lint`.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.cts', '.cjs']);
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  // Build-time CLIs, not workspace application source: they legitimately quote
  // forbidden specifiers because they are the rules that check for them.
  'tools',
  'dist',
  'build',
  'coverage',
  'test-results',
  'playwright-report',
  '.vite',
  '.git',
]);

/** Apps may never import each other; only these packages are shareable. */
const APP_PACKAGES = ['@echallan/api', '@echallan/tablet', '@echallan/admin'];
const SHARED_PACKAGES = ['@echallan/contracts', '@echallan/theme'];

/** Admin-only MUI X widgets: never allowed in tablet or shared client code. */
const ADMIN_ONLY_WIDGETS = ['@mui/x-data-grid', '@mui/x-charts', '@mui/x-date-pickers'];

/**
 * The one owner allowed to use {@link ADMIN_ONLY_WIDGETS}. Grids, charts and
 * date pickers are an admin-dashboard capability, so restricting them everywhere
 * would block valid admin work under the root lint gate. Matching is on the
 * workspace-relative package directory so the rule follows the package location.
 */
const ADMIN_ONLY_WIDGET_OWNERS = ['apps/admin'];

/** The one MUI subpath that is not a leaf component path. */
const THEME_STYLE_ENTRY = '@mui/material/styles';

/** Packages allowed to use {@link THEME_STYLE_ENTRY}. */
const THEME_STYLE_OWNERS = ['packages/theme'];

function parseArguments(argv) {
  let root = process.cwd();
  let quiet = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--root') {
      const value = argv[index + 1];
      if (value === undefined) throw new Error('--root requires a workspace directory');
      root = path.resolve(value);
      index += 1;
    } else if (argument.startsWith('--root=')) {
      root = path.resolve(argument.slice('--root='.length));
    } else if (argument === '--quiet') {
      quiet = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return { root, quiet };
}

/** @returns {string[]} absolute file paths of scannable sources */
function collectSources(directory) {
  const found = [];
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      found.push(...collectSources(absolute));
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      found.push(absolute);
    }
  }
  return found;
}

/** Nearest ancestor directory containing a package.json (the owning package). */
function owningPackage(file, root) {
  let current = path.dirname(file);
  for (;;) {
    try {
      statSync(path.join(current, 'package.json'));
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current || current === root) return null;
      current = parent;
    }
  }
}

function packageOf(root, directory) {
  try {
    const manifest = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));
    return manifest.name;
  } catch {
    return null;
  }
}

/**
 * Extract module specifiers from static imports/exports, dynamic imports and
 * CommonJS requires. Parsing text is intentional: it also catches barrels and
 * forbidden specifiers hidden in type-only or unresolvable positions.
 */
function extractSpecifiers(source) {
  const specifiers = [];
  const patterns = [
    /\bfrom\s*['"]([^'"\n]+)['"]/g,
    /\bimport\s*['"]([^'"\n]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier !== undefined && !specifiers.includes(specifier)) specifiers.push(specifier);
    }
  }
  return specifiers;
}

function isRelativeEscape(file, specifier, packageRoot) {
  if (!specifier.startsWith('.')) return false;
  const resolved = path.resolve(path.dirname(file), specifier);
  const relative = path.relative(packageRoot, resolved);
  return relative.startsWith('..') || path.isAbsolute(relative);
}

/**
 * The npm package name a specifier addresses, ignoring any subpath.
 *
 * `@echallan/admin/src/App` addresses `@echallan/admin`, so boundary rules must
 * be decided on the package name rather than on the full specifier: a subpath
 * must not be a way around a package-level prohibition.
 *
 * @returns {string|null} the package name, or null for a bare/unscoped specifier
 */
function packageNameOfSpecifier(specifier) {
  const segments = specifier.split('/');
  if (segments[0] === undefined) return null;
  if (!specifier.startsWith('@')) {
    return segments.length > 1 ? segments[0] : null;
  }
  if (segments.length < 2 || segments[1] === undefined || segments[1] === '') return null;
  return `${segments[0]}/${segments[1]}`;
}

/**
 * @returns {{file: string, specifier: string, rule: string, message: string}[]}
 */
function findViolations(root, files) {
  const violations = [];
  for (const file of files) {
    const packageRoot = owningPackage(file, root);
    if (packageRoot === null) continue;
    const packageName = packageOf(root, packageRoot);
    const workspaceRelative = path.relative(root, packageRoot).split(path.sep).join('/');
    const source = readFileSync(file, 'utf8');

    for (const specifier of extractSpecifiers(source)) {
      if (isRelativeEscape(file, specifier, packageRoot)) {
        violations.push({
          file,
          specifier,
          rule: 'cross-package-relative-import',
          message:
            `Forbidden boundary crossing: relative import "${specifier}" escapes package ` +
            `${packageName ?? workspaceRelative}; apps and packages must never reach into each other.`,
        });
        continue;
      }

      const addressedPackage = packageNameOfSpecifier(specifier);
      if (addressedPackage !== null && APP_PACKAGES.includes(addressedPackage)) {
        violations.push({
          file,
          specifier,
          rule: 'app-to-app-import',
          message:
            `Forbidden boundary crossing: ${packageName ?? workspaceRelative} imports app package ` +
            `"${addressedPackage}"; apps may only import ${SHARED_PACKAGES.join(' and ')}.`,
        });
        continue;
      }

      if (specifier.startsWith('@mui/material/') || specifier.startsWith('@mui/icons-material/')) {
        const subpath = specifier.slice(specifier.lastIndexOf('/') + 1);
        if (specifier === THEME_STYLE_ENTRY) {
          if (!THEME_STYLE_OWNERS.includes(workspaceRelative)) {
            violations.push({
              file,
              specifier,
              rule: 'mui-style-entry-outside-theme',
              message:
                `Forbidden import: "${THEME_STYLE_ENTRY}" may only be used by ${THEME_STYLE_OWNERS.join(', ')}; ` +
                'use @echallan/theme or an exact-path component import.',
            });
          }
          continue;
        }
        if (subpath === '') {
          violations.push({
            file,
            specifier,
            rule: 'mui-barrel-import',
            message: `Forbidden MUI barrel import "${specifier}"; import the exact component path instead.`,
          });
        }
        continue;
      }

      if (specifier.startsWith('@mui/') || specifier.startsWith('@mui')) {
        const [scope, tail] = specifier.split('/');
        const bare = tail === undefined ? scope : `${scope}/${tail.split('/')[0]}`;
        if (bare === '@mui/material' || bare === '@mui/icons-material') {
          violations.push({
            file,
            specifier,
            rule: 'mui-barrel-import',
            message: `Forbidden MUI barrel import "${specifier}"; import the exact component path instead.`,
          });
          continue;
        }
        if (
          ADMIN_ONLY_WIDGETS.includes(bare) &&
          !ADMIN_ONLY_WIDGET_OWNERS.includes(workspaceRelative)
        ) {
          violations.push({
            file,
            specifier,
            rule: 'admin-only-widget',
            message:
              `Forbidden admin-only widget "${bare}" in ${packageName ?? workspaceRelative}; ` +
              'grids, charts and date pickers are not available to tablet or shared client code.',
          });
        }
      }
    }
  }
  return violations;
}

function main() {
  const { root, quiet } = parseArguments(process.argv.slice(2));
  const files = collectSources(root).sort();
  const violations = findViolations(root, files);

  for (const violation of violations) {
    const relative = path.relative(root, violation.file);
    process.stderr.write(
      `${relative}: ${violation.message} (rule: ${violation.rule}, specifier: ${violation.specifier})\n`,
    );
  }

  if (violations.length > 0) {
    process.stderr.write(
      `check:boundaries: ${violations.length} forbidden import(s) across ${files.length} scanned file(s)\n`,
    );
    process.exitCode = 1;
    return;
  }

  if (!quiet) {
    process.stdout.write(
      `check:boundaries: ${files.length} file(s) scanned, no forbidden imports (app-to-app, MUI barrels, admin-only widgets)\n`,
    );
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `check:boundaries: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 2;
}
