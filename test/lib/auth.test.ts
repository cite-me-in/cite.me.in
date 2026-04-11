import { beforeAll, describe, expect, it } from "vitest";
import {
  createSession,
  hashPassword,
  requireSiteAccess,
  requireSiteOwner,
  requireUserAccess,
  signOut,
  verifyPassword,
} from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";

function makeRequest(options?: {
  cookie?: string;
  ip?: string;
  userAgent?: string;
  referer?: string;
  url?: string;
}): Request {
  const headers: Record<string, string> = {};
  if (options?.cookie) headers.Cookie = options.cookie;
  if (options?.ip) headers["x-forwarded-for"] = options.ip;
  if (options?.userAgent) headers["user-agent"] = options.userAgent;
  if (options?.referer) headers.referer = options.referer;
  return new Request(options?.url ?? "http://localhost/test", { headers });
}

describe("hashPassword and verifyPassword", () => {
  it("should hash a password", async () => {
    const hash = await hashPassword("password123");
    expect(typeof hash).toBe("string");
    expect(hash).not.toBe("password123");
    expect(hash.length).toBeGreaterThan(50);
  });

  it("should verify correct password", async () => {
    const hash = await hashPassword("password123");
    const result = await verifyPassword("password123", hash);
    expect(result).toBe(true);
  });

  it("should reject wrong password", async () => {
    const hash = await hashPassword("password123");
    const result = await verifyPassword("wrongpassword", hash);
    expect(result).toBe(false);
  });
});

describe("createSession", () => {
  const userId = "auth-test-user-1";
  const testEmail = "auth-test-1@test.example";

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: testEmail,
        passwordHash: await hashPassword("password"),
      },
      update: {},
    });
  });

  it("should create a session and return cookie", async () => {
    const request = makeRequest({
      ip: "192.168.1.1",
      userAgent: "TestAgent/1.0",
    });
    const cookie = await createSession(userId, request);
    expect(cookie).toContain("session=");
  });

  it("should store session data in database", async () => {
    const request = makeRequest({
      ip: "10.0.0.1",
      userAgent: "TestAgent/2.0",
    });
    await createSession(userId, request);

    const session = await prisma.session.findFirst({
      where: { userId, ipAddress: "10.0.0.1" },
      orderBy: { createdAt: "desc" },
    });
    expect(session).toBeDefined();
    expect(session?.userAgent).toBe("TestAgent/2.0");
  });
});

describe("signOut", () => {
  it("should return headers with cleared session cookie", async () => {
    const headers = await signOut();
    const cookie = headers.get("set-cookie");
    expect(cookie).toContain("session=");
    expect(cookie).toContain("Max-Age=0");
  });
});

describe("requireUserAccess", () => {
  const userId = "auth-test-user-2";
  const testEmail = "auth-test-2@test.example";
  let sessionToken: string;

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: testEmail,
        passwordHash: await hashPassword("password"),
      },
      update: {},
    });

    const request = makeRequest();
    const cookie = await createSession(userId, request);
    const match = cookie.match(/session=([^;]+)/);
    sessionToken = match?.[1] ?? "";
  });

  it("should return user when authenticated", async () => {
    const request = makeRequest({ cookie: `session=${sessionToken}` });
    const result = await requireUserAccess(request);
    expect(result.user.id).toBe(userId);
    expect(result.user.email).toBe(testEmail);
  });

  it("should redirect when not authenticated", async () => {
    const request = makeRequest();
    await expect(requireUserAccess(request)).rejects.toThrow();
  });
});

describe("requireSiteAccess", () => {
  const ownerId = "auth-test-owner";
  const otherUserId = "auth-test-other";
  const siteId = "auth-test-site";
  const domain = "auth-test-site.example";
  let ownerToken: string;
  let otherUserToken: string;

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: ownerId },
      create: {
        id: ownerId,
        email: "auth-owner@test.example",
        passwordHash: await hashPassword("password"),
        ownedSites: {
          create: {
            id: siteId,
            domain,
            content: "",
            summary: "",
            apiKey: crypto.randomUUID(),
          },
        },
      },
      update: {},
    });

    await prisma.user.upsert({
      where: { id: otherUserId },
      create: {
        id: otherUserId,
        email: "auth-other@test.example",
        passwordHash: await hashPassword("password"),
      },
      update: {},
    });

    const ownerCookie = await createSession(ownerId, makeRequest());
    const otherCookie = await createSession(otherUserId, makeRequest());
    ownerToken = ownerCookie.match(/session=([^;]+)/)?.[1] ?? "";
    otherUserToken = otherCookie.match(/session=([^;]+)/)?.[1] ?? "";
  });

  it("should return site for owner", async () => {
    const request = makeRequest({ cookie: `session=${ownerToken}` });
    const result = await requireSiteAccess({ domain, request });
    expect(result.site.id).toBe(siteId);
    expect(result.user.id).toBe(ownerId);
  });

  it("should throw 404 for user without access", async () => {
    const request = makeRequest({ cookie: `session=${otherUserToken}` });
    await expect(requireSiteAccess({ domain, request })).rejects.toSatisfy(
      (e) => e instanceof Response && e.status === 404,
    );
  });

  it("should throw 404 for non-existent site", async () => {
    const request = makeRequest({ cookie: `session=${ownerToken}` });
    await expect(
      requireSiteAccess({ domain: "nonexistent.example", request }),
    ).rejects.toSatisfy((e) => e instanceof Response && e.status === 404);
  });
});

describe("requireSiteOwner", () => {
  const ownerId = "auth-test-owner-2";
  const siteUserId = "auth-test-siteuser";
  const siteId = "auth-test-site-2";
  const domain = "auth-test-site-2.example";
  let ownerToken: string;
  let siteUserToken: string;

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: ownerId },
      create: {
        id: ownerId,
        email: "auth-owner-2@test.example",
        passwordHash: await hashPassword("password"),
        ownedSites: {
          create: {
            id: siteId,
            domain,
            content: "",
            summary: "",
            apiKey: crypto.randomUUID(),
          },
        },
      },
      update: {},
    });

    await prisma.user.upsert({
      where: { id: siteUserId },
      create: {
        id: siteUserId,
        email: "auth-siteuser@test.example",
        passwordHash: await hashPassword("password"),
        siteUsers: {
          create: {
            siteId,
          },
        },
      },
      update: {},
    });

    const ownerCookie = await createSession(ownerId, makeRequest());
    const siteUserCookie = await createSession(siteUserId, makeRequest());
    ownerToken = ownerCookie.match(/session=([^;]+)/)?.[1] ?? "";
    siteUserToken = siteUserCookie.match(/session=([^;]+)/)?.[1] ?? "";
  });

  it("should return site for owner", async () => {
    const request = makeRequest({ cookie: `session=${ownerToken}` });
    const result = await requireSiteOwner({ domain, request });
    expect(result.site.id).toBe(siteId);
    expect(result.user.id).toBe(ownerId);
  });

  it("should throw 404 for site user (not owner)", async () => {
    const request = makeRequest({ cookie: `session=${siteUserToken}` });
    await expect(requireSiteOwner({ domain, request })).rejects.toSatisfy(
      (e) => e instanceof Response && e.status === 404,
    );
  });
});
