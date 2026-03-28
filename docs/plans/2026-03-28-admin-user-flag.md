# Admin User Flag Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Replace the static `ADMIN_API_SECRET` env var with an `isAdmin` flag on `User`, so admin auth uses the same token-based lookup as regular users.

**Architecture:** Add `isAdmin Boolean @default(false)` to the Prisma `User` model. Replace `requireAdminApiKey` with `requireAdmin` which calls `verifyUserAccess` then checks the flag. Update the one admin route and remove the env var.

**Tech Stack:** Prisma, TypeScript, React Router v7, Vitest

---

### Task 1: Update schema and run migration

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add `isAdmin` to the User model**

Find the `model User {` block and add this field after `id`:

```prisma
isAdmin                 Boolean                  @default(false)           @map("is_admin")
```

The full User model field list (alphabetical, matching existing style) should have it between `id` and `ownedSites`:
```prisma
  id                      String                                             @id @default(cuid())
  isAdmin                 Boolean                  @default(false)           @map("is_admin")
  ownedSites              Site[]                   @relation("OwnedSites")
```

**Step 2: Push schema to DB and regenerate client**

```bash
cd /Users/assaf/Projects/cite.me.in && infisical --env dev run -- pnpm prisma db push 2>&1 | tail -5
```
Expected: `Your database is now in sync with your Prisma schema.`

```bash
cd /Users/assaf/Projects/cite.me.in && pnpm prisma generate 2>&1 | tail -3
```

**Step 3: Run typecheck to verify generated types are valid**

```bash
cd /Users/assaf/Projects/cite.me.in && pnpm check:type 2>&1 | grep -E "error TS" | head -10
```
Expected: no errors.

**Step 4: Commit**

```bash
cd /Users/assaf/Projects/cite.me.in && git add prisma/schema.prisma && git commit -m "feat: add isAdmin flag to User model"
```

---

### Task 2: Update tests for `requireAdmin`

**Files:**
- Modify: `test/lib/apiAuth.test.ts`

The current `requireAdminApiKey` describe block uses `envVars.ADMIN_API_SECRET`. Replace it with a `requireAdmin` describe block that seeds a real admin user.

**Step 1: Update the test file**

Replace the entire `requireAdminApiKey` describe block (lines 17–35) with:

```ts
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
```

Also update the import at the top — change `requireAdminApiKey` to `requireAdmin`:
```ts
import {
  requireAdmin,
  verifySiteAccess,
  verifyUserAccess,
} from "~/lib/api/apiAuth.server";
```

And remove the `envVars` import if it's only used for `ADMIN_API_SECRET` (check whether it's used elsewhere in the file — if not, remove the import line).

**Step 2: Run test to verify it fails (requireAdmin not yet exported)**

```bash
cd /Users/assaf/Projects/cite.me.in && infisical --env dev run -- pnpm vitest run test/lib/apiAuth.test.ts 2>&1 | grep -E "error|FAIL|cannot find" | head -10
```
Expected: TypeScript/import error — `requireAdmin` not exported yet.

**Step 3: Commit**

```bash
cd /Users/assaf/Projects/cite.me.in && git add test/lib/apiAuth.test.ts && git commit -m "test: update apiAuth tests for requireAdmin"
```

---

### Task 3: Implement `requireAdmin`, remove `requireAdminApiKey`

**Files:**
- Modify: `app/lib/api/apiAuth.server.ts`

**Step 1: Rewrite the file**

Replace `requireAdminApiKey` with `requireAdmin`. The `verifyUserAccess` query needs to also select `isAdmin`:

```ts
import prisma from "~/lib/prisma.server";

function parseTokenUserId(token: string): string | null {
  if (!token.startsWith("cite.me.in_")) return null;
  const rest = token.slice("cite.me.in_".length);
  const lastUnderscore = rest.lastIndexOf("_");
  if (lastUnderscore === -1) return null;
  return rest.slice(0, lastUnderscore);
}

export async function requireAdmin(request: Request): Promise<{
  id: string;
  email: string;
  createdAt: Date;
}> {
  const user = await verifyUserAccess(request);
  if (!user.isAdmin) throw new Response("Forbidden", { status: 403 });
  return user;
}

export async function verifyUserAccess(request: Request): Promise<{
  id: string;
  email: string;
  createdAt: Date;
  isAdmin: boolean;
}> {
  const auth = request.headers.get("authorization");
  if (!auth) throw new Response("Unauthorized", { status: 401 });
  const [tokenType, token] = auth.split(/\s+/);
  if (tokenType !== "Bearer")
    throw new Response("Unauthorized", { status: 401 });

  const userId = parseTokenUserId(token);
  if (!userId) throw new Response("Not found", { status: 404 });

  const user = await prisma.user.findFirst({
    where: { id: userId, apiKey: token },
    select: { id: true, email: true, createdAt: true, isAdmin: true },
  });
  if (!user) throw new Response("Not found", { status: 404 });
  return user;
}

export async function verifySiteAccess({
  domain,
  request,
}: {
  domain: string;
  request: Request;
}): Promise<{
  id: string;
  domain: string;
  createdAt: Date;
}> {
  const { id: userId } = await verifyUserAccess(request);

  const site = await prisma.site.findFirst({
    where: {
      domain,
      OR: [{ ownerId: userId }, { siteUsers: { some: { userId } } }],
    },
    select: { id: true, domain: true, createdAt: true },
  });
  if (!site) throw new Response("Not found", { status: 404 });
  return site;
}
```

Note: `requireAdmin`'s return type omits `isAdmin` (callers don't need it) but `verifyUserAccess` now returns it internally.

**Step 2: Run the unit tests**

```bash
cd /Users/assaf/Projects/cite.me.in && infisical --env dev run -- pnpm vitest run test/lib/apiAuth.test.ts 2>&1 | tail -20
```
Expected: all tests pass.

**Step 3: Run typecheck**

```bash
cd /Users/assaf/Projects/cite.me.in && pnpm check:type 2>&1 | grep -E "error TS" | head -10
```
Expected: no errors (there may be a temporary error in `api.admin.users.ts` — that's fixed next).

**Step 4: Commit**

```bash
cd /Users/assaf/Projects/cite.me.in && git add app/lib/api/apiAuth.server.ts && git commit -m "feat: replace requireAdminApiKey with requireAdmin using isAdmin flag"
```

---

### Task 4: Update `api.admin.users.ts` and remove `ADMIN_API_SECRET`

**Files:**
- Modify: `app/routes/api.admin.users.ts`
- Modify: `app/lib/envVars.ts`

**Step 1: Update the admin route**

In `app/routes/api.admin.users.ts`, change the import and the call:

```ts
import { requireAdmin } from "~/lib/api/apiAuth.server";
// ...
export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  // ... rest unchanged
}
```

**Step 2: Remove `ADMIN_API_SECRET` from envVars**

In `app/lib/envVars.ts`, delete this line:
```ts
  ADMIN_API_SECRET: env.get("ADMIN_API_SECRET").required(false).asString(),
```

**Step 3: Run typecheck**

```bash
cd /Users/assaf/Projects/cite.me.in && pnpm check:type 2>&1 | grep -E "error TS" | head -10
```
Expected: no errors.

**Step 4: Commit**

```bash
cd /Users/assaf/Projects/cite.me.in && git add app/routes/api.admin.users.ts app/lib/envVars.ts && git commit -m "feat: use requireAdmin in admin route, remove ADMIN_API_SECRET"
```

---

### Task 5: Update `api.admin.users.test.ts`

**Files:**
- Modify: `test/routes/api.admin.users.test.ts`

Replace `envVars.ADMIN_API_SECRET` with a seeded admin user token.

**Step 1: Rewrite the test file**

```ts
import { invariant } from "es-toolkit";
import { beforeAll, describe, expect, it } from "vitest";
import prisma from "~/lib/prisma.server";
import { port } from "../helpers/launchBrowser";

const ADMIN_ID = "admin-users-route-admin-1";
const ADMIN_API_KEY = `cite.me.in_${ADMIN_ID}_adminroutekey123456789`;

function makeRequest(token?: string) {
  return fetch(`http://localhost:${port}/api/admin/users`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe("api.admin.users", () => {
  beforeAll(async () => {
    // Seed admin user
    await prisma.user.upsert({
      where: { id: ADMIN_ID },
      create: {
        id: ADMIN_ID,
        email: "admin-users-route-admin@test.example",
        passwordHash: "test",
        apiKey: ADMIN_API_KEY,
        isAdmin: true,
      },
      update: { apiKey: ADMIN_API_KEY, isAdmin: true },
    });

    // User with a Stripe account (ordered first by createdAt desc)
    await prisma.user.upsert({
      where: { id: "admin-users-test-user-1" },
      create: {
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
      update: {},
    });

    // User without a Stripe account
    await prisma.user.upsert({
      where: { id: "admin-users-test-user-2" },
      create: {
        id: "admin-users-test-user-2",
        email: "admin-users-test-no-stripe@test.example",
        passwordHash: "test",
        updatedAt: new Date("2024-01-01"),
      },
      update: {},
    });
  });

  it("should return 401 without a token", async () => {
    const res = await makeRequest();
    expect(res.status).toBe(401);
  });

  it("should return 401 with a wrong token", async () => {
    const res = await makeRequest("wrong-token");
    expect(res.status).toBe(401);
  });

  it("should return 403 with a valid non-admin token", async () => {
    // Non-admin user from apiAuth tests
    const nonAdminKey = "cite.me.in_api-auth-test-user-1_testabcdefghijklmnop";
    const res = await makeRequest(nonAdminKey);
    expect(res.status).toBe(403);
  });

  describe("with an admin token", () => {
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
      response = await makeRequest(ADMIN_API_KEY);
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
```

**Step 2: Run typecheck**

```bash
cd /Users/assaf/Projects/cite.me.in && pnpm check:type 2>&1 | grep -E "error TS" | head -10
```
Expected: no errors.

**Step 3: Commit**

```bash
cd /Users/assaf/Projects/cite.me.in && git add test/routes/api.admin.users.test.ts && git commit -m "test: update admin users tests to use seeded admin token"
```

---

### Task 6: Run full typecheck and lint

**Step 1: Typecheck**

```bash
cd /Users/assaf/Projects/cite.me.in && pnpm check:type 2>&1 | grep -E "error TS" | head -20
```
Expected: no errors.

**Step 2: Lint**

```bash
cd /Users/assaf/Projects/cite.me.in && pnpm check:lint 2>&1 | tail -5
```
Expected: `No fixes applied.`
