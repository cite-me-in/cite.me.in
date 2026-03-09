import bcrypt from "bcryptjs";
import { redirect } from "react-router";
import {
  type UtmCookieData,
  sessionCookie,
  utmCookie,
} from "~/lib/cookies.server";
import prisma from "~/lib/prisma.server";
import type { Prisma } from "~/prisma";

/**
 * Hashes a password using bcrypt.
 *
 * @param password - The password to hash
 * @returns The hashed password (string)
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verifies a password against a hash.
 *
 * @param password - The password to verify
 * @param hash - The hash to verify against
 * @returns True if the password matches the hash, otherwise false (boolean)
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Creates a session for the user.
 *
 * @param userId - The user ID
 * @param request - The request object
 * @returns The session cookie (string)
 */
export async function createSession(
  userId: string,
  request: Request,
): Promise<string> {
  const cookieHeader = request.headers.get("Cookie");
  const utm = await utmCookie.parse(cookieHeader);

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;

  const token = crypto.randomUUID();

  await prisma.session.create({
    data: {
      token,
      userId,
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
      referrer: utm?.referrer ?? null,
      utmSource: utm?.utmSource ?? null,
      utmMedium: utm?.utmMedium ?? null,
      utmCampaign: utm?.utmCampaign ?? null,
      utmTerm: utm?.utmTerm ?? null,
      utmContent: utm?.utmContent ?? null,
    },
  });

  return sessionCookie.serialize(token);
}

/**
 * Creates a email verification token for the user.
 *
 * @param userId - The user ID
 * @returns The token (string) and the expiration date (Date)
 */
export async function createEmailVerificationToken(
  userId: string,
): Promise<string> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await prisma.emailVerificationToken.create({
    data: { token, userId, expiresAt },
  });
  return token;
}

/**
 * Signs out the user by clearing the session cookie.
 *
 * @returns The headers object with the session cookie cleared
 */
export async function signOut(): Promise<Headers> {
  return new Headers({
    "set-cookie": await sessionCookie.serialize("", { maxAge: 0 }),
  });
}

/**
 * Gets the current user from the session cookie.
 *
 * @param request - The request object
 * @returns The user object if found, otherwise null
 */
export async function getCurrentUser(
  request: Request,
): Promise<Prisma.UserGetPayload<{ include: { account: true } }> | null> {
  const cookieHeader = request.headers.get("Cookie");
  const token = await sessionCookie.parse(cookieHeader);
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { account: true } } },
  });
  return session?.user ?? null;
}

/**
 * Requires a user to be authenticated. If the user is not authenticated, it redirects to the sign-in page.
 *
 * @param request - The request object
 * @returns The user object if found, otherwise redirects to the sign-in page
 */
export async function requireUser(
  request: Request,
): Promise<Prisma.UserGetPayload<{ include: { account: true } }>> {
  const user = await getCurrentUser(request);
  if (user) return user;

  const url = new URL(request.url);
  const utmData: UtmCookieData = {
    referrer: request.headers.get("Referer") ?? null,
    utmSource: url.searchParams.get("utm_source"),
    utmMedium: url.searchParams.get("utm_medium"),
    utmCampaign: url.searchParams.get("utm_campaign"),
    utmTerm: url.searchParams.get("utm_term"),
    utmContent: url.searchParams.get("utm_content"),
  };
  throw redirect("/sign-in", {
    headers: { "Set-Cookie": await utmCookie.serialize(utmData) },
  });
}
