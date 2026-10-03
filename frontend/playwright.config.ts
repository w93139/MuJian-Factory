import { defineConfig, devices } from '@playwright/test';

const apiURL = 'http://127.0.0.1:18765';
const baseURL = 'http://127.0.0.1:18766';

export default defineConfig({
  testDir: './e2e',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'python3 e2e/fixture_backend.py',
      url: `${apiURL}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'MUJIAN_E2E=1 BACKEND_API_URL=http://127.0.0.1:18765 npm run dev -- --hostname 127.0.0.1 --port 18766',
      url: `${baseURL}/login`,
      reuseExistingServer: false,
      timeout: 90_000,
    },
  ],
});
