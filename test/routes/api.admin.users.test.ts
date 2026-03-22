import { invariant } from "es-toolkit";
import { beforeAll, describe, expect, it } from "vitest";
import envVars from "~/lib/envVars";
import prisma from "~/lib/prisma.server";
import { port } from "../helpers/launchBrowser";

function makeRequest(token?: string) {
  return fetch(`http://localhost:${port}/api/admin/users`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe("api.admin.users", () => {
  it("should return 401 without a token", async () => {
    const res = await makeRequest();
    expect(res.status).toBe(401);
  });

  it("should return 401 with a wrong token", async () => {
    const res = await makeRequest("wrong-token");
    expect(res.status).toBe(401);
  });

  describe("with a correct token", () => {
    let response: Response;
    let body: {
      users: {
        createdAt: string;
        email: string;
        id: string;
        plan: string;
        sites: { domain: string; createdAt: string }[];
        status: string;
        updatedAt: string;
      }[];
    };

    beforeAll(async () => {
      // User with a Stripe account (ordered first by createdAt desc)
      await prisma.user.create({
        data: {
          id: "admin-users-test-user-1",
          email: "admin-users-test@test.example",
          passwordHash: "test",
          account: {
            create: {
              stripeCustomerId: "cus_test123",
              stripeSubscriptionId: "sub_test123",
              status: "active",
              interval: "monthly",
              updatedAt: new Date("2024-02-24"),
            },
          },
          ownedSites: {
            create: {
              content: "Test content",
              domain: "admin-users-test.example.com",
              summary: "Test summary",
            },
          },
          updatedAt: new Date("2024-01-01"),
        },
      });

      // User without a Stripe account
      await prisma.user.create({
        data: {
          id: "admin-users-test-user-2",
          email: "admin-users-test-no-stripe@test.example",
          passwordHash: "test",
          updatedAt: new Date("2024-01-01"),
        },
      });

      response = await makeRequest(envVars.ADMIN_API_SECRET);
    });

    it("should return 200", async () => {
      expect(response.status).toBe(200);
      body = await response.json();
    });

    it("should return the seeded user", async () => {
      expect(body).toHaveProperty("users");
      expect(Array.isArray(body.users)).toBe(true);
      const user = body.users.find((u) => u.id === "admin-users-test-user-1");
      expect(user?.email).toBe("admin-users-test@test.example");
      expect(user?.createdAt).toBeDefined();
      expect(Array.isArray(user?.sites)).toBe(true);
    });

    it("should return the user's sites", async () => {
      const user = body.users.find((u) => u.id === "admin-users-test-user-1");
      expect(user?.sites[0].domain).toBe("admin-users-test.example.com");
      expect(user?.sites[0].createdAt).toBeDefined();
    });

    it("should return details for a user with an account", async () => {
      const user = body.users.find((u) => u.id === "admin-users-test-user-1");
      invariant(user, "User not found");
      expect(user.status).toBe("active");
      expect(user.plan).toBe("monthly");
      expect(user.updatedAt).toBe("2024-02-24");
    });

    it("should return free trial details for a user without an account", async () => {
      const user = body.users.find((u) => u.id === "admin-users-test-user-2");
      invariant(user, "User not found");
      expect(user.status).toBe("free_trial");
      expect(user.plan).toBeNull();
      expect(user.updatedAt).toBe("2024-01-01");
    });
  });
});
