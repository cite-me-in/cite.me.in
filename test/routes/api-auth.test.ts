import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { requireAdminApiKey, requireUserByApiKey } from "~/lib/api-auth.server";
import { hashPassword } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";

const TEST_ADMIN_SECRET = "test-admin-secret-xyz";

function makeRequest(token?: string) {
  return new Request("http://localhost/api/test", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe("requireAdminApiKey", () => {
  beforeAll(() => {
    process.env.ADMIN_API_SECRET = TEST_ADMIN_SECRET;
  });

  it("resolves when token matches ADMIN_API_SECRET", async () => {
    await expect(requireAdminApiKey(makeRequest(TEST_ADMIN_SECRET))).resolves.toBeUndefined();
  });

  it("throws 401 Response when token is wrong", async () => {
    const err = await requireAdminApiKey(makeRequest("wrong")).catch((e) => e);
    expect(err).toBeInstanceOf(Response);
    expect((err as Response).status).toBe(401);
  });

  it("throws 401 Response when no Authorization header", async () => {
    const err = await requireAdminApiKey(makeRequest()).catch((e) => e);
    expect(err).toBeInstanceOf(Response);
    expect((err as Response).status).toBe(401);
  });
});

describe("requireUserByApiKey", () => {
  const userId = "api-auth-test-user-1";
  const userApiKey = "cite.me.in_test_auth_key_abc123xyz";

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: "api-auth-test@test.example",
        passwordHash: await hashPassword("password"),
        apiKey: userApiKey,
      },
      update: { apiKey: userApiKey },
    });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
  });

  it("returns user when token matches", async () => {
    const user = await requireUserByApiKey(makeRequest(userApiKey));
    expect(user.id).toBe(userId);
  });

  it("throws 401 Response when token is unknown", async () => {
    const err = await requireUserByApiKey(makeRequest("unknown-key")).catch((e) => e);
    expect(err).toBeInstanceOf(Response);
    expect((err as Response).status).toBe(401);
  });

  it("throws 401 Response when no Authorization header", async () => {
    const err = await requireUserByApiKey(makeRequest()).catch((e) => e);
    expect(err).toBeInstanceOf(Response);
    expect((err as Response).status).toBe(401);
  });
});
