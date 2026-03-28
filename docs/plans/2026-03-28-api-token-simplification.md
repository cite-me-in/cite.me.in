# API Token Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Encode the user ID into the API token so `/api/me` needs no email URL param and auth lookups hit the primary key.

**Architecture:** Token format changes from `cite.me.in_{random}` to `cite.me.in_{userId}_{random}`. A `parseApiToken` helper extracts the userId. `verifyUserAccess` drops the `email` param; `verifySiteAccess` delegates to it then checks site membership by userId. The `api/me/$email` route becomes `api/me`.

**Tech Stack:** React Router v7, Prisma, TypeScript, Vitest

---

### Task 1: Update `apiAuth.test.ts` for new token format and interface

**Files:**
- Modify: `test/lib/apiAuth.test.ts`

The new token format embeds the userId: `cite.me.in_{userId}_{24chars}`.
`verifyUserAccess` no longer takes an `email` param.

**Step 1: Update the test file**

Replace the entire `verifyUserAccess` describe block and the token constant in `verifySiteAccess`:

```ts
// At the top of both describe blocks, change userApiKey to:
const userApiKey = "cite.me.in_api-auth-test-user-1_testabcdefghijklmnop";
```

In `verifySiteAccess` describe, change line 60:
```ts
update: { apiKey: userApiKey },
```
(already there — just update the constant value above)

In `verifyUserAccess` describe block, update all three tests:

```ts
describe("verifyUserAccess", () => {
  const userId = "api-auth-test-user-1";
  const userApiKey = "cite.me.in_api-auth-test-user-1_testabcdefghijklmnop";

  it("should return the user when token matches", async () => {
    const user = await verifyUserAccess(makeRequest(userApiKey));
    expect(user.id).toBe(userId);
  });

  it("should throw 401 when no Authorization header", async () => {
    await expect(verifyUserAccess(makeRequest())).rejects.toThrow(Response);
    const err = await verifyUserAccess(makeRequest()).catch((e) => e);
    expect((err as Response).status).toBe(401);
  });

  it("should throw 404 Response when token is unknown", async () => {
    // Wrong secret — userId exists but token doesn't match stored key
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
```

**Step 2: Run failing tests**

```bash
cd /Users/assaf/Projects/cite.me.in && infisical --env dev run -- pnpm vitest run test/lib/apiAuth.test.ts
```

Expected: `verifyUserAccess` tests fail (wrong signature), `verifySiteAccess` tests fail (token format mismatch).

---

### Task 2: Implement new `verifyUserAccess` and `verifySiteAccess`

**Files:**
- Modify: `app/lib/api/apiAuth.server.ts`

**Step 1: Rewrite the file**

```ts
import prisma from "~/lib/prisma.server";
import envVars from "../envVars";

export async function requireAdminApiKey(request: Request): Promise<void> {
  const auth = request.headers.get("authorization");
  if (!auth) throw new Response("Unauthorized", { status: 401 });
  const [tokenType, token] = auth.split(/\s+/);
  if (tokenType !== "Bearer")
    throw new Response("Unauthorized", { status: 401 });
  if (!envVars.ADMIN_API_SECRET || token !== envVars.ADMIN_API_SECRET)
    throw new Response("Unauthorized", { status: 401 });
}

function parseTokenUserId(token: string): string | null {
  if (!token.startsWith("cite.me.in_")) return null;
  const rest = token.slice("cite.me.in_".length);
  const lastUnderscore = rest.lastIndexOf("_");
  if (lastUnderscore === -1) return null;
  return rest.slice(0, lastUnderscore);
}

export async function verifyUserAccess(request: Request): Promise<{
  id: string;
  email: string;
  createdAt: Date;
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
    select: { id: true, email: true, createdAt: true },
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
      OR: [
        { ownerId: userId },
        { siteUsers: { some: { userId } } },
      ],
    },
    select: { id: true, domain: true, createdAt: true },
  });
  if (!site) throw new Response("Not found", { status: 404 });
  return site;
}
```

**Step 2: Run tests**

```bash
cd /Users/assaf/Projects/cite.me.in && infisical --env dev run -- pnpm vitest run test/lib/apiAuth.test.ts
```

Expected: all tests pass.

**Step 3: Commit**

```bash
git add app/lib/api/apiAuth.server.ts test/lib/apiAuth.test.ts
git commit -m "feat: encode userId in API token for primary-key auth lookup"
```

---

### Task 3: Update `regenerateApiKey` to use new token format

**Files:**
- Modify: `app/routes/profile/route.tsx:120-134`

**Step 1: Update `regenerateApiKey`**

Change the function to embed `userId` in the token:

```ts
async function regenerateApiKey({ userId }: { userId: string }) {
  try {
    const { generateApiKey } = await import("random-password-toolkit");
    const apiKey = `cite.me.in_${userId}_${generateApiKey(24)}`;
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { apiKey },
      select: { apiKey: true },
    });
    return { apiKey: updated.apiKey };
  } catch (error) {
    logError(error);
    return { error: "Failed to generate API key" };
  }
}
```

**Step 2: Run typecheck**

```bash
cd /Users/assaf/Projects/cite.me.in && pnpm check:type
```

Expected: no errors.

**Step 3: Commit**

```bash
git add app/routes/profile/route.tsx
git commit -m "feat: embed userId in generated API token"
```

---

### Task 4: Replace `api.me.$email.ts` with `api.me.ts`

**Files:**
- Create: `app/routes/api.me.ts`
- Delete: `app/routes/api.me.$email.ts`

**Step 1: Create the new route**

```ts
import { sortBy } from "es-toolkit";
import { data } from "react-router";
import { verifyUserAccess } from "~/lib/api/apiAuth.server";
import { UserSchema } from "~/lib/api/openapi";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/api.me";

export async function loader({ request }: Route.LoaderArgs) {
  const { id, email } = await verifyUserAccess(request);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id },
    select: {
      ownedSites: { select: { domain: true, createdAt: true } },
      siteUsers: {
        select: { site: { select: { domain: true, createdAt: true } } },
      },
    },
  });
  const sites = sortBy(
    [
      ...user.ownedSites.map(({ domain, createdAt }) => ({
        domain,
        createdAt: createdAt.toISOString().split("T")[0],
      })),
      ...user.siteUsers.map(({ site }) => ({
        domain: site.domain,
        createdAt: site.createdAt.toISOString().split("T")[0],
      })),
    ],
    ["domain"],
  );

  return data(UserSchema.parse({ email, sites }));
}
```

**Step 2: Delete the old route**

```bash
rm /Users/assaf/Projects/cite.me.in/app/routes/api.me.\$email.ts
```

**Step 3: Run typecheck**

```bash
cd /Users/assaf/Projects/cite.me.in && pnpm check:type
```

Expected: no errors (React Router will generate new types for `api.me.ts`).

**Step 4: Commit**

```bash
git add app/routes/api.me.ts
git rm app/routes/api.me.\$email.ts
git commit -m "feat: replace api/me/:email with api/me — user derived from token"
```

---

### Task 5: Update OpenAPI spec

**Files:**
- Modify: `app/lib/api/openapi.ts:156-183`

**Step 1: Replace the `/api/me/{email}` path entry**

Change:
```ts
"/api/me/{email}": {
  get: {
    description:
      "Responds with the details of the current user. Includes all the sites they have access to. You can only use this endpoint with your own email address.",
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        description: "The email address of the user to get details for",
        in: "path",
        name: "email",
        required: true,
      },
    ],
    responses: {
      200: {
        description: "User details with sites",
        content: { "application/json": { schema: UserSchema } },
      },
      401: {
        description: "Unauthorized",
      },
      404: {
        description: "Email not recognised or not found",
      },
    },
  },
},
```

To:
```ts
"/api/me": {
  get: {
    description:
      "Responds with the details of the authenticated user. Includes all the sites they have access to.",
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: "User details with sites",
        content: { "application/json": { schema: UserSchema } },
      },
      401: {
        description: "Unauthorized",
      },
      404: {
        description: "User not found",
      },
    },
  },
},
```

**Step 2: Run typecheck and OpenAPI test**

```bash
cd /Users/assaf/Projects/cite.me.in && pnpm check:type && infisical --env dev run -- pnpm vitest run test/routes/api.openapi.test.ts
```

Expected: pass.

**Step 3: Commit**

```bash
git add app/lib/api/openapi.ts
git commit -m "feat: update OpenAPI spec — /api/me has no email param"
```

---

### Task 6: Update `api.me.test.ts`

**Files:**
- Modify: `test/routes/api.me.test.ts`

**Step 1: Rewrite the test file**

The token must now embed the user ID (`api-sites-route-user-1`), and the URL is `/api/me` (no email segment).

```ts
import { beforeAll, describe, expect, it } from "vitest";
import prisma from "~/lib/prisma.server";
import { port } from "~/test/helpers/launchBrowser";

const BASE = `http://localhost:${port}`;
const USER_ID = "api-sites-route-user-1";
const API_KEY = `cite.me.in_${USER_ID}_sitesroutetestkey123456`;
const DOMAIN = "api-sites-route-test.example";
const EMAIL = "api-sites-route@test.example";
const RUN_ID = "api-sites-route-run-1";

function get(path: string, token?: string) {
  return fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

beforeAll(async () => {
  await prisma.user.upsert({
    where: { id: USER_ID },
    create: {
      id: USER_ID,
      email: EMAIL,
      passwordHash: "test",
      apiKey: API_KEY,
      ownedSites: {
        create: {
          content: "Test content",
          domain: DOMAIN,
          summary: "Test summary",
          citationRuns: {
            create: {
              id: RUN_ID,
              platform: "chatgpt",
              model: "gpt-4o",
              onDate: new Date().toISOString().split("T")[0],
              queries: {
                create: {
                  query: "best retail platforms",
                  group: "retail",
                  extraQueries: [],
                  text: "Some answer",
                  position: 1,
                  citations: [
                    `https://${DOMAIN}/page1`,
                    `https://${DOMAIN}/page2`,
                  ],
                },
              },
            },
          },
        },
      },
    },
    update: { apiKey: API_KEY },
  });
});

describe("GET /api/me", () => {
  it("should return 401 without a token", async () => {
    const res = await get("/api/me");
    expect(res.status).toBe(401);
  });

  it("should return 404 for an unknown token", async () => {
    const res = await get("/api/me", "cite.me.in_nonexistent_wrongsecret1234");
    expect(res.status).toBe(404);
  });

  describe("with a correct token", () => {
    let response: Response;
    let body: {
      email: string;
      sites: { domain: string; createdAt: string }[];
    };

    beforeAll(async () => {
      response = await get("/api/me", API_KEY);
      body = await response.json();
    });

    it("should return 200", async () => {
      expect(response.status).toBe(200);
    });

    it("should return the user with their sites", async () => {
      expect(body.email).toBe(EMAIL);
      expect(Array.isArray(body.sites)).toBe(true);
      expect(body.sites[0].domain).toBe(DOMAIN);
      expect(body.sites[0].createdAt).toBe(
        new Date().toISOString().split("T")[0],
      );
    });
  });
});
```

**Step 2: Run route test**

```bash
cd /Users/assaf/Projects/cite.me.in && infisical --env dev run -- pnpm vitest run test/routes/api.me.test.ts
```

Expected: all tests pass.

**Step 3: Commit**

```bash
git add test/routes/api.me.test.ts
git commit -m "test: update api.me tests for new token format and /api/me route"
```

---

### Task 7: Clear existing API keys via Prisma migration

Existing tokens in the database use the old format (no userId encoded). They must be cleared so users regenerate.

**Step 1: Run the clear via Prisma in a one-off script**

```bash
cd /Users/assaf/Projects/cite.me.in && infisical --env dev run -- node --input-type=module <<'EOF'
import prisma from "./app/lib/prisma.server.ts";
const result = await prisma.user.updateMany({ data: { apiKey: null } });
console.log(`Cleared ${result.count} API keys`);
await prisma.$disconnect();
EOF
```

Or use a direct Prisma call in a `tsx` script:

```bash
cd /Users/assaf/Projects/cite.me.in && infisical --env dev run -- tsx --tsconfig tsconfig.json -e "
import prisma from './app/lib/prisma.server.ts';
const r = await prisma.user.updateMany({ data: { apiKey: null } });
console.log('Cleared:', r.count);
await prisma.\$disconnect();
"
```

Expected: `Cleared: N` where N is the number of existing users with a key set.

**Step 2: Commit**

No code changes to commit — this is a data migration.

---

### Task 8: Run full typecheck and test suite

**Step 1: Typecheck**

```bash
cd /Users/assaf/Projects/cite.me.in && pnpm check:type
```

Expected: no errors.

**Step 2: Run all affected tests**

```bash
cd /Users/assaf/Projects/cite.me.in && infisical --env dev run -- pnpm vitest run test/lib/apiAuth.test.ts test/routes/api.me.test.ts test/routes/api.sites.test.ts test/routes/api.openapi.test.ts test/routes/profile.test.ts
```

Expected: all pass.

**Step 3: Run lint**

```bash
cd /Users/assaf/Projects/cite.me.in && pnpm check:lint
```

Expected: no errors.
