import { defineConfig, devices } from "@playwright/test";

process.env.NODE_ENV = "test";

// Fixed port for test server (defined in test/helpers/launchServer.ts)
const PORT = 9222;

export default defineConfig({
  fullyParallel: false,
  globalSetup: "test/helpers/global.setup.ts",
  globalTeardown: "test/helpers/global.teardown.ts",
  maxFailures: 5,
  projects: [
    {
      name: "chromium",
      use: devices["Desktop Chrome"],
    },
  ],
  reporter: process.env.CI ? "github" : "list",
  retries: 0,
  snapshotDir: "__screenshots__",
  testDir: "test/e2e",
  testMatch: /.*\.test\.ts$/,
  use: {
    baseURL: `http://localhost:${PORT}`,
    screenshot: "only-on-failure",
    viewport: { width: 1280, height: 720 },
    video: process.env.CI ? "off" : "on",
  },
});
