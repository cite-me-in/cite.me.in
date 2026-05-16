import { beforeAll, describe, expect, it } from "vitest";
import { requireAdmin, verifySiteAccess, verifyUserAccess } from "~/lib/api/apiAuth.server";
import { hashPassword } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";

function makeRequest(token?: string) {
  return new Request("http://localhost/api/test", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe("requireAdmin", () => {
  const userId = "user1";
  const apiKey = `cite.me.in_${userId}_adminapikey1234567890`;

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: `${userId}@test.example`,
        passwordHash: await hashPassword("password"),
        apiKey: apiKey,
        isAdmin: true,
      },
      update: { apiKey: apiKey, isAdmin: true },
    });
  });

  it("should return the user when token is an admin", async () => {
    const user = await requireAdmin(makeRequest(apiKey));
    expect(user.id).toBe(userId);
  });

  it("should throw 401 when no Authorization header", async () => {
    let caught: unknown;
    try {
      await requireAdmin(makeRequest());
    } catch (e) {
      caught = e;
    }
    expect(caught instanceof Response && caught.status === 401).toBe(true);
  });

  it("should throw 403 when user is not an admin", async () => {
    const nonAdminKey = `cite.me.in_${userId}_testabcdefghijklmnop`;
    let caught: unknown;
    try {
      await requireAdmin(makeRequest(nonAdminKey));
    } catch (e) {
      caught = e;
    }
    expect(caught instanceof Response && caught.status === 403).toBe(true);
  });

  it("should throw 403 when token is unknown", async () => {
    let caught: unknown;
    try {
      await requireAdmin(makeRequest("cite.me.in_nonexistent-user_wrongsecret"));
    } catch (e) {
      caught = e;
    }
    expect(caught instanceof Response && caught.status === 403).toBe(true);
  });
});

describe("verifySiteAccess", () => {
  const userId = "user2";
  const siteId = "test-site-1";
  const apiKey = `cite.me.in_${userId}_testabcdefghijklmnop`;

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: `${userId}@test.example`,
        passwordHash: await hashPassword("password"),
        apiKey: apiKey,
        ownedSites: {
          create: {
            apiKey: apiKey,
            content: "Test content",
            domain: "test.example",
            id: siteId,
            summary: "Test summary",
          },
        },
      },
      update: { apiKey: apiKey },
    });
  });

  it("should return the site when token matches", async () => {
    const site = await verifySiteAccess({
      domain: "test.example",
      request: makeRequest(apiKey),
    });
    expect(site.id).toBe(siteId);
  });

  it("should throw 404 Response when token is unknown", async () => {
    await expect(
      verifySiteAccess({
        domain: "test.example",
        request: makeRequest("unknown-key"),
      }),
    ).rejects.toThrow(Response);
  });

  it("should throw 404 Response when domain is unknown", async () => {
    await expect(
      verifySiteAccess({
        domain: "unknown.example",
        request: makeRequest(),
      }),
    ).rejects.toThrow(Response);
  });
});

describe("verifyUserAccess", () => {
  const userId = "user3";
  const apiKey = `cite.me.in_${userId}_testabcdefghijklmnop`;

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: `${userId}@test.example`,
        passwordHash: await hashPassword("password"),
        apiKey: apiKey,
      },
      update: { apiKey: apiKey },
    });
  });

  it("should return the user when token matches", async () => {
    const user = await verifyUserAccess(makeRequest(apiKey));
    expect(user.id).toBe(userId);
  });

  it("should throw 401 when no Authorization header", async () => {
    let caught: unknown;
    try {
      await verifyUserAccess(makeRequest());
    } catch (e) {
      caught = e;
    }
    expect(caught instanceof Response && caught.status === 401).toBe(true);
  });

  it("should throw 404 Response when token is unknown", async () => {
    let caught: unknown;
    try {
      await verifyUserAccess(makeRequest(`cite.me.in_${userId}_wrongsecret`));
    } catch (e) {
      caught = e;
    }
    expect(caught instanceof Response && caught.status === 403).toBe(true);
  });

  it("should throw 404 when userId in token doesn't exist", async () => {
    let caught: unknown;
    try {
      await verifyUserAccess(makeRequest("cite.me.in_nonexistent-user-id_testabcdef"));
    } catch (e) {
      caught = e;
    }
    expect(caught instanceof Response && caught.status === 403).toBe(true);
  });
});
