import { Temporal } from "@js-temporal/polyfill";
import { ms } from "convert";
import { invariant, sumBy, uniqBy } from "es-toolkit";
import dns from "node:dns";
import parseHTMLTree, { getBodyContent } from "~/lib/html/parseHTML";
import type { Account, Site } from "~/prisma";
import captureException from "./captureException.server";
import calculateCitationMetrics from "./llm-visibility/calculateCitationMetrics";
import prisma from "./prisma.server";

/**
 * Add a site to an account. If the domain is not valid, or DNS does not
 * resolve, throws an error. If the domain already exists, returns the existing
 * site without adding it again.
 *
 * @param account - The account to add the site to.
 * @param url - The URL of the site to add.
 * @throws {Error} If the domain is not valid or DNS does not resolve.
 * @returns The site that was added or already exists in the database.
 */
export async function addSiteToAccount(
  account: Account,
  url: string,
): Promise<{
  site: Site;
  existing: boolean;
}> {
  const domain = extractDomain(url);
  if (!domain) throw new Error("Enter a valid website URL or domain name");

  const existing = await prisma.site.findFirst({
    where: { accountId: account.id, domain },
  });
  if (existing) return { site: existing, existing: true };

  const content = await fetchPageContent(domain);
  const site = await prisma.site.create({
    data: {
      account: { connect: { id: account.id } },
      content,
      domain,
    },
  });
  return { site, existing: false };
}

/**
 * Extract the domain from a URL.
 *
 * @param url - The URL to extract the domain from.
 * @returns The domain, or null if the URL is not valid.
 */
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

/**
 * Verify that a domain has DNS records. Throws an error if the domain has no DNS records.
 *
 * @param domain - The domain to verify.
 * @throws {Error} If the domain has no DNS records.
 */
export async function verifyDomain(domain: string): Promise<void> {
  try {
    await Promise.race([
      Promise.any([
        dns.promises.resolve(domain, "A"),
        dns.promises.resolve(domain, "CNAME"),
      ]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 5_000),
      ),
    ]);
  } catch {
    throw new Error(`No DNS records found for ${domain}. Is the domain live?`);
  }
}

/**
 * Fetch the page content for a given domain. If the page is not found or the
 * request times out, returns null. The content is limited to 5,000 characters.
 *
 * @param domain - The domain to fetch the page content for.
 * @returns The page content, or null if the page is not found or the request times out.
 * @throws {Error} If the page is not found or the request times out.
 */
export async function fetchPageContent(domain: string): Promise<string | null> {
  try {
    const response = await fetch(`https://${domain}/`, {
      signal: AbortSignal.timeout(ms("5s")),
      redirect: "follow",
    });
    invariant(response.ok, response.statusText);
    const html = await response.text();
    const tree = parseHTMLTree(html);
    return getBodyContent(tree).slice(0, 5_000);
  } catch (error) {
    captureException(error, { extra: { domain } });
    throw new Error(`I couldn't fetch the main page of ${domain}`);
  }
}

/**
 * Load sites with metrics for a given account. The metrics are calculated for
 * the last 14 days.
 *
 * @param accountId - The account ID to load sites for.
 * @returns An array of sites with metrics.
 */
export async function loadSitesWithMetrics(accountId: string): Promise<
  {
    citationsToDomain: number;
    score: number;
    totalCitations: number;
    uniqueBots: number;
    totalBotVisits: number;
    site: Site;
  }[]
> {
  const gte = new Date(
    Temporal.Now.plainDateISO().subtract({ days: 14 }).toJSON(),
  );
  const sites = await prisma.site.findMany({
    include: {
      citationRuns: {
        include: {
          queries: {
            select: { citations: true },
          },
        },
        where: { createdAt: { gte } },
      },
      botVisits: {
        select: { count: true, botType: true },
        where: { date: { gte } },
      },
    },
    orderBy: [{ domain: "asc" }, { createdAt: "desc" }],
    where: { accountId },
  });
  return sites.map((site) => {
    // Get citation metrics
    const { citationsToDomain, score, totalCitations } =
      calculateCitationMetrics({
        domain: site.domain,
        queries: site.citationRuns[0]?.queries ?? [],
      });

    return {
      citationsToDomain,
      score,
      site,
      totalBotVisits: sumBy(site.botVisits, (v) => v.count),
      totalCitations,
      uniqueBots: uniqBy(site.botVisits, (v) => v.botType).length,
    };
  });
}

/**
 * Delete a site from an account.
 *
 * @param accountId - The account ID to delete the site from.
 * @param siteId - The ID of the site to delete.
 * @returns The deleted site.
 */
export async function deleteSite({
  accountId,
  siteId,
}: {
  accountId: string;
  siteId: string;
}): Promise<void> {
  // Verify site exists and belongs to user
  const site = await prisma.site.findFirst({
    where: { id: siteId, accountId: accountId },
  });
  if (site) await prisma.site.delete({ where: { id: siteId } });
}
