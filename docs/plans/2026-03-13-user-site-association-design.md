# User-Site Association Design

**Date:** 2026-03-13

## Overview

Replace the Account-based architecture with direct User-Site associations. Sites are owned by a user, can have multiple members via a join table, and each site carries its own API key. The Account model is removed entirely.

## Schema Changes

### Remove
- `Account` model
- `User.accountId` FK
- `Site.accountId` FK
- `UsageEvent.accountId` FK

### Changes to `Site`
- Add `ownerId String` → FK to `User`, `onDelete: Cascade`
- Add `apiKey String @unique` (generated on site creation; moved from Account)
- Change unique constraint from `[accountId, domain]` → `[ownerId, domain]`

### New `SiteUser` join table
```prisma
model SiteUser {
  siteId    String
  userId    String
  createdAt DateTime @default(now()) @map("created_at")

  site      Site     @relation(fields: [siteId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([siteId, userId])
  @@map("site_users")
}
```

### New `SiteInvitation` model
```prisma
model SiteInvitation {
  id          String           @id @default(cuid())
  siteId      String
  invitedById String
  email       String
  token       String           @unique
  status      InvitationStatus @default(PENDING)
  createdAt   DateTime         @default(now()) @map("created_at")
  acceptedAt  DateTime?        @map("accepted_at")

  site        Site             @relation(fields: [siteId], references: [id], onDelete: Cascade)
  invitedBy   User             @relation(fields: [invitedById], references: [id])

  @@map("site_invitations")
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  EXPIRED
}
```

### `UsageEvent`
- Replace `accountId` with `siteId` → FK to `Site`, `onDelete: Cascade`

## Auth & Authorization

**Sign-up:** Creates a `User` directly — no Account. API key is no longer generated at sign-up.

**`requireUser` / `getCurrentUser`:** Remove `include: { account: true }`. Returned user is plain `User`.

**Site authorization pattern** (replaces `accountId: user.accountId`):
```ts
where: {
  id: params.id,
  OR: [
    { ownerId: user.id },
    { siteUsers: { some: { userId: user.id } } }
  ]
}
```

**Owner-only actions** (invite/remove users, delete site) add: `site.ownerId === user.id`.

**Dashboard** loads sites via the same OR pattern so members see shared sites alongside owned ones.

## Invitation Flow

1. Owner visits `/site/$id/settings` → submits an email address
2. Server creates `SiteInvitation` (status: `pending`, unique token) and sends email with link to `/invite/$token`
3. Recipient clicks the link:
   - Not logged in, no account → redirect to `/sign-up?invite=$token`
   - Not logged in, has account → redirect to `/sign-in?invite=$token`
   - Logged in, email matches → accept: create `SiteUser`, mark invitation `accepted`, redirect to site
   - Logged in, email mismatch → show error
4. After sign-up or sign-in with `?invite=$token`, automatically process the pending invitation and redirect to site
5. Invitations expire after 7 days (checked at acceptance time)

## UI Changes

**Remove:**
- `/account` route and page
- "Account" link from account dropdown menu

**New `/site/$id/settings` page** (tab alongside Citations, Queries, Bot Traffic):
- **API Key section** — site API key with copy button + JS snippet (same UI as current `/account`)
- **Members section** — list of owner + members; owner can remove non-owner members
- **Invite section** (owner only) — email input; list of pending invitations with cancel option

**New `/invite/$token` route** — public page for invitation acceptance

**Dashboard (`/sites`)** — sites show owner vs member badge

**Account dropdown** — remove "Account" link; "Profile Settings" remains

## Data Migration

For each existing `Account`:
1. Pick the oldest `User` as site owner
2. For each `Site` in that account: set `ownerId`, generate a fresh `apiKey`
3. Any additional users in the account → create `SiteUser` records for all sites
4. `UsageEvent` → assign `siteId` to the first site of the account (best-effort)
5. Drop `Account` table

**Note:** Existing bot tracking API keys change. Users will need to update the snippet in their website. Show a banner or send an email.

## Task IDs

- T1: Schema changes (Prisma)
- T2: Data migration script
- T3: Auth & site authorization updates
- T4: Sign-up flow (remove Account creation)
- T5: API track endpoint (site apiKey lookup)
- T6: Dashboard (site loading + owner/member badge)
- T7: Site settings page (API key + members + invite)
- T8: Invitation email + `/invite/$token` route
- T9: Remove `/account` route + dropdown link
- T10: Tests
