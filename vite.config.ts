import path from "node:path";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";

export default {
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
    rules: {
      eqeqeq: "warn",
      "no-console": ["warn", { allow: ["assert", "error", "info", "warn"] }],
      "no-unused-expressions": "error",
      "no-useless-rename": "error",
      "prefer-const": ["error", { ignoreReadBeforeAssign: true }],
      "typescript/no-unsafe-declaration-merging": "error",
      "typescript/prefer-as-const": "error",
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
} satisfies import("vite-plus").UserConfig;
