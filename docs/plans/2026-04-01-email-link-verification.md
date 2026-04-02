# Email Link Verification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Verify a user's email address when they click any link in any outgoing email, by routing all email links through a server-side proxy that sets `emailVerifiedAt` before redirecting.

**Architecture:** A new `/r` route acts as a proxy — it validates an HMAC token, marks the user's email as verified, then redirects. Custom `Link` and `Button` components in `app/components/email/` consume a React context set up in `sendEmails.tsx` to rewrite `href` values through `/r` before the email HTML is rendered. The dedicated email verification flow (token table, verification email, `verify-email` route) is removed.

**Tech Stack:** React Router (flat routes, loaders), React Email (`render()` from `@react-email/components`), Prisma (PostgreSQL), Node `crypto` HMAC (already used by `generateUnsubscribeToken`), React context (`createContext` / `useContext`).

---

### Task 1: Create the `/r` proxy route (test-first)

**Files:**
- Create: `test/routes/r.test.ts`
- Create: `app/routes/r.ts`

**Step 1: Write the failing test**

Create `test/routes/r.test.ts`:

```ts
import { afterEach, describe, it, expect } from "vitest";
import { hashPassword } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import generateUnsubscribeToken from "~/emails/generateUnsubscribeToken";
import envVars from "~/lib/envVars.server";

const BASE = `http://localhost:${process.env.PORT ?? 3000}`;
const DEST = `${envVars.VITE_APP_URL}/sites`;

afterEach(() => prisma.user.deleteMany({ where: { email: { contains: "r-route-test" } } }));

describe("/r proxy route", () => {
  it("should redirect to url and mark emailVerifiedAt when token is valid", async () => {
    const email = "r-route-test-1@example.com";
    await prisma.user.create({
      data: { id: "r-route-1", email, passwordHash: await hashPassword("x") },
    });
    const token = generateUnsubscribeToken(email);
    const url = new URL("/r", BASE);
    url.searchParams.set("url", DEST);
    url.searchParams.set("email", email);
    url.searchParams.set("token", token);

    const res = await fetch(url.toString(), { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(DEST);

    const user = await prisma.user.findUnique({ where: { id: "r-route-1" } });
    expect(user?.emailVerifiedAt).not.toBeNull();
  });

  it("should not overwrite emailVerifiedAt if already set", async () => {
    const email = "r-route-test-2@example.com";
    const verifiedAt = new Date("2025-01-01");
    await prisma.user.create({
      data: { id: "r-route-2", email, passwordHash: await hashPassword("x"), emailVerifiedAt: verifiedAt },
    });
    const token = generateUnsubscribeToken(email);
    const url = new URL("/r", BASE);
    url.searchParams.set("url", DEST);
    url.searchParams.set("email", email);
    url.searchParams.set("token", token);

    await fetch(url.toString(), { redirect: "manual" });

    const user = await prisma.user.findUnique({ where: { id: "r-route-2" } });
    expect(user?.emailVerifiedAt?.toISOString()).toBe(verifiedAt.toISOString());
  });

  it("should still redirect when token is invalid", async () => {
    const url = new URL("/r", BASE);
    url.searchParams.set("url", DEST);
    url.searchParams.set("email", "r-route-test-3@example.com");
    url.searchParams.set("token", "bad-token");

    const res = await fetch(url.toString(), { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(DEST);
  });

  it("should redirect to / when url param is missing", async () => {
    const url = new URL("/r", BASE);
    const res = await fetch(url.toString(), { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
  });
});
```

**Step 2: Run the test to verify it fails**

```bash
infisical --env dev run -- vitest run test/routes/r.test.ts
```

Expected: 4 failures (route doesn't exist yet).

**Step 3: Implement the route**

Create `app/routes/r.ts`:

```ts
import generateUnsubscribeToken from "~/emails/generateUnsubscribeToken";
import envVars from "~/lib/envVars.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/r";

export async function loader({ request }: Route.LoaderArgs) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const email = searchParams.get("email");
  const token = searchParams.get("token");

  const dest = url && url.startsWith(envVars.VITE_APP_URL) ? url : "/";

  if (email && token && token === generateUnsubscribeToken(email)) {
    await prisma.user.updateMany({
      where: { email, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
  }

  return new Response(null, { status: 302, headers: { Location: dest } });
}
```

**Step 4: Run the tests to verify they pass**

```bash
infisical --env dev run -- vitest run test/routes/r.test.ts
```

Expected: 4 passing.

**Step 5: Commit**

```bash
git add app/routes/r.ts test/routes/r.test.ts
git commit -m "feat: add /r proxy route for email link verification"
```

---

### Task 2: Create email link context and custom Link/Button components

**Files:**
- Create: `app/components/email/context.ts`
- Create: `app/components/email/Link.tsx`
- Create: `app/components/email/Button.tsx`

No separate unit tests — these are thin wrappers verified by the email visual tests in Task 4.

**Step 1: Create the context**

Create `app/components/email/context.ts`:

```ts
import { createContext, useContext } from "react";

type EmailLinkContextValue = { email: string; token: string } | null;

export const EmailLinkContext = createContext<EmailLinkContextValue>(null);

export function useEmailLinkContext() {
  return useContext(EmailLinkContext);
}
```

**Step 2: Create the custom Link component**

Create `app/components/email/Link.tsx`:

```tsx
import { Link as EmailLink } from "@react-email/components";
import envVars from "~/lib/envVars.server";
import { useEmailLinkContext } from "./context";

type LinkProps = React.ComponentProps<typeof EmailLink>;

export default function Link({ href, ...props }: LinkProps) {
  const ctx = useEmailLinkContext();
  const wrappedHref =
    ctx && href
      ? (() => {
          const url = new URL("/r", envVars.VITE_APP_URL);
          url.searchParams.set("url", href);
          url.searchParams.set("email", ctx.email);
          url.searchParams.set("token", ctx.token);
          return url.toString();
        })()
      : href;
  return <EmailLink href={wrappedHref} {...props} />;
}
```

**Step 3: Create the custom Button component**

All email Buttons use identical styles (`rounded-md bg-primary px-4 py-2 text-white hover:bg-primary-hover`) — bake them in as default.

Create `app/components/email/Button.tsx`:

```tsx
import { Button as EmailButton } from "@react-email/components";
import { twMerge } from "tailwind-merge";
import envVars from "~/lib/envVars.server";
import { useEmailLinkContext } from "./context";

type ButtonProps = React.ComponentProps<typeof EmailButton>;

export default function Button({ href, className, ...props }: ButtonProps) {
  const ctx = useEmailLinkContext();
  const wrappedHref =
    ctx && href
      ? (() => {
          const url = new URL("/r", envVars.VITE_APP_URL);
          url.searchParams.set("url", href);
          url.searchParams.set("email", ctx.email);
          url.searchParams.set("token", ctx.token);
          return url.toString();
        })()
      : href;
  return (
    <EmailButton
      href={wrappedHref}
      className={twMerge(
        "rounded-md bg-primary px-4 py-2 text-white hover:bg-primary-hover",
        className,
      )}
      {...props}
    />
  );
}
```

**Step 4: Commit**

```bash
git add app/components/email/context.ts app/components/email/Link.tsx app/components/email/Button.tsx
git commit -m "feat: add email Link and Button components with proxy link wrapping"
```

---

### Task 3: Wire context into sendEmails.tsx

**Files:**
- Modify: `app/emails/sendEmails.tsx`

**Step 1: Update the render call**

In `app/emails/sendEmails.tsx`, add the import at the top (after existing imports):

```ts
import { EmailLinkContext } from "~/components/email/context";
```

Then update the `render(...)` call (lines 58–67) to wrap with the provider.

The existing token variable (line 52) is already the HMAC of `user.email` — reuse it.

Change:
```tsx
const html = await pretty(
  await render(
    <EmailLayout
      subject={subject}
      unsubscribeURL={canUnsubscribe ? unsubscribeURL : undefined}
    >
      {email}
    </EmailLayout>,
  ),
);
```

To:
```tsx
const html = await pretty(
  await render(
    <EmailLinkContext.Provider value={{ email: user.email, token }}>
      <EmailLayout
        subject={subject}
        unsubscribeURL={canUnsubscribe ? unsubscribeURL : undefined}
      >
        {email}
      </EmailLayout>
    </EmailLinkContext.Provider>,
  ),
);
```

**Step 2: Commit**

```bash
git add app/emails/sendEmails.tsx
git commit -m "feat: inject email link context into sendEmail render"
```

---

### Task 4: Update email templates to use custom components

For each file below, swap the `Button` / `Link` import from `@react-email/components` to `~/components/email/`. Remove the now-redundant `className` from `<Button>` calls since it's baked into the component.

**Files:**
- Modify: `app/emails/EmailLayout.tsx`
- Modify: `app/emails/PasswordRecovery.tsx`
- Modify: `app/emails/SiteInvitation.tsx`
- Modify: `app/emails/SiteSetupComplete.tsx`
- Modify: `app/emails/WeeklyDigest.tsx`

**Step 1: Update EmailLayout.tsx**

Find the import line:
```ts
import { ..., Link, ... } from "@react-email/components";
```
Add a new import for the custom `Link`:
```ts
import Link from "~/components/email/Link";
```
Remove `Link` from the `@react-email/components` import.

**Step 2: Update PasswordRecovery.tsx**

Add:
```ts
import Button from "~/components/email/Button";
```
Remove `Button` from the `@react-email/components` import.

Remove `className="rounded-md bg-primary px-4 py-2 text-white hover:bg-primary-hover"` from the `<Button>` — it's now the default.

**Step 3: Update SiteInvitation.tsx**

Same as PasswordRecovery — swap import, remove className.

**Step 4: Update SiteSetupComplete.tsx**

Swap `Button` import. Remove className from `<Button>`.

The `<Link>` in SiteSetupComplete (line 251) uses `className="text-dark no-underline"` — keep that className, it's not a default.

**Step 5: Update WeeklyDigest.tsx**

Swap `Button` import. Remove className from `<Button>`.

The `<Link>` on line 310 uses `className="text-dark no-underline"` — keep it.

**Step 6: Verify email tests still pass**

The visual tests render email HTML and compare screenshots — run them to catch any rendering regressions:

```bash
infisical --env dev run -- vitest run test/routes/email.site-setup.test.ts test/routes/email.weekly-digest.test.ts
```

Expected: all passing. If visual snapshots fail, delete the stale `.png` / `.html` baselines in `__screenshots__/email/` and re-run — they regenerate automatically.

**Step 7: Commit**

```bash
git add app/emails/EmailLayout.tsx app/emails/PasswordRecovery.tsx app/emails/SiteInvitation.tsx app/emails/SiteSetupComplete.tsx app/emails/WeeklyDigest.tsx
git commit -m "feat: swap email templates to use custom Link/Button components"
```

---

### Task 5: Remove the email verification flow

**Files:**
- Delete: `app/emails/EmailVerification.tsx`
- Delete: `app/routes/verify-email.$token.tsx`
- Modify: `prisma/schema.prisma` — remove `EmailVerificationToken` model and `emailVerificationTokens` relation from `User`
- Modify: `app/lib/auth.server.ts` — remove `createEmailVerificationToken`
- Modify: `app/routes/sign-up.tsx` — remove verification email call

**Step 1: Delete the files**

```bash
rm app/emails/EmailVerification.tsx app/routes/verify-email.\$token.tsx
```

**Step 2: Update prisma/schema.prisma**

Remove the entire `EmailVerificationToken` model block:

```prisma
model EmailVerificationToken {
  createdAt DateTime  @map("created_at") @default(now())
  expiresAt DateTime  @map("expires_at")
  id        String                       @id @default(cuid())
  token     String    @map("token")      @unique
  usedAt    DateTime? @map("used_at")
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String    @map("user_id")

  @@index([userId])
  @@map("email_verification_tokens")
}
```

Also remove the relation field from the `User` model:

```prisma
emailVerificationTokens EmailVerificationToken[]
```

**Step 3: Push schema change to DB**

```bash
infisical --env dev run -- pnpm prisma db push
```

Expected: Prisma drops the `email_verification_tokens` table.

**Step 4: Update auth.server.ts**

Remove the `createEmailVerificationToken` function (lines 69–84) from `app/lib/auth.server.ts`.

**Step 5: Update sign-up.tsx**

Remove the email verification call from the `action` in `app/routes/sign-up.tsx`. The try/catch block that calls `createEmailVerificationToken` and `sendEmailVerificationEmail` (lines 63–71) can be deleted entirely. Also remove the now-unused imports:

```ts
import sendEmailVerificationEmail from "~/emails/EmailVerification";
import {
  createEmailVerificationToken,
  createSession,
  hashPassword,
} from "~/lib/auth.server";
```

Becomes:

```ts
import { createSession, hashPassword } from "~/lib/auth.server";
```

Also remove the `captureAndLogError` import if it's no longer used in that file.

**Step 6: Run typecheck**

```bash
pnpm check:type
```

Expected: no errors. Fix any remaining references to removed symbols.

**Step 7: Run the sign-up tests**

```bash
infisical --env dev run -- vitest run test/routes/sign-up.test.ts
```

Expected: all passing (sign-up no longer sends a verification email, which is fine — the test doesn't check for one).

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: remove email verification flow — link clicks via /r handle verification"
```

---

### Task 6: Final verification

**Step 1: Run lint and typecheck**

```bash
pnpm check:lint && pnpm check:type
```

Expected: clean.

**Step 2: Run all route tests**

```bash
infisical --env dev run -- vitest run test/routes/
```

Expected: all passing.

**Step 3: Commit if anything was fixed**

Only commit if lint/type fixes were needed.
