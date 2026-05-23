import { type ChildProcess, fork } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ms } from "convert";
import debug from "debug";
import { sleep } from "radashi";

let worker: ChildProcess | undefined;
const logger = debug("server");
const loopbackHosts = ["127.0.0.1", "::1"] as const;
const serverStatePath = resolve(".test-server.json");

// Fixed port for test server - simplifies Playwright config
export const port = 9222;

/**
 * Launch a new server instance.
 *
 * @returns The port the server was launched on (always 9222).
 */
export async function launchServer(): Promise<number> {
  const running = readServerState();
  if (running && isProcessRunning(running.pid)) return running.port;

  logger("Launching server on port %s", port);

  // Start the server as forked process, that way we don't share the same node
  // instance, which could cause issues with some libraries (eg Prisma)
  process.on("exit", () => {
    try {
      worker?.kill("SIGKILL");
    } catch {}
  });

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
      VITE_APP_URL: `http://localhost:${port}`,
      VITE_TEST_MODE: "1",
    },
  });
  if (worker.pid)
    await writeFile(serverStatePath, JSON.stringify({ port, pid: worker.pid }));

  // Wait for the server to send ready message
  logger("Waiting for server to start...");
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Server startup timeout after 15s"));
    }, ms("15s"));

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

  return port;
}

/**
 * Close the server gracefully.
 */
export async function closeServer(): Promise<void> {
  await rm(serverStatePath, { force: true });
  const serverWorker = worker;
  if (!serverWorker) return await terminateServerPid();

  worker = undefined;

  const gracefulExit = waitForExit(serverWorker, ms("5s"));
  if (serverWorker.connected) {
    await new Promise<void>((resolve) => {
      serverWorker.send("shutdown", () => resolve());
    });
  }

  if (!(await gracefulExit)) {
    serverWorker.kill("SIGKILL");
    await waitForExit(serverWorker, ms("5s"));
  }

  if (serverWorker.connected) serverWorker.disconnect();
}

export async function isPortAvailable(port: number): Promise<boolean> {
  const results = await Promise.all(
    loopbackHosts.map((host) => canBindPort(port, host)),
  );
  return results.every(Boolean);
}

async function canBindPort(port: number, host: string): Promise<boolean> {
  const net = await import("net");

  return new Promise<boolean>((resolve) => {
    const tester = net
      .createServer()
      .once("error", () => {
        resolve(false);
      })
      .once("listening", () => {
        tester.close(() => resolve(true));
      })
      .listen(port, host);
  });
}

function waitForExit(
  worker: ChildProcess,
  timeoutMs: number,
): Promise<boolean> {
  if (worker.exitCode !== null || worker.signalCode !== null)
    return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      worker.off("exit", onExit);
      resolve(false);
    }, timeoutMs);

    function onExit() {
      clearTimeout(timeout);
      resolve(true);
    }

    worker.once("exit", onExit);
  });
}

async function terminateServerPid(): Promise<void> {
  const running = readServerState();
  if (!running) return;

  signalProcess(running.pid, "SIGTERM");
  if (!(await waitForPidExit(running.pid, ms("5s")))) {
    signalProcess(running.pid, "SIGKILL");
    await waitForPidExit(running.pid, ms("5s"));
  }
}

async function waitForPidExit(
  pid: number,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessRunning(pid)) return true;
    await sleep(50);
  }

  return !isProcessRunning(pid);
}

function signalProcess(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

function readServerState(): { port: number; pid: number } | null {
  if (!existsSync(serverStatePath)) return null;
  try {
    return JSON.parse(readFileSync(serverStatePath, "utf8")) as {
      port: number;
      pid: number;
    };
  } catch {
    return null;
  }
}

process.on("beforeExit", async () => {
  await closeServer();
});
