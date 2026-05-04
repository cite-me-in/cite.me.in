import { type Page, expect } from "@playwright/test";
import { beforeAll, describe, it } from "vite-plus/test";
import { goto } from "~/test/helpers/launchBrowser";
import { port } from "~/test/helpers/launchServer";

describe("home page HTTP headers", () => {
  let response: Response;

  beforeAll(async () => {
    response = await fetch(`http://localhost:${port}/`);
  });

  it("should have Link header for sitemap.xml", () => {
    const link = response.headers.get("Link");
    expect(link).toContain("/sitemap.xml");
    expect(link).toContain('rel="sitemap"');
    expect(link).toContain("application/xml");
  });

  it("should have Link header for sitemap.txt", () => {
    const link = response.headers.get("Link");
    expect(link).toContain("/sitemap.txt");
    expect(link).toContain('rel="sitemap"');
    expect(link).toContain("text/plain");
  });
});

describe("home page", () => {
  let page: Page;

  beforeAll(async () => {
    page = await goto("/");
  });

  it("should have sitemap.xml link in head", async () => {
    const link = page.locator('link[rel="sitemap"][type="application/xml"]');
    await expect(link).toHaveAttribute(
      "href",
      `http://localhost:${port}/sitemap.xml`,
    );
  });

  it("should have sitemap.txt link in head", async () => {
    const link = page.locator('link[rel="sitemap"][type="text/plain"]');
    await expect(link).toHaveAttribute(
      "href",
      `http://localhost:${port}/sitemap.txt`,
    );
  });

  it("should show the landing page hero", async () => {
    await expect(
      page.getByRole("heading", { name: /Does ChatGPT mention/ }),
    ).toBeVisible();
  });

  it("should show the squirrel-brain friendly quote", async () => {
    await expect(page.locator("blockquote")).toContainText(
      "Squirrel-brain friendly 🐿️",
    );
  });

  it("should show sign in and get started nav links when unauthenticated", async () => {
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Sign in" }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Get started" }),
    ).toBeVisible();
  });

  it("should show the scan form in the hero", async () => {
    await expect(page.getByPlaceholder("yourwebsite.com")).toBeVisible();
    await expect(page.getByRole("button", { name: "Scan now" })).toBeVisible();
  });

  it("should show how it works section", async () => {
    await expect(
      page.getByRole("heading", { name: "How it works" }),
    ).toBeVisible();
    await expect(page.getByText("Add your website")).toBeVisible();
    await expect(page.getByText("We run the queries")).toBeVisible();
    await expect(page.getByText("You see the citations")).toBeVisible();
  });

  it("should show who it's for section", async () => {
    await expect(
      page.getByText("Built for anyone with an online presence"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Solo founders" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Small businesses" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Marketing teams" }),
    ).toBeVisible();
  });

  it("should not show the site header", async () => {
    // The layout header (with nav links like Blog, Pricing) should be hidden;
    // only the landing nav rendered inline by the route should be visible.
    await expect(page.locator("header")).toHaveCount(0);
  });

  it("should show the footer", async () => {
    await expect(page.locator("footer")).toBeVisible();
  });
});
