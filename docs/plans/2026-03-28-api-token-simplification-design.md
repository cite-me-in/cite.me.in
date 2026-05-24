# API Token Simplification Design

**Date:** 2026-03-28

## Problem

The current `apiKey` is a random string with no user identity encoded (`cite.me.in_{24chars}`). This forces `verifyUserAccess` to accept an email URL parameter and perform a full-table scan: `findFirst({ where: { email, apiKey: token } })`. The `/api/me/{email}` endpoint is redundant — the caller already knows their email, and the server needs it only to locate the user.

## Solution

Encode the user ID into the token so the server can identify the account directly from the token alone.

## Token Format

```
cite.me.in_{userId}_{randomSecret}
```

- `userId`: the user's existing cuid (e.g. `clxyz123abc`)
- `randomSecret`: 24 random characters (same as today)
- Example: `cite.me.in_clxyz123abc_aB3dEfGhIjKlMnOpQrStUvWx`

The server splits on `_` to extract the prefix, userId, and secret.

## Auth Flow (new)

1. Parse token → extract `userId`
2. `prisma.user.findUnique({ where: { id: userId } })` — primary key lookup
3. Assert `user.apiKey === token` — full token comparison
4. Return the user

## API Changes

| Before                   | After                                    |
| ------------------------ | ---------------------------------------- |
| `GET /api/me/{email}`    | `GET /api/me`                            |
| Requires email URL param | No param needed; user derived from token |

## `verifySiteAccess` Simplification

Before (nested joins through apiKey):

```ts
prisma.site.findFirst({
  where: {
    domain,
    OR: [{ owner: { apiKey: token } }, { siteUsers: { some: { user: { apiKey: token } } } }],
  },
});
```

After (userId-first, cleaner join):

```ts
// 1. verify token → userId (reuse verifyUserAccess)
// 2. check site access
prisma.site.findFirst({
  where: {
    domain,
    OR: [{ ownerId: userId }, { siteUsers: { some: { userId } } }],
  },
});
```

## Schema

No schema change. The `apiKey String? @unique` field on `User` remains. Only the stored value changes format.

## Migration

Clear all existing `api_key` values so users regenerate with the new format:

```sql
UPDATE users SET api_key = NULL;
```

Existing tokens stop working immediately. Users regenerate from the profile page.

## Files to Change

1. `app/routes/profile/route.tsx` — update `regenerateApiKey` to use new format
2. `app/lib/api/apiAuth.server.ts` — rewrite `verifyUserAccess` and `verifySiteAccess`
3. `app/routes/api.me.$email.ts` → rename to `api.me.ts`, remove email param usage
4. `app/lib/api/openapi.ts` — update `/api/me/{email}` → `/api/me`, remove email parameter
5. Prisma migration — clear existing api_key values
