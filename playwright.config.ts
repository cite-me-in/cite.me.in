import { defineConfig, devices } from "@playwright/test";

process.env.NODE_ENV = "test";

export default defineConfig({
  globalSetup: "test/helpers/global.setup.ts",
  maxFailures: 1,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: process.env.CI ? "github" : "list",
  retries: process.env.CI ? 2 : 0,
  testDir: "test/e2e",
  testMatch: /.*\.test\.ts$/,
  use: {
    baseURL: "http://localhost:9222",
    screenshot: "only-on-failure",
    viewport: { width: 1280, height: 720 },
  },
});
