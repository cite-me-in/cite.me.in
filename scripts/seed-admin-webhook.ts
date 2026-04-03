// scripts/seed-admin-webhook.ts
// Run with: infisical --env prod run -- tsx scripts/seed-admin-webhook.ts
import prisma from "../app/lib/prisma.server";

const ADMIN_USER_ID = "<your-admin-user-id>"; // get from DB: SELECT id FROM users WHERE is_admin = true
const WEBHOOK_URL = "<your-admin-server-webhook-url>";
const WEBHOOK_SECRET = "<generate-with: openssl rand -hex 32>";

const endpoint = await prisma.webhookEndpoint.create({
  data: {
    userId: ADMIN_USER_ID,
    url: WEBHOOK_URL,
    secret: WEBHOOK_SECRET,
    events: ["user.created", "site.created", "site.deleted"],
  },
});

console.log("Created webhook endpoint:", endpoint.id);
console.log("Secret (save this for your admin server):", WEBHOOK_SECRET);
