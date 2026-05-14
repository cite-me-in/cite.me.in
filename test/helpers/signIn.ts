import type { BrowserContext } from "playwright";
import { sessionCookie } from "~/lib/cookies.server";
import prisma from "~/lib/prisma.server";
import { newContext } from "./launchBrowser";

/**
 * Create a session in the database for the given user and inject the signed
 * session cookie into the shared Playwright browser context. Call this before
 * goto() so the browser is already authenticated.
 */
export async function signIn(userId: string): Promise<BrowserContext> {
  const token = crypto.randomUUID();

  await prisma.session.create({
    data: { token, userId, ipAddress: "127.0.0.1", userAgent: "Playwright" },
  });

  const setCookieHeader = await sessionCookie.serialize(token);
  // Extract the raw encoded value from "session=<value>; Path=/; ..."
  const cookieValue = setCookieHeader.split(";")[0].split("=").slice(1).join("=");

  const ctx = await newContext();
  await ctx.addCookies([
    {
      name: "session",
      value: cookieValue,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  return ctx;
}
