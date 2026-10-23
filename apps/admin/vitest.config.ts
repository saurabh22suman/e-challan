import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    // Only the component suite runs here. e2e/*.spec.ts belongs to Playwright
    // (root playwright.config.ts) and must never be collected by Vitest.
    include: ['src/**/*.test.tsx'],
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
    environment: 'jsdom',
    globals: false,
    setupFiles: ['src/test/setup.ts'],
    // The create-user journey fills several MUI selects; keep a realistic
    // JavaScript budget under parallel file execution without weakening assertions.
    testTimeout: 45_000,
    fileParallelism: false,
    maxWorkers: 1,
    restoreMocks: true,
  },
});
