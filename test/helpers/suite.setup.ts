/**
 * NOTE: Setup code to run before every test suite.
 */

import * as Sentry from "@sentry/react-router";
import { afterAll, beforeAll, vi } from "vitest";
import prisma from "~/lib/prisma.server";
import msw from "~/test/mocks/msw";
import "./toMatchInnerHTML";
import "./toMatchScreenshot";
import "./toMatchVisual";
import "./trimConsole";

Sentry.init({ enabled: false });

beforeAll(async () => {
  // Cleanup database
  await prisma.user.deleteMany();

  // Freeze time at a fixed timestamp for deterministic visual and time-based tests
  vi.setSystemTime(new Date("2023-01-01T12:00:00Z"));

  // MSH handlers mock 3rd party APIs
  msw();
});

afterAll(async () => {
  await prisma.$disconnect();
  // Must run with NODE_OPTIONS="--expose-gc"
  if ("gc" in global && global.gc) global.gc();
});
