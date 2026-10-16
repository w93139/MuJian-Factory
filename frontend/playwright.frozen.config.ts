import { defineConfig, devices } from '@playwright/test';
// Read-only acceptance against the original local dataset and a frozen Git checkout.
// Start the real-data previews described in docs/local-run.md before running.
export default defineConfig({
  testDir: './frozen-tests', workers: 1, fullyParallel: false, retries: 0,
  timeout: 60000, expect: { timeout: 15000 }, outputDir: '../.local-artifacts/frozen-test-results', reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3110', viewport: { width: 1470, height: 900 }, trace: 'retain-on-failure' },
});
