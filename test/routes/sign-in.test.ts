import { expect } from "@playwright/test";
import { beforeAll, describe, it } from "vitest";
import { hashPassword } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import { goto } from "~/test/helpers/launchBrowser";
import { port } from "~/test/helpers/launchServer";

const EMAIL = "sign-in-test@example.com";
const PASSWORD = "test-password-123";

describe("sign-in route", () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: "user-1",
        email: EMAIL,
        passwordHash: await hashPassword(PASSWORD),
      },
    });
  });

  it("should show the sign-in form", async () => {
    const page = (await goto("/sign-in")).locator("main");
    await expect(page.getByRole("textbox", { name: "Email", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Password", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  it("should show error for wrong credentials", async () => {
    const page = (await goto("/sign-in")).locator("main");
    await page.getByRole("textbox", { name: "Email", exact: true }).fill(EMAIL);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("email and password do not match")).toBeVisible();
  });

  it("should redirect to home on successful sign-in", async () => {
    const page = await goto("/sign-in");
    await page.locator("main").getByRole("textbox", { name: "Email", exact: true }).fill(EMAIL);
    await page
      .locator("main")
      .getByRole("textbox", { name: "Password", exact: true })
      .fill(PASSWORD);
    await page.locator("main").getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(`http://localhost:${port}/sites`);
    expect(new URL(page.url()).pathname).toBe("/sites");
  });

  it("should match visually", async () => {
    const page = await goto("/sign-in");
    await expect(page.locator("main")).toMatchVisual({
      name: "account/sign-in",
    });
  });

  it("should navigate to sign-up page when sign-up button is clicked", async () => {
    const page = await goto("/sign-in");
    await page.getByRole("link", { name: "Sign up" }).click();
    await page.waitForURL("**/sign-up");
    expect(new URL(page.url()).pathname).toBe("/sign-up");
  });

  it("should navigate to password recovery page when forgot password button is clicked", async () => {
    const page = await goto("/sign-in");
    await page.getByRole("link", { name: "Forgot your password?" }).click();
    await page.waitForURL("**/password-recovery");
    expect(new URL(page.url()).pathname).toBe("/password-recovery");
  });
});
