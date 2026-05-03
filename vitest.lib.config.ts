import { defineConfig } from "vite-plus";

process.env.NODE_ENV = "test";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    sourcemap: false,
  },
  logLevel: process.env.CI ? "error" : "warn",

  test: {
    bail: 3,
    disableConsoleIntercept: !process.env.CI,
    include: ["test/lib/aiLegibility/**/*.test.ts"],
    pool: "threads",
    setupFiles: "test/helpers/suite.setup.ts",
    teardownTimeout: 5_000,
    testTimeout: 30_000,

    onConsoleLog: (log: string, type: "stdout" | "stderr") => {
      if (type === "stderr") process.stderr.write(log);
      else process.stdout.write(log);
    },

    onStackTrace: (error: { name?: string }, { file }: { file: string }) => {
      if (error.name === "ReferenceError") return true;
      return !file.includes("node_modules");
    },
  },
});
