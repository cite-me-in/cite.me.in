import { ms } from "convert";
import { generateApiKey } from "random-password-toolkit";
import type { Site } from "~/prisma";
import prisma from "./prisma.server";

export async function createSite(
  user: { id: string; isAdmin: boolean; },
  url: string,
): Promise<{ site: Site; existing: boolean; }> {
  const domain = extractDomain(url);
  if (!domain) throw new Error("Enter a valid website URL or domain name");

  const existing = await prisma.site.findFirst({
    where: { ownerId: user.id, domain },
  });
  if (existing) return { site: existing, existing: true };

  const account = await prisma.account.findUnique({
    where: { userId: user.id },
    select: { status: true },
  });
  const isPro = account?.status === "active";
  const limit = isPro ? 5 : 1;
  const siteCount = await prisma.site.count({ where: { ownerId: user.id } });
  const canAddSite = user.isAdmin || siteCount < limit;
  if (!canAddSite)
    throw new Error(
      isPro
        ? "Pro plan supports up to 5 sites. Contact us if you need more."
        : "Free trial supports 1 site. Upgrade to Pro to add up to 5 sites.",
    );

  // Quick reachability check — the only sync step before backgrounding.
  // Skipped in test environment (no outbound network access).
  if (process.env.NODE_ENV !== "test") {
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

  const site = await prisma.site.create({
    data: {
      apiKey: `cite.me.in_${generateApiKey(16)}`,
      content: "",
      summary: "",
      domain,
      owner: { connect: { id: user.id } },
    },
  });
  return { site, existing: false };
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
  if (site) await prisma.site.delete({ where: { id: siteId } });
}
