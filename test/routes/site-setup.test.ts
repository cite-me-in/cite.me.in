import { afterAll, beforeAll, describe, it } from "vitest";
import { appendLog, setStatus } from "~/lib/setupProgress.server";
import { type Page, expect } from "@playwright/test";
import { hashPassword } from "~/lib/auth.server";
import { signIn } from "../helpers/signIn";
import { goto } from "../helpers/launchBrowser";
import envVars from "~/lib/envVars.server";
import prisma from "~/lib/prisma.server";
import Redis from "ioredis";

const USER_ID = "user-setup-test";
const SITE_ID = "site-setup-test";
const DOMAIN = "setup-test.com";

describe("setup page", () => {
  let page: Page;
  const redis = new Redis(envVars.REDIS_URL);

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: USER_ID,
        email: "setup-test@example.com",
        passwordHash: await hashPassword("correct-password-123"),
      },
    });
    await prisma.site.create({
      data: {
        id: SITE_ID,
        apiKey: "test-api-key-setup",
        domain: DOMAIN,
        content: "",
        summary: "",
        ownerId: USER_ID,
      },
    });

    // Seed Redis with a running status and partial log — simulates mid-pipeline state.
    await setStatus({ siteId: SITE_ID, userId: USER_ID, status: "running" });
    await appendLog({
      siteId: SITE_ID,
      userId: USER_ID,
      line: `Crawling ${DOMAIN}...`,
    });
    await appendLog({
      siteId: SITE_ID,
      userId: USER_ID,
      line: "Found 1,234 words of content",
    });
    await appendLog({
      siteId: SITE_ID,
      userId: USER_ID,
      line: "Summarizing content...",
    });
    await appendLog({
      siteId: SITE_ID,
      userId: USER_ID,
      line: "Generating queries...",
    });

    await signIn(USER_ID);
    page = await goto(`/site/${DOMAIN}/setup`);

    // Wait for the first poll to render lines from Redis.
    await page.waitForSelector("pre div");
  });

  afterAll(async () => {
    await redis.del(`setup:${SITE_ID}:${USER_ID}:log`);
    await redis.del(`setup:${SITE_ID}:${USER_ID}:status`);
    await prisma.site.deleteMany({ where: { id: SITE_ID } });
    await prisma.user.deleteMany({ where: { id: USER_ID } });
  });

  it("should show log lines from Redis", async () => {
    await expect(page.getByText(`Crawling ${DOMAIN}...`)).toBeVisible();
    await expect(page.getByText("Found 1,234 words of content")).toBeVisible();
    await expect(page.getByText("Summarizing content...")).toBeVisible();
    await expect(page.getByText("Generating queries...")).toBeVisible();
  });

  it("should show spinner while running", async () => {
    await expect(page.getByText("Running…")).toBeVisible();
  });

  it("should match visually", async () => {
    await expect(page.locator("main")).toMatchVisual({
      name: "setup/in-progress",
    });
  });

  describe("when Redis status flips to complete", () => {
    beforeAll(async () => {
      await setStatus({ siteId: SITE_ID, userId: USER_ID, status: "complete" });
      // Polling detects done → component waits 2s → navigates to citations.
      await page.waitForURL(/\/citations/, { timeout: 10_000 });
    });

    it("should redirect to citations page", async () => {
      expect(page.url()).toContain(`/site/${DOMAIN}/citations`);
    });
  });
});
