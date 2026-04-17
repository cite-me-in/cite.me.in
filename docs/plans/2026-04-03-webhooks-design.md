# Webhooks Design

## Overview

Outbound webhooks that fire when key events occur in cite.me.in. Initially used to send admin alert emails from a separate server. Designed for multi-tenant use from the start so user-facing webhooks can be added later with UI only — no backend changes needed.

## Data Model

Two new Prisma models added to `schema.prisma`.

**`WebhookEndpoint`** — one row per registered recipient:

```prisma
model WebhookEndpoint {
  id         String            @id @default(cuid())
  user       User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId     String            @map("user_id")
  url        String            @map("url")
  secret     String            @map("secret")
  events     String[]          @map("events")
  isActive   Boolean           @map("is_active")  @default(true)
  createdAt  DateTime          @map("created_at") @default(now())
  updatedAt  DateTime          @map("updated_at") @updatedAt
  deliveries WebhookDelivery[]

  @@index([userId])
  @@map("webhook_endpoints")
}
```

**`WebhookDelivery`** — one row per delivery attempt:

```prisma
model WebhookDelivery {
  id          String          @id @default(cuid())
  endpoint    WebhookEndpoint @relation(fields: [endpointId], references: [id], onDelete: Cascade)
  endpointId  String          @map("endpoint_id")
  eventType   String          @map("event_type")
  payload     Json            @map("payload")
  status      DeliveryStatus  @map("status")       @default(PENDING)
  attempts    Int             @map("attempts")      @default(0)
  nextRetryAt DateTime?       @map("next_retry_at")
  lastError   String?         @map("last_error")
  createdAt   DateTime        @map("created_at")   @default(now())
  updatedAt   DateTime        @map("updated_at")   @updatedAt

  @@index([status, nextRetryAt])
  @@index([endpointId])
  @@map("webhook_deliveries")
}

enum DeliveryStatus {
  PENDING
  DELIVERED
  RETRY
  FAILED
}
```

`User` gets a `webhookEndpoints WebhookEndpoint[]` relation.

## Event System

All webhook logic lives in `app/lib/webhooks.server.ts`.

### Event Config

Each event declares its scope and how to resolve the target user from the payload:

```ts
export const WEBHOOK_EVENT_CONFIG = {
  "user.created": { scope: "admin" },
  "site.created": { scope: "user", resolveBy: "siteId" },
  "site.deleted": { scope: "user", resolveBy: "siteId" },
} as const;

export type WebhookEventType = keyof typeof WEBHOOK_EVENT_CONFIG;
```

- `"admin"` scope — only endpoints owned by admin users receive the event
- `"user"` scope — endpoints owned by the relevant user + admin users receive the event

### emitWebhookEvent

Single function, single signature:

```ts
export async function emitWebhookEvent(
  eventType: WebhookEventType,
  payload: Record<string, unknown>,
): Promise<void>;
```

Internally:

1. Reads `WEBHOOK_EVENT_CONFIG[eventType]` to determine scope
2. For `"user"` scope with `resolveBy: "siteId"`: looks up `site.ownerId` from `payload.siteId`
3. Queries active endpoints subscribed to `eventType` matching the scope:
   - Admin: `user.isAdmin = true`
   - User: `userId = ownerId OR user.isAdmin = true`
4. Creates a `WebhookDelivery` row per endpoint and immediately attempts delivery

### Call Sites

```ts
// sign-up.tsx — after user creation
await emitWebhookEvent("user.created", { userId: user.id, email: user.email });

// site.$domain_.setup.tsx — after site creation
await emitWebhookEvent("site.created", { siteId: site.id, domain: site.domain });

// site.$domain_.settings/ delete action — before or after deletion
await emitWebhookEvent("site.deleted", { siteId: site.id, domain: site.domain });
```

## Delivery & HMAC Signing

`attemptDelivery(delivery, endpoint)` in `webhooks.server.ts`:

1. Serialises payload with `event` and `timestamp` fields added at top level
2. Computes `sha256=<hex>` HMAC signature using `endpoint.secret`
3. POSTs to `endpoint.url` with headers:
   - `Content-Type: application/json`
   - `X-Webhook-Signature: sha256=<hex>`
   - `X-Webhook-Event: <eventType>`
4. 10-second timeout via `AbortSignal.timeout`
5. Non-2xx or network error → `scheduleRetry`

### Retry Logic

Max 3 attempts, 5-minute intervals:

```
attempt 1 — immediate (on event emit)
attempt 2 — 5 min after attempt 1 failure (cron)
attempt 3 — 5 min after attempt 2 failure (cron)
→ FAILED
```

Status transitions: `PENDING → DELIVERED` or `PENDING → RETRY → RETRY → FAILED`.

## Retry Cron

New route `app/routes/cron.webhook-retries.tsx`, called every 5 minutes:

- Authenticated via `Authorization: Bearer <CRON_SECRET>`
- Queries `WebhookDelivery` where `status = RETRY AND nextRetryAt <= now`
- Calls `attemptDelivery` for each, reusing the same function as immediate delivery

## Admin Endpoint Seed

Run once against the production DB to register the admin webhook:

```ts
await prisma.webhookEndpoint.create({
  data: {
    userId: "<admin-user-id>",
    url: "<admin-server-url>",
    secret: "<random-secret>",
    events: ["user.created", "site.created", "site.deleted"],
  },
});
```

The admin server verifies requests by recomputing `sha256=HMAC-SHA256(body, secret)` and comparing to the `X-Webhook-Signature` header.

## Adding User-Facing Webhooks Later

The backend is complete. To expose webhooks to regular users:

1. Add a settings UI for users to register `WebhookEndpoint` rows (URL + secret + event subscriptions)
2. Restrict the UI to only show `"user"` scoped events (enforce in UI, not backend)
3. No changes to `emitWebhookEvent`, `attemptDelivery`, or the cron route

To add a new event type: add one entry to `WEBHOOK_EVENT_CONFIG` and one `emitWebhookEvent` call in the relevant route action.
