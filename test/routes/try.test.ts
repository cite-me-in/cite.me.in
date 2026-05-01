import { type Page, expect } from "@playwright/test";
import { beforeAll, describe, it } from "vite-plus/test";
import { goto } from "~/test/helpers/launchBrowser";
import { port } from "~/test/helpers/launchServer";
import "~/test/helpers/toMatchVisual";

describe("try page hero and nav", () => {
  let page: Page;

  beforeAll(async () => {
    page = await goto("/try");
  });

  it("should render the hero visually", async () => {
    await expect(
      page.getByRole("heading", { name: "Is your site ready for AI?" }),
    ).toBeVisible();
    await expect(page.locator("main")).toMatchVisual({
      name: "try/hero",
    });
  });

  it("should show the domain input and check button", async () => {
    await expect(page.getByPlaceholder("yourwebsite.com")).toBeVisible();
    await expect(page.getByRole("button", { name: "Check" })).toBeVisible();
  });

  it("should show sign in and get started nav links", async () => {
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Sign in" }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Get started" }),
    ).toBeVisible();
  });

  it("should show the benefits section", async () => {
    await expect(
      page.getByRole("heading", { name: "After your scan, you'll get" }),
    ).toBeVisible();
    await expect(
      page.getByText("13 free checks", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Know your gaps", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("One-click monitoring", { exact: true }),
    ).toBeVisible();
  });

  it("should show the sign-up CTA section", async () => {
    await expect(
      page.getByRole("heading", { name: "Turn this into weekly monitoring" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Start monitoring/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "See pricing" })).toBeVisible();
  });

  it("should not show the site header", async () => {
    await expect(page.locator("header")).toHaveCount(0);
  });

  it("should show the footer", async () => {
    await expect(page.locator("footer")).toBeVisible();
  });
});

describe("try page form validation", () => {
  let page: Page;

  beforeAll(async () => {
    page = await goto("/try");
  });

  it("should show error when submitting empty domain", async () => {
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByText("Enter a website URL")).toBeVisible();
  });
});

const TEST_DOMAIN = "acme.com";

describe("try page scan flow", () => {
  let page: Page;

  beforeAll(async () => {
    page = await goto(`/try?domain=${TEST_DOMAIN}`);
  });

  it("should show the domain badge", async () => {
    await expect(page.getByText(TEST_DOMAIN, { exact: true })).toBeVisible();
  });

  it("should show the scanning progress", async () => {
    await expect(page.getByText(`Checking ${TEST_DOMAIN}...`)).toBeVisible();
  });

  it("should show scan results", async () => {
    await expect(page.getByText(/AI Legibility Report/)).toBeVisible({
      timeout: 40_000,
    });
  });
});

describe("try page HTTP headers", () => {
  let response: Response;

  beforeAll(async () => {
    response = await fetch(`http://localhost:${port}/try`);
  });

  it("should return status 200", () => {
    expect(response.status).toBe(200);
  });
});
