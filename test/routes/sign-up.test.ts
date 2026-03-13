import { expect } from "@playwright/test";
import { describe, it } from "vitest";
import { hashPassword } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import { goto, port } from "../helpers/launchBrowser";

const EXISTING_EMAIL = "sign-up-existing@example.com";

describe("sign-up route", () => {
  it("shows the sign-up form", async () => {
    const page = await goto("/sign-up");
    await expect(
      page.getByRole("textbox", { name: "Email", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Password", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Confirm password", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create account" }),
    ).toBeVisible();
  });

  it("shows error when password is too short", async () => {
    const page = await goto("/sign-up");
    await page
      .getByRole("textbox", { name: "Email", exact: true })
      .fill("newuser@example.com");
    await page
      .getByRole("textbox", { name: "Password", exact: true })
      .fill("abc");
    await page
      .getByRole("textbox", { name: "Confirm password", exact: true })
      .fill("abc");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(
      page.getByText("Password must be at least 6 characters"),
    ).toBeVisible();
  });

  it("shows error when passwords do not match", async () => {
    const page = await goto("/sign-up");
    await page
      .getByRole("textbox", { name: "Email", exact: true })
      .fill("newuser@example.com");
    await page
      .getByRole("textbox", { name: "Password", exact: true })
      .fill("password123");
    await page
      .getByRole("textbox", { name: "Confirm password", exact: true })
      .fill("different");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Passwords do not match")).toBeVisible();
  });

  it("shows error for already-registered email", async () => {
    await prisma.user.create({
      data: {
        id: "user-1",
        email: EXISTING_EMAIL,
        passwordHash: await hashPassword("password123"),
      },
    });

    const page = await goto("/sign-up");
    await page
      .getByRole("textbox", { name: "Email", exact: true })
      .fill(EXISTING_EMAIL);
    await page
      .getByRole("textbox", { name: "Password", exact: true })
      .fill("password123");
    await page
      .getByRole("textbox", { name: "Confirm password", exact: true })
      .fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(
      page.getByText("An account with this email already exists"),
    ).toBeVisible();
  });

  it("creates account and redirects to home", async () => {
    const page = await goto("/sign-up");
    await page
      .getByRole("textbox", { name: "Email", exact: true })
      .fill("brand-new@example.com");
    await page
      .getByRole("textbox", { name: "Password", exact: true })
      .fill("password123");
    await page
      .getByRole("textbox", { name: "Confirm password", exact: true })
      .fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(`http://localhost:${port}/sites`);
    expect(new URL(page.url()).pathname).toBe("/sites");
  });

  it("should match visually", async () => {
    const page = await goto("/sign-up");
    await expect(page.locator("main")).toMatchVisual({
      name: "sign-up",
    });
  });

  it("clicks the sign-in button and redirects to sign-in page", async () => {
    const page = await goto("/sign-up");
    await page.getByRole("link", { name: "Sign in" }).click();
    await page.waitForURL("**/sign-in");
    expect(new URL(page.url()).pathname).toBe("/sign-in");
  });
});
