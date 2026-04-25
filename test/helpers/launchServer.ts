import { type ChildProcess, fork } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ms } from "convert";
import debug from "debug";
import { sleep } from "radashi";

let worker: ChildProcess | undefined;
export let port: number;

const logger = debug("server");
const loopbackHosts = ["127.0.0.1", "::1"] as const;
const serverHost = "localhost";
const serverStatePath = resolve(".test-server.json");

type ServerState = {
  baseURL: string;
  pid: number;
  port: number;
};

/**
 * Launch a new server instance.
 *
 * @param port - The port to launch the server on.
 */
export async function launchServer(): Promise<number> {
  if (worker) return port;

  await findAvailablePort();
  process.env.TEST_PORT = port.toString();
  process.env.TEST_BASE_URL = getServerBaseURL();
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
  if (worker.pid) {
    await persistServerState({
      baseURL: getServerBaseURL(),
      pid: worker.pid,
      port,
    });
  }

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

  return port;
}

/**
 * Close the server gracefully.
 */
export async function closeServer(): Promise<void> {
  const serverWorker = worker;
  if (!serverWorker) {
    await terminateServerPid();
    await cleanupServerEnv();
    return;
  }

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
  await cleanupServerEnv();
}

async function findAvailablePort() {
  port = 9222;
  // Check if the port is taken, increment by one and keep checking
  let found = false;
  while (!found) {
    console.info(`Checking port ${port}...`);
    found = await isPortAvailable(port);
    if (!found) port++;
  }
}

export async function isPortAvailable(port: number): Promise<boolean> {
  const results = await Promise.all(
    loopbackHosts.map((host) => canBindPort(port, host)),
  );
  return results.every(Boolean);
}

export function getServerPort(): number {
  const serverPort =
    port || Number(process.env.TEST_PORT) || readServerState()?.port;
  if (!serverPort) throw new Error("Test server port has not been set");
  return serverPort;
}

export function getServerBaseURL(): string {
  if (process.env.TEST_BASE_URL) return process.env.TEST_BASE_URL;
  if (process.env.TEST_PORT)
    return `http://${serverHost}:${process.env.TEST_PORT}`;

  return (
    readServerState()?.baseURL ?? `http://${serverHost}:${getServerPort()}`
  );
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
  const pid = Number(process.env.TEST_SERVER_PID) || readServerState()?.pid;
  if (!pid) return;

  signalProcess(pid, "SIGTERM");
  if (!(await waitForPidExit(pid, ms("5s")))) {
    signalProcess(pid, "SIGKILL");
    await waitForPidExit(pid, ms("5s"));
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

async function cleanupServerEnv(): Promise<void> {
  delete process.env.TEST_PORT;
  delete process.env.TEST_BASE_URL;
  delete process.env.TEST_SERVER_PID;
  await rm(serverStatePath, { force: true });
}

async function persistServerState(state: ServerState): Promise<void> {
  process.env.TEST_PORT = state.port.toString();
  process.env.TEST_BASE_URL = state.baseURL;
  process.env.TEST_SERVER_PID = state.pid.toString();
  await writeFile(serverStatePath, `${JSON.stringify(state)}\n`);
}

function readServerState(): ServerState | undefined {
  if (!existsSync(serverStatePath)) return undefined;

  try {
    const state = JSON.parse(
      readFileSync(serverStatePath, "utf8"),
    ) as Partial<ServerState>;
    if (!state.pid || !state.port || !state.baseURL) return undefined;
    return {
      baseURL: state.baseURL,
      pid: state.pid,
      port: state.port,
    };
  } catch {
    return undefined;
  }
}
