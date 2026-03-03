import { type Page, type Response, expect } from "playwright/test";
import { afterAll, beforeAll, describe, it } from "vitest";
import { goto } from "~/test/helpers/launchBrowser";

const POST_SLUG = "2026-02-26-how-citeup-was-born";
const POST_TITLE =
  "How CiteUp Was Born: From Rentail to LLM Citation Monitoring";

describe("Blog Post Rendering", () => {
  let page: Page;

  beforeAll(async () => {
    page = await goto(`/blog/${POST_SLUG}`);
  });

  afterAll(async () => {
    await page?.close();
  });

  it("should render blog post with proper title", async () => {
    const title = await page.locator("article h1").first().textContent();
    expect(title).toBe(POST_TITLE);
  });

  it("should render blog post image with proper attributes", async () => {
    const heroImage = page.locator("figure img");
    expect(heroImage).toBeVisible();

    const imageClasses = await heroImage.getAttribute("class");
    expect(imageClasses).toContain("w-full");
    expect(imageClasses).toContain("object-cover");
  });

  it("should render markdown content with proper formatting", async () => {
    const heading = page.locator("h2").first();
    await expect(heading).toBeVisible();

    const article = page.locator("article");
    const articleClasses = await article.getAttribute("class");
    expect(articleClasses).toContain("prose");
    expect(articleClasses).toContain("prose-lg");
    expect(articleClasses).toContain("mx-auto");
  });

  it("should have a FAQ section with 4 questions", async () => {
    const faq = page.locator("h2", { hasText: "FAQ" });
    await expect(faq).toBeVisible();
    const items = page.locator("h2:has-text('FAQ') ~ h3");
    await expect(items).toHaveCount(4);
  });

  it("should be responsive on mobile viewport", async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();

    const article = page.locator("article");
    await expect(article).toBeVisible();

    const articleClasses = await article.getAttribute("class");
    expect(articleClasses).toContain("prose");
    expect(articleClasses).toContain("mx-auto");
  });

  it("should match inner HTML snapshot", async () => {
    await expect(page.locator("article")).toMatchInnerHTML();
  });

  it("should match visual regression test", async () => {
    await page.setViewportSize({ width: 1024, height: 667 });
    await expect(page.locator("article")).toMatchScreenshot();
  });

  describe("404", () => {
    let response: Response | null;

    beforeAll(async () => {
      response = await page.goto("/blog/non-existent-post");
    });

    it("should return 404 for non-existent posts", async () => {
      expect(response?.status()).toEqual(404);
    });
  });
});
