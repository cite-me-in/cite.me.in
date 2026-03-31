import { Temporal } from "@js-temporal/polyfill";
import { createHash } from "node:crypto";
import prisma from "~/lib/prisma.server";
import captureAndLogError from "./captureAndLogError.server";

/**
 * Browser detection — order matters: Edge and Opera ship with Chrome tokens, so
 * they must be matched before Chrome.
 */
const BROWSER_PATTERNS = [
  { pattern: /Edg\//i, browser: "Edge" },
  { pattern: /OPR\//i, browser: "Opera" },
  { pattern: /Chrome\//i, browser: "Chrome" },
  { pattern: /Firefox\//i, browser: "Firefox" },
  { pattern: /Safari\//i, browser: "Safari" },
] as const;

export function classifyBrowser(userAgent: string): string {
  return (
    BROWSER_PATTERNS.find(({ pattern }) => pattern.test(userAgent))?.browser ??
    "Other"
  );
}

/**
 * Device detection — iPad counts as desktop (aligns with common analytics
 * convention post-iPadOS 13 which uses desktop UA by default).
 */
export function classifyDevice(userAgent: string): "mobile" | "desktop" {
  return /Mobile|Android|iPhone|iPod/i.test(userAgent) ? "mobile" : "desktop";
}

/**
 * AI referral detection — check referer hostname first, fall back to utm_source
 * for tracking links shared from AI platforms.
 */
const AI_REFERRAL_PATTERNS: { pattern: RegExp; source: string }[] = [
  { pattern: /chat\.openai\.com|chatgpt\.com/i, source: "chatgpt" },
  { pattern: /perplexity\.ai/i, source: "perplexity" },
  { pattern: /claude\.ai/i, source: "claude" },
  { pattern: /gemini\.google\.com/i, source: "gemini" },
  { pattern: /copilot\.microsoft\.com/i, source: "copilot" },
  { pattern: /you\.com/i, source: "you" },
];

/**
 * Detect AI referral — check referer hostname first, fall back to utm_source
 * for tracking links shared from AI platforms.
 */
export function detectAiReferral({
  referer,
  utmSource,
}: {
  referer: string | null;
  utmSource: string | null;
}): string | null {
  if (referer) {
    try {
      const { hostname } = new URL(referer);
      const match = AI_REFERRAL_PATTERNS.find(({ pattern }) =>
        pattern.test(hostname),
      );
      if (match) return match.source;
    } catch {
      // ignore malformed referer
    }
  }

  if (utmSource) {
    const match = AI_REFERRAL_PATTERNS.find(({ pattern }) =>
      pattern.test(utmSource),
    );
    if (match) return match.source;
  }

  return null;
}

/**
 * Human browser detection — must look like a real browser UA.  Filters out
 * curl, wget, python-requests, and unknown scripts.
 */
export function isHumanBrowser(userAgent: string): boolean {
  return (
    /Mozilla\/5\.0/i.test(userAgent) &&
    /(Chrome|Firefox|Safari|Edg|OPR)\//i.test(userAgent)
  );
}

/**
 * Visitor fingerprint — daily per-person identifier derived from ip +
 * userAgent. Not perfect (CGNAT, VPNs collapse users) but server-side,
 * cookieless, and consent-free.
 */
function visitorFingerprint(ip: string, userAgent: string): string {
  return createHash("sha256")
    .update(`${ip}:${userAgent}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Record a human visit — one record per visitor per day, page views accumulate
 * in `count`.
 */
export default async function recordHumanVisit({
  ip,
  referer,
  site,
  userAgent,
  utmSource,
}: {
  ip: string | null;
  referer: string | null;
  site: { id: string };
  userAgent: string;
  utmSource: string | null;
}): Promise<{ tracked: boolean; reason?: string }> {
  const date = new Date(
    Temporal.Now.zonedDateTimeISO("UTC").startOfDay().epochMilliseconds,
  );

  const visitorId = visitorFingerprint(ip ?? "unknown", userAgent);
  const browser = classifyBrowser(userAgent);
  const deviceType = classifyDevice(userAgent);
  const aiReferral = detectAiReferral({ referer, utmSource });

  try {
    await prisma.humanVisit.upsert({
      where: {
        date_siteId_visitorId: { date, siteId: site.id, visitorId },
      },
      update: { count: { increment: 1 }, lastSeen: new Date() },
      create: {
        aiReferral,
        browser,
        count: 1,
        date,
        deviceType,
        site: { connect: { id: site.id } },
        visitorId,
      },
    });
    return { tracked: true };
  } catch (error) {
    captureAndLogError(error, { extra: { visitorId, browser, deviceType } });
    return { tracked: false, reason: "db error" };
  }
}
