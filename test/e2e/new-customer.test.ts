import test, { type Page, expect } from "@playwright/test";
import prisma from "~/lib/prisma.server";
import type { Site, User } from "~/prisma";
import { goto } from "~/test/helpers/launchBrowser";

let page: Page;
let user: User | null;
let site: Site | null;

test.beforeAll(async () => {
  page = await goto("/");
});

test("loads homepage with Playwright", async () => {
  await expect(
    page.getByRole("heading", { name: /Does ChatGPT mention/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation").getByRole("link", { name: /get started/i }),
  ).toBeVisible();
});

test("clicks get started button", async () => {
  await page
    .getByRole("navigation")
    .getByRole("link", { name: /get started/i })
    .click();
  await expect(page).toHaveURL("/sign-up");
});

test("fills out sign-up form", async () => {
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("test@example.com");
  await page
    .getByRole("textbox", { name: "Password", exact: true })
    .fill("password123");
  await page
    .getByRole("textbox", { name: "Confirm password", exact: true })
    .fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("/sites");
});

test("verifies user created in DB", async () => {
  user = await prisma.user.findUniqueOrThrow({
    where: { email: "test@example.com" },
  });
  expect(user.email).toBe("test@example.com");
});

test("fills out site add form", async () => {
  await page.getByLabel("Website URL or domain").fill("https://example.com");
  await page.getByRole("button", { name: "Add Site" }).click();
  await page.waitForURL(/\/site\/[^/]+\/setup/, { timeout: 15_000 });
});

test("verifies site created in DB", async () => {
  site = await prisma.site.findFirstOrThrow({
    where: { ownerId: user?.id },
  });
  expect(site.domain).toBe("example.com");
});

test("waits for setup pipeline to complete", async () => {
  await page.waitForURL(/\/site\/[^/]+\/citations/, { timeout: 30_000 });
});

test("verifies queries saved in DB", async () => {
  const queries = await prisma.siteQuery.findMany({
    where: { siteId: site?.id },
  });
  expect(queries.length).toBeGreaterThan(0);
  expect(queries[0].group).toBe("1. discovery");
  expect(queries[0].query).toBe("Query 1");
  expect(queries[3].group).toBe("2. active_search");
  expect(queries[3].query).toBe("Query 4");
});
