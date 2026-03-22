import { beforeAll, describe, expect, it } from "vitest";
import {
  requireAdminApiKey,
  verifySiteAccess,
  verifyUserAccess,
} from "~/lib/api/apiAuth.server";
import { hashPassword } from "~/lib/auth.server";
import envVars from "~/lib/envVars";
import prisma from "~/lib/prisma.server";

function makeRequest(token?: string) {
  return new Request("http://localhost/api/test", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe("requireAdminApiKey", () => {
  it("should resolve when token matches ADMIN_API_SECRET", async () => {
    await expect(
      requireAdminApiKey(makeRequest(envVars.ADMIN_API_SECRET)),
    ).resolves.toBeUndefined();
  });

  it("should throw 401 Response when token is wrong", async () => {
    const err = await requireAdminApiKey(makeRequest("wrong")).catch((e) => e);
    expect(err).toBeInstanceOf(Response);
    expect((err as Response).status).toBe(401);
  });

  it("should throw 401 Response when no Authorization header", async () => {
    const err = await requireAdminApiKey(makeRequest()).catch((e) => e);
    expect(err).toBeInstanceOf(Response);
    expect((err as Response).status).toBe(401);
  });
});

describe("verifySiteAccess", () => {
  const userId = "api-auth-test-user-1";
  const siteId = "test-site-1";
  const userApiKey = "cite.me.in_test_auth_key_abc123xyz";

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
  const userApiKey = "cite.me.in_test_auth_key_abc123xyz";

  it("should return the user when token matches", async () => {
    const user = await verifyUserAccess({
      email: "api-auth-test@test.example",
      request: makeRequest(userApiKey),
    });
    expect(user.id).toBe(userId);
  });

  it("should throw 404 Response when token is unknown", async () => {
    await expect(
      verifyUserAccess({
        email: "api-auth-test@test.example",
        request: makeRequest("unknown-key"),
      }),
    ).rejects.toThrow(Response);
  });

  it("should throw 404 Response when email is unknown", async () => {
    await expect(
      verifyUserAccess({
        email: "unknown@test.example",
        request: makeRequest(),
      }),
    ).rejects.toThrow(Response);
  });
});
