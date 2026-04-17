# Human Visitors Visualization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone "Human Visitors" page showing AI platform referral breakdown as a stacked area chart, proving that LLM citations drive real human visitors.

**Architecture:** New route `site.$domain_.visitors` modeled after `site.$domain_.bots`. Loader queries `humanVisit` records, aggregates counts by day and AI platform (derived dynamically from data). Three components: key metrics row, stacked area chart, AI platform breakdown table.

**Tech Stack:** React Router v7 loaders, Prisma, Recharts `AreaChart` with `stackId`, existing `ChartContainer` + `Card` + `Table` UI components, `DateRangeSelector`.

---

### Task 1: Add "Human Visitors" nav link

**Files:**

- Modify: `app/components/layout/PageHeader.tsx:29-32`

**Step 1: Add the link**

In `HeaderLinks`, add `{ to: \`/site/${siteDomain}/visitors\`, label: "Human Visitors" }` between "Bot Traffic" and the settings icon:

```ts
navLinks.push(
  { to: `/site/${siteDomain}/citations`, label: "Citations" },
  { to: `/site/${siteDomain}/visitors`, label: "Human Visitors" },
  { to: `/site/${siteDomain}/bots`, label: "Bot Traffic" },
  { to: `/site/${siteDomain}/settings`, label: <SettingsIcon size={20} /> },
);
```

**Step 2: Commit**

```bash
git add app/components/layout/PageHeader.tsx
git commit -m "feat: add Human Visitors link to site nav"
```

---

### Task 2: Write the Playwright test (failing)

**Files:**

- Create: `test/routes/site.visitors.test.ts`

**Step 1: Write the test file**

```ts
import { expect } from "@playwright/test";
import { afterAll, beforeAll, describe, it } from "vitest";
import { removeElements } from "~/lib/html/parseHTML";
import prisma from "~/lib/prisma.server";
import type { User } from "~/prisma";
import { goto, port } from "../helpers/launchBrowser";
import { signIn } from "../helpers/signIn";

const BASE_DATE = new Date("2026-02-26T00:00:00.000Z");

const HUMAN_VISITS = [
  {
    visitorId: "hv-visitor-1",
    browser: "Chrome",
    deviceType: "desktop",
    aiReferral: "chatgpt",
    count: 3,
    daysAgo: 0,
  },
  {
    visitorId: "hv-visitor-2",
    browser: "Firefox",
    deviceType: "mobile",
    aiReferral: "perplexity",
    count: 1,
    daysAgo: 1,
  },
  {
    visitorId: "hv-visitor-3",
    browser: "Chrome",
    deviceType: "desktop",
    aiReferral: null,
    count: 5,
    daysAgo: 2,
  },
] as const;

function daysAgo(n: number): Date {
  const d = new Date(BASE_DATE);
  d.setDate(d.getDate() - n);
  return d;
}

describe("unauthenticated access", () => {
  it("should redirect to /sign-in", async () => {
    const response = await fetch(`http://localhost:${port}/site/some-id/visitors`, {
      redirect: "manual",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/sign-in");
  });
});

describe("site visitors page", () => {
  let user: User;
  let siteId: string;
  let siteDomain: string;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        id: "user-visitors-1",
        email: "site-visitors-test@test.com",
        passwordHash: "test",
      },
    });
    const site = await prisma.site.create({
      data: {
        apiKey: "test-api-key-visitors-1",
        content: "Test content",
        domain: "visitors-test.example.com",
        id: "site-visitors-1",
        ownerId: user.id,
        summary: "Test summary",
      },
    });
    siteId = site.id;
    siteDomain = site.domain;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: user.id } });
  });

  describe("empty state", () => {
    let page: Awaited<ReturnType<typeof goto>>;

    beforeAll(async () => {
      await signIn(user.id);
      page = await goto(`/site/${siteDomain}/visitors`);
    });

    it("should show empty state message", async () => {
      await expect(page.getByText("No visitors recorded")).toBeVisible();
    });

    it("should show site domain breadcrumb", async () => {
      await expect(page.getByRole("link", { name: siteDomain })).toBeVisible();
    });

    it("should match visually", { timeout: 30_000 }, async () => {
      await expect(page.locator("main")).toMatchVisual({
        name: "site/visitors-empty",
      });
    });
  });

  describe("with human visits", () => {
    let page: Awaited<ReturnType<typeof goto>>;

    beforeAll(async () => {
      for (const v of HUMAN_VISITS) {
        const date = daysAgo(v.daysAgo);
        await prisma.humanVisit.create({
          data: {
            siteId,
            visitorId: v.visitorId,
            browser: v.browser,
            deviceType: v.deviceType,
            aiReferral: v.aiReferral ?? null,
            count: v.count,
            date,
            firstSeen: date,
            lastSeen: date,
          },
        });
      }
      page = await goto(`/site/${siteDomain}/visitors?from=2026-01-27&until=2026-02-26`);
    });

    it("should show total unique visitors", async () => {
      // 3 visits = 3 unique visitors (one row per visitor per day)
      await expect(page.getByText("3")).toBeVisible();
    });

    it("should show AI platforms in the breakdown table", async () => {
      await expect(page.getByRole("cell", { name: "chatgpt", exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: "perplexity", exact: true })).toBeVisible();
    });

    it("should match visually", { timeout: 30_000 }, async () => {
      await expect(page.locator("main")).toMatchVisual({
        name: "site/visitors-with-data",
        modify: (html) =>
          removeElements(html, (node) => {
            if (node.attributes["data-slot"] === "chart") return true;
            const href = node.attributes.href ?? "";
            return href.startsWith("/site/") && !href.endsWith("/visitors");
          }),
      });
    });
  });
});
```

**Step 2: Run the test to confirm it fails**

```bash
infisical --env dev run -- vitest run test/routes/site.visitors.test.ts
```

Expected: fails with 404 or redirect (route doesn't exist yet).

---

### Task 3: Create NoVisitors empty state

**Files:**

- Create: `app/routes/site.$domain_.visitors/NoVisitors.tsx`

**Step 1: Write the component**

```tsx
export default function NoVisitors({ domain }: { domain: string }) {
  return (
    <div className="rounded border-2 border-black p-8 text-center">
      <p className="font-bold text-lg">No visitors recorded</p>
      <p className="mt-2 text-foreground/60">
        Install the tracking snippet on <span className="font-mono">{domain}</span> to start seeing
        human visitor data here.
      </p>
    </div>
  );
}
```

---

### Task 4: Create VisitorKeyMetrics component

**Files:**

- Create: `app/routes/site.$domain_.visitors/VisitorKeyMetrics.tsx`

**Step 1: Write the component**

```tsx
import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/Card";

export default function VisitorKeyMetrics({
  totalVisitors,
  totalPageViews,
  aiReferredVisitors,
  aiPct,
}: {
  totalVisitors: number;
  totalPageViews: number;
  aiReferredVisitors: number;
  aiPct: number;
}) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {[
        { label: "Unique Visitors", value: totalVisitors.toLocaleString() },
        { label: "Page Views", value: totalPageViews.toLocaleString() },
        {
          label: "AI-Referred Visitors",
          value: aiReferredVisitors.toLocaleString(),
        },
        { label: "% from AI", value: `${aiPct}%` },
      ].map(({ label, value }) => (
        <Card key={label}>
          <CardHeader className="text-center">
            <CardDescription className="text-foreground/60">{label}</CardDescription>
            <CardTitle>{value}</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
```

---

### Task 5: Create VisitorTrafficChart (stacked area)

**Files:**

- Create: `app/routes/site.$domain_.visitors/VisitorTrafficChart.tsx`

**Step 1: Write the component**

```tsx
import { Area, AreaChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { ChartContainer } from "~/components/ui/Chart";
import { formatDateMed, formatDateShort } from "~/lib/formatDate";

const NON_AI_COLOR = "#d1d5db";
const PLATFORM_COLORS = [
  "#e63946",
  "#457b9d",
  "#2a9d8f",
  "#e9c46a",
  "#f4a261",
  "#264653",
  "#a8dadc",
  "#6a4c93",
  "#c77dff",
] as const;

export default function VisitorTrafficChart({
  platforms,
  chartData,
}: {
  platforms: string[];
  chartData: { date: string; total: number; nonAi: number; [key: string]: number | string }[];
}) {
  const config = {
    nonAi: { label: "Non-AI", color: NON_AI_COLOR },
    ...Object.fromEntries(
      platforms.map((p, i) => [
        p,
        { label: p, color: PLATFORM_COLORS[i % PLATFORM_COLORS.length] },
      ]),
    ),
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Traffic by Source</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-64 w-full">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={(v) => formatDateShort(new Date(v))} />
            <YAxis />
            <Tooltip labelFormatter={(value) => formatDateMed(new Date(value))} />
            <Legend />
            <Area
              dataKey="nonAi"
              fill={NON_AI_COLOR}
              name="Non-AI"
              stackId="a"
              stroke={NON_AI_COLOR}
              type="monotone"
            />
            {platforms.map((p, i) => (
              <Area
                dataKey={p}
                fill={PLATFORM_COLORS[i % PLATFORM_COLORS.length]}
                key={p}
                name={p}
                stackId="a"
                stroke={PLATFORM_COLORS[i % PLATFORM_COLORS.length]}
                type="monotone"
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

---

### Task 6: Create AiPlatformBreakdown component

**Files:**

- Create: `app/routes/site.$domain_.visitors/AiPlatformBreakdown.tsx`

**Step 1: Write the component**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/Table";

export default function AiPlatformBreakdown({
  platformBreakdown,
}: {
  platformBreakdown: { platform: string; visitors: number; pct: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Platform Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Platform</TableHead>
              <TableHead className="text-right">Visitors</TableHead>
              <TableHead className="text-right">% of Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {platformBreakdown.map((row) => (
              <TableRow key={row.platform}>
                <TableCell className="font-medium">{row.platform}</TableCell>
                <TableCell className="text-right">{row.visitors.toLocaleString()}</TableCell>
                <TableCell className="text-right">{row.pct}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

---

### Task 7: Create route.tsx with loader

**Files:**

- Create: `app/routes/site.$domain_.visitors/route.tsx`

**Step 1: Write the route**

```tsx
import type { Temporal } from "@js-temporal/polyfill";
import { sum } from "radashi";
import DateRangeSelector, { parseDateRange } from "~/components/ui/DateRangeSelector";
import Main from "~/components/ui/Main";
import SitePageHeader from "~/components/ui/SiteHeading";
import { requireSiteAccess } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/route";
import AiPlatformBreakdown from "./AiPlatformBreakdown";
import NoVisitors from "./NoVisitors";
import VisitorKeyMetrics from "./VisitorKeyMetrics";
import VisitorTrafficChart from "./VisitorTrafficChart";

export const handle = { siteNav: true };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Human Visitors — ${loaderData?.site.domain} | Cite.me.in` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { site } = await requireSiteAccess({ domain: params.domain, request });
  const { from, until } = parseDateRange(new URL(request.url).searchParams);
  const data = await getVisitorData(site.id, from, until);
  return { site, ...data };
}

async function getVisitorData(siteId: string, from: Temporal.PlainDate, until: Temporal.PlainDate) {
  const visits = await prisma.humanVisit.findMany({
    where: {
      siteId,
      date: {
        gte: new Date(from.toZonedDateTime("UTC").epochMilliseconds),
        lte: new Date(until.toZonedDateTime("UTC").epochMilliseconds),
      },
    },
    select: { date: true, count: true, aiReferral: true },
    orderBy: { date: "asc" },
  });

  const dailyBySource: Record<string, Record<string, number>> = {};
  let totalVisitors = 0;
  let totalPageViews = 0;
  let aiReferredVisitors = 0;
  const platformTotals: Record<string, number> = {};

  for (const v of visits) {
    const day = v.date.toISOString().slice(0, 10);
    const source = v.aiReferral ?? "nonAi";
    if (!dailyBySource[day]) dailyBySource[day] = {};
    dailyBySource[day][source] = (dailyBySource[day][source] ?? 0) + 1;
    totalVisitors += 1;
    totalPageViews += v.count;
    if (v.aiReferral) {
      aiReferredVisitors += 1;
      platformTotals[v.aiReferral] = (platformTotals[v.aiReferral] ?? 0) + 1;
    }
  }

  const platforms = Object.entries(platformTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([p]) => p);

  const chartData = Object.keys(dailyBySource)
    .sort()
    .map((date) => ({
      date,
      total: sum(Object.values(dailyBySource[date]), (c) => c),
      nonAi: dailyBySource[date].nonAi ?? 0,
      ...Object.fromEntries(platforms.map((p) => [p, dailyBySource[date][p] ?? 0])),
    }));

  const platformBreakdown = platforms.map((p) => ({
    platform: p,
    visitors: platformTotals[p],
    pct: totalVisitors > 0 ? Math.round((platformTotals[p] / totalVisitors) * 100) : 0,
  }));

  const aiPct = totalVisitors > 0 ? Math.round((aiReferredVisitors / totalVisitors) * 100) : 0;

  return {
    chartData,
    platforms,
    platformBreakdown,
    totalVisitors,
    totalPageViews,
    aiReferredVisitors,
    aiPct,
  };
}

export default function SiteVisitorsPage({ loaderData }: Route.ComponentProps) {
  const {
    site,
    chartData,
    platforms,
    platformBreakdown,
    totalVisitors,
    totalPageViews,
    aiReferredVisitors,
    aiPct,
  } = loaderData;

  const isEmpty = totalVisitors === 0;

  return (
    <Main variant="wide">
      <SitePageHeader site={site} title="Human Visitors">
        <DateRangeSelector />
      </SitePageHeader>

      {isEmpty ? (
        <NoVisitors domain={site.domain} />
      ) : (
        <section className="space-y-6">
          <VisitorKeyMetrics
            totalVisitors={totalVisitors}
            totalPageViews={totalPageViews}
            aiReferredVisitors={aiReferredVisitors}
            aiPct={aiPct}
          />
          <VisitorTrafficChart platforms={platforms} chartData={chartData} />
          <AiPlatformBreakdown platformBreakdown={platformBreakdown} />
        </section>
      )}
    </Main>
  );
}
```

---

### Task 8: Run tests and verify

**Step 1: Run typecheck**

```bash
pnpm check:type
```

Expected: no errors.

**Step 2: Run the visitor tests**

```bash
infisical --env dev run -- vitest run test/routes/site.visitors.test.ts
```

Expected: all tests pass, visual snapshots created on first run.

**Step 3: Commit**

```bash
git add app/routes/site.\$domain_.visitors/ test/routes/site.visitors.test.ts
git commit -m "feat: add Human Visitors page with AI platform breakdown"
```
