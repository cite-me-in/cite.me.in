import path from "node:path";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";
import type { ParsedStack } from "vite-plus/test";

export default defineConfig({
  build: {
    sourcemap: true,
  },
  resolve: {
    alias: {
      "@tailwindcss/typography": path.resolve("node_modules/@tailwindcss/typography/src/index.js"),
      "@tailwindcss/forms": path.resolve("node_modules/@tailwindcss/forms/src/index.js"),
    },
    dedupe: ["react", "react-dom", "react-router"],
    tsconfigPaths: true,
  },
  plugins: [tailwindcss(), reactRouter()],
  ssr: {
    noExternal: ["streamdown"],
  },
  server: {
    allowedHosts: [".ngrok-free.app"],
    cors: false, // Disable Vite's CORS middleware, let React Router handle it
  },
  staged: {
    "*.{ts,tsx}": "vp check --fix",
  },

  test: {
    fileParallelism: false,
    bail: 1,
    setupFiles: ["test/helpers/suite.setup.ts"],
    globalSetup: ["test/helpers/global.setup.ts"],
    teardownTimeout: 5_000, // 5 seconds - Prisma disconnect will timeout anyway on macOS
    testTimeout: 15_000, // 15 seconds
    hookTimeout: 15_000, // 15 seconds
    include: ["test/**/*.test.ts", "!test/e2e/*"],

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
