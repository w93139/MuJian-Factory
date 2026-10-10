import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./live-tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  outputDir: "../.local-artifacts/live-test-results",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:18776",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command:
        "MUJIAN_LIVE_TEST=1 MUJIAN_TEST_API_PORT=18775 python3 e2e/fixture_backend.py",
      url: "http://127.0.0.1:18775/api/health",
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command:
        "MUJIAN_LIVE_TEST=1 BACKEND_API_URL=http://127.0.0.1:18775 npm run dev -- --hostname 127.0.0.1 --port 18776",
      url: "http://127.0.0.1:18776/login",
      reuseExistingServer: false,
      timeout: 90000,
    },
  ],
});
