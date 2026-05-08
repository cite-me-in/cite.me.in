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
      "@tailwindcss/typography": path.resolve(
        "node_modules/@tailwindcss/typography/src/index.js",
      ),
      "@tailwindcss/forms": path.resolve(
        "node_modules/@tailwindcss/forms/src/index.js",
      ),
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
  lint: {
    ignorePatterns: [
      "__screenshots__",
      "build",
      "docs",
      "node_modules",
      "prisma/generated",
    ],
    plugins: [
      "import",
      "jsx-a11y",
      "node",
      "oxc",
      "promise",
      "react",
      "typescript",
      "unicorn",
      "vitest",
    ],
    rules: {
      "eslint/eqeqeq": "warn",
      "eslint/no-console": [
        "error",
        { allow: ["assert", "error", "info", "warn"] },
      ],
      "eslint/no-unused-expressions": "error",
      "eslint/no-useless-rename": "error",
      "typescript/no-floating-promises": "error",
      "typescript/no-unsafe-assignment": "warn",
      "typescript/no-unsafe-declaration-merging": "error",
      "typescript/prefer-as-const": "error",
      "vitest/no-focused-tests": "warn",
    },
    options: {
      denyWarnings: true,
      reportUnusedDisableDirectives: "error",
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    ignorePatterns: [
      "__screenshots__",
      "build",
      "docs",
      "node_modules",
      "prisma/generated",
    ],
    printWidth: 80,
    sortImports: { newlinesBetween: false },
    sortTailwindcss: true,
  },

  test: {
    fileParallelism: false,
    bail: 1,
    setupFiles: ["test/helpers/suite.setup.ts"],
    globalSetup: ["test/helpers/global.setup.ts"],
    teardownTimeout: 5_000, // 5 seconds - Prisma disconnect will timeout anyway on macOS
    testTimeout: 15_000, // 15 seconds
    hookTimeout: 30_000, // 30 seconds — Prisma cold-start + browser setup in CI takes longer
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
