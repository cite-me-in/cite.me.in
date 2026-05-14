import { resolve4, resolve6 } from "node:dns/promises";
import net from "node:net";
import { ms } from "convert";
import debug from "debug";
import { generateApiKey } from "random-password-toolkit";
import prices from "~/data/stripe-prices.json";
import { emitWebhookEvent } from "~/lib/webhooks.server";
import type { Site } from "~/prisma";
import prisma from "./prisma.server";

const logger = debug("server");

const RESERVED_DOMAINS = new Set([
  "example.com",
  "example.net",
  "example.org",
  "example.edu",
  "test.com",
  "test.net",
  "test.org",
]);

const PRIVATE_TLDS = new Set([".local", ".internal", ".corp", ".home", ".lan"]);

function isPrivateIP(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (normalized === "::1") return true;
    if (normalized.startsWith("fe80")) return true;
    return false;
  }
  return false;
}

async function checkPublicIP(domain: string): Promise<void> {
  const addresses: string[] = [];
  try {
    const v4 = await resolve4(domain);
    addresses.push(...v4);
  } catch {
    // No A record
  }
  try {
    const v6 = await resolve6(domain);
    addresses.push(...v6);
  } catch {
    // No AAAA record
  }
  if (addresses.length === 0) return;

  if (addresses.some(isPrivateIP))
    throw new Error(
      `${domain} resolves to a private IP address. Enter a website accessible from the internet.`,
    );
}

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
    logger("[createSite] User %s cannot add site %s - over limit %d", user.id, domain, limit);
    throw new Error(
      isPro
        ? "Pro plan supports up to 5 sites. Contact us if you need more."
        : "Free trial supports 1 site. Upgrade to Pro to add up to 5 sites.",
    );
  }

  // Skip network checks in test environment
  if (process.env.NODE_ENV !== "test") {
    logger("[createSite] Checking public DNS of %s", domain);
    await checkPublicIP(domain);

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
        throw new Error(`Could not reach ${domain} (${error.message}). Check the URL.`);
      throw new Error(`Could not reach ${domain}. Check the URL and try again.`);
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
    const lower = hostname.toLowerCase();
    if (!lower || lower === "localhost") return null;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(lower)) return null;
    if (RESERVED_DOMAINS.has(lower)) return null;
    for (const tld of PRIVATE_TLDS) {
      if (lower.endsWith(tld)) return null;
    }
    return lower;
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
