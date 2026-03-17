# Cron Consolidation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Replace three separate cron routes with a single `cron.process-sites` route that runs every four hours, filters sites by payment tier and last-processed date, and runs citation run → bot insights → digest email for each qualifying site.

**Architecture:** Add an `Account` model to the Prisma schema (1:1 with `User`, holds Stripe subscription fields). The consolidated route queries all sites with their owner's account and most recent citation run, filters by eligibility, then processes each site sequentially. The three old routes and their tests are deleted.

**Tech Stack:** Prisma (schema + ORM), React Router loader, Vercel Cron, `@js-temporal/polyfill` for date math.

---

### Task 1: Add Account model to schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add Account model at the end of schema.prisma (after line 260)**

```prisma
model Account {
  id                   String   @id @default(cuid())
  userId               String   @unique @map("user_id")
  stripeCustomerId     String   @map("stripe_customer_id")
  stripeSubscriptionId String   @map("stripe_subscription_id")
  status               String   @map("status")
  createdAt            DateTime @map("created_at") @default(now())
  updatedAt            DateTime @map("updated_at") @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("accounts")
}
```

**Step 2: Add account relation field to User model (after `weeklyDigestEnabled` line ~257)**

```prisma
  account               Account?
```

**Step 3: Push schema and regenerate client**

```bash
pnpm prisma db push
pnpm prisma generate
```

Expected: no errors, migration applied.

**Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Account model for Stripe subscription"
```

---

### Task 2: Update envVars.ts

**Files:**
- Modify: `app/lib/envVars.ts`

**Step 1: Replace the three old heartbeat vars with one new one**

Remove these three entries from the `envVars` object:

```ts
  HEARTBEAT_CRON_CITATIONS: env
    .get("HEARTBEAT_CRON_CITATIONS")
    .required(false)
    .asString(),
  HEARTBEAT_CRON_BOT_INSIGHTS: env
    .get("HEARTBEAT_CRON_BOT_INSIGHTS")
    .required(false)
    .asString(),
  HEARTBEAT_CRON_WEEKLY_DIGEST: env
    .get("HEARTBEAT_CRON_WEEKLY_DIGEST")
    .required(false)
    .asString(),
```

Add this one:

```ts
  HEARTBEAT_CRON_PROCESS_SITES: env
    .get("HEARTBEAT_CRON_PROCESS_SITES")
    .required(false)
    .asString(),
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: errors for the three usages of the removed vars in the old cron files (those will be deleted in Task 5 — ignore for now).

**Step 3: Commit**

```bash
git add app/lib/envVars.ts
git commit -m "feat: add HEARTBEAT_CRON_PROCESS_SITES env var"
```

---

### Task 3: Create cron.process-sites.ts

**Files:**
- Create: `app/routes/cron.process-sites.ts`

**Step 1: Create the file with this exact content**

```ts
import { Temporal } from "@js-temporal/polyfill";
import debug from "debug";
import { data } from "react-router";
import sendWeeklyDigestEmail from "~/emails/WeeklyDigest";
import envVars from "~/lib/envVars";
import generateBotInsight from "~/lib/llm-visibility/generateBotInsight";
import queryAccount from "~/lib/llm-visibility/queryAccount";
import logError from "~/lib/logError.server";
import prisma from "~/lib/prisma.server";
import { UsageLimitExceededError } from "~/lib/usage/UsageLimitExceededError";
import {
  generateCitationChart,
  generateUnsubscribeToken,
  getWeeklyMetrics,
} from "~/lib/weeklyDigest.server";
import type { Route } from "./+types/cron.process-sites";

const logger = debug("server");

export async function loader({ request }: Route.LoaderArgs) {
  if (request.headers.get("authorization") !== `Bearer ${envVars.CRON_SECRET}`)
    throw new Response("Unauthorized", { status: 401 });

  const sevenDaysAgo = new Date(
    Temporal.Now.instant().subtract({ hours: 24 * 7 }).epochMilliseconds,
  );
  const twentyFourDaysAgo = new Date(
    Temporal.Now.instant().subtract({ hours: 24 * 24 }).epochMilliseconds,
  );

  const sites = await prisma.site.findMany({
    select: {
      id: true,
      domain: true,
      createdAt: true,
      owner: {
        select: {
          id: true,
          email: true,
          weeklyDigestEnabled: true,
          account: { select: { status: true } },
        },
      },
      siteUsers: {
        select: {
          user: {
            select: { id: true, email: true, weeklyDigestEnabled: true },
          },
        },
      },
      citationRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  const qualifying = sites.filter((site) => {
    const lastRun = site.citationRuns[0];
    if (lastRun && lastRun.createdAt >= sevenDaysAgo) return false;
    const isPaid = site.owner.account?.status === "active";
    const isFreeTrial = !isPaid && site.createdAt >= twentyFourDaysAgo;
    return isPaid || isFreeTrial;
  });

  logger(
    "[cron:process-sites] Processing %d/%d sites: %s",
    qualifying.length,
    sites.length,
    qualifying.map((s) => s.domain).join(", "),
  );

  const results: {
    siteId: string;
    ok: boolean;
    citationRun: boolean;
    botInsight: boolean;
    digestSent: number;
    error?: string;
  }[] = [];

  for (const site of qualifying) {
    let citationRun = false;
    let botInsight = false;
    let digestSent = 0;

    try {
      const siteQueryRows = await prisma.siteQuery.findMany({
        where: { siteId: site.id },
        orderBy: [{ group: "asc" }, { query: "asc" }],
      });
      const queries = siteQueryRows
        .filter((q) => q.query.trim())
        .map((q) => ({ query: q.query, group: q.group }));
      await queryAccount({ site, queries });
      citationRun = true;
      logger("[cron:process-sites] Citation run done — %s", site.domain);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger(
        "[cron:process-sites] Citation run failed — %s: %s",
        site.domain,
        message,
      );
      if (!(error instanceof UsageLimitExceededError))
        logError(error, { extra: { siteId: site.id, step: "citation-run" } });
    }

    try {
      const visits = await prisma.botVisit.findMany({
        where: { siteId: site.id, date: { gte: sevenDaysAgo } },
        select: { botType: true, path: true, count: true },
      });
      const byBot: Record<
        string,
        { total: number; pathCounts: Record<string, number> }
      > = {};
      for (const v of visits) {
        if (!byBot[v.botType]) byBot[v.botType] = { total: 0, pathCounts: {} };
        byBot[v.botType].total += v.count;
        byBot[v.botType].pathCounts[v.path] =
          (byBot[v.botType].pathCounts[v.path] ?? 0) + v.count;
      }
      const botStats = Object.entries(byBot)
        .sort(([, a], [, b]) => b.total - a.total)
        .map(([botType, { total, pathCounts }]) => ({
          botType,
          total,
          topPaths: Object.entries(pathCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([p]) => p),
        }));
      const content = await generateBotInsight(site.domain, botStats);
      const now = new Date();
      await prisma.botInsight.upsert({
        where: { siteId: site.id },
        create: { siteId: site.id, content, generatedAt: now },
        update: { content, generatedAt: now },
      });
      botInsight = true;
      logger("[cron:process-sites] Bot insight done — %s", site.domain);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger(
        "[cron:process-sites] Bot insight failed — %s: %s",
        site.domain,
        message,
      );
      logError(error, { extra: { siteId: site.id, step: "bot-insight" } });
    }

    try {
      const metrics = await getWeeklyMetrics(site.id, site.domain);
      const chartBase64 = await generateCitationChart(
        metrics.dailyCitations,
        metrics.prevDailyCitations,
      );
      const appUrl = envVars.VITE_APP_URL ?? "";
      const recipients = [
        site.owner,
        ...site.siteUsers.map((su) => su.user),
      ].filter((u) => u.weeklyDigestEnabled);
      for (const user of recipients) {
        const token = generateUnsubscribeToken(user.id);
        const unsubscribeUrl = new URL("/unsubscribe", appUrl);
        unsubscribeUrl.searchParams.set("token", token);
        unsubscribeUrl.searchParams.set("user", user.id);
        if (user.email === "assaf@labnotes.org")
          await sendWeeklyDigestEmail({
            to: user.email,
            domain: site.domain,
            unsubscribeUrl: unsubscribeUrl.toString(),
            metrics,
            chartBase64,
          });
        digestSent++;
      }
      logger(
        "[cron:process-sites] Digest done — %s, sent %d",
        site.domain,
        digestSent,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger(
        "[cron:process-sites] Digest failed — %s: %s",
        site.domain,
        message,
      );
      logError(error, { extra: { siteId: site.id, step: "digest" } });
    }

    results.push({
      siteId: site.id,
      ok: citationRun,
      citationRun,
      botInsight,
      digestSent,
    });
  }

  if (envVars.HEARTBEAT_CRON_PROCESS_SITES)
    await fetch(envVars.HEARTBEAT_CRON_PROCESS_SITES);
  return data({ ok: true, results });
}
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors (the old cron files still exist at this point and will still show errors for their removed heartbeat vars — that's fine, they're deleted in Task 5).

**Step 3: Commit**

```bash
git add app/routes/cron.process-sites.ts
git commit -m "feat: add consolidated cron.process-sites route"
```

---

### Task 4: Write tests for cron.process-sites

**Files:**
- Create: `test/routes/cron.process-sites.test.ts`

These are HTTP integration tests (no mocking) that hit the real dev server. The pattern matches the existing cron test files.

**Step 1: Create the test file**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import prisma from "~/lib/prisma.server";
import { port } from "../helpers/launchBrowser";

async function makeRequest(auth?: string) {
  return await fetch(`http://localhost:${port}/cron/process-sites`, {
    headers: { authorization: `Bearer ${auth}` },
  });
}

describe("cron.process-sites", () => {
  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: "process" } } });
  });

  describe("auth", () => {
    it("should return 401 without Authorization header", async () => {
      const res = await fetch(`http://localhost:${port}/cron/process-sites`);
      expect(res.status).toBe(401);
    });

    it("should return 401 with wrong token", async () => {
      const res = await makeRequest("wrong-token");
      expect(res.status).toBe(401);
    });

    it("should return 200 with correct token", async () => {
      const res = await makeRequest("test-cron-secret");
      expect(res.status).toBe(200);
    });
  });

  describe("site filtering", () => {
    it("should process a paid site with no citation run", async () => {
      await prisma.site.create({
        data: {
          id: "site-process-1",
          domain: "paid-site.example.com",
          apiKey: "test-api-key-process-1",
          owner: {
            create: {
              id: "user-process-1",
              email: "owner-process1@test.com",
              passwordHash: "test",
              account: {
                create: {
                  stripeCustomerId: "cus_test1",
                  stripeSubscriptionId: "sub_test1",
                  status: "active",
                },
              },
            },
          },
        },
      });

      const res = await makeRequest("test-cron-secret");
      const body = await res.json();
      expect(
        body.results.find(
          (r: { siteId: string }) => r.siteId === "site-process-1",
        ),
      ).toBeDefined();
    });

    it("should process a free trial site (created today)", async () => {
      await prisma.site.create({
        data: {
          id: "site-process-2",
          domain: "free-trial.example.com",
          apiKey: "test-api-key-process-2",
          owner: {
            create: {
              id: "user-process-2",
              email: "owner-process2@test.com",
              passwordHash: "test",
            },
          },
        },
      });

      const res = await makeRequest("test-cron-secret");
      const body = await res.json();
      expect(
        body.results.find(
          (r: { siteId: string }) => r.siteId === "site-process-2",
        ),
      ).toBeDefined();
    });

    it("should skip a free site older than 24 days", async () => {
      const twentyFiveDaysAgo = new Date(
        Date.now() - 25 * 24 * 60 * 60 * 1000,
      );
      await prisma.site.create({
        data: {
          id: "site-process-3",
          domain: "old-free.example.com",
          apiKey: "test-api-key-process-3",
          createdAt: twentyFiveDaysAgo,
          owner: {
            create: {
              id: "user-process-3",
              email: "owner-process3@test.com",
              passwordHash: "test",
            },
          },
        },
      });

      const res = await makeRequest("test-cron-secret");
      const body = await res.json();
      expect(
        body.results.find(
          (r: { siteId: string }) => r.siteId === "site-process-3",
        ),
      ).toBeUndefined();
    });

    it("should skip a paid site with a citation run within 7 days", async () => {
      await prisma.site.create({
        data: {
          id: "site-process-4",
          domain: "recent-run.example.com",
          apiKey: "test-api-key-process-4",
          owner: {
            create: {
              id: "user-process-4",
              email: "owner-process4@test.com",
              passwordHash: "test",
              account: {
                create: {
                  stripeCustomerId: "cus_test4",
                  stripeSubscriptionId: "sub_test4",
                  status: "active",
                },
              },
            },
          },
          citationRuns: {
            create: { platform: "chatgpt", model: "gpt-4o" },
          },
        },
      });

      const res = await makeRequest("test-cron-secret");
      const body = await res.json();
      expect(
        body.results.find(
          (r: { siteId: string }) => r.siteId === "site-process-4",
        ),
      ).toBeUndefined();
    });
  });
});
```

**Step 2: Run the tests**

```bash
pnpm vitest run test/routes/cron.process-sites.test.ts
```

Expected: all tests pass.

**Step 3: Commit**

```bash
git add test/routes/cron.process-sites.test.ts
git commit -m "test: add cron.process-sites tests"
```

---

### Task 5: Delete old routes and update vercel.json

**Files:**
- Delete: `app/routes/cron.citation-runs.ts`
- Delete: `app/routes/cron.bot-insights.ts`
- Delete: `app/routes/cron.weekly-digest.ts`
- Delete: `test/routes/cron.bot-insights.test.ts`
- Delete: `test/routes/cron.weekly-digest.test.ts`
- Modify: `.vercel/vercel.json`

**Step 1: Delete the old route files**

```bash
rm app/routes/cron.citation-runs.ts
rm app/routes/cron.bot-insights.ts
rm app/routes/cron.weekly-digest.ts
```

**Step 2: Delete the old test files**

```bash
rm test/routes/cron.bot-insights.test.ts
rm test/routes/cron.weekly-digest.test.ts
```

**Step 3: Update .vercel/vercel.json — replace the three cron entries with one**

Replace the entire `crons` array:

```json
{
  "crons": [
    {
      "path": "/cron/process-sites",
      "schedule": "0 */4 * * *"
    }
  ],
  "github": {
    "enabled": false
  },
  "public": false
}
```

**Step 4: Run typecheck and lint**

```bash
pnpm typecheck
pnpm lint
```

Expected: no errors.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: consolidate cron jobs into cron.process-sites"
```
