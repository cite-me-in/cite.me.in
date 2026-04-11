import bcrypt from "bcryptjs";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import prisma from "~/lib/prisma.server";
import { port } from "../../helpers/launchBrowser";

describe("OAuth Routes", () => {
  let user: { id: string; email: string };
  let oauthClient: { id: string; clientId: string; clientSecret: string };

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        email: "test@example.com",
        passwordHash: await bcrypt.hash("password", 10),
        plan: "trial",
      },
    });
    oauthClient = await prisma.oAuthClient.create({
      data: {
        name: "Test Client",
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUris: ["https://example.com/callback"],
        scopes: ["sites:read", "sites:write"],
      },
    });
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe("Device Flow", () => {
    it("should start device flow", async () => {
      const res = await fetch(
        `http://localhost:${port}/oauth/device/authorize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: oauthClient.clientId,
            client_secret: oauthClient.clientSecret,
            scope: "sites:read",
          }),
        },
      );

      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.device_code).toBeDefined();
      expect(data.user_code).toBeDefined();
      expect(data.verification_uri).toBeDefined();
      expect(data.expires_in).toBe(900);
      expect(data.interval).toBe(5);
    });

    it("should reject invalid client", async () => {
      const res = await fetch(
        `http://localhost:${port}/oauth/device/authorize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: "invalid",
            client_secret: "invalid",
            scope: "sites:read",
          }),
        },
      );

      expect(res.status).toBe(401);
    });

    it("should return authorization_pending before approval", async () => {
      const startRes = await fetch(
        `http://localhost:${port}/oauth/device/authorize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: oauthClient.clientId,
            client_secret: oauthClient.clientSecret,
            scope: "sites:read",
          }),
        },
      );

      const { device_code } = await startRes.json();

      const tokenRes = await fetch(
        `http://localhost:${port}/oauth/device/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            client_id: oauthClient.clientId,
            client_secret: oauthClient.clientSecret,
            device_code,
          }),
        },
      );

      expect(tokenRes.status).toBe(400);
      const data = await tokenRes.json();
      expect(data.error).toBe("authorization_pending");
    });

    it("should return tokens after approval", async () => {
      const startRes = await fetch(
        `http://localhost:${port}/oauth/device/authorize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: oauthClient.clientId,
            client_secret: oauthClient.clientSecret,
            scope: "sites:read",
          }),
        },
      );

      const { device_code } = await startRes.json();

      await prisma.oAuthDeviceCode.updateMany({
        where: { code: device_code },
        data: { userId: user.id },
      });

      const tokenRes = await fetch(
        `http://localhost:${port}/oauth/device/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            client_id: oauthClient.clientId,
            client_secret: oauthClient.clientSecret,
            device_code,
          }),
        },
      );

      expect(tokenRes.ok).toBe(true);
      const data = await tokenRes.json();
      expect(data.access_token).toBeDefined();
      expect(data.refresh_token).toBeDefined();
      expect(data.token_type).toBe("Bearer");
      expect(data.expires_in).toBe(3600);
    });
  });

  describe("Authorization Code Flow", () => {
    it("should create authorization code", async () => {
      const res = await fetch(
        `http://localhost:${port}/oauth/authorize?client_id=${oauthClient.clientId}&redirect_uri=https://example.com/callback&scope=sites:read&state=xyz`,
        {
          headers: { Cookie: `session=${user.id}` },
        },
      );

      expect(res.status).toBe(200);
    });

    it("should reject invalid redirect_uri", async () => {
      const res = await fetch(
        `http://localhost:${port}/oauth/authorize?client_id=${oauthClient.clientId}&redirect_uri=https://evil.com/callback&scope=sites:read`,
        {
          headers: { Cookie: `session=${user.id}` },
        },
      );

      expect(res.status).toBe(400);
    });
  });

  describe("Token Endpoint", () => {
    it("should exchange authorization code for tokens", async () => {
      const code = "test-auth-code";
      await prisma.oAuthAuthorizationCode.create({
        data: {
          code,
          userId: user.id,
          clientId: oauthClient.id,
          redirectUri: "https://example.com/callback",
          scopes: ["sites:read"],
          expiresAt: new Date(Date.now() + 600000),
        },
      });

      const res = await fetch(`http://localhost:${port}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: oauthClient.clientId,
          client_secret: oauthClient.clientSecret,
          code,
          redirect_uri: "https://example.com/callback",
        }),
      });

      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.access_token).toBeDefined();
      expect(data.refresh_token).toBeDefined();
    });

    it("should refresh tokens", async () => {
      const accessToken = "test-access-token";
      const refreshToken = "test-refresh-token";

      await prisma.oAuthAccessToken.create({
        data: {
          token: accessToken,
          userId: user.id,
          clientId: oauthClient.id,
          scopes: ["sites:read"],
          expiresAt: new Date(Date.now() + 3600000),
        },
      });

      await prisma.oAuthRefreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          clientId: oauthClient.id,
          scopes: ["sites:read"],
          expiresAt: new Date(Date.now() + 2592000000),
        },
      });

      const res = await fetch(`http://localhost:${port}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: oauthClient.clientId,
          client_secret: oauthClient.clientSecret,
          refresh_token: refreshToken,
        }),
      });

      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.access_token).toBeDefined();
      expect(data.access_token).not.toBe(accessToken);
    });

    it("should reject expired tokens", async () => {
      const refreshToken = "expired-refresh-token";

      await prisma.oAuthRefreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          clientId: oauthClient.id,
          scopes: ["sites:read"],
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      const res = await fetch(`http://localhost:${port}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: oauthClient.clientId,
          client_secret: oauthClient.clientSecret,
          refresh_token: refreshToken,
        }),
      });

      expect(res.status).toBe(400);
    });
  });
});
