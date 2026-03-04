/**
 * NOTE: Setup code to run only once before all tests.
 */

import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { promisify } from "node:util";
import prisma from "~/lib/prisma.server";
import { port } from "./launchBrowser";
import { closeServer, launchServer } from "./launchServer";
import { removeNewHTML } from "./toMatchInnerHTML";
import { removeDiffImages } from "./toMatchScreenshot";

export default async function setup() {
  // Kill any server processes running on the port
  try {
    const { stdout } = await promisify(execFile)("lsof", [`-ti:${port}`]);
    const pid = stdout.trim().match(/^\s*(\d+)/m)?.[1];
    if (pid) await promisify(execFile)("kill", ["-9", pid]);
  } catch {}

  // Remove Vite dependency cache
  await rm("node_modules/.vite/deps", { recursive: true, force: true });

  // Remove regression testing diff images
  await removeDiffImages();
  await removeNewHTML();

  // Launch server and start test env MSW handlers
  await launchServer(port);

  // Cleanup database: we do this here for Playwright tests, and we do it in the
  // setupTestSuite for the unit tests
  await prisma.account.deleteMany();
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
