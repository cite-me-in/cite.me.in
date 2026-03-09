/**
 * This file is used to start the Vite dev server in a forked process.  It is
 * used to avoid sharing the same node instance, which could cause issues with
 * some libraries (eg Prisma). It is also used to allow the process to exit
 * cleanly when the test is done.
 */

import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { invariant } from "es-toolkit";
import * as vite from "vite";

// Import and start the server
async function startServer() {
  // Initialize MSW for mocking HTTP requests during tests
  if (process.env.NODE_ENV === "test") {
    try {
      const mswModule = await import("~/test/mocks/msw");
      if (typeof mswModule.default === "function") mswModule.default();
    } catch (error) {
      console.error("Failed to initialize MSW:", error);
    }
  }

  invariant(process.send, "process.send is not defined");
  const port = Number(process.env.PORT);
  invariant(port, "PORT is not defined");
  try {
    // Remove the directory at "deps" before starting the dev server
    await rm(resolve("node_modules/.vite/deps"), {
      recursive: true,
      force: true,
    });

    const devServer = await vite.createServer({
      build: {
        // Test-specific build options
        minify: false,
        sourcemap: true,
      },
      clearScreen: false,
      logLevel: "warn", // Reduced log level to avoid noise
      root: process.cwd(),
      optimizeDeps: {
        // List all hook-using packages here so Vite pre-bundles them in the
        // first pass and never does mid-session re-optimization. With HMR
        // disabled, a mid-session re-optimization assigns new chunk hashes but
        // cannot signal the browser to reload already-loaded chunks, resulting
        // in two React instances: the old one (held by react-dom) and the new
        // one (held by the newly discovered dep). This causes
        // ReactCurrentDispatcher.current to be null when the new dep tries to
        // call a hook.
        force: true,
        include: [
          "react",
          "react-dom",
          "react-router",
          "recharts",
          "usehooks-ts",
          "lucide-react",
        ],
      },
      server: {
        fs: { allow: ["."] }, // Don't re-optimize already bundled deps
        hmr: false,
        middlewareMode: false,
        port,
        strictPort: true,
        warmup: { clientFiles: ["/"] }, // Pre-warm these routes during dev server startup
        watch: null, // Don't watch files during tests
      },
    });

    // Start the Vite dev server
    await devServer.listen(port);
    // Unref the server to allow process to exit cleanly
    devServer.httpServer?.unref();

    // Handle graceful shutdown on parent process termination
    process.on("message", async (msg) => {
      if (msg === "shutdown") {
        await devServer?.close();
        process.exit(0);
      }
    });

    // Send ready signal immediately - first test navigation will trigger optimization
    process.send({ type: "ready" });
  } catch (error) {
    process.send({
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

await startServer();
