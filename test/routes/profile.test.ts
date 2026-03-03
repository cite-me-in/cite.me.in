import { type Page, expect } from "@playwright/test";
import { beforeAll, describe, it } from "vitest";
import { hashPassword, verifyPassword } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import type { User } from "~/prisma";
import { goto, port } from "../helpers/launchBrowser";
import { signIn } from "../helpers/signIn";

const EMAIL = "profile-test@example.com";
const PASSWORD = "correct-password-123";

describe("unauthenticated access", () => {
  it("redirects to /sign-in", async () => {
    const response = await fetch(`http://localhost:${port}/profile`, {
      redirect: "manual",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/sign-in");
  });
});

describe("profile route", () => {
  let user: User;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        id: "user-1",
        email: EMAIL,
        passwordHash: await hashPassword(PASSWORD),
        account: { create: { id: "account-1" } },
      },
    });
    await signIn(user.id);
  });

  describe("email update", () => {
    let page: Page;

    beforeAll(async () => {
      page = await goto("/profile");
    });

    it("shows email tab with current email pre-filled", async () => {
      await expect(page.getByRole("textbox", { name: "email" })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "email" })).toHaveValue(
        EMAIL,
      );
      await expect(
        page.getByRole("button", { name: "Update Email" }),
      ).toBeVisible();
    });

    it("HTML matches baseline", { timeout: 30_000 }, async () => {
      await expect(page.locator("main")).toMatchInnerHTML({
        name: "profile-email-update",
      });
    });

    it("screenshot matches baseline", { timeout: 30_000 }, async () => {
      await expect(page.locator("main")).toMatchScreenshot({
        name: "profile-email-update",
      });
    });

    it("shows error for invalid email", async () => {
      await page
        .getByRole("textbox", { name: "email" })
        .fill("invalid-email@here");
      await page.getByRole("button", { name: "Update Email" }).click();
      await expect(page.getByText("Enter a valid email address")).toBeVisible();
    });

    it("shows error for already-used email", async () => {
      await prisma.user.create({
        data: {
          id: "user-2",
          email: "existing-email@example.com",
          passwordHash: await hashPassword(PASSWORD),
          account: { create: { id: "account-2" } },
        },
      });

      await page
        .getByRole("textbox", { name: "email" })
        .fill("existing-email@example.com");
      await page.getByRole("button", { name: "Update Email" }).click();
      await expect(
        page.getByText("Email address is already in use"),
      ).toBeVisible();
    });

    describe("success", () => {
      beforeAll(async () => {
        await page
          .getByRole("textbox", { name: "email" })
          .fill("newemail@example.com");
        await page.getByRole("button", { name: "Update Email" }).click();
      });

      it("shows success after correct email update", async () => {
        await expect(
          page.getByText("Email updated successfully"),
        ).toBeVisible();
      });

      it("updates the user record with new email", async () => {
        const updatedUser = await prisma.user.findUniqueOrThrow({
          where: { id: user.id },
        });
        expect(updatedUser.email).toBe("newemail@example.com");
      });
    });
  });

  describe("password update", () => {
    let page: Page;

    beforeAll(async () => {
      page = await goto("/profile");
      await page.getByText("Password").click();
    });

    it("shows password fields after switching to password tab", async () => {
      await expect(
        page.getByRole("textbox", { name: "Current password" }),
      ).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: "New password", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: "Confirm new password" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Change password" }),
      ).toBeVisible();
    });

    it("HTML matches baseline", { timeout: 30_000 }, async () => {
      await expect(page.locator("main")).toMatchInnerHTML({
        name: "profile-password-update",
      });
    });

    it("screenshot matches baseline", { timeout: 30_000 }, async () => {
      await expect(page.locator("main")).toMatchScreenshot({
        name: "profile-password-update",
      });
    });

    it("shows error for wrong current password", async () => {
      await page
        .getByRole("textbox", { name: "Current password" })
        .fill("wrong-password");
      await page
        .getByRole("textbox", { name: "New password", exact: true })
        .fill("newpassword123");
      await page
        .getByRole("textbox", { name: "Confirm new password" })
        .fill("newpassword123");
      await page.getByRole("button", { name: "Change password" }).click();
      await expect(
        page.getByText("Current password is incorrect"),
      ).toBeVisible();
    });

    it("shows error when passwords do not match", async () => {
      await page
        .getByRole("textbox", { name: "Current password" })
        .fill(PASSWORD);
      await page
        .getByRole("textbox", { name: "New password", exact: true })
        .fill("newpassword123");
      await page
        .getByRole("textbox", { name: "Confirm new password" })
        .fill("different456");
      await page.getByRole("button", { name: "Change password" }).click();
      await expect(page.getByText("Passwords do not match")).toBeVisible();
    });

    it("shows success after correct password change", async () => {
      await page
        .getByRole("textbox", { name: "Current password" })
        .fill(PASSWORD);
      await page
        .getByRole("textbox", { name: "New password", exact: true })
        .fill("newpassword456");
      await page
        .getByRole("textbox", { name: "Confirm new password" })
        .fill("newpassword456");
      await page.getByRole("button", { name: "Change password" }).click();
      await expect(
        page.getByText("Password changed successfully"),
      ).toBeVisible();
    });

    describe("password change", () => {
      beforeAll(async () => {
        await page
          .getByRole("textbox", { name: "Current password" })
          .fill(PASSWORD);
        await page
          .getByRole("textbox", { name: "New password", exact: true })
          .fill("newpassword456");
        await page
          .getByRole("textbox", { name: "Confirm new password" })
          .fill("newpassword456");
        await page.getByRole("button", { name: "Change password" }).click();
      });

      it("shows success after correct password change", async () => {
        await expect(
          page.getByText("Password changed successfully"),
        ).toBeVisible();
      });

      it("updates the user record with new password", async () => {
        const updatedUser = await prisma.user.findUniqueOrThrow({
          where: { id: user.id },
        });
        expect(await verifyPassword(PASSWORD, updatedUser.passwordHash)).toBe(
          false,
        );
        expect(
          await verifyPassword("newpassword456", updatedUser.passwordHash),
        ).toBe(true);
      });
    });
  });
});
