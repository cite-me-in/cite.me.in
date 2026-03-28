import { beforeAll, describe, expect, it } from "vitest";
import {
  requireAdmin,
  verifySiteAccess,
  verifyUserAccess,
} from "~/lib/api/apiAuth.server";
import { hashPassword } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";

function makeRequest(token?: string) {
  return new Request("http://localhost/api/test", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe("requireAdmin", () => {
  const adminId = "api-auth-admin-user-1";
  const adminApiKey = `cite.me.in_${adminId}_adminapikey1234567890`;

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: adminId },
      create: {
        id: adminId,
        email: "api-auth-admin@test.example",
        passwordHash: await hashPassword("password"),
        apiKey: adminApiKey,
        isAdmin: true,
      },
      update: { apiKey: adminApiKey, isAdmin: true },
    });
  });

  it("should return the user when token is an admin", async () => {
    const user = await requireAdmin(makeRequest(adminApiKey));
    expect(user.id).toBe(adminId);
  });

  it("should throw 401 when no Authorization header", async () => {
    const err = await requireAdmin(makeRequest()).catch((e) => e);
    expect(err).toBeInstanceOf(Response);
    expect((err as Response).status).toBe(401);
  });

  it("should throw 403 when user is not an admin", async () => {
    // Use the non-admin user seeded in verifySiteAccess describe
    const nonAdminKey = "cite.me.in_api-auth-test-user-1_testabcdefghijklmnop";
    const err = await requireAdmin(makeRequest(nonAdminKey)).catch((e) => e);
    expect(err).toBeInstanceOf(Response);
    expect((err as Response).status).toBe(403);
  });

  it("should throw 404 when token is unknown", async () => {
    await expect(
      requireAdmin(makeRequest("cite.me.in_nonexistent-user_wrongsecret")),
    ).rejects.toThrow(Response);
  });
});

describe("verifySiteAccess", () => {
  const userId = "api-auth-test-user-1";
  const siteId = "test-site-1";
  const userApiKey = "cite.me.in_api-auth-test-user-1_testabcdefghijklmnop";

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: "api-auth-test@test.example",
        passwordHash: await hashPassword("password"),
        apiKey: userApiKey,
        ownedSites: {
          create: {
            apiKey: userApiKey,
            content: "Test content",
            domain: "test.example",
            id: siteId,
            summary: "Test summary",
          },
        },
      },
      update: { apiKey: userApiKey },
    });
  });

  it("should return the site when token matches", async () => {
    const site = await verifySiteAccess({
      domain: "test.example",
      request: makeRequest(userApiKey),
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
  const userId = "api-auth-test-user-1";
  const userApiKey = "cite.me.in_api-auth-test-user-1_testabcdefghijklmnop";

  it("should return the user when token matches", async () => {
    const user = await verifyUserAccess(makeRequest(userApiKey));
    expect(user.id).toBe(userId);
  });

  it("should throw 401 when no Authorization header", async () => {
    const err = await verifyUserAccess(makeRequest()).catch((e) => e);
    expect(err).toBeInstanceOf(Response);
    expect((err as Response).status).toBe(401);
  });

  it("should throw 404 Response when token is unknown", async () => {
    await expect(
      verifyUserAccess(makeRequest("cite.me.in_api-auth-test-user-1_wrongsecret")),
    ).rejects.toThrow(Response);
  });

  it("should throw 404 when userId in token doesn't exist", async () => {
    await expect(
      verifyUserAccess(makeRequest("cite.me.in_nonexistent-user-id_testabcdef")),
    ).rejects.toThrow(Response);
  });
});
