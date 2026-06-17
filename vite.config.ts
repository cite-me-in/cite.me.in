import { execSync } from "node:child_process";
import path from "node:path";

import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: ["__screenshots__", "docs", "prisma/generated"],
    printWidth: 80,
    proseWrap: "always",
    sortImports: true,
    sortTailwindcss: true,
  },
  lint: {
    plugins: [
      "import",
      "jsx-a11y",
      "node",
      "oxc",
      "oxc",
      "promise",
      "react",
      "typescript",
      "typescript",
      "unicorn",
      "unicorn",
      "vitest",
    ],
    categories: {
      correctness: "error",
    },
    env: {
      builtin: true,
    },
    ignorePatterns: ["dist", "node_modules", ".opencode", "scripts/"],
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
  test: {
    // Fetch secrets via Infisical REST API (Machine Identity) for worker processes.
    // Falls back to process.env if Machine Identity credentials aren't configured.
    env: (() => {
      try {
        const raw = execSync("node scripts/fetch-infisical-secrets.mjs", {
          encoding: "utf-8",
          timeout: 10_000,
          stdio: ["pipe", "pipe", "pipe"],
        });
        const env: Record<string, string> = {};
        for (const line of raw.split("\n")) {
          const eqIdx = line.indexOf("=");
          if (eqIdx > 7 && line.startsWith("export ")) {
            const key = line.slice(7, eqIdx);
            const value = line.slice(eqIdx + 1);
            if (/^\w+$/.test(key)) env[key] = value;
          }
        }
        return { ...env, ...process.env };
      } catch {
        return { ...process.env };
      }
    })(),
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

    onStackTrace: (error: { name?: string }, { file }: { file: string }) => {
      // If we've encountered a ReferenceError, show the whole stack.
      if (error.name === "ReferenceError") return true;
      // Reject all frames from third party libraries.
      return !file.includes("node_modules");
    },
  },
});
