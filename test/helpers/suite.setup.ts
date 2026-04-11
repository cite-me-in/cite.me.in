/**
 * NOTE: Setup code to run before every test suite.
 */

import * as Sentry from "@sentry/react-router";
import { afterAll, beforeAll, vi } from "vitest";
import prisma from "~/lib/prisma.server";
import "~/test/mocks/msw";
import "./toMatchInnerHTML";
import "./toMatchScreenshot";
import "./toMatchVisual";
import "./trimConsole";
import { fixedTime } from "./worker.setup";

Sentry.init({ enabled: false });

beforeAll(async () => {
  // Cleanup database
  await prisma.user.deleteMany();
  await prisma.oAuthClient.deleteMany();

  // Freeze time at a fixed timestamp for deterministic visual and time-based tests
  vi.setSystemTime(fixedTime.getTime());
});

afterAll(async () => {
  await prisma.$disconnect();
  // Must run with NODE_OPTIONS="--expose-gc"
  if ("gc" in global && global.gc) global.gc();
});
