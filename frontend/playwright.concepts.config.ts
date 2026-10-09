import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./concept-tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  outputDir: "../verification/test-results",
  reporter: [
    ["list"],
    ["json", { outputFile: "../verification/concepts-results.json" }],
  ],
  use: { viewport: { width: 1440, height: 1000 }, trace: "retain-on-failure" },
  projects: [
    { name: "director", use: { baseURL: "http://127.0.0.1:3101" } },
    { name: "guided", use: { baseURL: "http://127.0.0.1:3102" } },
    { name: "gallery", use: { baseURL: "http://127.0.0.1:3103" } },
  ],
  webServer: ["director", "guided", "gallery"].map((name, i) => ({
    command: "npm run dev:" + name,
    url: "http://127.0.0.1:" + (3101 + i),
    reuseExistingServer: true,
    timeout: 60000,
  })),
});
