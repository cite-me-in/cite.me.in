# Sites Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Build `/sites` (list), `/sites/new` (multi-step add flow with DNS + content fetch), and `/sites/:id` (placeholder), plus fix the home route so it redirects to `/sites` when no site exists.

**Architecture:** Three React Router file-system routes. The add-site flow is a single route (`sites.new`) whose action drives a four-step state machine via a hidden `step` field. Server utilities for DNS verification and page content fetching live in `app/lib/sites.server.ts` so they can be tested in isolation. Playwright browser tests cover the full user-facing flows.

**Tech Stack:** React Router 7 (loaders/actions), Prisma, Node.js `dns.promises`, native `fetch`, Playwright + Vitest.

---

### Task 1: Server utilities — domain extraction, DNS verification, content fetch

**Files:**

- Create: `app/lib/sites.server.ts`
- Test: `test/sites.server.test.ts`

**Step 1: Write failing tests**

Create `test/sites.server.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  extractDomain,
  fetchPageContent,
  verifyDomain,
} from "~/lib/sites.server";

describe("extractDomain", () => {
  it("extracts hostname from full URL", () => {
    expect(extractDomain("https://example.com/path?q=1")).toBe("example.com");
  });

  it("extracts hostname when scheme is missing", () => {
    expect(extractDomain("example.com")).toBe("example.com");
  });

  it("returns null for localhost", () => {
    expect(extractDomain("http://localhost:3000")).toBeNull();
  });

  it("returns null for bare IP address", () => {
    expect(extractDomain("http://192.168.1.1")).toBeNull();
  });

  it("returns null for unparseable input", () => {
    expect(extractDomain("not a url at all !!")).toBeNull();
  });
});

describe("verifyDomain", () => {
  it("returns true when A record resolves", async () => {
    vi.spyOn(await import("node:dns"), "promises", "get").mockReturnValue({
      resolve: vi.fn().mockResolvedValue(["1.2.3.4"]),
    } as never);
    expect(await verifyDomain("example.com")).toBe(true);
  });

  it("returns false when DNS lookup fails", async () => {
    vi.spyOn(await import("node:dns"), "promises", "get").mockReturnValue({
      resolve: vi.fn().mockRejectedValue(new Error("ENOTFOUND")),
    } as never);
    expect(await verifyDomain("nonexistent.invalid")).toBe(false);
  });
});

describe("fetchPageContent", () => {
  it("returns extracted text from HTML", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "<html><body><p>Hello world</p></body></html>",
      }),
    );
    const content = await fetchPageContent("example.com");
    expect(content).toContain("Hello world");
  });

  it("returns null when response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, text: async () => "" }),
    );
    expect(await fetchPageContent("example.com")).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await fetchPageContent("example.com")).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run test/sites.server.test.ts
```

Expected: FAIL — module not found.

**Step 3: Write the implementation**

Create `app/lib/sites.server.ts`:

```ts
import dns from "node:dns";

export function extractDomain(url: string): string | null {
  try {
    const href = url.startsWith("http") ? url : `https://${url}`;
    const { hostname } = new URL(href);
    if (!hostname || hostname === "localhost") return null;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return null;
    return hostname;
  } catch {
    return null;
  }
}

export async function verifyDomain(domain: string): Promise<boolean> {
  try {
    await Promise.race([
      Promise.any([
        dns.promises.resolve(domain, "A"),
        dns.promises.resolve(domain, "CNAME"),
      ]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 5_000),
      ),
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function fetchPageContent(domain: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(`https://${domain}/`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const html = await response.text();
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return text.slice(0, 5_000);
  } catch {
    return null;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run test/sites.server.test.ts
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add app/lib/sites.server.ts test/sites.server.test.ts
git commit -m "feat: add sites server utilities for domain extraction, DNS verification, content fetch"
```

---

### Task 2: `/sites` list route

**Files:**

- Create: `app/routes/sites/route.tsx`
- Test: `test/routes/sites.test.ts`

**Step 1: Write failing test**

Create `test/routes/sites.test.ts`:

```ts
import { expect } from "@playwright/test";
import { beforeAll, describe, it } from "vitest";
import prisma from "~/lib/prisma.server";
import { goto, port } from "~/test/helpers/launchBrowser";
import { signIn } from "~/test/helpers/signIn";

describe("unauthenticated access", () => {
  it("redirects to /sign-in", async () => {
    const response = await fetch(`http://localhost:${port}/sites`, {
      redirect: "manual",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/sign-in");
  });
});

describe("sites list — no sites", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: "sites-empty@example.com",
        passwordHash: "test",
        account: { create: {} },
      },
    });
    await signIn(user.id);
  });

  it("shows empty state with add site CTA", async () => {
    const page = await goto("/sites");
    await expect(page.getByRole("link", { name: /add.*site/i })).toBeVisible();
  });

  it("HTML matches baseline", { timeout: 30_000 }, async () => {
    const page = await goto("/sites");
    await expect(page.locator("main")).toMatchInnerHTML({ name: "sites-empty" });
  });

  it("screenshot matches baseline", { timeout: 30_000 }, async () => {
    const page = await goto("/sites");
    await expect(page.locator("main")).toMatchScreenshot({ name: "sites-empty" });
  });
});

describe("sites list — with sites", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: "sites-list@example.com",
        passwordHash: "test",
        account: { create: {} },
      },
    });
    await prisma.site.create({
      data: { domain: "example.com", accountId: user.accountId },
    });
    await signIn(user.id);
  });

  it("shows domain in list", async () => {
    const page = await goto("/sites");
    await expect(page.getByText("example.com")).toBeVisible();
  });

  it("shows link to site detail page", async () => {
    const page = await goto("/sites");
    await expect(page.getByRole("link", { name: /view/i })).toBeVisible();
  });

  it("HTML matches baseline", { timeout: 30_000 }, async () => {
    const page = await goto("/sites");
    await expect(page.locator("main")).toMatchInnerHTML({ name: "sites-list" });
  });

  it("screenshot matches baseline", { timeout: 30_000 }, async () => {
    const page = await goto("/sites");
    await expect(page.locator("main")).toMatchScreenshot({ name: "sites-list" });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run test/routes/sites.test.ts
```

Expected: FAIL — route not found (404).

**Step 3: Write the implementation**

Create `app/routes/sites/route.tsx`:

```tsx
import { Link } from "react-router";
import { Button } from "~/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
import { requireUser } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/route";

export function meta(): Route.MetaDescriptors {
  return [{ title: "Your Sites | CiteUp" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const sites = await prisma.site.findMany({
    where: { accountId: user.accountId },
    orderBy: { createdAt: "desc" },
  });
  return { sites };
}

export default function SitesPage({ loaderData }: Route.ComponentProps) {
  const { sites } = loaderData;

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl">Your Sites</h1>
        <Button render={<Link to="/sites/new" />}>Add Site</Button>
      </div>

      {sites.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {sites.map((site) => (
            <Card key={site.id}>
              <CardHeader>
                <CardTitle className="text-xl">{site.domain}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-foreground/60 text-sm">
                  Added{" "}
                  {new Date(site.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <Button variant="outline" size="sm" render={<Link to={`/sites/${site.id}`} />}>
                  View
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <Card className="py-16 text-center">
      <CardContent className="flex flex-col items-center gap-6">
        <div className="space-y-2">
          <h2 className="font-heading text-2xl">Monitor your brand in AI responses</h2>
          <p className="mx-auto max-w-md text-foreground/60">
            CiteUp runs search queries on ChatGPT, Perplexity, Claude, and
            Gemini and records every URL cited. Add your site to start tracking
            your AI citation visibility.
          </p>
        </div>
        <Button render={<Link to="/sites/new" />}>Add your first site</Button>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run test/routes/sites.test.ts
```

Expected: all tests pass (HTML/screenshot baselines created on first run).

**Step 5: Commit**

```bash
git add app/routes/sites/route.tsx test/routes/sites.test.ts
git commit -m "feat: add /sites list page with empty state and site cards"
```

---

### Task 3: `/sites/new` — action + step 1 (URL input)

**Files:**

- Create: `app/routes/sites.new/route.tsx`
- Test: `test/routes/sites-new.test.ts`

**Step 1: Write failing test for step 1**

Create `test/routes/sites-new.test.ts`:

```ts
import { expect } from "@playwright/test";
import { beforeAll, describe, it } from "vitest";
import prisma from "~/lib/prisma.server";
import { goto, port } from "~/test/helpers/launchBrowser";
import { signIn } from "`/test/helpers/signIn";

describe("unauthenticated access", () => {
  it("redirects to /sign-in", async () => {
    const response = await fetch(`http://localhost:${port}/sites/new`, {
      redirect: "manual",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/sign-in");
  });
});

describe("add site — step 1", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: "sites-new@example.com",
        passwordHash: "test",
        account: { create: {} },
      },
    });
    await signIn(user.id);
  });

  it("shows URL input form", async () => {
    const page = await goto("/sites/new");
    await expect(page.getByRole("textbox", { name: /url/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();
  });

  it("shows error for invalid URL", async () => {
    const page = await goto("/sites/new");
    await page.getByRole("textbox", { name: /url/i }).fill("not-a-domain!!");
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText(/enter a valid website url/i)).toBeVisible();
  });

  it("shows error for localhost", async () => {
    const page = await goto("/sites/new");
    await page.getByRole("textbox", { name: /url/i }).fill("http://localhost");
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText(/enter a valid website url/i)).toBeVisible();
  });

  it("HTML matches baseline", { timeout: 30_000 }, async () => {
    const page = await goto("/sites/new");
    await expect(page.locator("main")).toMatchInnerHTML({ name: "sites-new-step1" });
  });

  it("screenshot matches baseline", { timeout: 30_000 }, async () => {
    const page = await goto("/sites/new");
    await expect(page.locator("main")).toMatchScreenshot({ name: "sites-new-step1" });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run test/routes/sites-new.test.ts
```

Expected: FAIL — route not found.

**Step 3: Write the step 1 implementation**

Create `app/routes/sites.new/route.tsx`:

```tsx
import { Form, redirect } from "react-router";
import { Button } from "~/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
import {
  Field,
  FieldError,
  FieldLabel,
  FieldSet,
} from "~/components/ui/FieldSet";
import { Input } from "~/components/ui/Input";
import { requireUser } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import {
  extractDomain,
  fetchPageContent,
  verifyDomain,
} from "~/lib/sites.server";
import type { Route } from "./+types/route";

export function meta(): Route.MetaDescriptors {
  return [{ title: "Add Site | CiteUp" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  return {};
}

type ActionResult =
  | { step: 1; error: string; url?: string }
  | { step: 2; domain: string; error: string }
  | { step: 3; domain: string; content: string; error: string }
  | { step: 4; domain: string; content: string };

export async function action({ request }: Route.ActionArgs): Promise<ActionResult | Response> {
  await requireUser(request);
  const form = await request.formData();
  const step = Number(form.get("step") ?? 1);

  if (step === 1) {
    const url = form.get("url")?.toString().trim() ?? "";
    const domain = extractDomain(url);
    if (!domain) return { step: 1, error: "Enter a valid website URL", url };
    const ok = await verifyDomain(domain);
    if (!ok)
      return {
        step: 1,
        error: `No DNS records found for ${domain}. Is the domain live?`,
        url,
      };
    return { step: 2, domain, error: "" };
  }

  if (step === 2) {
    const domain = form.get("domain")?.toString() ?? "";
    const content = await fetchPageContent(domain);
    if (!content)
      return {
        step: 2,
        domain,
        error: `Couldn't fetch ${domain} — is the site live and accessible?`,
      };
    return { step: 3, domain, content, error: "" };
  }

  if (step === 3) {
    const user = await requireUser(request);
    const domain = form.get("domain")?.toString() ?? "";
    const content = form.get("content")?.toString() ?? "";
    const existing = await prisma.site.findFirst({
      where: { accountId: user.accountId, domain },
    });
    if (existing) return { step: 3, domain, content, error: "That domain is already added to your account" };
    await prisma.site.create({ data: { domain, accountId: user.accountId } });
    throw redirect("/sites");
  }

  return { step: 1, error: "Invalid step" };
}

const STEP_LABELS = ["Enter URL", "Verify DNS", "Fetch Content", "Confirm"];

export default function AddSitePage({ actionData }: Route.ComponentProps) {
  const currentStep = (actionData as ActionResult | undefined)?.step ?? 1;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg space-y-2">
        <CardHeader>
          <CardTitle className="text-2xl">Add a Site</CardTitle>
          <StepIndicator current={currentStep} />
        </CardHeader>

        <CardContent>
          {currentStep <= 1 && <Step1Form actionData={actionData as { step: 1; error: string; url?: string } | undefined} />}
          {currentStep === 2 && <Step2Form actionData={actionData as { step: 2; domain: string; error: string }} />}
          {currentStep === 3 && <Step3Form actionData={actionData as { step: 3; domain: string; content: string; error: string }} />}
        </CardContent>
      </Card>
    </main>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex gap-2 pt-2">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <span
            className={
              i + 1 < current
                ? "font-bold text-green-600 text-sm"
                : i + 1 === current
                  ? "font-bold text-sm"
                  : "text-foreground/40 text-sm"
            }
          >
            {i + 1 < current ? "✓" : `${i + 1}.`} {label}
          </span>
          {i < STEP_LABELS.length - 1 && (
            <span className="text-foreground/30">→</span>
          )}
        </div>
      ))}
    </div>
  );
}

function Step1Form({
  actionData,
}: {
  actionData?: { step: 1; error: string; url?: string };
}) {
  return (
    <Form method="post" className="space-y-6">
      <input type="hidden" name="step" value="1" />
      <FieldSet>
        <Field>
          <FieldLabel htmlFor="url">Website URL</FieldLabel>
          <Input
            id="url"
            name="url"
            type="url"
            placeholder="https://yoursite.com"
            defaultValue={actionData?.url ?? ""}
            autoFocus
          />
          {actionData?.error && <FieldError>{actionData.error}</FieldError>}
        </Field>
      </FieldSet>
      <Button type="submit" className="w-full">
        Continue
      </Button>
    </Form>
  );
}

function Step2Form({
  actionData,
}: {
  actionData: { step: 2; domain: string; error: string };
}) {
  return (
    <Form method="post" className="space-y-6">
      <input type="hidden" name="step" value="2" />
      <input type="hidden" name="domain" value={actionData.domain} />
      <div className="rounded-base border-2 border-green-500 bg-green-50 p-4">
        <p className="font-medium text-green-700">✓ DNS verified</p>
        <p className="text-green-600 text-sm">{actionData.domain}</p>
      </div>
      {actionData.error && (
        <FieldError>{actionData.error}</FieldError>
      )}
      <Button type="submit" className="w-full">
        Continue
      </Button>
    </Form>
  );
}

function Step3Form({
  actionData,
}: {
  actionData: { step: 3; domain: string; content: string; error: string };
}) {
  return (
    <Form method="post" className="space-y-6">
      <input type="hidden" name="step" value="3" />
      <input type="hidden" name="domain" value={actionData.domain} />
      <input type="hidden" name="content" value={actionData.content} />
      <div className="space-y-3">
        <div className="rounded-base border-2 border-green-500 bg-green-50 p-4">
          <p className="font-medium text-green-700">✓ DNS verified</p>
          <p className="text-green-600 text-sm">{actionData.domain}</p>
        </div>
        <div className="rounded-base border-2 border-green-500 bg-green-50 p-4">
          <p className="font-medium text-green-700">✓ Content fetched</p>
          <p className="line-clamp-3 text-green-600 text-sm">
            {actionData.content.slice(0, 200)}…
          </p>
        </div>
      </div>
      {actionData.error && <FieldError>{actionData.error}</FieldError>}
      <Button type="submit" className="w-full">
        Add Site
      </Button>
    </Form>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run test/routes/sites-new.test.ts
```

Expected: step 1 tests pass (DNS/content tests require Task 4).

**Step 5: Commit**

```bash
git add app/routes/sites.new/route.tsx test/routes/sites-new.test.ts
git commit -m "feat: add /sites/new route with step 1 URL validation"
```

---

### Task 4: `/sites/new` — test DNS failure and content fetch steps

**Files:**

- Modify: `test/routes/sites-new.test.ts`

**Step 1: Add tests for DNS failure, content fetch, and confirm**

Add to `test/routes/sites-new.test.ts` (after the existing `describe("add site — step 1")` block):

```ts
describe("add site — DNS failure", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: "sites-dns-fail@example.com",
        passwordHash: "test",
        account: { create: {} },
      },
    });
    await signIn(user.id);
  });

  it("shows DNS error for domain with no records", async () => {
    const page = await goto("/sites/new");
    // Use a domain that definitely won't resolve in tests
    await page.getByRole("textbox", { name: /url/i }).fill("https://this-domain-does-not-exist-xyzxyz.invalid");
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText(/no dns records found/i)).toBeVisible();
  });
});

describe("add site — duplicate domain", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: "sites-dup@example.com",
        passwordHash: "test",
        account: { create: {} },
      },
    });
    await prisma.site.create({
      data: { domain: "duplicate.example.com", accountId: user.accountId },
    });
    await signIn(user.id);
  });

  it("shows error when domain already exists on account via direct POST", async () => {
    // Simulate step 3 POST with a domain already on the account
    const response = await fetch(`http://localhost:${port}/sites/new`, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        step: "3",
        domain: "duplicate.example.com",
        content: "some content",
      }).toString(),
    });
    // Should return 200 with error (not redirect)
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("already added");
  });
});

describe("add site — successful save", () => {
  let accountId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: "sites-save@example.com",
        passwordHash: "test",
        account: { create: {} },
      },
    });
    accountId = user.accountId;
    await signIn(user.id);
  });

  it("creates site and redirects to /sites on step 3 submit", async () => {
    const response = await fetch(`http://localhost:${port}/sites/new`, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        step: "3",
        domain: "newsite.example.com",
        content: "some content",
      }).toString(),
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/sites");
    const site = await prisma.site.findFirst({
      where: { accountId, domain: "newsite.example.com" },
    });
    expect(site).not.toBeNull();
  });
});
```

**Step 2: Run tests to verify they pass (action is already implemented)**

```bash
pnpm vitest run test/routes/sites-new.test.ts
```

Expected: all tests pass.

**Step 3: Commit**

```bash
git add test/routes/sites-new.test.ts
git commit -m "test: add DNS failure, duplicate domain, and successful save tests for /sites/new"
```

---

### Task 5: `/sites/:id` placeholder route

**Files:**

- Create: `app/routes/sites.$id/route.tsx`

**Step 1: Write the route**

Create `app/routes/sites.$id/route.tsx`:

```tsx
import { requireUser } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/route";

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const site = await prisma.site.findFirst({
    where: { id: params.id, accountId: user.accountId },
  });
  if (!site) throw new Response("Not found", { status: 404 });
  return { site };
}

export default function SiteDetailPage({ loaderData }: Route.ComponentProps) {
  const { site } = loaderData;
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <h1 className="font-heading text-3xl">{site.domain}</h1>
      <p className="text-foreground/60">
        Added{" "}
        {new Date(site.createdAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>
    </main>
  );
}
```

**Step 2: Verify it loads manually (no automated test for placeholder)**

```bash
pnpm typecheck
```

Expected: no errors.

**Step 3: Commit**

```bash
git add app/routes/sites.$id/route.tsx
git commit -m "feat: add /sites/:id placeholder page"
```

---

### Task 6: Fix home route — redirect to `/sites` when no site found

**Files:**

- Modify: `app/routes/home/route.tsx:18-21`
- Test: `test/routes/home.test.ts` — add a test for the no-site redirect

**Step 1: Write failing test**

Add to `test/routes/home.test.ts` before the existing `describe("unauthenticated access")`:

```ts
describe("home route — no site", () => {
  it("redirects to /sites when user has no sites", async () => {
    const user = await prisma.user.create({
      data: {
        email: "home-nosite@example.com",
        passwordHash: "test",
        account: { create: {} },
      },
    });
    await signIn(user.id);
    const response = await fetch(`http://localhost:${port}/`, {
      redirect: "manual",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/sites");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run test/routes/home.test.ts
```

Expected: FAIL — currently throws 404 instead of redirecting.

**Step 3: Update the home loader**

In `app/routes/home/route.tsx`, change lines 18–21:

```ts
// Before:
  if (!site) throw new Response("No site found", { status: 404 });

// After:
  if (!site) throw redirect("/sites");
```

Also add `redirect` to the import:

```ts
import { redirect, useSearchParams } from "react-router";
```

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run test/routes/home.test.ts
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add app/routes/home/route.tsx test/routes/home.test.ts
git commit -m "fix: redirect to /sites instead of 404 when user has no sites"
```

---

### Task 7: Full check

**Step 1: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

**Step 2: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass.

**Step 3: Commit if any final fixes were needed**

```bash
git add -p
git commit -m "chore: fix any typecheck or lint issues"
```
