import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import invariant from "tiny-invariant";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "~/lib/prisma.server";
import { resetRateLimit } from "~/lib/rateLimit.server";
import { port } from "~/test/helpers/launchBrowser";

const baseUrl = `http://localhost:${port}`;

function generatePKCE() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

describe("MCP Authorization Flow", () => {
  let user: { id: string; email: string };
  let sessionToken: string;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        email: "mcp-auth-test@example.com",
        passwordHash: await bcrypt.hash("password", 10),
        plan: "trial",
      },
    });

    sessionToken = crypto.randomUUID();
    await prisma.session.create({
      data: {
        token: sessionToken,
        userId: user.id,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("Discovery", () => {
    it("should return 401 with WWW-Authenticate header when accessing MCP without token", async () => {
      const res = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" },
          },
        }),
      });

      expect(res.status).toBe(401);
      const wwwAuth = res.headers.get("WWW-Authenticate");
      expect(wwwAuth).toContain("Bearer");
      expect(wwwAuth).toContain("resource_metadata");
    });

    it("should serve Protected Resource Metadata", async () => {
      const res = await fetch(
        `${baseUrl}/.well-known/oauth-protected-resource`,
      );

      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.resource).toBeDefined();
      expect(data.authorization_servers).toBeDefined();
      expect(Array.isArray(data.authorization_servers)).toBe(true);
      expect(data.scopes_supported).toContain("mcp:tools");
    });

    it("should serve Authorization Server Metadata", async () => {
      const res = await fetch(
        `${baseUrl}/.well-known/oauth-authorization-server`,
      );

      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.issuer).toBeDefined();
      expect(data.authorization_endpoint).toBeDefined();
      expect(data.token_endpoint).toBeDefined();
      expect(data.registration_endpoint).toBeDefined();
      expect(data.response_types_supported).toContain("code");
      expect(data.code_challenge_methods_supported).toContain("S256");
    });
  });

  describe("Dynamic Client Registration", () => {
    it("should register a new public client", async () => {
      const res = await fetch(`${baseUrl}/oauth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "Test MCP Client",
          redirect_uris: ["http://localhost:3000/callback"],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
          scope: "mcp:tools",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.client_id).toBeDefined();
      expect(data.client_name).toBe("Test MCP Client");
      expect(data.redirect_uris).toContain("http://localhost:3000/callback");
      expect(data.token_endpoint_auth_method).toBe("none");
      expect(data.client_secret).toBeUndefined();
    });

    it("should register a confidential client with secret", async () => {
      const res = await fetch(`${baseUrl}/oauth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "Confidential Client",
          redirect_uris: ["https://example.com/callback"],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "client_secret_post",
          scope: "mcp:tools",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.client_id).toBeDefined();
      expect(data.client_secret).toBeDefined();
    });

    it("should reject invalid redirect URIs", async () => {
      const res = await fetch(`${baseUrl}/oauth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "Bad Client",
          redirect_uris: ["http://evil.com/callback"],
          token_endpoint_auth_method: "none",
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("invalid_redirect_uri");
    });
  });

  describe("Authorization Code Flow with PKCE", () => {
    let clientId: string;
    const redirectUri = "http://localhost:3000/callback";

    beforeAll(async () => {
      const res = await fetch(`${baseUrl}/oauth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "E2E Test Client",
          redirect_uris: [redirectUri],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
          scope: "mcp:tools",
        }),
      });
      const data = await res.json();
      clientId = data.client_id;
    });

    it("should complete full authorization flow", async () => {
      const pkce = generatePKCE();
      const state = randomBytes(16).toString("base64url");

      const authUrl = new URL(`${baseUrl}/oauth/authorize`);
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "mcp:tools");
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("code_challenge", pkce.challenge);
      authUrl.searchParams.set("code_challenge_method", "S256");

      const authPageRes = await fetch(authUrl.toString(), {
        headers: { Cookie: `session=${sessionToken}` },
      });
      expect(authPageRes.status).toBe(200);

      const formData = new URLSearchParams();
      formData.set("client_id", clientId);
      formData.set("user_id", user.id);
      formData.set("redirect_uri", redirectUri);
      formData.set("scope", "mcp:tools");
      formData.set("state", state);
      formData.set("code_challenge", pkce.challenge);
      formData.set("allow", "1");

      const approveRes = await fetch(`${baseUrl}/oauth/authorize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: `session=${user.id}`,
        },
        body: formData,
        redirect: "manual",
      });

      expect([302, 303]).toContain(approveRes.status);
      const location = approveRes.headers.get("location");
      invariant(location, "No location found");

      const callbackUrl = new URL(location);
      const code = callbackUrl.searchParams.get("code");
      invariant(code, "No code found");
      const returnedState = callbackUrl.searchParams.get("state");
      expect(returnedState).toBe(state);

      const tokenRes = await fetch(`${baseUrl}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          code: code,
          redirect_uri: redirectUri,
          code_verifier: pkce.verifier,
        }),
      });

      expect(tokenRes.ok).toBe(true);
      const tokens = await tokenRes.json();
      expect(tokens.access_token).toBeDefined();
      expect(tokens.refresh_token).toBeDefined();
      expect(tokens.token_type).toBe("Bearer");
      expect(tokens.expires_in).toBeGreaterThan(0);

      const mcpRes = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          Authorization: `Bearer ${tokens.access_token}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" },
          },
        }),
      });

      expect(mcpRes.ok).toBe(true);
    });

    it("should reject token exchange with wrong PKCE verifier", async () => {
      const pkce = generatePKCE();
      const wrongPkce = generatePKCE();

      const formData = new URLSearchParams();
      formData.set("client_id", clientId);
      formData.set("user_id", user.id);
      formData.set("redirect_uri", redirectUri);
      formData.set("scope", "mcp:tools");
      formData.set("code_challenge", pkce.challenge);
      formData.set("allow", "1");

      const approveRes = await fetch(`${baseUrl}/oauth/authorize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: `session=${user.id}`,
        },
        body: formData,
        redirect: "manual",
      });

      const location = approveRes.headers.get("location");
      invariant(location, "No location found");
      const callbackUrl = new URL(location);
      const code = callbackUrl.searchParams.get("code");
      invariant(code, "No code found");

      const tokenRes = await fetch(`${baseUrl}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          code: code,
          redirect_uri: redirectUri,
          code_verifier: wrongPkce.verifier,
        }),
      });

      expect(tokenRes.status).toBe(400);
      const data = await tokenRes.json();
      expect(data.error).toBe("invalid_grant");
      expect(data.error_description).toContain("PKCE");
    });
  });

  describe("Refresh Token Flow", () => {
    let clientId: string;
    let refreshToken: string;
    const redirectUri = "http://localhost:3000/callback";

    beforeAll(async () => {
      const res = await fetch(`${baseUrl}/oauth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "Refresh Test Client",
          redirect_uris: [redirectUri],
          token_endpoint_auth_method: "none",
          scope: "mcp:tools",
        }),
      });
      const data = await res.json();
      clientId = data.client_id;

      const pkce = generatePKCE();
      const formData = new URLSearchParams();
      formData.set("client_id", clientId);
      formData.set("user_id", user.id);
      formData.set("redirect_uri", redirectUri);
      formData.set("scope", "mcp:tools");
      formData.set("code_challenge", pkce.challenge);
      formData.set("allow", "1");

      const approveRes = await fetch(`${baseUrl}/oauth/authorize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: `session=${user.id}`,
        },
        body: formData,
        redirect: "manual",
      });

      const location = approveRes.headers.get("location");
      invariant(location, "No location found");
      const callbackUrl = new URL(location);
      const code = callbackUrl.searchParams.get("code");
      invariant(code, "No code found");

      const tokenRes = await fetch(`${baseUrl}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          code: code,
          redirect_uri: redirectUri,
          code_verifier: pkce.verifier,
        }),
      });

      const tokens = await tokenRes.json();
      refreshToken = tokens.refresh_token;
    });

    it("should refresh access token", async () => {
      const tokenRes = await fetch(`${baseUrl}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId,
          refresh_token: refreshToken,
        }),
      });

      expect(tokenRes.ok).toBe(true);
      const tokens = await tokenRes.json();
      expect(tokens.access_token).toBeDefined();
      expect(tokens.refresh_token).toBeDefined();
      expect(tokens.token_type).toBe("Bearer");
    });

    it("should reject reused refresh token", async () => {
      const tokenRes = await fetch(`${baseUrl}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId,
          refresh_token: refreshToken,
        }),
      });

      expect(tokenRes.status).toBe(400);
      const data = await tokenRes.json();
      expect(data.error).toBe("invalid_grant");
    });
  });

  describe("MCP Access with Tokens", () => {
    let accessToken: string;

    beforeAll(async () => {
      const res = await fetch(`${baseUrl}/oauth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "MCP Access Test Client",
          redirect_uris: ["http://localhost:3000/callback"],
          token_endpoint_auth_method: "none",
          scope: "mcp:tools",
        }),
      });
      const data = await res.json();
      const clientId = data.client_id;

      const pkce = generatePKCE();
      const formData = new URLSearchParams();
      formData.set("client_id", clientId);
      formData.set("user_id", user.id);
      formData.set("redirect_uri", "http://localhost:3000/callback");
      formData.set("scope", "mcp:tools");
      formData.set("code_challenge", pkce.challenge);
      formData.set("allow", "1");

      const approveRes = await fetch(`${baseUrl}/oauth/authorize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: `session=${user.id}`,
        },
        body: formData,
        redirect: "manual",
      });

      const location = approveRes.headers.get("location");
      invariant(location, "No location found");
      const callbackUrl = new URL(location);
      const code = callbackUrl.searchParams.get("code");
      invariant(code, "No code found");

      const tokenRes = await fetch(`${baseUrl}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          code: code,
          redirect_uri: "http://localhost:3000/callback",
          code_verifier: pkce.verifier,
        }),
      });

      const tokens = await tokenRes.json();
      accessToken = tokens.access_token;
    });

    it("should access MCP with valid token", async () => {
      const res = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" },
          },
        }),
      });

      expect(res.ok).toBe(true);
      const sessionId = res.headers.get("MCP-Session-ID");
      expect(sessionId).toBeDefined();
    });

    it("should reject invalid token", async () => {
      const res = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          Authorization: "Bearer invalid-token",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" },
          },
        }),
      });

      expect(res.status).toBe(403);
    });

    it("should maintain session across requests", async () => {
      const initRes = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" },
          },
        }),
      });

      const sessionId = initRes.headers.get("MCP-Session-ID");
      invariant(sessionId, "No session ID found");

      const listRes = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          Authorization: `Bearer ${accessToken}`,
          "MCP-Session-ID": sessionId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
        }),
      });

      expect(listRes.ok).toBe(true);
    });
  });

  describe("Rate Limiting", () => {
    let accessToken: string;

    beforeAll(async () => {
      await resetRateLimit(user.id);

      const res = await fetch(`${baseUrl}/oauth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "Rate Limit Test Client",
          redirect_uris: ["http://localhost:3000/callback"],
          token_endpoint_auth_method: "none",
          scope: "mcp:tools",
        }),
      });
      const data = await res.json();
      const clientId = data.client_id;

      const pkce = generatePKCE();
      const formData = new URLSearchParams();
      formData.set("client_id", clientId);
      formData.set("user_id", user.id);
      formData.set("redirect_uri", "http://localhost:3000/callback");
      formData.set("scope", "mcp:tools");
      formData.set("code_challenge", pkce.challenge);
      formData.set("allow", "1");

      const approveRes = await fetch(`${baseUrl}/oauth/authorize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: `session=${sessionToken}`,
        },
        body: formData,
        redirect: "manual",
      });

      const location = approveRes.headers.get("location");
      const callbackUrl = new URL(location!);
      const code = callbackUrl.searchParams.get("code");

      const tokenRes = await fetch(`${baseUrl}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          code: code!,
          redirect_uri: "http://localhost:3000/callback",
          code_verifier: pkce.verifier,
        }),
      });

      const tokens = await tokenRes.json();
      accessToken = tokens.access_token;
    });

    it("should allow requests under the rate limit", async () => {
      await resetRateLimit(user.id);

      const res = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" },
          },
        }),
      });

      expect(res.ok).toBe(true);
    });

    it("should return 429 when rate limit exceeded", async () => {
      await resetRateLimit(user.id);

      const requests = Array.from({ length: 65 }, () =>
        fetch(`${baseUrl}/mcp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2024-11-05",
              capabilities: {},
              clientInfo: { name: "test", version: "1.0.0" },
            },
          }),
        }),
      );

      const responses = await Promise.all(requests);
      const statusCodes = responses.map((r) => r.status);

      const rateLimited = statusCodes.filter((s) => s === 429);
      expect(rateLimited.length).toBeGreaterThan(0);

      const rateLimitedRes = responses.find((r) => r.status === 429)!;
      expect(rateLimitedRes.headers.has("Retry-After")).toBe(true);
      expect(rateLimitedRes.headers.has("X-RateLimit-Reset")).toBe(true);
    });
  });
});
