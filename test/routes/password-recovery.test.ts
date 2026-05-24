import { expect } from "@playwright/test";
import { beforeAll, describe, it } from "vitest";
import { hashPassword } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import { goto } from "~/test/helpers/launchBrowser";

const EMAIL = "recovery-test@example.com";
const PASSWORD = "test-password-123";

describe("password recovery route", () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: "user-1",
        email: EMAIL,
        passwordHash: await hashPassword(PASSWORD),
      },
    });
  });

  it("should show the recovery form", async () => {
    const page = await goto("/password-recovery");
    await expect(page.getByRole("textbox", { name: "Email", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send recovery link" })).toBeVisible();
  });

  it("should show confirmation for unknown email without creating a token", async () => {
    const page = await goto("/password-recovery");
    await page.getByRole("textbox", { name: "Email", exact: true }).fill("nobody@example.com");
    await page.getByRole("button", { name: "Send recovery link" }).click();
    await expect(page.getByText("Check your email")).toBeVisible();
    const count = await prisma.passwordRecoveryToken.count({
      where: { user: { email: "nobody@example.com" } },
    });
    expect(count).toBe(0);
  });

  it("should show confirmation for known email and creates a recovery token", async () => {
    const page = await goto("/password-recovery");
    await page.getByRole("textbox", { name: "Email", exact: true }).fill(EMAIL);
    await page.getByRole("button", { name: "Send recovery link" }).click();
    await expect(page.getByText("Check your email")).toBeVisible();
    const token = await prisma.passwordRecoveryToken.findFirstOrThrow({
      where: { user: { email: EMAIL } },
      orderBy: { createdAt: "desc" },
    });
    expect(token.usedAt).toBeNull();
  });

  it("should sign user in and redirect to home when valid reset link is clicked", async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: EMAIL },
    });
    const { token } = await prisma.passwordRecoveryToken.create({
      data: {
        token: crypto.randomUUID(),
        userId: user.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const page = await goto(`/reset-password/${token}`);
    expect(new URL(page.url()).pathname).toBe("/sites");
  });

  it("should show link-expired card when expired reset link is clicked", async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: EMAIL },
    });
    const { token } = await prisma.passwordRecoveryToken.create({
      data: {
        token: crypto.randomUUID(),
        userId: user.id,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    const page = await goto(`/reset-password/${token}`);
    await expect(page.getByText("Link expired")).toBeVisible();
  });

  it("should match visually", async () => {
    const page = await goto("/password-recovery");
    await expect(page.locator("main")).toMatchVisual({
      name: "account/password-recovery",
    });
  });

  it("should navigate to sign-in page when sign-in button is clicked", async () => {
    const page = await goto("/password-recovery");
    await page.getByRole("link", { name: "Back to sign in" }).click();
    await page.waitForURL("**/sign-in");
    expect(new URL(page.url()).pathname).toBe("/sign-in");
  });
});
