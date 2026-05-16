import { beforeAll, describe, expect, it } from "vitest";
import {
  approveDeviceCode,
  createAccessToken,
  createDeviceCode,
  generateCodeChallenge,
  generateToken,
  isDeviceCodeApproved,
  revokeToken,
  verifyAccessToken,
  verifyDeviceCode,
} from "~/lib/oauth/server";
import prisma from "~/lib/prisma.server";

describe("generateToken", () => {
  it("should generate a random token", async () => {
    const token = generateToken();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);
  });

  it("should generate unique tokens", async () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateToken());
    }
    expect(tokens.size).toBe(100);
  });

  it("should generate tokens of different lengths based on bytes", async () => {
    const shortToken = generateToken(16);
    const longToken = generateToken(64);
    expect(shortToken.length).toBeLessThan(longToken.length);
  });
});

describe("generateCodeChallenge", () => {
  it("should generate a code challenge from a verifier", async () => {
    const verifier = "test-verifier-123";
    const challenge = generateCodeChallenge(verifier);
    expect(typeof challenge).toBe("string");
    expect(challenge.length).toBeGreaterThan(0);
  });

  it("should generate the same challenge for the same verifier", async () => {
    const verifier = "test-verifier-123";
    const challenge1 = generateCodeChallenge(verifier);
    const challenge2 = generateCodeChallenge(verifier);
    expect(challenge1).toBe(challenge2);
  });

  it("should generate different challenges for different verifiers", async () => {
    const challenge1 = generateCodeChallenge("verifier-1");
    const challenge2 = generateCodeChallenge("verifier-2");
    expect(challenge1).not.toBe(challenge2);
  });
});

describe("createAccessToken and verifyAccessToken", () => {
  const userId = "oauth-test-user-1";
  const testEmail = "oauth-test-1@test.example";
  let clientId: string;

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: testEmail,
        passwordHash: "test-hash",
      },
      update: {},
    });

    const client = await prisma.oAuthClient.create({
      data: {
        name: "Test Client 1",
        clientId: "test-client-id-1",
        clientSecret: "test-client-secret-1",
        redirectUris: ["https://example.com/callback"],
        scopes: ["sites:read", "sites:write"],
      },
    });
    clientId = client.id;
  });

  it("should create access and refresh tokens", async () => {
    const result = await createAccessToken({
      userId,
      clientId,
      scopes: ["sites:read"],
    });

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.expiresIn).toBe(3600);
  });

  it("should verify a valid access token", async () => {
    const { accessToken } = await createAccessToken({
      userId,
      clientId,
      scopes: ["sites:read", "sites:write"],
    });

    const result = await verifyAccessToken(accessToken);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe(userId);
    expect(result?.scopes).toEqual(["sites:read", "sites:write"]);
  });

  it("should return null for invalid token", async () => {
    const result = await verifyAccessToken("invalid-token");
    expect(result).toBeNull();
  });

  it("should return null for expired token", async () => {
    const token = "expired-access-token";
    await prisma.oAuthAccessToken.create({
      data: {
        token,
        userId,
        clientId,
        scopes: ["sites:read"],
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const result = await verifyAccessToken(token);
    expect(result).toBeNull();
  });
});

describe("revokeToken", () => {
  const userId = "oauth-test-user-2";
  const testEmail = "oauth-test-2@test.example";
  let clientId: string;

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: testEmail,
        passwordHash: "test-hash",
      },
      update: {},
    });

    const client = await prisma.oAuthClient.create({
      data: {
        name: "Test Client 2",
        clientId: "test-client-id-2",
        clientSecret: "test-client-secret-2",
        redirectUris: ["https://example.com/callback"],
        scopes: ["sites:read", "sites:write"],
      },
    });
    clientId = client.id;
  });

  it("should revoke an access token", async () => {
    const { accessToken } = await createAccessToken({
      userId,
      clientId,
      scopes: ["sites:read"],
    });

    await revokeToken(accessToken);

    const result = await verifyAccessToken(accessToken);
    expect(result).toBeNull();
  });
});

describe("createDeviceCode and verifyDeviceCode", () => {
  const userId = "oauth-test-user-3";
  const testEmail = "oauth-test-3@test.example";
  let clientId: string;

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: testEmail,
        passwordHash: "test-hash",
      },
      update: {},
    });

    const client = await prisma.oAuthClient.create({
      data: {
        name: "Test Client 3",
        clientId: "test-client-id-3",
        clientSecret: "test-client-secret-3",
        redirectUris: ["https://example.com/callback"],
        scopes: ["sites:read", "sites:write"],
      },
    });
    clientId = client.id;
  });

  it("should create a device code", async () => {
    const result = await createDeviceCode({
      userId,
      clientId,
      scopes: ["sites:read"],
    });

    expect(result.deviceCode).toBeDefined();
    expect(result.expiresIn).toBe(900);
  });

  it("should verify a device code", async () => {
    const { deviceCode } = await createDeviceCode({
      userId,
      clientId,
      scopes: ["sites:read"],
    });

    const result = await verifyDeviceCode(deviceCode);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe(userId);
    expect(result?.clientId).toBe(clientId);
    expect(result?.scopes).toEqual(["sites:read"]);
  });

  it("should return null for invalid device code", async () => {
    const result = await verifyDeviceCode("invalid-device-code");
    expect(result).toBeNull();
  });
});

describe("approveDeviceCode and isDeviceCodeApproved", () => {
  const userId = "oauth-test-user-4";
  const testEmail = "oauth-test-4@test.example";
  let clientId: string;

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: testEmail,
        passwordHash: "test-hash",
      },
      update: {},
    });

    const client = await prisma.oAuthClient.create({
      data: {
        name: "Test Client 4",
        clientId: "test-client-id-4",
        clientSecret: "test-client-secret-4",
        redirectUris: ["https://example.com/callback"],
        scopes: ["sites:read", "sites:write"],
      },
    });
    clientId = client.id;
  });

  it("should not be approved initially", async () => {
    const { deviceCode } = await createDeviceCode({
      userId,
      clientId,
      scopes: ["sites:read"],
    });

    const approved = await isDeviceCodeApproved(deviceCode);
    expect(approved).toBe(false);
  });

  it("should be approved after approval", async () => {
    const { deviceCode } = await createDeviceCode({
      userId,
      clientId,
      scopes: ["sites:read"],
    });

    await approveDeviceCode(deviceCode);

    const approved = await isDeviceCodeApproved(deviceCode);
    expect(approved).toBe(true);
  });

  it("should return false for non-existent code", async () => {
    const approved = await isDeviceCodeApproved("non-existent-code");
    expect(approved).toBe(false);
  });
});
