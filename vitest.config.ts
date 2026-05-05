import { defineConfig } from "vite-plus";
import type { ParsedStack } from "vite-plus/test";

process.env.NODE_ENV = "test";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  ssr: {
    noExternal: ["defuddle"],
  },
  test: {
    setupFiles: ["test/helpers/suite.setup.ts"],
    teardownTimeout: 5_000, // 5 seconds - Prisma disconnect will timeout anyway on macOS
    testTimeout: 30_000, // 30 seconds

    onConsoleLog: (log: string, type: "stdout" | "stderr") => {
      if (type === "stderr") process.stderr.write(log);
      else process.stdout.write(log);
    },

    onStackTrace: (error: { name?: string }, { file }: ParsedStack) => {
      // If we've encountered a ReferenceError, show the whole stack.
      if (error.name === "ReferenceError") return true;
      // Reject all frames from third party libraries.
      return !file.includes("node_modules");
    },
  },
});
