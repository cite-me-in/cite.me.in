import { type ChildProcess, fork } from "node:child_process";
import { resolve } from "node:path";
import { ms } from "convert";
import debug from "debug";
import { sleep } from "radashi";

let worker: ChildProcess | undefined;
export let port: number;

const logger = debug("server");

/**
 * Launch a new server instance.
 *
 * @param port - The port to launch the server on.
 */
export async function launchServer(port: number): Promise<void> {
  if (worker) return;

  await findAvailablePort();
  logger("Launching server on port %s", port);

  // Start the server as forked process, that way we don't share the same node
  // instance, which could cause issues with some libraries (eg Prisma)
  worker = fork(resolve("test/helpers/serverWorker.ts"), {
    execArgv: ["--import", "tsx/esm"],
    stdio: debug.enabled("server")
      ? ["ignore", process.stdout, process.stderr, "ipc"]
      : undefined,
    env: {
      ...process.env,
      CHOKIDAR_USEPOLLING: "1",
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

  // Additional sleep to ensure HTTP server is fully bound
  await sleep(500);
}

/**
 * Close the server gracefully.
 */
export async function closeServer(): Promise<void> {
  if (worker) {
    // Send graceful shutdown message first
    worker.send("shutdown");
    // Wait for graceful shutdown (increased from 500ms to allow Vite server to fully close)
    await sleep(1000);
    // Check if process exited, only kill if it's still running
    if (!worker.killed) worker.kill("SIGKILL");
    worker.disconnect();
  }
}

async function findAvailablePort() {
  port = 9222;
  // Check if the port is taken, increment by one and keep checking
  const net = await import("net");
  let found = false;
  while (!found) {
    await new Promise<void>((resolve) => {
      const tester = net
        .createServer()
        .once("error", () => {
          port++;
          resolve();
        })
        .once("listening", function () {
          tester.close(() => {
            found = true;
            resolve();
          });
        })
        .listen(port, "127.0.0.1");
    });
  }
}
