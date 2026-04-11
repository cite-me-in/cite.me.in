import tsconfigPaths from "vite-tsconfig-paths";
import type { ParsedStack } from "vitest";
import { defineConfig } from "vitest/config";

process.env.NODE_ENV = "test";

export default defineConfig({
  build: {
    sourcemap: false, // Disable source maps in tests to save memory
  },
  plugins: [tsconfigPaths()],
  logLevel: process.env.CI ? "error" : "warn", // Only show errors in CI

  test: {
    bail: 3, // Stop after 3 failing tests
    browser: { screenshotDirectory: "__screenshots__" },
    disableConsoleIntercept: !process.env.CI,
    exclude: ["test/e2e/*"],
    execArgv: ["--max-old-space-size=3072"],
    fileParallelism: false,
    globalSetup: "test/helpers/global.setup.ts",
    hookTimeout: 30_000, // 30 seconds for beforeAll/afterAll (server + browser startup)
    include: [
      "test/routes/*.test.ts",
      "test/llm-visibility/*.test.ts",
      "test/lib/*.test.ts",
      "test/oauth/*.test.ts",
    ],
    maxConcurrency: 1, // Run tests sequentially to reduce memory pressure
    maxWorkers: 1, // Use only 1 worker to minimize memory usage
    pool: "forks",
    printConsoleTrace: !process.env.CI,
    reporters: process.env.GITHUB_ACTIONS
      ? ["github-actions", "verbose"]
      : ["verbose"],
    setupFiles: "test/helpers/suite.setup.ts",
    teardownTimeout: 5_000, // 5 seconds - Prisma disconnect will timeout anyway on macOS
    testTimeout: 30_000, // 30 seconds

    onConsoleLog: (log: string, type: "stdout" | "stderr") => {
      if (type === "stderr") process.stderr.write(log);
      else process.stdout.write(log);
    },

    onStackTrace: (error: { name?: string; }, { file }: ParsedStack) => {
      // If we've encountered a ReferenceError, show the whole stack.
      if (error.name === "ReferenceError") return true;
      // Reject all frames from third party libraries.
      return !file.includes("node_modules");
    },
  },
});
