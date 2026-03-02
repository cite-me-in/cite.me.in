# Query Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Auto-generate 9 categorized LLM visibility queries from site content on new site creation, show for user review, then save; also expose a "Suggest queries" button on the queries page.

**Architecture:** Option A — two-phase action in existing routes. A shared `generateSiteQueries()` function in `app/lib/llm-visibility/` calls Claude via `generateObject`. The `sites_.new` action grows a phase-2 branch (`_intent=save-queries`) and returns suggestions on phase 1. The queries page action gets an `intent="suggest"` branch. No new routes.

**Tech Stack:** `ai` SDK v6 (`generateObject`), `@ai-sdk/anthropic`, Zod v4, React Router v7 fetchers, Playwright + vitest for tests.

---

### Task 1: Write failing unit test for `generateSiteQueries`

**Files:**
- Create: `test/lib/generateSiteQueries.test.ts`

**Step 1: Write the test**

```ts
import { describe, expect, it, vi } from "vitest";
import generateSiteQueries from "~/lib/llm-visibility/generateSiteQueries";

vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@ai-sdk/anthropic", () => ({ anthropic: vi.fn().mockReturnValue("mock-model") }));

const MOCK_QUERIES = [
  { group: "1.discovery", query: "How do I find short-term retail space?" },
  { group: "1.discovery", query: "Best platforms for pop-up shops?" },
  { group: "1.discovery", query: "Where to rent a temporary store?" },
  { group: "2.active_search", query: "Lease a kiosk in a mall for 3 months" },
  { group: "2.active_search", query: "Short-term retail lease options" },
  { group: "2.active_search", query: "Pop-up shop rental near me" },
  { group: "3.comparison", query: "Rentail vs Storefront alternatives" },
  { group: "3.comparison", query: "Best temporary retail platforms compared" },
  { group: "3.comparison", query: "Which pop-up rental site is most reliable?" },
];

describe("generateSiteQueries", () => {
  it("returns 9 queries across 3 groups", async () => {
    const { generateObject } = await import("ai");
    vi.mocked(generateObject).mockResolvedValue({ object: { queries: MOCK_QUERIES } } as any);

    const result = await generateSiteQueries("Rentail helps brands find pop-up retail space.");
    expect(result).toHaveLength(9);
    const groups = [...new Set(result.map((q) => q.group))];
    expect(groups).toEqual(["1.discovery", "2.active_search", "3.comparison"]);
  });

  it("propagates errors from generateObject", async () => {
    const { generateObject } = await import("ai");
    vi.mocked(generateObject).mockRejectedValue(new Error("API error"));

    await expect(generateSiteQueries("some content")).rejects.toThrow("API error");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run test/lib/generateSiteQueries.test.ts
```

Expected: FAIL with "Cannot find module '~/lib/llm-visibility/generateSiteQueries'"

---

### Task 2: Implement `generateSiteQueries`

**Files:**
- Create: `app/lib/llm-visibility/generateSiteQueries.ts`

**Step 1: Write the implementation**

```ts
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";

export const CATEGORIES = [
  {
    group: "1.discovery",
    intent: "User doesn't know your brand; looking for solutions in your space",
  },
  {
    group: "2.active_search",
    intent: "User is actively looking for a specific product/service you offer",
  },
  {
    group: "3.comparison",
    intent:
      "User is comparing options; your site should appear as a credible choice",
  },
] as const;

const schema = z.object({
  queries: z
    .array(
      z.object({
        group: z.enum(["1.discovery", "2.active_search", "3.comparison"]),
        query: z.string().min(10).max(200),
      }),
    )
    .length(9),
});

export default async function generateSiteQueries(
  content: string,
): Promise<{ group: string; query: string }[]> {
  const { object } = await generateObject({
    model: anthropic("claude-haiku-4-5-20251001"),
    schema,
    messages: [
      {
        role: "system" as const,
        content: `You generate search queries a user might type into an AI platform (ChatGPT, Perplexity, Claude, Gemini) that should ideally return a citation to the given website.

Return exactly 9 queries: 3 per category.

Categories:
${CATEGORIES.map((c) => `- ${c.group}: ${c.intent}`).join("\n")}

Rules:
- Queries must sound like real user questions, not marketing copy.
- Each query should be specific enough to trigger a citation for this site.
- Vary the phrasing; do not repeat the same question structure.`,
      },
      {
        role: "user" as const,
        content: `Website content:\n\n${content}`,
      },
    ],
  });
  return object.queries;
}
```

**Step 2: Run tests to verify they pass**

```bash
pnpm vitest run test/lib/generateSiteQueries.test.ts
```

Expected: PASS (2 tests)

**Step 3: Commit**

```bash
git add app/lib/llm-visibility/generateSiteQueries.ts test/lib/generateSiteQueries.test.ts
git commit -m "feat: add generateSiteQueries function"
```

---

### Task 3: Update `sites_.new` action — two-phase logic

**Files:**
- Modify: `app/routes/sites_.new/route.tsx`

**Step 1: Read the current action** — already done above. The current action:
1. Validates domain
2. Checks for duplicate
3. Verifies DNS
4. Fetches content
5. Creates site
6. Returns `{ siteId }`

**Step 2: Update the action**

Replace the `action` function and `ActionResult` type with:

```ts
import { redirect } from "react-router";
import generateSiteQueries from "~/lib/llm-visibility/generateSiteQueries";
import { captureException } from "@sentry/react-router";

type Suggestion = { group: string; query: string };

type ActionResult =
  | { error: string }
  | { siteId: string }
  | { siteId: string; suggestions: Suggestion[] };

export async function action({
  request,
}: Route.ActionArgs): Promise<ActionResult | Response> {
  const user = await requireUser(request);
  const form = await request.formData();
  const intent = form.get("_intent")?.toString();

  // Phase 2: save approved queries then redirect
  if (intent === "save-queries") {
    const siteId = form.get("siteId")?.toString() ?? "";
    const site = await prisma.site.findFirst({
      where: { id: siteId, accountId: user.accountId },
    });
    if (!site) return { error: "Site not found" };

    const raw = form.get("queries")?.toString() ?? "[]";
    let queries: Suggestion[] = [];
    try {
      queries = JSON.parse(raw);
    } catch {
      // ignore malformed JSON — just redirect with no queries
    }
    const valid = queries.filter((q) => q.group && q.query.trim());
    if (valid.length > 0) {
      await prisma.siteQuery.createMany({
        data: valid.map((q) => ({
          siteId: site.id,
          group: q.group,
          query: q.query.trim(),
        })),
      });
    }
    return redirect(`/site/${site.id}`);
  }

  // Phase 1: validate + create site + generate suggestions
  const url = form.get("url")?.toString().trim() ?? "";
  const domain = extractDomain(url);
  if (!domain) return { error: "Enter a valid website URL or domain name" };

  const existing = await prisma.site.findFirst({
    where: { accountId: user.accountId, domain },
  });
  if (existing) return { error: "That domain is already added to your account" };

  const dnsOk = await verifyDomain(domain);
  if (!dnsOk)
    return { error: `No DNS records found for ${domain}. Is the domain live?` };

  const content = await fetchPageContent(domain);
  const site = await prisma.site.create({
    data: { domain, account: { connect: { id: user.accountId } }, content },
  });

  if (!content) return { siteId: site.id };

  try {
    const suggestions = await generateSiteQueries(content);
    return { siteId: site.id, suggestions };
  } catch (error) {
    captureException(error, { extra: { siteId: site.id } });
    return { siteId: site.id };
  }
}
```

**Step 3: Run typecheck**

```bash
pnpm react-router typegen && pnpm tsc --noEmit --strict
```

Expected: No errors (may warn about unused navigate — fix in Task 4).

---

### Task 4: Update `sites_.new` UI — review screen

**Files:**
- Modify: `app/routes/sites_.new/route.tsx`

**Step 1: Update the component**

Replace the entire `export default function AddSitePage()` with the two-state version below. The component reads `fetcher.data`:
- If `{ error }` → show error on the form
- If `{ siteId }` (no suggestions) → navigate to site page (existing behavior)
- If `{ siteId, suggestions }` → show review screen

```tsx
import { useState } from "react";
import { PlusIcon, TrashIcon } from "lucide-react";

// Add at module level, outside the component:
const CATEGORY_LABELS: Record<string, string> = {
  "1.discovery": "Discovery — user is looking for solutions",
  "2.active_search": "Active search — user wants what you offer",
  "3.comparison": "Comparison — user is evaluating options",
};

export default function AddSitePage() {
  const navigate = useNavigate();
  const fetcher = useFetcher<ActionResult>();
  const isProcessing = fetcher.state !== "idle";
  const result = fetcher.data;
  const error = result && "error" in result ? result.error : undefined;

  useEffect(() => {
    if (result && "siteId" in result && !("suggestions" in result)) {
      navigate(`/site/${result.siteId}`);
    }
  }, [result, navigate]);

  if (result && "suggestions" in result) {
    return (
      <ReviewScreen
        siteId={result.siteId}
        initialSuggestions={result.suggestions}
        isProcessing={isProcessing}
        fetcher={fetcher}
      />
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Add a Site</CardTitle>
        </CardHeader>
        <CardContent>
          {isProcessing ? (
            <div className="flex items-center gap-3 py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
              <p className="text-foreground/70">
                Verifying domain and generating queries…
              </p>
            </div>
          ) : (
            <fetcher.Form method="post" noValidate className="space-y-4">
              <p className="text-foreground/60 text-sm">
                Enter a full URL (https://yoursite.com) or just the domain name
                (yoursite.com).
              </p>
              <Field>
                <FieldLabel htmlFor="url">Website URL or domain</FieldLabel>
                <Input
                  id="url"
                  name="url"
                  type="text"
                  placeholder="https://yoursite.com"
                  autoFocus
                />
                {error && <FieldError>{error}</FieldError>}
              </Field>
              <Button type="submit">Add Site</Button>
            </fetcher.Form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

type Suggestion = { group: string; query: string };

function ReviewScreen({
  siteId,
  initialSuggestions,
  isProcessing,
  fetcher,
}: {
  siteId: string;
  initialSuggestions: Suggestion[];
  isProcessing: boolean;
  fetcher: ReturnType<typeof useFetcher<ActionResult>>;
}) {
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const groups = ["1.discovery", "2.active_search", "3.comparison"];
  const nonEmpty = suggestions.filter((q) => q.query.trim());

  function updateQuery(index: number, query: string) {
    setSuggestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, query } : q)),
    );
  }

  function removeQuery(index: number) {
    setSuggestions((prev) => prev.filter((_, i) => i !== index));
  }

  function addQuery(group: string) {
    setSuggestions((prev) => [...prev, { group, query: "" }]);
  }

  function handleSave() {
    fetcher.submit(
      {
        _intent: "save-queries",
        siteId,
        queries: JSON.stringify(nonEmpty),
      },
      { method: "post" },
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-6 py-12">
      <div>
        <h1 className="font-heading text-2xl font-bold">Review suggested queries</h1>
        <p className="mt-1 text-foreground/60 text-sm">
          Edit, remove, or add queries before saving. These will be used to
          track your citation visibility across AI platforms.
        </p>
      </div>

      <div className="space-y-4">
        {groups.map((group) => {
          const items = suggestions
            .map((q, i) => ({ ...q, index: i }))
            .filter((q) => q.group === group);
          return (
            <Card key={group}>
              <CardContent className="space-y-2">
                <p className="font-heading text-sm font-semibold">
                  {CATEGORY_LABELS[group] ?? group}
                </p>
                <ul className="space-y-1">
                  {items.map(({ query, index }) => (
                    <li key={index} className="flex items-center gap-2">
                      <Input
                        aria-label="Query text"
                        className="flex-1 text-sm"
                        value={query}
                        onChange={(e) => updateQuery(index, e.target.value)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        aria-label="Remove query"
                        onClick={() => removeQuery(index)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => addQuery(group)}
                >
                  <PlusIcon className="h-4 w-4" />
                  Add query
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-4">
        <Button
          onClick={handleSave}
          disabled={nonEmpty.length === 0 || isProcessing}
        >
          {isProcessing ? "Saving…" : "Save queries"}
        </Button>
        <a href={`/site/${siteId}`} className="text-foreground/60 text-sm underline">
          Skip
        </a>
      </div>
    </main>
  );
}
```

**Step 2: Run typecheck**

```bash
pnpm react-router typegen && pnpm tsc --noEmit --strict
```

Expected: No errors.

**Step 3: Commit**

```bash
git add app/routes/sites_.new/route.tsx
git commit -m "feat: two-phase site creation with query review screen"
```

---

### Task 5: Add `suggest` intent to queries page action

**Files:**
- Modify: `app/routes/site.$id_.queries/route.tsx`

**Step 1: Add the import and case**

At the top of the file, add the import:
```ts
import { captureException } from "@sentry/react-router";
import generateSiteQueries from "~/lib/llm-visibility/generateSiteQueries";
```

In the `action` function's `switch (intent)` block, add before the final `return { ok: false, error: "Unknown action" }`:

```ts
case "suggest": {
  if (!site.content)
    return {
      ok: false as const,
      error: "No site content available to generate suggestions from.",
    };
  try {
    const suggestions = await generateSiteQueries(site.content);
    return { ok: true as const, suggestions };
  } catch (error) {
    captureException(error, { extra: { siteId: site.id } });
    return {
      ok: false as const,
      error: "Couldn't generate suggestions. Please try again.",
    };
  }
}
```

**Step 2: Run typecheck**

```bash
pnpm react-router typegen && pnpm tsc --noEmit --strict
```

Expected: No errors.

---

### Task 6: Add `SuggestedQueries` component to queries page

**Files:**
- Create: `app/routes/site.$id_.queries/SuggestedQueries.tsx`
- Modify: `app/routes/site.$id_.queries/route.tsx` (add to UI)

**Step 1: Create the component**

```tsx
import { ChevronDownIcon, PlusIcon, SparklesIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { Alert, AlertTitle } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Card, CardContent } from "~/components/ui/Card";
import type { action } from "./route";

const CATEGORY_LABELS: Record<string, string> = {
  "1.discovery": "Discovery",
  "2.active_search": "Active search",
  "3.comparison": "Comparison",
};

export default function SuggestedQueries({ hasContent }: { hasContent: boolean }) {
  const fetcher = useFetcher<typeof action>();
  const [dismissed, setDismissed] = useState(false);

  const isLoading = fetcher.state !== "idle";
  const data = fetcher.data;
  const suggestions =
    data && "suggestions" in data ? data.suggestions : undefined;
  const error = data && !data.ok ? data.error : undefined;

  if (!hasContent || dismissed) return null;

  const groups = ["1.discovery", "2.active_search", "3.comparison"];

  return (
    <div className="space-y-3">
      {!suggestions && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={isLoading}
            onClick={() =>
              fetcher.submit({ _intent: "suggest" }, { method: "post" })
            }
          >
            <SparklesIcon className="h-4 w-4" />
            {isLoading ? "Generating…" : "Suggest queries"}
          </Button>
        </div>
      )}

      {error && (
        <Alert variant="outline">
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      )}

      {suggestions && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-heading text-sm font-semibold">Suggested queries</p>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss suggestions"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>

            {groups.map((group) => {
              const items = suggestions.filter((s) => s.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} className="space-y-1">
                  <p className="text-foreground/50 text-xs uppercase tracking-wide">
                    {CATEGORY_LABELS[group] ?? group}
                  </p>
                  <ul className="space-y-1">
                    {items.map((s, i) => (
                      <SuggestionRow key={i} suggestion={s} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SuggestionRow({
  suggestion,
}: {
  suggestion: { group: string; query: string };
}) {
  const addFetcher = useFetcher<typeof action>();
  const added = addFetcher.data?.ok === true;

  return (
    <li className="flex items-center gap-2 text-sm">
      <span className="flex-1 text-foreground/80">{suggestion.query}</span>
      <Button
        variant="outline"
        size="sm"
        type="button"
        disabled={added || addFetcher.state !== "idle"}
        onClick={() =>
          addFetcher.submit(
            {
              _intent: "add-query",
              group: suggestion.group,
              query: suggestion.query,
            },
            { method: "post" },
          )
        }
      >
        {added ? "Added" : <PlusIcon className="h-3 w-3" />}
      </Button>
    </li>
  );
}
```

**Step 2: Update the queries page action to pre-fill query text when adding from suggestions**

The current `add-query` case creates an empty query. We need it to accept an optional `query` value:

```ts
case "add-query": {
  const group = String(data.get("group"));
  const query = String(data.get("query") ?? "");
  await prisma.siteQuery.create({
    data: { siteId: site.id, group, query },
  });
  return { ok: true as const };
}
```

**Step 3: Add `SuggestedQueries` to the route component**

In `route.tsx`, import `SuggestedQueries` and add it above the groups list:

```tsx
import SuggestedQueries from "./SuggestedQueries";

// In the component, after the description paragraph and before the groups div:
<SuggestedQueries hasContent={!!site.content} />
```

**Step 4: Run typecheck**

```bash
pnpm react-router typegen && pnpm tsc --noEmit --strict
```

Expected: No errors.

**Step 5: Commit**

```bash
git add app/routes/site.\$id_.queries/
git commit -m "feat: add suggest queries button to queries page"
```

---

### Task 7: Route tests — sites-new phase 2

**Files:**
- Modify: `test/routes/sites-new.test.ts`

**Step 1: Add a test for phase 2 save-queries**

Add a new `describe` block at the end of the file:

```ts
describe("add site — save-queries phase 2", () => {
  it("creates SiteQuery rows and redirects", async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: EMAIL },
    });
    const site = await prisma.site.create({
      data: {
        id: "site-phase2-1",
        domain: "phase2-test.example.com",
        accountId: user.accountId,
        content: "some content",
      },
    });

    const token = crypto.randomUUID();
    await prisma.session.create({
      data: { token, userId: user.id, ipAddress: "127.0.0.1", userAgent: "test" },
    });
    const cookieHeader = await sessionCookie.serialize(token);

    const queries = [
      { group: "1.discovery", query: "How do I find pop-up retail space?" },
      { group: "2.active_search", query: "Short-term kiosk rental" },
    ];

    const form = new FormData();
    form.append("_intent", "save-queries");
    form.append("siteId", site.id);
    form.append("queries", JSON.stringify(queries));

    const response = await fetch(`http://localhost:${port}/sites/new`, {
      method: "POST",
      headers: { Cookie: cookieHeader },
      body: form,
      redirect: "manual",
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain(`/site/${site.id}`);

    const rows = await prisma.siteQuery.findMany({ where: { siteId: site.id } });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.query)).toContain("How do I find pop-up retail space?");
  });

  it("skips empty queries", async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: EMAIL },
    });
    const site = await prisma.site.create({
      data: {
        id: "site-phase2-2",
        domain: "phase2-empty.example.com",
        accountId: user.accountId,
      },
    });

    const token = crypto.randomUUID();
    await prisma.session.create({
      data: { token, userId: user.id, ipAddress: "127.0.0.1", userAgent: "test" },
    });
    const cookieHeader = await sessionCookie.serialize(token);

    const form = new FormData();
    form.append("_intent", "save-queries");
    form.append("siteId", site.id);
    form.append("queries", JSON.stringify([{ group: "1.discovery", query: "  " }]));

    const response = await fetch(`http://localhost:${port}/sites/new`, {
      method: "POST",
      headers: { Cookie: cookieHeader },
      body: form,
      redirect: "manual",
    });

    expect(response.status).toBe(302);
    const rows = await prisma.siteQuery.findMany({ where: { siteId: site.id } });
    expect(rows).toHaveLength(0);
  });
});
```

**Step 2: Run the new tests**

```bash
pnpm vitest run test/routes/sites-new.test.ts
```

Expected: All tests pass, including the 2 new ones.

**Step 3: Commit**

```bash
git add test/routes/sites-new.test.ts
git commit -m "test: add phase 2 save-queries tests for sites-new"
```

---

### Task 8: Route tests — queries page suggest action

**Files:**
- Modify: `test/routes/siteQueries.test.ts`

**Step 1: Add a describe block for the suggest action**

Add at the end of the file (reuse `user` and `siteId` from the outer describe):

```ts
describe("suggest action", () => {
  it("returns error when site has no content", async () => {
    // siteId has no content (created without content in beforeAll)
    const token = crypto.randomUUID();
    await prisma.session.create({
      data: { token, userId: user.id, ipAddress: "127.0.0.1", userAgent: "test" },
    });
    const cookieHeader = await sessionCookie.serialize(token);

    const form = new FormData();
    form.append("_intent", "suggest");

    const response = await fetch(
      `http://localhost:${port}/site/${siteId}/queries`,
      { method: "POST", headers: { Cookie: cookieHeader }, body: form },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBeTruthy();
  });

  it("returns error when LLM call fails (no API key in test env)", async () => {
    const siteWithContent = await prisma.site.create({
      data: {
        id: "site-suggest-1",
        domain: "suggest-test.example.com",
        accountId: user.accountId,
        content: "Rentail helps brands find short-term retail space.",
      },
    });

    const token = crypto.randomUUID();
    await prisma.session.create({
      data: { token, userId: user.id, ipAddress: "127.0.0.1", userAgent: "test" },
    });
    const cookieHeader = await sessionCookie.serialize(token);

    const form = new FormData();
    form.append("_intent", "suggest");

    const response = await fetch(
      `http://localhost:${port}/site/${siteWithContent.id}/queries`,
      { method: "POST", headers: { Cookie: cookieHeader }, body: form },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    // LLM call fails (no API key) → graceful error returned
    expect(body.ok).toBe(false);
    expect(body.error).toBeTruthy();
  });
});
```

Note: this test also needs `sessionCookie` import. Add to the top of the file:
```ts
import { sessionCookie } from "~/lib/cookies.server";
```

**Step 2: Run the tests**

```bash
pnpm vitest run test/routes/siteQueries.test.ts
```

Expected: All tests pass.

**Step 3: Run the full test suite**

```bash
pnpm test
```

Expected: All tests pass.

**Step 4: Final commit**

```bash
git add test/routes/siteQueries.test.ts
git commit -m "test: add suggest action tests for queries page"
```
