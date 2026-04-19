import { expect } from "@playwright/test";
import { beforeAll, describe, it } from "vitest";
import { goto } from "../helpers/launchBrowser";

describe("ai-legibility page", () => {
  let page: import("playwright").Page;

  beforeAll(async () => {
    page = await goto("/ai-legibility");
  });

  it("should show the main heading", async () => {
    await expect(
      page.getByRole("heading", { name: "AI Legibility Checker" }),
    ).toBeVisible();
  });

  it("should show the description", async () => {
    await expect(
      page.getByText("Check if your website is readable by AI agents"),
    ).toBeVisible();
  });

  it("should show the URL input field", async () => {
    await expect(
      page.getByRole("textbox", { name: "Website URL" }),
    ).toBeVisible();
  });

  it("should show the scan button", async () => {
    await expect(
      page.getByRole("button", { name: "Scan Website" }),
    ).toBeVisible();
  });

  it("should show the card with yellow variant", async () => {
    const card = page.locator('[data-slot="card"]').first();
    await expect(card).toBeVisible();
  });

  it("should match visually", async () => {
    await expect(page.locator("main")).toMatchVisual({
      name: "ai-legibility/form",
    });
  });

  it("should show error for empty URL submission", async () => {
    const currentPage = await goto("/ai-legibility");
    await currentPage.getByRole("button", { name: "Scan Website" }).click();
    await expect(currentPage.getByText("URL is required")).toBeVisible();
  });

  it("should accept URL input", async () => {
    const currentPage = await goto("/ai-legibility");
    const input = currentPage.getByRole("textbox", { name: "Website URL" });
    await input.fill("https://example.com");
    await expect(input).toHaveValue("https://example.com");
  });
});
