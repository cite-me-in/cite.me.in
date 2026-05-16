/**
 * NOTE: Setup code to run before every test suite.
 */

import { execSync } from "node:child_process";
import { afterAll, beforeAll, vi } from "vitest";
import prisma from "~/lib/prisma.server";
import "~/test/mocks/msw";
import "./toMatchInnerHTML";
import "./toMatchScreenshot";
import "./toMatchVisual";
import "./trimConsole";
import { fixedTime } from "./freezeDateTime";

// Sentry is disabled in tests, but stub it to avoid ESM import issues
vi.mock("@sentry/react-router", () => ({
  init: vi.fn<() => void>(),
  captureException: vi.fn<() => void>(),
}));

beforeAll(async () => {
  // Cleanup database
  await prisma.user.deleteMany();
  await prisma.oAuthClient.deleteMany();

  // Flush Redis to avoid stale scan state
  try {
    execSync("redis-cli FLUSHDB", { stdio: "ignore", timeout: 5_000 });
  } catch {
    // Redis might not be running — skip
  }

  // Freeze time at a fixed timestamp for deterministic visual and time-based tests
  vi.setSystemTime(fixedTime.getTime());
});

afterAll(async () => {
  await prisma.$disconnect();
  // Must run with NODE_OPTIONS="--expose-gc"
  if ("gc" in global && global.gc) global.gc();
});
