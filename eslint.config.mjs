import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Root ESLint flat configuration (S-01).
 *
 * Scope notes:
 * - Type-aware linting is deliberately not enabled yet: the workspace has no
 *   project references and the foundation gates are format/lint/typecheck/test,
 *   where type errors belong to `pnpm run typecheck` (tsc, strict).
 * - Build output, dependencies and planner-owned generated artefacts are
 *   ignored so `eslint .` is deterministic and offline.
 * - `pnpm run lint` additionally runs `pnpm run check:boundaries`; the import
 *   boundary gate is part of the lint gate, not a separate optional tool.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '**/.vite/**',
      'pnpm-lock.yaml',
      'docs/demo-data.json',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/api/**/*.ts', 'tools/**/*.mjs', 'tests/foundation/*.mjs', 'eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    files: [
      'apps/tablet/**/*.{ts,tsx}',
      'apps/admin/**/*.{ts,tsx}',
      'packages/theme/**/*.{ts,tsx}',
      'packages/contracts/**/*.{ts,tsx}',
    ],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'apps/*/e2e/**/*.spec.ts', '**/tests/**'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
);
