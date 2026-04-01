# Setup Email First-Run Metrics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the site setup complete email to show first-run metrics (citations per platform, top queries, sentiment, top competitors) drawn from the initial setup pipeline run.

**Architecture:** `sendSiteSetupEmail` is updated to accept a `SetupMetrics` object (caller's responsibility to load it). A new `loadSetupMetrics(siteId)` helper queries `citationQueryRun` records. `setup.run.ts` calls `loadSetupMetrics` and passes the result to `sendSiteSetupEmail`. The visual test passes hardcoded fixture data directly, matching the weekly digest test pattern.

**Tech Stack:** React Email (`@react-email/components`), Prisma (`citationQueryRun` model), `radashi` (sum), `topCompetitors` from citations route, `getDomainMeta` from `domainMeta.server.ts`, Playwright visual regression.

---

### Task 1: Write the failing test with new signature and fixture metrics

**Files:**
- Modify: `test/routes/email.site-setup.test.ts`

**Step 1: Update the test to pass fixture metrics**

Replace the entire file:

```ts
import { expect } from "@playwright/test";
import { beforeAll, describe, it } from "vitest";
import sendSiteSetupEmail from "~/emails/SiteSetupComplete";
import { getLastEmailSent } from "~/emails/sendEmails";
import { newContext } from "../helpers/launchBrowser";

describe("SiteSetupComplete email", () => {
  let email: NonNullable<Awaited<ReturnType<typeof getLastEmailSent>>>;

  beforeAll(async () => {
    await sendSiteSetupEmail({
      domain: "example.com",
      user: { email: "test@example.com", unsubscribed: false },
      metrics: {
        totalCitations: 42,
        byPlatform: {
          chatgpt: {
            citations: 15,
            sentimentLabel: "positive",
            sentimentSummary:
              "Example.com is cited positively, frequently recommended as the top result for relevant queries.",
          },
          claude: {
            citations: 0,
            sentimentLabel: "neutral",
            sentimentSummary: "",
          },
          gemini: {
            citations: 18,
            sentimentLabel: "mixed",
            sentimentSummary:
              "Example.com receives mixed mentions — positive in some contexts, absent in others.",
          },
          perplexity: {
            citations: 9,
            sentimentLabel: "negative",
            sentimentSummary:
              "Example.com rarely appears and when mentioned is ranked below competitors.",
          },
        },
        topQueries: [
          { query: "Best platforms for finding short-term retail space", count: 12 },
          { query: "Pop-up shop locations in shopping malls", count: 8 },
          { query: "How to lease a kiosk in a mall", count: 6 },
          { query: "Temporary retail space for sale", count: 4 },
          { query: "Short-term shop rental near me", count: 2 },
        ],
        competitors: [
          { domain: "popupinsider.com", brandName: "Popup Insider", url: "https://popupinsider.com", count: 22, pct: 31 },
          { domain: "storeshq.com", brandName: "Stores HQ", url: "https://storeshq.com", count: 14, pct: 20 },
          { domain: "siteselectiongroup.com", brandName: "Site Selection Group", url: "https://siteselectiongroup.com", count: 9, pct: 13 },
        ],
      },
    });
    email = await getLastEmailSent();
  });

  it("should send with correct subject", () => {
    expect(email.subject).toBe("example.com is set up on cite.me.in");
  });

  it("should send to correct recipient", () => {
    expect(email.to).toBe("test@example.com");
  });

  it("should match visually", async () => {
    const context = await newContext();
    const page = await context.newPage();
    await page.setContent(email.html, { waitUntil: "load" });
    await page.setViewportSize({ width: 1024, height: 2048 });
    await expect(page).toMatchVisual({ name: "email/site-setup" });
  });
});
```

**Step 2: Run the test to confirm it fails on the type error**

```bash
cd /Users/assaf/Projects/cite.me.in
pnpm vitest run test/routes/email.site-setup.test.ts
```

Expected: TypeScript error — `metrics` is not a valid prop on `sendSiteSetupEmail`.

---

### Task 2: Add `SetupMetrics` type and update `sendSiteSetupEmail` signature

**Files:**
- Modify: `app/emails/SiteSetupComplete.tsx`

**Step 1: Add the `SetupMetrics` type and update the function signature**

After line 4 (`import { sendEmail } from "./sendEmails";`), add the type. Then update the function signature to accept `metrics`:

```ts
import { Button, Column, Link, Row, Section, Text } from "@react-email/components";
import { alphabetical } from "radashi";
import { twMerge } from "tailwind-merge";
import type { SentimentLabel } from "~/prisma";
import envVars from "~/lib/envVars.server";
import EmailLayout from "./EmailLayout";
import { sendEmail } from "./sendEmails";

export type SetupMetrics = {
  totalCitations: number;
  byPlatform: Record<
    string,
    {
      citations: number;
      sentimentLabel: SentimentLabel | null;
      sentimentSummary: string | null;
    }
  >;
  topQueries: { query: string; count: number }[];
  competitors: {
    domain: string;
    brandName: string;
    url: string;
    count: number;
    pct: number;
  }[];
};

export default async function sendSiteSetupEmail({
  domain,
  user,
  metrics,
}: {
  domain: string;
  user: { email: string; unsubscribed: boolean };
  metrics: SetupMetrics;
}) {
  const citationsURL = new URL(
    `/site/${domain}/citations`,
    envVars.VITE_APP_URL,
  ).toString();
  await sendEmail({
    canUnsubscribe: false,
    render: ({ subject }) => (
      <SiteSetupComplete
        subject={subject}
        domain={domain}
        citationsURL={citationsURL}
        metrics={metrics}
      />
    ),
    subject: `${domain} is set up on cite.me.in`,
    user,
  });
}
```

**Step 2: Run typecheck**

```bash
pnpm check:type 2>&1 | head -30
```

Expected: errors about `SiteSetupComplete` component not accepting `metrics` yet — that's fine, we'll fix in Task 3.

---

### Task 3: Add metric sections to the email template

**Files:**
- Modify: `app/emails/SiteSetupComplete.tsx`

Replace the `SiteSetupComplete` component and add all helper components. The full new bottom half of the file (replacing everything from `function SiteSetupComplete` onwards):

```tsx
function SiteSetupComplete({
  citationsURL,
  domain,
  metrics,
  subject,
}: {
  citationsURL: string;
  domain: string;
  metrics: SetupMetrics;
  subject: string;
}) {
  return (
    <EmailLayout subject={subject}>
      <Text className="my-4 text-base text-text leading-relaxed">
        Your site <strong>{domain}</strong> has been set up on cite.me.in.
      </Text>

      <Text className="my-4 text-base text-text leading-relaxed">
        We've crawled your site, generated search queries, and checked how
        ChatGPT, Claude, Perplexity, and Gemini cite you. Here's what we found.
      </Text>

      <PlatformCitations byPlatform={metrics.byPlatform} />
      <SetupTopQueries topQueries={metrics.topQueries} />
      <SetupSentiment byPlatform={metrics.byPlatform} />
      <SetupTopCompetitors competitors={metrics.competitors} />

      <Section className="my-8 text-center">
        <Button
          href={citationsURL}
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

function PlatformCitations({
  byPlatform,
}: {
  byPlatform: SetupMetrics["byPlatform"];
}) {
  const platforms = alphabetical(
    Object.entries(byPlatform),
    ([name]) => name,
  ).slice(0, 4);

  return (
    <Card title="Citations found">
      <Row>
        {platforms.map(([platform, { citations }], i) => (
          <Column
            key={platform}
            className={twMerge(i < platforms.length - 1 ? "pr-2" : "", "w-1/4")}
          >
            <Section className="w-full overflow-hidden rounded-lg border border-border bg-white">
              <Row>
                <Column className="px-4 text-center">
                  <Text className="font-bold text-2xl text-dark tabular-nums">
                    {citations.toLocaleString()}
                  </Text>
                  <Text className="mb-1.5 whitespace-nowrap text-light text-xs uppercase tracking-wide">
                    {platform}
                  </Text>
                </Column>
              </Row>
            </Section>
          </Column>
        ))}
      </Row>
    </Card>
  );
}

function SetupTopQueries({
  topQueries,
}: {
  topQueries: SetupMetrics["topQueries"];
}) {
  if (topQueries.length === 0) return null;
  return (
    <Card
      title="↑ Top queries"
      subtitle="Queries most cited in your first run"
      withBorder
    >
      <table>
        <thead>
          <tr className="text-center text-light text-xs uppercase tracking-wide">
            <th className="p-4">Query</th>
            <th className="p-4">Citations</th>
          </tr>
        </thead>
        <tbody>
          {topQueries.map(({ query, count }) => (
            <tr key={query} className="border-border border-t">
              <td className="p-4 text-left">{query}</td>
              <td className="p-4 text-center">{count.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function SetupSentiment({
  byPlatform,
}: {
  byPlatform: SetupMetrics["byPlatform"];
}) {
  const platforms = alphabetical(
    Object.entries(byPlatform).filter(([, { sentimentSummary }]) => sentimentSummary),
    ([name]) => name,
  );
  if (platforms.length === 0) return null;

  const sentimentColors: Record<string, string> = {
    positive: "text-green-500",
    negative: "text-red-500",
    neutral: "text-gray-500",
    mixed: "text-yellow-500",
  };

  return (
    <Card title="AI sentiment" withBorder>
      {platforms.map(([platform, { sentimentLabel, sentimentSummary }]) => (
        <Section key={platform} className="border-border border-b py-3">
          <Row>
            <Column className="w-1/4">
              <Text className="text-light text-xs uppercase tracking-wide">
                {platform}
              </Text>
              <Text
                className={twMerge(
                  "text-sm font-semibold uppercase",
                  sentimentColors[sentimentLabel ?? "neutral"],
                )}
              >
                {sentimentLabel ?? "neutral"}
              </Text>
            </Column>
            <Column>
              <Text className="text-light text-sm leading-6">
                {sentimentSummary}
              </Text>
            </Column>
          </Row>
        </Section>
      ))}
    </Card>
  );
}

function SetupTopCompetitors({
  competitors,
}: {
  competitors: SetupMetrics["competitors"];
}) {
  if (competitors.length === 0) return null;
  return (
    <Card
      title="Top competitors"
      subtitle="Sites appearing in your queries"
      withBorder
    >
      <table>
        <tbody>
          {competitors.map(({ domain, brandName, url, count, pct }) => (
            <tr key={domain} className="border-border border-t">
              <td className="w-full py-4">
                <Link href={url} className="text-dark no-underline">
                  {brandName}
                </Link>
              </td>
              <td className="w-30 whitespace-nowrap px-2 py-4 font-bold tabular-nums">
                {count.toLocaleString()}{" "}
                {count === 1 ? "citation" : "citations"}
              </td>
              <td className="w-15 px-2 py-4 text-right tabular-nums">
                {pct}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Card({
  children,
  className,
  title,
  subtitle,
  withBorder,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  withBorder?: boolean;
}) {
  return (
    <Section
      className={twMerge(
        "my-4 w-full overflow-hidden bg-white",
        withBorder && "rounded-lg border border-border",
        className,
      )}
    >
      {(title || subtitle) && (
        <Row>
          <Column className="px-5 pt-4">
            {title && (
              <Text className="font-bold text-2xl text-dark">{title}</Text>
            )}
            {subtitle && (
              <Text className="text-light text-sm">{subtitle}</Text>
            )}
          </Column>
        </Row>
      )}
      <Row>
        <Column className="px-5 pt-4">{children}</Column>
      </Row>
    </Section>
  );
}
```

**Step 2: Delete old baselines so they regenerate**

```bash
rm /Users/assaf/Projects/cite.me.in/__screenshots__/email/site-setup.png
rm /Users/assaf/Projects/cite.me.in/__screenshots__/email/site-setup.html
```

**Step 3: Run the test to confirm it passes (baselines created on first run)**

```bash
pnpm vitest run test/routes/email.site-setup.test.ts
```

Expected: all tests pass; new baselines written to `__screenshots__/email/site-setup.{png,html}`.

**Step 4: Commit**

```bash
git add app/emails/SiteSetupComplete.tsx test/routes/email.site-setup.test.ts __screenshots__/email/site-setup.png __screenshots__/email/site-setup.html
git commit -m "feat: add first-run metrics to site setup complete email"
```

---

### Task 4: Create `loadSetupMetrics`

**Files:**
- Create: `app/lib/setupMetrics.server.ts`

**Step 1: Write the function**

```ts
import { sum } from "radashi";
import type { SetupMetrics } from "~/emails/SiteSetupComplete";
import { getDomainMeta } from "~/lib/domainMeta.server";
import prisma from "~/lib/prisma.server";
import { topCompetitors } from "~/routes/site.$domain_.citations/TopCompetitors";

export default async function loadSetupMetrics(
  siteId: string,
): Promise<SetupMetrics> {
  const site = await prisma.site.findUniqueOrThrow({
    where: { id: siteId },
    select: { domain: true },
  });

  // Latest run per platform (setup runs one per platform on a single day)
  const runs = await prisma.citationQueryRun.findMany({
    where: { siteId },
    select: {
      platform: true,
      queries: { select: { query: true, citations: true } },
      sentimentLabel: true,
      sentimentSummary: true,
    },
    orderBy: { onDate: "desc" },
    distinct: ["platform"],
  });

  const byPlatform: SetupMetrics["byPlatform"] = {};
  for (const run of runs) {
    byPlatform[run.platform] = {
      citations: sum(run.queries, (q) => q.citations.length),
      sentimentLabel: run.sentimentLabel,
      sentimentSummary: run.sentimentSummary,
    };
  }

  const queryCounts = new Map<string, number>();
  for (const run of runs)
    for (const q of run.queries)
      queryCounts.set(q.query, (queryCounts.get(q.query) ?? 0) + q.citations.length);

  const topQueries = [...queryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([query, count]) => ({ query, count }));

  const allQueries = runs.flatMap((r) => r.queries);
  const { competitors: rawCompetitors } = topCompetitors(allQueries, site.domain);
  const competitors = await Promise.all(
    rawCompetitors.map(async (c) => ({
      ...c,
      ...(await getDomainMeta(c.domain)),
    })),
  );

  return {
    totalCitations: sum(Object.values(byPlatform), (p) => p.citations),
    byPlatform,
    topQueries,
    competitors,
  };
}
```

**Step 2: Run typecheck**

```bash
pnpm check:type 2>&1 | grep -i "setupMetrics\|SiteSetupComplete" | head -20
```

Expected: no errors related to the new file.

---

### Task 5: Wire up `loadSetupMetrics` in `setup.run.ts`

**Files:**
- Modify: `app/routes/site.$domain_.setup.run.ts`

**Step 1: Import and call `loadSetupMetrics` before sending the email**

At line 4 (after the `sendSiteSetupEmail` import), add:
```ts
import loadSetupMetrics from "~/lib/setupMetrics.server";
```

Replace lines 87–92 (Phase 6 block):
```ts
    // Phase 6: Email
    await log("Sending confirmation email...");
    const owner = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { email: true, unsubscribed: true },
    });
    const metrics = await loadSetupMetrics(site.id);
    await sendSiteSetupEmail({ domain: site.domain, user: owner, metrics });
```

**Step 2: Run typecheck**

```bash
pnpm check:type 2>&1 | head -30
```

Expected: no errors.

**Step 3: Commit**

```bash
git add app/lib/setupMetrics.server.ts app/routes/site.$domain_.setup.run.ts
git commit -m "feat: load setup metrics and pass to setup complete email"
```

---

### Task 6: Final verification

**Step 1: Run full typecheck and lint**

```bash
pnpm check:type && pnpm check:lint
```

Expected: no errors.

**Step 2: Run the email test once more to confirm baselines are stable**

```bash
pnpm vitest run test/routes/email.site-setup.test.ts
```

Expected: all 3 tests pass.
