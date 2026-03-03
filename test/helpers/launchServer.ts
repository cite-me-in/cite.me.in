import { ms } from "convert";
import debug from "debug";
import { delay } from "es-toolkit";
import { type ChildProcess, fork } from "node:child_process";
import { resolve } from "node:path";

let worker: ChildProcess | undefined;

const logger = debug("server");

/**
 * Launch a new server instance.
 *
 * @param port - The port to launch the server on.
 */
export async function launchServer(port: number): Promise<void> {
  if (worker) return;

  logger("Launching server on port %s", port);

  // Start the server as forked process, that way we don't share the same node
  // instance, which could cause issues with some libraries (eg Prisma)
  worker = fork(resolve("test/helpers/serverWorker.ts"), {
    execArgv: ["--import", "tsx/esm"],
    stdio: debug.enabled("server") ? "inherit" : "pipe",
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: port.toString(),
      VITE_TEST_MODE: "1",
    },
  });

  // Wait for the server to send ready message
  logger("Waiting for server to start...");
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Server startup timeout after 30s"));
    }, ms("30s"));

    if (worker) {
      worker.on("message", (msg: { type: string; error?: string }) => {
        if (msg.type === "ready") {
          clearTimeout(timeout);
          logger("Server is ready");
          resolve();
        } else if (msg.type === "error") {
          clearTimeout(timeout);
          reject(new Error(`Server error: ${msg.error}`));
        }
      });

      worker.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    }
  });

  // Additional delay to ensure HTTP server is fully bound
  await delay(500);
}

/**
 * Close the server gracefully.
 */
export async function closeServer(): Promise<void> {
  if (worker) {
    // Send graceful shutdown message first
    worker.send("shutdown");
    // Wait for graceful shutdown (increased from 500ms to allow Vite server to fully close)
    await delay(1000);
    // Check if process exited, only kill if it's still running
    if (!worker.killed) worker.kill("SIGKILL");
    worker.disconnect();
  }
}
