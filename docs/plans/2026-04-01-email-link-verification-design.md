# Email Link Verification Design

## Overview

When a user clicks any link in any outgoing email, the request passes through a
server-side proxy route that marks their email as verified before redirecting
them to the destination. This replaces the dedicated email verification flow
(separate email + dedicated route).

## Proxy route

**`app/routes/r.ts`** — `GET /r?url=<encoded>&email=<encoded>&token=<hmac>`

- Verify token = HMAC of email using `SESSION_SECRET` (same as
  `generateUnsubscribeToken`)
- If valid and `emailVerifiedAt` is null, set it to now via `prisma.user.update`
- Always redirect to `url` — even on invalid token (user must not be stranded)
- If `url` is missing or not an absolute URL, redirect to `/`

## Context

**`app/components/email/context.ts`**

```ts
type EmailLinkContextValue = { email: string; token: string } | null;
```

Default is `null` so components degrade gracefully outside a provider (tests,
previews).

## Custom email components

**`app/components/email/Link.tsx`** and **`app/components/email/Button.tsx`**

- Same props as React Email's `Link` / `Button`
- If context is present, wraps `href` through `/r?url=...&email=...&token=...`
- If context is null, passes `href` through unchanged

## sendEmails.tsx changes

Wrap the `render()` call with the context provider:

```tsx
render(
  <EmailLinkContext.Provider value={{ email: user.email, token }}>
    <EmailLayout ...>
      {email}
    </EmailLayout>
  </EmailLinkContext.Provider>
)
```

The token is already generated for the unsubscribe URL — reuse it.

## Template updates

Swap `Button` / `Link` imports in these files from `@react-email/components`
to `~/components/email/`:

- `app/emails/EmailLayout.tsx`
- `app/emails/PasswordRecovery.tsx`
- `app/emails/SiteInvitation.tsx`
- `app/emails/SiteSetupComplete.tsx`
- `app/emails/WeeklyDigest.tsx`

## Removals

- `app/emails/EmailVerification.tsx`
- `app/routes/verify-email.$token.tsx`
- `EmailVerificationToken` model from `prisma/schema.prisma`
- `createEmailVerificationToken` from `app/lib/auth.server.ts`
- All call sites of `sendEmailVerificationEmail`
- Run `pnpm prisma db push` after schema change
