import { defineConfig } from 'vitest/config';

// Plain Node vitest — we don't need the Workers runtime for the pure-function
// tests in this repo (scoring math, summary synthesis). Tests that need D1
// bindings mock them inline. If we later want to test the full request path
// including Workers APIs, add @cloudflare/vitest-pool-workers and a separate
// config file for those.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 10_000,
  },
});
