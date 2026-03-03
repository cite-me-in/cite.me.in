# Sites Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Display all user sites in a dashboard table showing citation metrics, bot traffic, and delete functionality.

**Architecture:** The loader calculates metrics in two ways: database aggregations for bot visits/unique bots (efficient), code-side calculation for citation metrics (flexible). A single table component displays all sites with View and Delete actions. Delete uses a modal dialog requiring domain name confirmation.

**Tech Stack:** React Router (loader/actions), Prisma aggregations, Temporal for date math, Card/Table UI components

---

## Task 1: Create helper function to calculate citation metrics

**Files:**
- Create: `app/lib/llm-visibility/calculateCitationMetrics.ts`
- Test: `test/lib/calculateCitationMetrics.test.ts`

**Context:**
The loader needs to calculate citation counts and scores for each site from the last 14 days. This helper fetches citation data and computes metrics in a reusable way.

**Step 1: Write the failing test**

Create `test/lib/calculateCitationMetrics.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import calculateCitationMetrics from "~/lib/llm-visibility/calculateCitationMetrics";

describe("calculateCitationMetrics", () => {
  it("returns 0 citations and 0 score when no citations", () => {
    const result = calculateCitationMetrics([], "example.com");
    expect(result).toEqual({ totalCitations: 0, avgScore: 0 });
  });

  it("calculates score: 50 for position 0, 10 for others", () => {
    const queries = [
      {
        citations: ["example.com"],
      },
      {
        citations: ["other.com", "example.com"],
      },
    ];
    const result = calculateCitationMetrics(queries as any, "example.com");
    expect(result.totalCitations).toBe(2);
    expect(result.avgScore).toBe((50 + 10) / 2); // 30
  });

  it("counts only citations mentioning the domain", () => {
    const queries = [
      { citations: ["example.com"] },
      { citations: ["other.com"] },
      { citations: ["example.com", "another.com"] },
    ];
    const result = calculateCitationMetrics(queries as any, "example.com");
    expect(result.totalCitations).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run test/lib/calculateCitationMetrics.test.ts
```

Expected output: Tests fail with "function not found" or similar.

**Step 3: Implement the helper function**

Create `app/lib/llm-visibility/calculateCitationMetrics.ts`:

```typescript
import type { CitationQuery } from "~/prisma";

interface MetricsResult {
  totalCitations: number;
  avgScore: number;
}

export default function calculateCitationMetrics(
  queries: CitationQuery[],
  domain: string,
): MetricsResult {
  let totalScore = 0;
  let totalCitations = 0;

  for (const query of queries) {
    const position = query.citations.indexOf(domain);
    if (position !== -1) {
      totalCitations++;
      totalScore += position === 0 ? 50 : 10;
    }
  }

  return {
    totalCitations,
    avgScore: totalCitations === 0 ? 0 : totalScore / totalCitations,
  };
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run test/lib/calculateCitationMetrics.test.ts
```

Expected: All tests pass.

**Step 5: Commit**

```bash
git add app/lib/llm-visibility/calculateCitationMetrics.ts test/lib/calculateCitationMetrics.test.ts
git commit -m "feat: add citation metrics calculation helper"
```

---

## Task 2: Add bot metrics aggregation helper

**Files:**
- Create: `app/lib/llm-visibility/getBotMetrics.server.ts`

**Context:**
This server-side helper queries the database efficiently using Prisma aggregations to get bot visit counts and unique bot types for a site within the last 14 days.

**Step 1: Write the helper function**

Create `app/lib/llm-visibility/getBotMetrics.server.ts`:

```typescript
import { Temporal } from "@js-temporal/polyfill";
import prisma from "~/lib/prisma.server";

export interface BotMetrics {
  totalBotVisits: number;
  uniqueBots: number;
}

export async function getBotMetrics(
  siteId: string,
  days: number = 14,
): Promise<BotMetrics> {
  const now = Temporal.Now.plainDateISO();
  const from = now.subtract({ days });

  // Get total bot visits
  const visitResult = await prisma.botVisit.aggregate({
    _sum: { count: true },
    where: {
      siteId,
      date: {
        gte: from.toString(),
      },
    },
  });

  // Get unique bot types
  const uniqueBotsResult = await prisma.botVisit.groupBy({
    by: ["botType"],
    where: {
      siteId,
      date: {
        gte: from.toString(),
      },
    },
  });

  return {
    totalBotVisits: visitResult._sum.count || 0,
    uniqueBots: uniqueBotsResult.length,
  };
}
```

**Step 2: Test manually in loader**

We'll verify this works when we integrate it into the loader in Task 3. No separate unit test needed since it's a simple aggregation wrapper.

**Step 3: Commit**

```bash
git add app/lib/llm-visibility/getBotMetrics.server.ts
git commit -m "feat: add bot metrics database aggregation helper"
```

---

## Task 3: Update sites loader with metrics calculation

**Files:**
- Modify: `app/routes/sites/route.tsx` (loader only, lines 21-28)

**Context:**
The loader needs to fetch all sites and calculate metrics for each. It will use the helpers from Tasks 1 and 2.

**Step 1: Update the loader**

Modify the loader in `app/routes/sites/route.tsx`:

```typescript
import calculateCitationMetrics from "~/lib/llm-visibility/calculateCitationMetrics";
import { getBotMetrics } from "~/lib/llm-visibility/getBotMetrics.server";

export interface SiteWithMetrics {
  site: Site;
  totalCitations: number;
  avgScore: number;
  totalBotVisits: number;
  uniqueBots: number;
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const sites = await prisma.site.findMany({
    where: { accountId: user.accountId },
    orderBy: { createdAt: "desc" },
  });

  // Calculate metrics for each site
  const sitesWithMetrics: SiteWithMetrics[] = await Promise.all(
    sites.map(async (site) => {
      // Get citation metrics
      const now = Temporal.Now.plainDateISO();
      const from = now.subtract({ days: 14 });

      const citationRuns = await prisma.citationQueryRun.findMany({
        include: { queries: true },
        where: {
          siteId: site.id,
          createdAt: {
            gte: from.toString(),
          },
        },
      });

      const allQueries = citationRuns.flatMap((run) => run.queries);
      const citationMetrics = calculateCitationMetrics(
        allQueries,
        site.domain,
      );

      // Get bot metrics
      const botMetrics = await getBotMetrics(site.id, 14);

      return {
        site,
        totalCitations: citationMetrics.totalCitations,
        avgScore: citationMetrics.avgScore,
        totalBotVisits: botMetrics.totalBotVisits,
        uniqueBots: botMetrics.uniqueBots,
      };
    }),
  );

  return { sites: sitesWithMetrics };
}
```

**Step 2: Update component to use new data structure**

Update the default export component to use `loaderData.sites` which is now an array of `SiteWithMetrics`:

```typescript
export default function SitesPage({ loaderData }: Route.ComponentProps) {
  const { sites } = loaderData;

  if (sites.length === 0) {
    // ... empty state unchanged
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-6 py-12">
      <div className="flex flex-row items-center justify-between gap-4">
        <h1 className="font-heading text-3xl">Your Sites</h1>
        <Button render={<Link to="/sites/new" />}>Add Site</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black">
                <th className="px-4 py-2 text-left font-bold">Domain</th>
                <th className="px-4 py-2 text-right font-bold">Citations</th>
                <th className="px-4 py-2 text-right font-bold">Avg Score</th>
                <th className="px-4 py-2 text-right font-bold">Bot Visits</th>
                <th className="px-4 py-2 text-right font-bold">Unique Bots</th>
                <th className="px-4 py-2 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((item, idx) => (
                <tr
                  key={item.site.id}
                  className={idx < sites.length - 1 ? "border-b border-gray-200" : ""}
                >
                  <td className="px-4 py-2">
                    <span className="font-medium">{item.site.domain}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {item.totalCitations}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {item.avgScore.toFixed(1)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {item.totalBotVisits}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {item.uniqueBots}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex gap-2 justify-end">
                      <ActiveLink
                        size="sm"
                        to={`/site/${item.site.id}/citations`}
                        variant="button"
                      >
                        View
                      </ActiveLink>
                      <button
                        type="button"
                        className="text-sm text-red-600 hover:underline"
                        onClick={() => {
                          // Will implement delete in Task 5
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </main>
  );
}
```

**Step 3: Add import for Temporal**

At the top of the file, add:

```typescript
import { Temporal } from "@js-temporal/polyfill";
```

**Step 4: Run typecheck and tests**

```bash
pnpm typecheck
```

Expected: No type errors.

**Step 5: Commit**

```bash
git add app/routes/sites/route.tsx
git commit -m "feat: add metrics calculation to sites loader"
```

---

## Task 4: Create delete site modal dialog component

**Files:**
- Create: `app/routes/sites/DeleteSiteDialog.tsx`

**Context:**
A reusable modal dialog component that prompts the user to type the domain name to confirm deletion. Controlled by parent component state.

**Step 1: Create the component**

Create `app/routes/sites/DeleteSiteDialog.tsx`:

```typescript
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/Button";

interface DeleteSiteDialogProps {
  isOpen: boolean;
  domain: string;
  siteId: string;
  onClose: () => void;
  onConfirm: (siteId: string) => void;
  isSubmitting?: boolean;
}

export default function DeleteSiteDialog({
  isOpen,
  domain,
  siteId,
  onClose,
  onConfirm,
  isSubmitting = false,
}: DeleteSiteDialogProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isValid = input === domain;

  useEffect(() => {
    if (isOpen) {
      setInput("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg border-2 border-black shadow-shadow p-6 max-w-md w-full mx-4">
        <h2 className="font-heading text-xl font-bold mb-4">Delete Site</h2>

        <p className="mb-4 text-base text-foreground/70">
          Are you sure you want to delete <strong>{domain}</strong>? This action cannot be undone.
        </p>

        <p className="mb-4 text-sm text-foreground/60">
          Type the domain name below to confirm deletion:
        </p>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={domain}
          disabled={isSubmitting}
          className="w-full px-3 py-2 border-2 border-black rounded-base mb-6 font-mono text-sm disabled:opacity-50"
        />

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-base font-medium border-2 border-black rounded-base hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <Button
            onClick={() => {
              if (isValid) onConfirm(siteId);
            }}
            disabled={!isValid || isSubmitting}
            bg="red"
          >
            Delete Site
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/routes/sites/DeleteSiteDialog.tsx
git commit -m "feat: create delete site confirmation dialog component"
```

---

## Task 5: Add delete site action and wire up UI

**Files:**
- Modify: `app/routes/sites/route.tsx` (add action, update component)

**Context:**
Add a server action to delete sites with domain validation, and wire the dialog to the component state.

**Step 1: Add the delete action**

Add this to `app/routes/sites/route.tsx`:

```typescript
import { useFetcher } from "react-router";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return { ok: false, error: "Method not allowed" } as const;
  }

  const user = await requireUser(request);
  const formData = await request.formData();
  const siteId = formData.get("siteId") as string;
  const confirmDomain = formData.get("confirmDomain") as string;

  // Verify site exists and belongs to user
  const site = await prisma.site.findFirst({
    where: { id: siteId, accountId: user.accountId },
  });

  if (!site) {
    return { ok: false, error: "Site not found" } as const;
  }

  // Verify domain matches
  if (confirmDomain !== site.domain) {
    return { ok: false, error: "Domain doesn't match" } as const;
  }

  // Delete the site (cascades delete all related data)
  await prisma.site.delete({ where: { id: siteId } });

  return { ok: true } as const;
}
```

**Step 2: Update component to use dialog and action**

Update the default component function:

```typescript
import { useFetcher } from "react-router";
import DeleteSiteDialog from "./DeleteSiteDialog";

export default function SitesPage({ loaderData }: Route.ComponentProps) {
  const { sites } = loaderData;
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    siteId: string;
    domain: string;
  }>({ open: false, siteId: "", domain: "" });

  const deleteFetcher = useFetcher<typeof action>();
  const isSubmitting = deleteFetcher.state === "submitting";

  // Close dialog on successful delete
  useEffect(() => {
    if (deleteFetcher.data?.ok) {
      setDeleteDialog({ open: false, siteId: "", domain: "" });
    }
  }, [deleteFetcher.data]);

  if (sites.length === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl space-y-6 px-6 py-12">
        <h1 className="font-heading text-3xl">Your Sites</h1>
        <div className="rounded-base border-2 border-black bg-secondary-background p-8 text-center shadow-shadow">
          <p className="mb-2 font-bold text-xl">No sites yet</p>
          <p className="mb-6 text-base text-foreground/60">
            Add your first site to start tracking when AI platforms cite you.
          </p>
          <ActiveLink variant="button" to="/sites/new" bg="yellow">
            Add your first site
          </ActiveLink>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-6 py-12">
      <div className="flex flex-row items-center justify-between gap-4">
        <h1 className="font-heading text-3xl">Your Sites</h1>
        <Button render={<Link to="/sites/new" />}>Add Site</Button>
      </div>

      {deleteFetcher.data?.ok === false && (
        <div className="bg-red-100 border-2 border-red-500 text-red-700 px-4 py-3 rounded-base">
          {deleteFetcher.data.error}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black">
                <th className="px-4 py-2 text-left font-bold">Domain</th>
                <th className="px-4 py-2 text-right font-bold">Citations</th>
                <th className="px-4 py-2 text-right font-bold">Avg Score</th>
                <th className="px-4 py-2 text-right font-bold">Bot Visits</th>
                <th className="px-4 py-2 text-right font-bold">Unique Bots</th>
                <th className="px-4 py-2 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((item, idx) => (
                <tr
                  key={item.site.id}
                  className={idx < sites.length - 1 ? "border-b border-gray-200" : ""}
                >
                  <td className="px-4 py-2">
                    <span className="font-medium">{item.site.domain}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {item.totalCitations}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {item.avgScore.toFixed(1)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {item.totalBotVisits}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {item.uniqueBots}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex gap-2 justify-end">
                      <ActiveLink
                        size="sm"
                        to={`/site/${item.site.id}/citations`}
                        variant="button"
                      >
                        View
                      </ActiveLink>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteDialog({
                            open: true,
                            siteId: item.site.id,
                            domain: item.site.domain,
                          })
                        }
                        className="text-sm text-red-600 hover:underline"
                        disabled={isSubmitting}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <DeleteSiteDialog
        isOpen={deleteDialog.open}
        domain={deleteDialog.domain}
        siteId={deleteDialog.siteId}
        onClose={() => setDeleteDialog({ open: false, siteId: "", domain: "" })}
        onConfirm={(siteId) => {
          deleteFetcher.submit(
            {
              siteId,
              confirmDomain: deleteDialog.domain,
            },
            { method: "POST" },
          );
        }}
        isSubmitting={isSubmitting}
      />
    </main>
  );
}
```

**Step 3: Add useState import**

At the top of the component file, add:

```typescript
import { useState, useEffect } from "react";
import DeleteSiteDialog from "./DeleteSiteDialog";
```

**Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: No type errors.

**Step 5: Commit**

```bash
git add app/routes/sites/route.tsx
git commit -m "feat: add delete site action and modal dialog integration"
```

---

## Task 6: Update tests for new dashboard functionality

**Files:**
- Modify: `test/routes/sites.test.ts`

**Context:**
Update existing tests to work with the new table layout and add tests for metrics display and delete functionality.

**Step 1: Update existing tests**

Modify `test/routes/sites.test.ts`:

```typescript
import { expect } from "@playwright/test";
import { beforeAll, describe, it } from "vitest";
import { hashPassword } from "~/lib/auth.server";
import { removeElements } from "~/lib/html/parseHTML";
import prisma from "~/lib/prisma.server";
import { goto, port } from "../helpers/launchBrowser";
import { signIn } from "../helpers/signIn";

const EMAIL = "sites-test@example.com";
const PASSWORD = "correct-password-123";

describe("unauthenticated access", () => {
  it("redirects to /sign-in", async () => {
    const response = await fetch(`http://localhost:${port}/sites`, {
      redirect: "manual",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/sign-in");
  });
});

describe("sites route", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        id: "user-sites-test",
        email: EMAIL,
        passwordHash: await hashPassword(PASSWORD),
        account: { create: { id: "account-sites-test" } },
      },
    });
    await signIn(user.id);
  });

  describe("empty state", () => {
    let page: Awaited<ReturnType<typeof goto>>;

    beforeAll(async () => {
      page = await goto("/sites");
    });

    it("shows add site link", async () => {
      await expect(
        page.getByRole("link", { name: /add.*site/i }),
      ).toBeVisible();
    });

    it("HTML matches baseline", { timeout: 30_000 }, async () => {
      await expect(page.locator("main")).toMatchInnerHTML({
        name: "sites-empty",
      });
    });

    it("screenshot matches baseline", { timeout: 30_000 }, async () => {
      await expect(page.locator("main")).toMatchScreenshot({
        name: "sites-empty",
      });
    });
  });

  describe("with one site", () => {
    let page: Awaited<ReturnType<typeof goto>>;

    beforeAll(async () => {
      await prisma.account.deleteMany();
      const user = await prisma.user.create({
        data: {
          id: "user-sites-test-2",
          email: EMAIL,
          passwordHash: await hashPassword(PASSWORD),
          account: { create: { id: "account-sites-test-2" } },
        },
      });
      await prisma.site.create({
        data: {
          id: "site-dashboard-test",
          domain: "example.com",
          accountId: user.accountId,
        },
      });
      page = await goto("/sites");
    });

    it("shows the site domain", async () => {
      await expect(
        page.getByText("example.com", { exact: true }),
      ).toBeVisible();
    });

    it("shows column headers", async () => {
      await expect(page.getByText("Domain", { exact: true })).toBeVisible();
      await expect(page.getByText("Citations", { exact: true })).toBeVisible();
      await expect(page.getByText("Avg Score", { exact: true })).toBeVisible();
      await expect(page.getByText("Bot Visits", { exact: true })).toBeVisible();
      await expect(page.getByText("Unique Bots", { exact: true })).toBeVisible();
    });

    it("shows View button", async () => {
      const link = page.getByRole("link", { name: "View" });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", /\/site\//);
    });

    it("shows Delete button", async () => {
      await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
    });

    it("shows Add Site button in list state", async () => {
      const addBtn = page.getByRole("link", { name: "Add Site" });
      await expect(addBtn).toBeVisible();
    });

    it("delete button opens confirmation dialog", async () => {
      const deleteBtn = page.getByRole("button", { name: "Delete" }).first();
      await deleteBtn.click();
      await expect(
        page.getByText("Are you sure you want to delete"),
      ).toBeVisible();
    });

    it("delete dialog requires domain name match", async () => {
      const deleteBtn = page.getByRole("button", { name: "Delete" }).first();
      await deleteBtn.click();
      const deleteConfirmBtn = page.getByRole("button", {
        name: "Delete Site",
      });
      // Initially disabled
      await expect(deleteConfirmBtn).toBeDisabled();
      // Type wrong domain
      await page.getByPlaceholder("example.com").fill("wrong.com");
      await expect(deleteConfirmBtn).toBeDisabled();
      // Type correct domain
      await page.getByPlaceholder("example.com").fill("example.com");
      await expect(deleteConfirmBtn).toBeEnabled();
    });

    it("HTML matches baseline", { timeout: 30_000 }, async () => {
      await expect(page.locator("main")).toMatchInnerHTML({
        name: "sites-list",
        strip: (html) =>
          removeElements(html, (node) => {
            if (node.tag !== "a") return false;
            const href = node.attributes.href ?? "";
            return href.startsWith("/site/") && href !== "/sites/new";
          }),
      });
    });

    it("screenshot matches baseline", { timeout: 30_000 }, async () => {
      await expect(page.locator("main")).toMatchScreenshot({
        name: "sites-list",
      });
    });
  });
});
```

**Step 2: Run tests**

```bash
pnpm vitest run test/routes/sites.test.ts
```

Expected: Tests pass (or fail gracefully if baselines need updating).

**Step 3: Update baselines if needed**

If HTML/screenshot tests fail, update baselines:

```bash
pnpm vitest run test/routes/sites.test.ts -- --reporter=verbose
```

Follow the prompts to update baselines if visual changes are expected.

**Step 4: Commit**

```bash
git add test/routes/sites.test.ts
git commit -m "test: update sites route tests for dashboard metrics"
```

---

## Summary

This plan implements a complete sites dashboard with:

1. **Citation metrics calculation** (helper function + tests)
2. **Bot metrics aggregation** (database-efficient helper)
3. **Loader integration** (calculates metrics for all sites)
4. **Dashboard table** (displays all metrics in organized columns)
5. **Delete dialog** (reusable component with domain confirmation)
6. **Delete action** (server-side validation and site deletion)
7. **Tests** (verify functionality and visual regression)

All tasks follow TDD principles with frequent, small commits. The implementation is efficient (database aggregations for bot metrics) and maintainable (reusable helper functions).
