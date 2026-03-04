import test, { type Page, expect } from "@playwright/test";
import { invariant } from "es-toolkit";
import prisma from "~/lib/prisma.server";
import type { Site, User } from "~/prisma";
import { goto } from "~/test/helpers/launchBrowser";

let page: Page;
let user: User | null;
let site: Site | null;

// Integration test: Ensure Playwright loads homepage correctly, for smoke-checking infra
test("loads homepage with Playwright", async () => {
  await prisma.account.deleteMany();

  page = await goto("/");
  await expect(
    page.getByRole("heading", { name: /Does ChatGPT mention/i }),
  ).toBeVisible();
  // Optionally verify critical navigation link exists
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
  expect(user).toBeDefined();
  if (!user) throw new Error("User not created");
  expect(user.email).toBe("test@example.com");
});

test("clicks add site button", async () => {
  await page.getByRole("link", { name: "Add your first site" }).click();
  await expect(page).toHaveURL("/sites/new");
});

test("fills out site add form", async () => {
  await page
    .getByRole("textbox", { name: "Website URL or domain" })
    .fill("https://example.com");
  await page.getByRole("button", { name: "Add Site" }).click();
  await expect(page).toHaveURL("/sites/new");
});

test("verifies site created in DB", async () => {
  invariant(user, "User not found");
  await page.waitForSelector('button:has-text("Save queries")');
  site = await prisma.site.findFirst({
    where: { accountId: user.accountId },
  });
  expect(site).toBeDefined();
  expect(site?.domain).toBe("example.com");
});

test("clicks suggest queries button", async () => {
  invariant(site, "Site not found");
  await page.getByRole("button", { name: /save queries/i }).click();
  await page.waitForURL(`/site/${site.id}/citations`);
});

test("verifies queries saved in DB", async () => {
  invariant(site, "Site not found");
  const queries = await prisma.siteQuery.findMany({
    where: { siteId: site.id },
  });
  expect(queries.length).toBeGreaterThan(0);
  expect(queries[0].group).toBe("1. discovery");
  expect(queries[0].query).toBe("Query 1");
  expect(queries[3].group).toBe("2. active_search");
  expect(queries[3].query).toBe("Query 4");
});
