import { type Locator, type Page, expect } from "playwright/test";
import { afterAll, beforeAll, describe, it } from "vitest";
import { goto } from "../helpers/launchBrowser";

describe("Blog Listing", () => {
  let page: Page;
  let blogSection: Locator;

  beforeAll(async () => {
    page = await goto("/blog");
    blogSection = page.locator("section.blog-posts").first();
  });

  afterAll(async () => {
    await page?.close();
  });

  it("should display blog posts section", async () => {
    await expect(blogSection).toBeVisible();
  });

  it("should have blog post links", async () => {
    const blogLinks = page.locator('a[href^="/blog/"]');
    const linkCount = await blogLinks.count();
    expect(linkCount).toBeGreaterThan(0);
  });

  it("should have titles and excerpts in each post card", async () => {
    const blogLinks = page.locator('a[href^="/blog/"]');
    const linkCount = await blogLinks.count();

    if (linkCount > 0) {
      const firstLink = blogLinks.first();

      const title = firstLink.locator("h2");
      await expect(title).toBeVisible();
      const titleText = await title.textContent();
      expect(titleText?.length).toBeGreaterThan(0);

      const excerpt = firstLink.locator("p");
      await expect(excerpt).toBeVisible();
      const excerptText = await excerpt.textContent();
      expect(excerptText?.length).toBeGreaterThan(0);
    }
  });

  it("should have proper meta title", async () => {
    const title = await page.title();
    expect(title).toContain("Blog");
    expect(title).toContain("Cite.me.in");
  });

  it("should match visually", async () => {
    await expect(blogSection).toMatchVisual({
      name: "blog.list",
    });
  });

  describe("navigates to first blog post", () => {
    beforeAll(async () => {
      await page
        .locator('a[href^="/blog/2026-02-26-how-citemein-was-born"]')
        .click();
      await page.waitForURL(/.*\/blog\/.*/);
    });

    it("should navigate to the blog post", async () => {
      expect(page.url()).toContain("/blog/2026-02-26-how-citemein-was-born");
    });

    it("should display the blog post content", async () => {
      await page.waitForSelector("article");
      const article = page.locator("article");
      await expect(article).toBeVisible();
      const h1 = page.locator("h1").first();
      await expect(h1).toBeVisible();
      await expect(h1).toHaveText(
        "How Cite.me.in Was Born: From Rentail to LLM Citation Monitoring",
      );
    });
  });
});
