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
    restoreMocks: true,
    // B-08 revision: the vehicle dropdown renders a results panel per debounced
    // keystroke, so char-by-char userEvent flows through the full entry form
    // legitimately exceed the 5s default in jsdom. Keep the per-test budget
    // explicit rather than weakening any assertion.
    testTimeout: 15_000,
  },
});
