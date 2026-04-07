import { afterEach, beforeAll, beforeEach, describe, it } from "vitest";
import { type Page, expect } from "@playwright/test";
import { hashPassword } from "~/lib/auth.server";
import { goto, port } from "../helpers/launchBrowser";
import prisma from "~/lib/prisma.server";

const EXISTING_EMAIL = "sign-up-existing@example.com";

describe("sign-up route", () => {
  it("should show the sign-up form", async () => {
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

  it("should show error when password is too short", async () => {
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

  it("should show error when passwords do not match", async () => {
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

  it("should show error for already-registered email", async () => {
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

  describe("valid sign-up", () => {
    let page: Page;

    beforeAll(async () => {
      page = await goto("/sign-up");
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
    });

    it("should redirect to home", async () => {
      expect(new URL(page.url()).pathname).toBe("/sites");
    });

    it("should create account ", async () => {
      const user = await prisma.user.findUnique({
        where: { email: "brand-new@example.com" },
      });
      expect(user).not.toBeNull();
      expect(user?.email).toBe("brand-new@example.com");
      expect(user?.passwordHash).not.toBeNull();
    });
  });

  it("should match visually", async () => {
    const page = await goto("/sign-up");
    await expect(page.locator("main")).toMatchVisual({
      name: "account/sign-up",
    });
  });

  it("should navigate to sign-in page when sign-in button is clicked", async () => {
    const page = await goto("/sign-up");
    await page.getByRole("link", { name: "Sign in" }).click();
    await page.waitForURL("**/sign-in");
    expect(new URL(page.url()).pathname).toBe("/sign-in");
  });

  describe("webhook delivery", () => {
    afterEach(async () => {
      await prisma.user.deleteMany({
        where: { email: "admin-signup-wh@test.com" },
      });
    });

    beforeEach(async () => {
      await prisma.user.deleteMany({
        where: { email: "admin-signup-wh@test.com" },
      });
      await prisma.user.create({
        data: {
          id: "user-signup-wh-admin",
          email: "admin-signup-wh@test.com",
          passwordHash: "test",
          isAdmin: true,
          webhookEndpoints: {
            create: {
              id: "ep-signup-wh-1",
              url: "https://admin.test/hook",
              secret: "test-secret",
              events: ["user.created"],
            },
          },
        },
      });
    });

    it("should emit user.created webhook event on successful sign-up", async () => {
      const email = `signup-wh-${Date.now()}@example.com`;
      const res = await fetch(`http://localhost:${port}/sign-up`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          email,
          password: "password123",
          confirm: "password123",
        }).toString(),
        redirect: "manual",
      });

      expect([200, 302]).toContain(res.status);

      const delivery = await prisma.webhookDelivery.findFirst({
        where: { eventType: "user.created", endpointId: "ep-signup-wh-1" },
      });
      expect(delivery).not.toBeNull();

      await prisma.user.deleteMany({ where: { email } });
    });
  });
});
