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
        id: string;
        email: string;
        createdAt: string;
        stripe: {
          status: string;
          interval: string;
          updatedAt: string;
          customerId: string;
        } | null;
        sites: {
          domain: string;
          createdAt: string;
        }[];
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
            },
          },
          ownedSites: {
            create: {
              domain: "admin-users-test.example.com",
            },
          },
        },
      });

      // User without a Stripe account
      await prisma.user.create({
        data: {
          id: "admin-users-test-user-2",
          email: "admin-users-test-no-stripe@test.example",
          passwordHash: "test",
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

    it("should return the seeded user's sites", async () => {
      const user = body.users.find((u) => u.id === "admin-users-test-user-1");
      expect(user?.sites[0].domain).toBe("admin-users-test.example.com");
      expect(user?.sites[0].createdAt).toBeDefined();
    });

    it("should return stripe details for a user with an account", async () => {
      const user = body.users.find((u) => u.id === "admin-users-test-user-1");
      expect(user?.stripe).not.toBeNull();
      expect(user?.stripe?.status).toBe("active");
      expect(user?.stripe?.interval).toBe("monthly");
      expect(user?.stripe?.updatedAt).toBeDefined();
      expect(user?.stripe?.customerId).toBe("cus_test123");
    });

    it("should return null stripe for a user without an account", async () => {
      const user = body.users.find((u) => u.id === "admin-users-test-user-2");
      expect(user?.stripe).toBeNull();
    });
  });
});
