import { convert } from "convert";
import { parallel } from "radashi";
import prisma from "~/lib/prisma.server";
import { attemptDelivery } from "~/lib/webhooks.server";

export const schedule = "*/15 * * * *";
export const timeout = convert(2, "minutes").to("seconds");

async function main() {
  const pending = await prisma.webhookDelivery.findMany({
    where: { status: "RETRY", nextRetryAt: { lte: new Date() } },
    include: { endpoint: true },
  });
  await parallel({ limit: 10 }, pending, attemptDelivery);

  return { processed: pending.length };
}

if (import.meta.main) await main();

export default main;
