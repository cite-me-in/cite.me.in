# Site Setup Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Replace the synchronous crawl→suggestions→query flow with a fully async pipeline that streams progress to a live setup page, showing one log line per operation like LLM thinking output.

**Architecture:** POST `/sites` validates the URL (HEAD request) and creates a minimal site record, then redirects to `/site/{domain}/setup`. The setup page fires a POST to `/site/{domain}/setup/run` (via useFetcher), which runs the full pipeline — crawl, summarize, generate queries, query 4 platforms in parallel, send email — writing each step to a Redis log list. A polling endpoint reads from Redis; the UI appends lines every 2s and redirects to citations when done.

**Tech Stack:** React Router v7, Prisma/PostgreSQL, ioredis, React Email/Resend, Vercel AI SDK, es-toolkit

---

### Task 1: Create shared Redis client module

**Files:**

- Create: `app/lib/redis.server.ts`

The `sendEmails.tsx` file creates Redis instances inline for test use only. Production code needs a shared client.

**Step 1: Create the file**

```ts
import Redis from "ioredis";
import envVars from "./envVars";

const redis = new Redis(envVars.REDIS_URL);
export default redis;
```

**Step 2: Commit**

```bash
git add app/lib/redis.server.ts
git commit -m "feat: add shared Redis client module"
```

---

### Task 2: Create setup progress helpers

**Files:**

- Create: `app/lib/setupProgress.server.ts`

**Step 1: Write the module**

```ts
import redis from "./redis.server";

const TTL = 86_400; // 24 hours

function logKey(siteId: string, userId: string) {
  return `setup:${siteId}:${userId}:log`;
}
function statusKey(siteId: string, userId: string) {
  return `setup:${siteId}:${userId}:status`;
}

export async function appendLog(siteId: string, userId: string, line: string) {
  await redis.rpush(logKey(siteId, userId), line);
}

export async function setStatus(
  siteId: string,
  userId: string,
  status: "running" | "complete" | "error",
) {
  await redis.set(statusKey(siteId, userId), status, "EX", TTL);
  if (status !== "running") await redis.expire(logKey(siteId, userId), TTL);
}

export async function getProgress(
  siteId: string,
  userId: string,
  offset: number,
): Promise<{ lines: string[]; done: boolean; nextOffset: number }> {
  const [lines, status] = await Promise.all([
    redis.lrange(logKey(siteId, userId), offset, -1),
    redis.get(statusKey(siteId, userId)),
  ]);
  const done = status === "complete" || status === "error";
  return { lines, done, nextOffset: offset + lines.length };
}

export async function getStatus(siteId: string, userId: string) {
  return redis.get(statusKey(siteId, userId));
}
```

**Step 2: Commit**

```bash
git add app/lib/setupProgress.server.ts
git commit -m "feat: add setup progress helpers for Redis log streaming"
```

---

### Task 3: Refactor `addSiteToUser` to fast site creation

**Files:**

- Modify: `app/lib/sites.server.ts`

Replace `addSiteToUser` with `createSite`: validates the URL, checks for existing, checks limits, does a HEAD request for reachability, then creates the site record with empty `content`/`summary`. Crawling moves to the worker.

**Step 1: Rewrite `addSiteToUser` → `createSite`**

Replace the entire `addSiteToUser` function (lines 7–55) with:

```ts
export async function createSite(
  user: { id: string },
  url: string,
): Promise<{ site: Site; existing: boolean }> {
  const domain = extractDomain(url);
  if (!domain) throw new Error("Enter a valid website URL or domain name");

  const existing = await prisma.site.findFirst({
    where: { ownerId: user.id, domain },
  });
  if (existing) return { site: existing, existing: true };

  const account = await prisma.account.findUnique({
    where: { userId: user.id },
    select: { status: true },
  });
  const isPro = account?.status === "active";
  const limit = isPro ? 5 : 1;
  const siteCount = await prisma.site.count({ where: { ownerId: user.id } });
  if (siteCount >= limit) {
    throw new Error(
      isPro
        ? "Pro plan supports up to 5 sites. Contact us if you need more."
        : "Free trial supports 1 site. Upgrade to Pro to add up to 5 sites.",
    );
  }

  // Quick reachability check — the only sync step before backgrounding.
  try {
    const res = await fetch(`https://${domain}/`, {
      method: "HEAD",
      signal: AbortSignal.timeout(5_000),
    });
    // Some servers reject HEAD; treat 405 as reachable.
    if (!res.ok && res.status !== 405) throw new Error(`HTTP ${res.status}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("HTTP "))
      throw new Error(`Could not reach ${domain} (${error.message}). Check the URL.`);
    throw new Error(`Could not reach ${domain}. Check the URL and try again.`);
  }

  const site = await prisma.site.create({
    data: {
      apiKey: `cite.me.in_${generateApiKey(16)}`,
      content: "",
      summary: "",
      domain,
      owner: { connect: { id: user.id } },
    },
  });
  return { site, existing: false };
}
```

**Step 2: Update the import in `route.tsx`**

In `app/routes/sites/route.tsx` line 11, change `addSiteToUser` → `createSite`:

```ts
import { createSite, deleteSite } from "~/lib/sites.server";
```

**Step 3: Typecheck**

```bash
pnpm check:type
```

Expected: no errors.

**Step 4: Commit**

```bash
git add app/lib/sites.server.ts app/routes/sites/route.tsx
git commit -m "refactor: replace addSiteToUser with fast createSite (crawl moved to worker)"
```

---

### Task 4: Create setup confirmation email

**Files:**

- Create: `app/emails/SiteSetupComplete.tsx`

A simple transactional email sent when the pipeline finishes. Pattern follows `EmailVerification.tsx`.

**Step 1: Create the file**

```tsx
import { Button, Section, Text } from "@react-email/components";
import EmailLayout from "./EmailLayout";
import { sendEmail } from "./sendEmails";

export default async function sendSiteSetupEmail({
  domain,
  user,
}: {
  domain: string;
  user: { email: string; unsubscribed: boolean };
}) {
  const citationsUrl = `${process.env.VITE_APP_URL}/site/${domain}/citations`;
  await sendEmail({
    canUnsubscribe: false,
    render: ({ subject }) => (
      <SiteSetupComplete subject={subject} domain={domain} citationsUrl={citationsUrl} />
    ),
    subject: `${domain} is set up on cite.me.in`,
    user,
  });
}

function SiteSetupComplete({
  subject,
  domain,
  citationsUrl,
}: {
  subject: string;
  domain: string;
  citationsUrl: string;
}) {
  return (
    <EmailLayout subject={subject}>
      <Text className="my-4 text-base text-text leading-relaxed">
        Your site <strong>{domain}</strong> has been set up on cite.me.in.
      </Text>

      <Text className="my-4 text-base text-text leading-relaxed">
        We've crawled your site, generated search queries, and checked how ChatGPT, Claude,
        Perplexity, and Gemini cite you. Your results are ready.
      </Text>

      <Section className="my-8 text-center">
        <Button
          href={citationsUrl}
          className="rounded-md bg-primary px-4 py-2 text-white hover:bg-primary-hover"
        >
          View your citations
        </Button>
      </Section>

      <Text className="my-4 text-base text-text leading-relaxed">
        Best regards,
        <br />
        The Cite.me.in Team
      </Text>
    </EmailLayout>
  );
}
```

**Step 2: Commit**

```bash
git add app/emails/SiteSetupComplete.tsx
git commit -m "feat: add site setup complete email"
```

---

### Task 5: Create setup worker route

**Files:**

- Create: `app/routes/site.$domain_.setup.run.ts`

This is the pipeline. It must only handle POST. Auth via `requireSiteAccess`. Guards against double-start with the Redis status key. Runs crawl → summarize → generate queries → add queries to DB → query all 4 platforms in parallel (each platform logs per-query) → send email → set status `complete`.

**Step 1: Create the file**

```ts
import { ms } from "convert";
import { delay, forEachAsync } from "es-toolkit";
import sendSiteSetupEmail from "~/emails/SiteSetupComplete";
import addSiteQueries from "~/lib/addSiteQueries";
import { requireSiteAccess } from "~/lib/auth.server";
import generateSiteQueries from "~/lib/llm-visibility/generateSiteQueries";
import analyzeSentiment from "~/lib/llm-visibility/analyzeSentiment";
import queryClaude from "~/lib/llm-visibility/claudeClient";
import queryGemini from "~/lib/llm-visibility/geminiClient";
import openaiClient from "~/lib/llm-visibility/openaiClient";
import queryPerplexity from "~/lib/llm-visibility/perplexityClient";
import type { QueryFn } from "~/lib/llm-visibility/queryFn";
import { singleQueryRepetition } from "~/lib/llm-visibility/queryPlatform";
import logError from "~/lib/logError.server";
import prisma from "~/lib/prisma.server";
import { crawl } from "~/lib/scrape/crawl";
import { summarize } from "~/lib/scrape/summarize";
import { appendLog, getStatus, setStatus } from "~/lib/setupProgress.server";
import type { Route } from "./+types/site.$domain_.setup.run";

const PLATFORMS: {
  platform: string;
  modelId: string;
  queryFn: QueryFn;
  label: string;
}[] = [
  { platform: "chatgpt", modelId: "gpt-5-chat-latest", queryFn: openaiClient, label: "ChatGPT" },
  { platform: "perplexity", modelId: "sonar", queryFn: queryPerplexity, label: "Perplexity" },
  {
    platform: "claude",
    modelId: "claude-haiku-4-5-20251001",
    queryFn: queryClaude,
    label: "Claude",
  },
  { platform: "gemini", modelId: "gemini-2.5-flash", queryFn: queryGemini, label: "Gemini" },
];

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") throw new Response("Method not allowed", { status: 405 });

  const { site, user } = await requireSiteAccess({
    domain: params.domain,
    request,
  });

  // Idempotency: don't start a second pipeline if one is running or done.
  const current = await getStatus(site.id, user.id);
  if (current === "running" || current === "complete") return new Response(null, { status: 204 });

  await setStatus(site.id, user.id, "running");

  const log = (line: string) => appendLog(site.id, user.id, line);

  try {
    // Phase 1: Crawl
    await log("Crawling " + site.domain + "...");
    const content = await crawl({
      domain: site.domain,
      maxPages: 10,
      maxWords: 5_000,
      maxSeconds: 15,
    });
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    await log(`Found ${wordCount.toLocaleString()} words of content`);
    await prisma.site.update({ where: { id: site.id }, data: { content } });

    // Phase 2: Summarize
    await log("Summarizing content...");
    const summary = await summarize({ domain: site.domain, content });
    await log(summary);
    await prisma.site.update({ where: { id: site.id }, data: { summary } });

    // Phase 3: Generate queries
    await log("Generating queries...");
    const suggestions = await generateSiteQueries(site);
    for (const { group, query } of suggestions) await log(`  [${group}] ${query}`);

    // Phase 4: Save queries to DB
    const queries = suggestions.filter((q) => q.query.trim());
    await addSiteQueries(site, queries);

    // Clean up suggestions now that they've been promoted.
    await prisma.siteQuerySuggestion.deleteMany({ where: { siteId: site.id } });

    // Phase 5: Query all 4 platforms in parallel
    await log("Querying AI platforms...");
    await Promise.all(
      PLATFORMS.map(({ platform, modelId, queryFn, label }) =>
        runPlatformWithProgress({
          site,
          platform,
          modelId,
          queryFn,
          label,
          queries,
          log,
        }),
      ),
    );

    // Phase 6: Email
    await log("Sending confirmation email...");
    const owner = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { email: true, unsubscribed: true },
    });
    await sendSiteSetupEmail({ domain: site.domain, user: owner });

    await log("Done! Your citations are ready.");
    await setStatus(site.id, user.id, "complete");
  } catch (error) {
    await log("Something went wrong — please try refreshing.");
    await setStatus(site.id, user.id, "error");
    logError(error, { extra: { siteId: site.id } });
  }

  return new Response(null, { status: 204 });
}

async function runPlatformWithProgress({
  site,
  platform,
  modelId,
  queryFn,
  label,
  queries,
  log,
}: {
  site: { id: string; domain: string };
  platform: string;
  modelId: string;
  queryFn: QueryFn;
  label: string;
  queries: { query: string; group: string }[];
  log: (line: string) => Promise<void>;
}) {
  const onDate = new Date().toISOString().split("T")[0];
  const run = await prisma.citationQueryRun.upsert({
    where: { siteId_platform_onDate: { onDate, platform, siteId: site.id } },
    update: { model: modelId },
    create: { onDate, model: modelId, platform, siteId: site.id },
  });

  await forEachAsync(queries, async ({ query, group }, index) => {
    if (process.env.NODE_ENV !== "test") await delay(ms("200ms") * index);
    await log(`${label}: ${query} (${index + 1}/${queries.length})`);
    await singleQueryRepetition({
      siteId: site.id,
      group,
      modelId,
      platform,
      query,
      queryFn,
      runId: run.id,
      site,
    });
  });

  // Sentiment analysis for this platform's run.
  try {
    const completedQueries = await prisma.citationQuery.findMany({
      where: { runId: run.id },
    });
    const { label: sentLabel, summary } = await analyzeSentiment({
      domain: site.domain,
      queries: completedQueries,
    });
    await prisma.citationQueryRun.update({
      where: { id: run.id },
      data: { sentimentLabel: sentLabel, sentimentSummary: summary },
    });
  } catch (error) {
    logError(error, { extra: { siteId: site.id, platform } });
  }
}
```

**Step 2: Typecheck**

```bash
pnpm check:type
```

Fix any type errors. The generated `+types/site.$domain_.setup.run` should be created automatically by react-router typegen.

**Step 3: Commit**

```bash
git add app/routes/site.$domain_.setup.run.ts
git commit -m "feat: add setup pipeline worker route"
```

---

### Task 6: Create setup status polling endpoint

**Files:**

- Create: `app/routes/site.$domain_.setup.status.ts`

Simple GET resource route. Reads offset from search params, calls `getProgress`, returns JSON.

**Step 1: Create the file**

```ts
import { requireSiteAccess } from "~/lib/auth.server";
import { getProgress } from "~/lib/setupProgress.server";
import type { Route } from "./+types/site.$domain_.setup.status";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { site, user } = await requireSiteAccess({
    domain: params.domain,
    request,
  });

  const offset = Number(new URL(request.url).searchParams.get("offset") ?? "0");
  const progress = await getProgress(site.id, user.id, offset);
  return Response.json(progress);
}
```

**Step 2: Typecheck**

```bash
pnpm check:type
```

**Step 3: Commit**

```bash
git add app/routes/site.$domain_.setup.status.ts
git commit -m "feat: add setup status polling endpoint"
```

---

### Task 7: Create setup page

**Files:**

- Create: `app/routes/site.$domain_.setup/route.tsx`

Shows the live log. On mount, fires the worker if not already started. Polls the status endpoint every 2s and appends lines. Redirects to citations when done.

**Step 1: Create the directory and file**

```bash
mkdir -p app/routes/site.\$domain_.setup
```

```tsx
import { useEffect, useRef, useState } from "react";
import { redirect, useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import Main from "~/components/ui/Main";
import Spinner from "~/components/ui/Spinner";
import { requireSiteAccess } from "~/lib/auth.server";
import { getStatus } from "~/lib/setupProgress.server";
import type { Route } from "./+types/route";

export const handle = { siteNav: true };

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Setting up ${params.domain} | Cite.me.in` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { site, user } = await requireSiteAccess({
    domain: params.domain,
    request,
  });
  const status = await getStatus(site.id, user.id);
  if (status === "complete") throw redirect(`/site/${params.domain}/citations`);
  return { domain: params.domain, needsStart: status === null };
}

export default function SetupPage({ loaderData }: Route.ComponentProps) {
  const { domain, needsStart } = loaderData;
  const navigate = useNavigate();

  const [lines, setLines] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const offsetRef = useRef(0);
  const logRef = useRef<HTMLPreElement>(null);

  // Fire worker on mount if not already started.
  useEffect(() => {
    if (!needsStart) return;
    fetch(`/site/${domain}/setup/run`, { method: "POST" }).catch(() => {
      setError(true);
    });
  }, [domain, needsStart]);

  // Poll status endpoint every 2s.
  useEffect(() => {
    if (done) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/site/${domain}/setup/status?offset=${offsetRef.current}`);
        const data: { lines: string[]; done: boolean; nextOffset: number } = await res.json();
        if (data.lines.length > 0) {
          setLines((prev) => [...prev, ...data.lines]);
          offsetRef.current = data.nextOffset;
        }
        if (data.done) setDone(true);
      } catch {
        // Network hiccup — keep polling.
      }
    }, 2_000);
    return () => clearInterval(id);
  }, [done, domain]);

  // Auto-scroll log to bottom.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  // Redirect to citations after pipeline completes.
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => navigate(`/site/${domain}/citations`), 2_000);
    return () => clearTimeout(timer);
  }, [done, domain, navigate]);

  return (
    <Main variant="wide">
      <div>
        <h1 className="font-heading text-3xl">Setting up {domain}</h1>
        <p className="mt-1 text-base text-foreground/60">
          {done
            ? "All done — redirecting to your citations…"
            : "Crawling your site and querying AI platforms. This takes about a minute."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {!done && !error && <Spinner />}
            {done ? "Setup complete" : error ? "Something went wrong" : "Running…"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre
            ref={logRef}
            className="h-96 overflow-y-auto rounded border border-border bg-muted p-4 font-mono text-sm leading-relaxed"
          >
            {lines.length === 0 && !done && <span className="text-foreground/40">Starting…</span>}
            {lines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            {done && (
              <div className="mt-2 font-semibold text-green-700">✓ Redirecting to citations…</div>
            )}
          </pre>
        </CardContent>
      </Card>
    </Main>
  );
}
```

**Step 2: Typecheck**

```bash
pnpm check:type
```

**Step 3: Commit**

```bash
git add app/routes/site.\$domain_.setup/
git commit -m "feat: add site setup page with live log streaming"
```

---

### Task 8: Update `/sites` action to use `createSite` and redirect to setup

**Files:**

- Modify: `app/routes/sites/route.tsx`

**Step 1: Replace the POST case in the action**

In `app/routes/sites/route.tsx`, find the POST case (lines 54–65) and replace:

Old:

```ts
const { site, existing } = await addSiteToUser(user, url);
if (existing) {
  return redirect(`/site/${site.domain}/citations`);
} else {
  await generateSiteQueries(site);
  return redirect(`/site/${site.domain}/suggestions`);
}
```

New:

```ts
const { site, existing } = await createSite(user, url);
if (existing) return redirect(`/site/${site.domain}/citations`);
return redirect(`/site/${site.domain}/setup`);
```

**Step 2: Remove unused import**

Remove `generateSiteQueries` from the import list (line 9).

**Step 3: Run typecheck**

```bash
pnpm check:type
```

**Step 4: Commit**

```bash
git add app/routes/sites/route.tsx
git commit -m "feat: redirect new sites to setup page instead of suggestions"
```

---

### Task 9: Retire the suggestions route

**Files:**

- Modify: `app/routes/site.$domain_.suggestions/route.tsx`

New sites will never reach the suggestions route (redirected to setup instead). Old sites still have suggestions in the DB, so the route stays functional. The only change: remove the `queryAccount` call from the POST action (queries are now run by the setup worker) and redirect to citations instead of running queries inline.

**Step 1: In the POST case of the action, replace the body**

Old (lines 61–71):

```ts
case "POST": {
  const raw = await request.json();
  const queries = z
    .array(z.object({ group: z.string(), query: z.string() }))
    .parse(raw);
  await addSiteQueries(site, queries);
  await queryAccount({
    site,
    queries: queries.filter((q) => q.query.trim()),
  });
  return redirect(`/site/${params.domain}/citations`);
}
```

New:

```ts
case "POST": {
  const raw = await request.json();
  const queries = z
    .array(z.object({ group: z.string(), query: z.string() }))
    .parse(raw);
  await addSiteQueries(site, queries);
  return redirect(`/site/${params.domain}/citations`);
}
```

**Step 2: Remove now-unused imports** (`queryAccount` import on line 18).

**Step 3: Remove the `GradualProgress` component and its import** (`useInterval`, `ProgressIndicator`), and the `isProcessing` block in the JSX that shows the coffee icon + progress bar, since no long-running inline query is happening anymore.

**Step 4: Typecheck and test**

```bash
pnpm check:type
```

**Step 5: Commit**

```bash
git add app/routes/site.\$domain_.suggestions/
git commit -m "refactor: remove inline queryAccount from suggestions route"
```

---

### Task 10: End-to-end smoke test

**Files:**

- Modify or create: `test/routes/site-setup.test.ts` (Playwright)

**Step 1: Write the test**

```ts
import { expect, test } from "@playwright/test";
import { goto } from "test/helpers/launchBrowser";

test("should complete site setup and show citations", async ({ page }) => {
  // Navigate to dashboard as a logged-in test user
  await goto(page, "/sites");

  // Open add-site form
  await page.getByRole("button", { name: "Add Site" }).click();

  // Submit a URL — use a real domain that resolves
  await page.getByLabel("Website URL or domain").fill("example.com");
  await page.getByRole("button", { name: "Add Site" }).click();

  // Should land on the setup page
  await expect(page).toHaveURL(/\/site\/example\.com\/setup/);
  await expect(page.getByRole("heading", { name: /Setting up/ })).toBeVisible();

  // Log container should appear
  await expect(page.locator("pre")).toBeVisible();
});
```

> Note: A full end-to-end test that waits for the pipeline to finish would take 2+ minutes and require real API keys. The smoke test above validates the redirect and page render. The polling behavior is tested by running the app manually.

**Step 2: Run the test**

```bash
pnpm exec playwright test test/routes/site-setup.test.ts
```

**Step 3: Commit**

```bash
git add test/routes/site-setup.test.ts
git commit -m "test: add smoke test for site setup page"
```

---

## Notes

- **Vercel timeout**: The worker runs for ~60–80s (crawl 15s + summarize 3s + generate queries 5s + parallel queries ~52s). Well within the 300s Pro limit. The client-side `fetch` to `/setup/run` keeps the connection open; even if the browser navigates away, Vercel continues executing the function.
- **Idempotency**: The worker checks Redis status on entry — calling `/setup/run` twice has no effect if a pipeline is already running or complete.
- **Error recovery**: If the worker errors, status is set to `error` and the log shows the last message. The setup page shows the error state. Users can retry by navigating away and back to `/sites` to start fresh (which would require deleting and re-adding the site — a known limitation for now).
- **Suggestions route**: Left in place for existing sites that have `SiteQuerySuggestion` records. New sites bypass it entirely. The worker deletes suggestion records after promoting them to `SiteQuery`.
