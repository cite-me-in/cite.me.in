import { type Page, expect } from "playwright/test";
import { afterAll, beforeAll, describe, it } from "vite-plus/test";
import faq from "~/routes/faq/faq";
import { goto } from "~/test/helpers/launchBrowser";

describe("FAQ page", () => {
  let page: Page;
  const totalQuestions = faq.reduce(
    (sum, category) => sum + category.questions.length,
    0,
  );

  beforeAll(async () => {
    page = await goto("/faq");
  });

  afterAll(async () => {
    await page?.close();
  });

  it("should have at least 10 questions", async () => {
    expect(totalQuestions).toBeGreaterThanOrEqual(10);
  });

  it("should display all FAQ categories", async () => {
    for (const category of faq) {
      const heading = page.locator("h2", { hasText: category.category });
      await expect(heading).toBeVisible();
    }
  });

  it("should display all questions", async () => {
    for (const category of faq) {
      for (const item of category.questions) {
        const question = page.locator("h3", { hasText: item.question });
        await expect(question).toBeVisible();
      }
    }
  });

  it("should include valid FAQPage JSON-LD structured data", async () => {
    const jsonLdContent = await page
      .locator('main script[type="application/ld+json"]')
      .textContent();

    expect(jsonLdContent).toBeTruthy();

    const structuredData = JSON.parse(jsonLdContent ?? "") as {
      "@context": string;
      "@type": string;
      name: string;
      mainEntity: {
        "@type": string;
        name: string;
        acceptedAnswer: {
          "@type": string;
          text: string;
        };
      }[];
    };
    expect(structuredData["@context"]).toBe("https://schema.org");
    expect(structuredData["@type"]).toBe("FAQPage");
    expect(structuredData.name).toBeTruthy();
    expect(Array.isArray(structuredData.mainEntity)).toBe(true);
    expect(structuredData.mainEntity.length).toBe(totalQuestions);

    const firstQuestion = structuredData.mainEntity[0];
    expect(firstQuestion["@type"]).toBe("Question");
    expect(firstQuestion.name).toBeTruthy();
    expect(firstQuestion.acceptedAnswer).toBeDefined();
    expect(firstQuestion.acceptedAnswer["@type"]).toBe("Answer");
    expect(firstQuestion.acceptedAnswer.text).toBeTruthy();
  });

  it("should match visually", async () => {
    await expect(page.locator("main")).toMatchVisual({
      name: "home/faq",
    });
  });

  it("should have proper meta title", async () => {
    const title = await page.title();
    expect(title).toContain("FAQ");
    expect(title).toContain("Cite.me.in");
  });

  it("should have meta description about LLM citation visibility", async () => {
    const metaDescription = page.locator('meta[name="description"]').last();
    const content = await metaDescription.getAttribute("content");
    expect(content).toBeTruthy();
    expect(content).toContain("LLM citation visibility");
  });
});
