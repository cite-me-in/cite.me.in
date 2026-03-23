import bcrypt from "bcryptjs";
import { redirect } from "react-router";
import { sessionCookie, utmCookie } from "~/lib/cookies.server";
import prisma from "~/lib/prisma.server";

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
      referer: utm?.referer ?? null,
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
 * Requires the user to be authenticated.  If the user is not authenticated, it
 * redirects to the sign-in page. The UTM cookie holds the referrer and UTM
 * query string parameters.
 *
 * @param request - The request object
 * @returns The user object with the email, account, owned sites, and site users
 * @throws {Response} - Redirects to the sign-in page if the user is not authenticated
 */
export async function requireUserAccess(request: Request): Promise<{
  user: {
    apiKey: string | null;
    createdAt: Date;
    email: string;
    id: string;
    passwordHash: string;
  };
  account: { status: string; interval: string } | null;
  ownedSites: { id: string; domain: string }[];
  siteUsers: { site: { id: string; domain: string } }[];
}> {
  const cookieHeader = request.headers.get("Cookie");
  const token = await sessionCookie.parse(cookieHeader);
  if (token) {
    const session = await prisma.session.findUnique({
      where: { token },
      select: {
        user: {
          select: {
            apiKey: true,
            createdAt: true,
            email: true,
            id: true,
            passwordHash: true,
            account: { select: { status: true, interval: true } },
            ownedSites: { select: { domain: true, id: true } },
            siteUsers: {
              select: { site: { select: { domain: true, id: true } } },
            },
          },
        },
      },
    });
    if (session)
      return {
        user: session.user,
        account: session.user.account,
        ownedSites: session.user.ownedSites,
        siteUsers: session.user.siteUsers,
      };
  }

  const url = new URL(request.url);
  const cookie = await utmCookie.serialize({
    referer: request.headers.get("referer") ?? null,
    utmSource: url.searchParams.get("utm_source"),
    utmMedium: url.searchParams.get("utm_medium"),
    utmCampaign: url.searchParams.get("utm_campaign"),
    utmTerm: url.searchParams.get("utm_term"),
    utmContent: url.searchParams.get("utm_content"),
  });
  throw redirect("/sign-in", {
    headers: { "Set-Cookie": cookie },
  });
}

/**
 * Requires the user to have access to the site with the given domain. If the
 * user does not have access, it throws a 404 response.
 *
 * @param domain - The domain of the site to check access for
 * @param request - The request object
 * @returns The site with the given domain if the user has access and the user
 * object with the email
 * @throws {Response} - Throws a 404 response if the user does not have access
 */
export async function requireSiteAccess({
  domain,
  request,
}: {
  domain: string;
  request: Request;
}): Promise<{
  site: { id: string; domain: string };
  user: { id: string; email: string };
}> {
  const { user, ownedSites, siteUsers } = await requireUserAccess(request);
  const site =
    ownedSites.find((s) => s.domain === domain) ||
    siteUsers.find((s) => s.site.domain === domain)?.site;
  if (site) return { site, user };
  else throw new Response("Not found", { status: 404 });
}

/**
 * Requires the user to be the owner of the site with the given domain. If the
 * user is not the owner, it throws a 403 response.
 *
 * @param domain - The domain of the site to check access for
 * @param request - The request object
 * @returns The site with the given domain if the user is the owner and the user
 * object
 * @throws {Response} - Throws a 404 response if the site is not found
 */
export async function requireSiteOwner({
  domain,
  request,
}: {
  domain: string;
  request: Request;
}): Promise<{
  site: { id: string; domain: string };
  user: { id: string; email: string };
}> {
  const { user, ownedSites } = await requireUserAccess(request);
  const site = ownedSites.find((s) => s.domain === domain);
  if (site) return { site, user };
  else throw new Response("Not found", { status: 404 });
}
