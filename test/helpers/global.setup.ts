/**
 * NOTE: Setup code to run only once before all tests.
 */

import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { promisify } from "node:util";
import prisma from "~/lib/prisma.server";
import "~/test/mocks/msw";
import { port } from "./launchBrowser";
import { closeServer, launchServer } from "./launchServer";
import { removeTemporaryFiles } from "./toMatchVisual";

export default async function setup() {
  // Kill any server processes running on the port
  try {
    const { stdout } = await promisify(execFile)("lsof", [`-ti:${port}`]);
    const pid = stdout.trim().match(/^\s*(\d+)/m)?.[1];
    if (pid) await promisify(execFile)("kill", ["-9", pid]);
  } catch { }

  // Remove Vite dependency cache
  await rm("node_modules/.vite/deps", { recursive: true, force: true });

  // Remove regression testing diff images
  await removeTemporaryFiles();

  // Launch server and start test env MSW handlers
  await launchServer(port);

  // Pre-warm Vite dep optimization: the first browser request is held until
  // Vite finishes crawling and bundling deps. By making an HTTP request here
  // (in global setup, outside the 30s test timeout), we ensure Vite completes
  // that work before any browser test calls goto().
  await fetch(`http://localhost:${port}/`).catch(() => { });

  // Cleanup database: we do this here for Playwright tests, and we do it in the
  // suite.setup.ts for the unit tests
  await prisma.user.deleteMany();
}

export async function teardown() {
  if (!process.env.CI)
    await promisify(execFile)("terminal-notifier", [
      "-sound",
      "default",
      "-title",
      "Test Suite",
      "-message",
      "Done!",
    ]);
  await closeServer();
}
