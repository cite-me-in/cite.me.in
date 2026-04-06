import type { Site } from "~/prisma";
import { emitWebhookEvent } from "~/lib/webhooks.server";
import { generateApiKey } from "random-password-toolkit";
import { ms } from "convert";
import prices from "~/data/stripe-prices.json";
import prisma from "./prisma.server";
import debug from "debug";

const logger = debug("server");

/**
 * Create a new site for a user. This function verifies the user can add a site
 * and the site is reachable.  It also emits a webhook for the site.  Setting up
 * the site is a separate step.
 *
 * @param user - The user to create the site for.
 * @param domain - The domain of the site to create.
 * @returns The created site object.
 */
export async function createSite({
  user,
  domain,
}: {
  user: { id: string; isAdmin: boolean; plan: string };
  domain: string;
}): Promise<Site> {
  const isPro = user.plan === "paid" || user.plan === "gratis";
  const limit = isPro ? prices.sites : 1;
  const siteCount = await prisma.site.count({ where: { ownerId: user.id } });
  const canAddSite = user.isAdmin || siteCount < limit;
  if (!canAddSite) {
    logger(
      "[createSite] User %s cannot add site %s - over limit %d",
      user.id,
      domain,
      limit,
    );
    throw new Error(
      isPro
        ? "Pro plan supports up to 5 sites. Contact us if you need more."
        : "Free trial supports 1 site. Upgrade to Pro to add up to 5 sites.",
    );
  }

  // Quick reachability check — the only sync step before backgrounding.
  // Skipped in test environment (no outbound network access).
  if (process.env.NODE_ENV !== "test") {
    logger("[createSite] Checking reachability of %s", domain);
    try {
      const res = await fetch(`https://${domain}/`, {
        method: "HEAD",
        signal: AbortSignal.timeout(ms("5s")),
      });
      // Some servers reject HEAD; treat 405 as reachable.
      if (!res.ok && res.status !== 405) throw new Error(`HTTP ${res.status}`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("HTTP "))
        throw new Error(
          `Could not reach ${domain} (${error.message}). Check the URL.`,
        );
      throw new Error(
        `Could not reach ${domain}. Check the URL and try again.`,
      );
    }
  }

  logger("[createSite] Creating site %s for user %s", domain, user.id);
  const site = await prisma.site.create({
    data: {
      apiKey: `cite.me.in_${generateApiKey(16)}`,
      content: "",
      summary: "",
      domain,
      owner: { connect: { id: user.id } },
    },
  });

  logger("[createSite] Emitting webhook for site %s", site.id);
  await emitWebhookEvent("site.created", {
    siteId: site.id,
    domain: site.domain,
  });
  return site;
}

export function extractDomain(url: string): string | null {
  try {
    const href = url.startsWith("http") ? url : `https://${url}`;
    const { hostname } = new URL(href);
    if (!hostname || hostname === "localhost") return null;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return null;
    return hostname.toLowerCase();
  } catch {
    return null;
  }
}

export async function deleteSite({
  userId,
  siteId,
}: {
  userId: string;
  siteId: string;
}): Promise<void> {
  const site = await prisma.site.findFirst({
    where: { id: siteId, ownerId: userId },
  });
  if (site) {
    logger("[deleteSite] Deleting site %s for user %s", siteId, userId);
    await emitWebhookEvent("site.deleted", {
      siteId: site.id,
      domain: site.domain,
    });
    await prisma.site.delete({ where: { id: siteId } });
  }
}
