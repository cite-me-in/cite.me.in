# Admin User Flag Design

**Date:** 2026-03-28

## Problem

`requireAdminApiKey` uses a static `ADMIN_API_SECRET` env var — a shared secret with no user identity. It's a separate auth path that can't leverage the token-based lookup introduced for regular users.

## Solution

Add `isAdmin` to the `User` model. Admin auth becomes: verify the token (same as any user), then assert `user.isAdmin === true`. Admins use their regular API token from the profile page.

## Schema Change

```prisma
model User {
  // ... existing fields ...
  isAdmin Boolean @default(false) @map("is_admin")
}
```

Prisma adds the column with `DEFAULT false` — no data migration needed.

## Auth Function

Replace `requireAdminApiKey` with `requireAdmin`:

```ts
export async function requireAdmin(request: Request): Promise<{
  id: string;
  email: string;
  createdAt: Date;
}> {
  const user = await verifyUserAccess(request); // 401 if bad/missing token
  if (!user.isAdmin) throw new Response("Forbidden", { status: 403 });
  return user;
}
```

- Bad/missing token → 401 (from `verifyUserAccess`)
- Valid token but not admin → 403
- Valid token and admin → returns user

## Route Change

`api.admin.users.ts`: swap `requireAdminApiKey` → `requireAdmin`. No other changes.

## Env Var Removal

Remove `ADMIN_API_SECRET` from `envVars.ts`. Admins authenticate with their personal API token.

## Setting an Admin

Directly in the DB:
```sql
UPDATE users SET is_admin = true WHERE email = 'you@example.com';
```

No UI needed.

## Files to Change

1. `prisma/schema.prisma` — add `isAdmin` field to `User`
2. `app/lib/api/apiAuth.server.ts` — replace `requireAdminApiKey` with `requireAdmin`
3. `app/lib/envVars.ts` — remove `ADMIN_API_SECRET`
4. `app/routes/api.admin.users.ts` — swap to `requireAdmin`
5. `test/lib/apiAuth.test.ts` — replace `requireAdminApiKey` describe with `requireAdmin`
6. `test/routes/api.admin.users.test.ts` — seed an admin user with a proper token; remove `envVars.ADMIN_API_SECRET` usage
7. Prisma migration: `pnpm prisma db push` to apply schema change
