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

test("loads homepage", async () => {
  await expect(
    page.getByRole("heading", { name: /Does ChatGPT mention/i }),
  ).toBeVisible();
});

test("signs up", async () => {
  await page
    .getByRole("navigation")
    .getByRole("link", { name: /get started/i })
    .click();
  await expect(page).toHaveURL("/sign-up");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("citation-pipeline@example.com");
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
    where: { email: "citation-pipeline@example.com" },
  });
  expect(user.email).toBe("citation-pipeline@example.com");
});

test("adds site", async () => {
  await page.getByLabel("Website URL or domain").fill("https://acme.com");
  await page.getByRole("button", { name: "Add Site" }).click();
  await page.waitForURL(/\/site\/[^/]+\/setup/, { timeout: 15_000 });
});

test("verifies site created in DB", async () => {
  site = await prisma.site.findFirstOrThrow({
    where: { ownerId: user?.id },
  });
  expect(site!.domain).toBe("acme.com");
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
});

test("verifies citation query runs exist", async () => {
  const runs = await prisma.citationQueryRun.findMany({
    where: { siteId: site?.id },
    include: { queries: true, citations: true },
  });
  expect(runs.length).toBeGreaterThan(0);

  for (const run of runs) {
    expect(run.platform).toBeDefined();
    expect(run.model).toBeDefined();
    expect(run.queries.length).toBeGreaterThan(0);
  }
});

test("verifies citations were created", async () => {
  const citations = await prisma.citation.findMany({
    where: { siteId: site?.id },
  });
  expect(citations.length).toBeGreaterThan(0);

  const uniqueUrls = [...new Set(citations.map((c) => c.url))];
  expect(uniqueUrls.length).toBeGreaterThan(0);

  for (const url of uniqueUrls) {
    expect(url).toMatch(/^https?:\/\//);
  }
});

test("verifies citing pages were created from citations", async () => {
  const citingPages = await prisma.citingPage.findMany({
    where: { siteId: site?.id },
  });
  expect(citingPages.length).toBeGreaterThan(0);

  for (const citingPage of citingPages) {
    expect(citingPage.url).toMatch(/^https?:\/\//);
    expect(citingPage.citationCount).toBeGreaterThan(0);
  }
});
