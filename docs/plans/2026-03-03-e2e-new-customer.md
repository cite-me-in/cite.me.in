# End-to-End New Customer Test Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Implement a complete end-to-end test that verifies the full new customer onboarding flow from signup through viewing LLM citations.

**Architecture:** The test will use Playwright to navigate through the actual UI, with MSW mocking the LLM response to return 9 custom queries. Step-by-step assertions verify both UI state (redirects, page content) and database state (user, site, queries created). Optional slow mode allows watching the test execute step-by-step.

**Tech Stack:** Playwright (browser testing), Vitest (test runner), Prisma (DB assertions), MSW (HTTP mocking), TypeScript

---

## Task 1: Extend MSW to Mock LLM Response

**Files:**
- Modify: `test/mocks/msw.ts`

**Step 1: Understand current MSW setup**

Read the file to see how handlers are structured. The file has a `handlers` array that gets passed to `setupServer()`.

**Step 2: Add LLM API mock handler**

Add this handler to the `handlers` array in `test/mocks/msw.ts`:

```typescript
// Mock Anthropic API for LLM calls (query suggestions)
http.post("https://api.anthropic.com/v1/messages", ({ request }) => {
  logger("Mocking LLM response for query suggestions");
  return HttpResponse.json({
    id: "msg_test_" + crypto.randomUUID(),
    type: "message",
    role: "assistant",
    content: [
      {
        type: "text",
        text: JSON.stringify({
          queries: [
            { group: "1.discovery", query: "Query 1" },
            { group: "1.discovery", query: "Query 2" },
            { group: "1.discovery", query: "Query 3" },
            { group: "2.active_search", query: "Query 4" },
            { group: "2.active_search", query: "Query 5" },
            { group: "2.active_search", query: "Query 6" },
            { group: "3.comparison", query: "Query 7" },
            { group: "3.comparison", query: "Query 8" },
            { group: "3.comparison", query: "Query 9" },
          ],
        }),
      },
    ],
    model: "claude-3-5-sonnet-20241022",
    stop_reason: "end_turn",
    usage: {
      input_tokens: 1000,
      output_tokens: 500,
    },
  });
}),
```

Place this handler **before** the catch-all `http.all()` handler at the end.

**Step 3: Verify the addition**

Run: `pnpm typecheck`
Expected: No type errors

**Step 4: Commit**

```bash
git add test/mocks/msw.ts
git commit -m "test: add MSW mock for LLM query suggestions API"
```

---

## Task 2: Create E2E Test Directory and Base Test File

**Files:**
- Create: `test/e2e/new-customer.test.ts`

**Step 1: Create test/e2e directory**

The directory doesn't exist yet. The test file creation will create it.

**Step 2: Write the complete E2E test**

Create `test/e2e/new-customer.test.ts` with this content:

```typescript
import { expect } from "@playwright/test";
import { describe, it } from "vitest";
import { hashPassword } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import { goto } from "../helpers/launchBrowser";

describe("new customer onboarding E2E", () => {
  const SLOW_MO = parseInt(process.env.SLOW_MO || "0");
  const pause = () => SLOW_MO > 0 ? new Promise(r => setTimeout(r, SLOW_MO)) : null;

  it("completes full flow: signup → add site → accept queries → view citations", async () => {
    // Dynamic test data to avoid conflicts
    const timestamp = Date.now();
    const email = `${timestamp}@example.com`;
    const domain = `${timestamp}.example.com`;
    const password = "TestPassword123!";

    // ============================================
    // 1. HOME PAGE
    // ============================================
    const page = await goto("/");

    // Verify home page loaded
    await expect(page.getByRole("heading")).toBeVisible();
    await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
    await pause();

    // Click Get Started
    await page.getByRole("link", { name: /get started/i }).click();
    await pause();

    // ============================================
    // 2. SIGN-UP FORM
    // ============================================
    // Verify redirect to sign-up
    await expect(page).toHaveURL(/\/sign-up/);

    // Verify form fields visible
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirm password", { exact: true })).toBeVisible();
    await pause();

    // Fill and submit
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password", { exact: true }).fill(password);
    await page.getByRole("button", { name: /create account/i }).click();
    await pause();

    // ============================================
    // 3. VERIFY SIGN-UP & REDIRECT
    // ============================================
    // Should redirect to sites/new
    await expect(page).toHaveURL(/\/sites\/new/);

    // Verify user created in DB
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeDefined();
    expect(user!.email).toBe(email);
    await pause();

    // ============================================
    // 4. SITE ADD FORM
    // ============================================
    // Verify at sites/new page
    await expect(page.getByLabel("Website URL or domain")).toBeVisible();
    await expect(page.getByRole("button", { name: /add site/i })).toBeVisible();
    await pause();

    // Fill and submit
    await page.getByLabel("Website URL or domain").fill(domain);
    await page.getByRole("button", { name: /add site/i }).click();
    await pause();

    // ============================================
    // 5. VERIFY SITE CREATION & REDIRECT
    // ============================================
    // Should redirect to /site/{id}/queries
    await page.waitForURL(/\/site\/[^/]+\/queries/);
    const siteUrl = page.url();
    const siteIdMatch = siteUrl.match(/\/site\/([^/]+)/);
    expect(siteIdMatch).toBeTruthy();
    const siteId = siteIdMatch![1];

    // Verify site created in DB
    const site = await prisma.site.findUnique({ where: { id: siteId } });
    expect(site).toBeDefined();
    expect(site!.domain).toBe(domain);
    expect(site!.accountId).toBe(user!.accountId);
    await pause();

    // ============================================
    // 6. QUERY SUGGESTIONS PAGE
    // ============================================
    // Verify we're on queries page
    await expect(page).toHaveURL(/\/site\/${siteId}\/queries/);

    // Verify 9 query rows are visible
    const queryRows = page.locator("tr"); // Assuming queries are in a table
    await expect(queryRows).toHaveCount(10); // 9 queries + header row

    // Verify "Accept All" button exists
    await expect(page.getByRole("button", { name: /accept all/i })).toBeVisible();
    await pause();

    // ============================================
    // 7. ACCEPT ALL QUERIES
    // ============================================
    await page.getByRole("button", { name: /accept all/i }).click();
    await pause();

    // ============================================
    // 8. VERIFY QUERIES SAVED & REDIRECT
    // ============================================
    // Should redirect to citations page
    await page.waitForURL(/\/site\/${siteId}\/citations/);

    // Verify 9 queries saved in DB
    const queries = await prisma.siteQuery.findMany({ where: { siteId } });
    expect(queries).toHaveLength(9);
    expect(queries.map(q => q.query)).toContain("Query 1");
    expect(queries.map(q => q.query)).toContain("Query 9");
    await pause();

    // ============================================
    // 9. CITATIONS PAGE
    // ============================================
    // Verify we're on citations page
    await expect(page).toHaveURL(/\/site\/${siteId}\/citations/);

    // Verify content visible
    await expect(page.getByRole("heading", { name: /citations/i })).toBeVisible();
    await pause();
  });
});
```

**Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: No type errors

**Step 4: Run the test to see it pass or fail**

```bash
pnpm test test/e2e/new-customer.test.ts
```

Expected: Test should run (may fail if assertions don't match actual UI, that's OK for now - test infrastructure is set up)

**Step 5: Commit**

```bash
git add test/e2e/new-customer.test.ts
git commit -m "test: add E2E new customer onboarding flow test"
```

---

## Task 3: Verify Slow Mode Works

**Files:**
- Verify: `test/e2e/new-customer.test.ts`

**Step 1: Run test in slow mode**

```bash
SLOW_MO=1000 pnpm test test/e2e/new-customer.test.ts
```

Expected: Test runs normally, but with 1-second pauses between each interaction (visible in the test execution time)

**Step 2: Run test normally**

```bash
pnpm test test/e2e/new-customer.test.ts
```

Expected: Test runs quickly without pauses

**Step 3: No changes needed**

The slow mode feature is already built in via the `SLOW_MO` environment variable parsing. No commit needed.

---

## Summary

This plan implements a comprehensive end-to-end test with three focused tasks:

1. **MSW Mock Setup** - Adds LLM API mocking so test doesn't depend on external APIs
2. **E2E Test Implementation** - Complete test file with step-by-step assertions
3. **Slow Mode Verification** - Ensures slow mode works for debugging

The test verifies:
- ✅ User signup with email/password
- ✅ Site addition with domain
- ✅ Query suggestions generation (with mocked LLM)
- ✅ Query acceptance and saving
- ✅ Navigation to citations page
- ✅ All redirects work correctly
- ✅ Data is persisted in database

The test is self-contained, uses dynamic data to avoid conflicts, and keeps test data for manual inspection.
