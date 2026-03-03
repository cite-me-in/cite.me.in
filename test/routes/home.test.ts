import { expect } from "@playwright/test";
import { describe, it } from "vitest";
import { goto, port } from "../helpers/launchBrowser";

describe("home page", () => {
  it("shows the landing page hero", async () => {
    const page = await goto("/");
    await expect(
      page.getByRole("heading", { name: /Does ChatGPT mention/ }),
    ).toBeVisible();
    await expect(page.getByText("The Search Console for AI")).toBeVisible();
  });

  it("shows sign in and get started nav links when unauthenticated", async () => {
    const page = await goto("/");
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Sign in" }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Get started" }),
    ).toBeVisible();
  });

  it("shows how it works section", async () => {
    const page = await goto("/");
    await expect(
      page.getByRole("heading", { name: "How it works" }),
    ).toBeVisible();
    await expect(page.getByText("Add your website")).toBeVisible();
    await expect(page.getByText("We run the queries")).toBeVisible();
    await expect(page.getByText("You see the citations")).toBeVisible();
  });

  it("shows who it's for section", async () => {
    const page = await goto("/");
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

  it("does not show the site header", async () => {
    const page = await goto("/");
    // The layout header (with nav links like Blog, Pricing) should be hidden;
    // only the landing nav rendered inline by the route should be visible.
    await expect(page.locator("header")).toHaveCount(0);
  });

  it("shows the footer", async () => {
    const page = await goto("/");
    await expect(page.locator("footer")).toBeVisible();
  });

  it("HTML matches baseline", { timeout: 30_000 }, async () => {
    const page = await goto("/");
    await expect(page.locator("main")).toMatchInnerHTML();
  });

  it("screenshot matches baseline", { timeout: 30_000 }, async () => {
    const page = await goto("/");
    await expect(page).toMatchScreenshot();
  });

  it("sign-up CTA navigates to sign-up page", async () => {
    const page = await goto("/");
    await page.getByRole("link", { name: "Start monitoring — free" }).click();
    await page.waitForURL(`http://localhost:${port}/sign-up`);
    expect(new URL(page.url()).pathname).toBe("/sign-up");
  });
});
