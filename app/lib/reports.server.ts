import { Temporal } from "@js-temporal/polyfill";
import debug from "debug";
import type { Account, BotInsight, BotVisit, Site, User } from "~/prisma";
import prisma from "./prisma.server";

const logger = debug("server");

/**
 * Query new users created in the past 24 hours
 */
async function queryNewUsers() {
  const now = new Date(
    Temporal.Now.instant().epochMilliseconds
  );
  const oneDayAgo = new Date(
    Temporal.Now.instant().subtract({ hours: 24 }).epochMilliseconds
  );

  logger("[reports:newUsers] Querying users from %s to %s", oneDayAgo, now);

  const users = await prisma.user.findMany({
    where: {
      createdAt: {
        gte: oneDayAgo,
        lte: now,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  logger("[reports:newUsers] Found %d new users", users.length);
  return users;
}

/**
 * Query new sites with account and user details (past 24 hours)
 */
async function queryNewSites() {
  const now = new Date(
    Temporal.Now.instant().epochMilliseconds
  );
  const oneDayAgo = new Date(
    Temporal.Now.instant().subtract({ hours: 24 }).epochMilliseconds
  );

  logger("[reports:newSites] Querying sites from %s to %s", oneDayAgo, now);

  const sites = await prisma.site.findMany({
    where: {
      createdAt: {
        gte: oneDayAgo,
        lte: now,
      },
    },
    include: {
      account: {
        include: {
          users: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  logger("[reports:newSites] Found %d new sites", sites.length);
  return sites;
}

/**
 * Query top 3 bot visits by count for a site (past 24 hours)
 */
async function queryTopBotVisits(siteId: string) {
  const now = new Date(
    Temporal.Now.instant().epochMilliseconds
  );
  const oneDayAgo = new Date(
    Temporal.Now.instant().subtract({ hours: 24 }).epochMilliseconds
  );

  logger(
    "[reports:topBotVisits] Querying for site %s from %s to %s",
    siteId,
    oneDayAgo,
    now
  );

  const botVisits = await prisma.botVisit.findMany({
    where: {
      siteId,
      createdAt: {
        gte: oneDayAgo,
        lte: now,
      },
    },
    orderBy: { count: "desc" },
    take: 3,
  });

  logger("[reports:topBotVisits] Found %d top bot visits", botVisits.length);
  return botVisits;
}

/**
 * Query citation query scores (current 24h vs previous 24h)
 */
async function queryCitationScores(siteId: string) {
  const now = Temporal.Now.zonedDateTimeISO("UTC");
  const currentStart = now.startOfDay();
  const previousStart = currentStart.subtract({ days: 1 });
  const previousEnd = currentStart.subtract({ days: 0, milliseconds: 1 });

  const currentStartDate = new Date(currentStart.epochMilliseconds);
  const previousStartDate = new Date(previousStart.epochMilliseconds);
  const previousEndDate = new Date(previousEnd.epochMilliseconds);

  logger(
    "[reports:citationScores] Querying for site %s",
    siteId
  );

  const currentPeriod = await prisma.citationQueryRun.findMany({
    where: {
      siteId,
      createdAt: {
        gte: currentStartDate,
      },
    },
    include: {
      queries: true,
    },
  });

  const previousPeriod = await prisma.citationQueryRun.findMany({
    where: {
      siteId,
      createdAt: {
        gte: previousStartDate,
        lte: previousEndDate,
      },
    },
    include: {
      queries: true,
    },
  });

  const currentScore = calculateAverageScore(currentPeriod);
  const previousScore = calculateAverageScore(previousPeriod);

  logger(
    "[reports:citationScores] Current: %d, Previous: %d",
    currentScore,
    previousScore
  );

  return {
    current: currentScore,
    previous: previousScore,
  };
}

/**
 * Query bot insights updated in past 24 hours
 */
async function queryBotInsightsUpdated() {
  const now = new Date(
    Temporal.Now.instant().epochMilliseconds
  );
  const oneDayAgo = new Date(
    Temporal.Now.instant().subtract({ hours: 24 }).epochMilliseconds
  );

  logger(
    "[reports:botInsights] Querying insights updated from %s to %s",
    oneDayAgo,
    now
  );

  const insights = await prisma.botInsight.findMany({
    where: {
      updatedAt: {
        gte: oneDayAgo,
        lte: now,
      },
    },
    include: {
      site: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  logger("[reports:botInsights] Found %d updated insights", insights.length);
  return insights;
}

interface CitationQueryRun {
  queries: Array<{
    citations?: string[];
  }>;
}

/**
 * Calculate average citation score from citation query runs
 */
function calculateAverageScore(runs: CitationQueryRun[]): number {
  if (runs.length === 0) return 0;

  const totalCitations = runs.reduce((sum, run) => {
    const citationCount = run.queries.filter(
      (q) => q.citations && q.citations.length > 0
    ).length;
    return sum + citationCount;
  }, 0);

  return runs.length > 0 ? Math.round((totalCitations / runs.length) * 100) / 100 : 0;
}

/**
 * Generate daily report HTML with all metrics
 */
export async function generateDailyReport(): Promise<string> {
  logger("[reports:generate] Starting daily report generation");

  try {
    const newUsers = await queryNewUsers();
    const newSites = await queryNewSites();
    const botInsights = await queryBotInsightsUpdated();

    // Get top bot visits for each new site
    const newSitesWithMetrics = await Promise.all(
      newSites.map(async (site) => {
        const topBotVisits = await queryTopBotVisits(site.id);
        const citationScores = await queryCitationScores(site.id);
        return {
          site,
          topBotVisits,
          citationScores,
        };
      })
    );

    logger("[reports:generate] Report data collected successfully");

    const html = generateHTMLReport({
      newUsers,
      newSitesWithMetrics,
      botInsights,
      generatedAt: new Date(),
    });

    logger("[reports:generate] Report HTML generated successfully");
    return html;
  } catch (error) {
    logger("[reports:generate] Error generating report: %o", error);
    throw error;
  }
}

interface ReportData {
  newUsers: User[];
  newSitesWithMetrics: Array<{
    site: Site & { account: Account & { users: User[] } };
    topBotVisits: BotVisit[];
    citationScores: { current: number; previous: number };
  }>;
  botInsights: (BotInsight & { site: Site })[];
  generatedAt: Date;
}

/**
 * Generate HTML report from collected data
 */
function generateHTMLReport(data: ReportData): string {
  const {
    newUsers,
    newSitesWithMetrics,
    botInsights,
    generatedAt,
  } = data;

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(generatedAt);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CiteUp Daily Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    h1 {
      color: #1a1a1a;
      border-bottom: 3px solid #007bff;
      padding-bottom: 10px;
      margin-bottom: 10px;
    }
    h2 {
      color: #333;
      margin-top: 30px;
      margin-bottom: 15px;
      border-left: 4px solid #007bff;
      padding-left: 10px;
    }
    .timestamp {
      color: #666;
      font-size: 0.9em;
      margin-top: 10px;
    }
    .metric {
      background-color: #f9f9f9;
      border-left: 4px solid #007bff;
      padding: 15px;
      margin: 15px 0;
      border-radius: 4px;
    }
    .metric-title {
      font-weight: bold;
      color: #007bff;
      margin-bottom: 5px;
    }
    .metric-value {
      font-size: 1.5em;
      color: #1a1a1a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th {
      background-color: #007bff;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e0e0e0;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .empty-state {
      text-align: center;
      color: #999;
      padding: 20px;
      font-style: italic;
    }
    .score-positive {
      color: #28a745;
      font-weight: bold;
    }
    .score-negative {
      color: #dc3545;
      font-weight: bold;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      color: #666;
      font-size: 0.9em;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 CiteUp Daily Report</h1>
    <div class="timestamp">Generated: ${formattedDate}</div>

    <h2>📈 Summary</h2>
    <div class="metric">
      <div class="metric-title">New Users (24h)</div>
      <div class="metric-value">${newUsers.length}</div>
    </div>
    <div class="metric">
      <div class="metric-title">New Sites (24h)</div>
      <div class="metric-value">${newSitesWithMetrics.length}</div>
    </div>
    <div class="metric">
      <div class="metric-title">Bot Insights Updated (24h)</div>
      <div class="metric-value">${botInsights.length}</div>
    </div>

    ${newUsers.length > 0 ? `
    <h2>👥 New Users</h2>
    <table>
      <thead>
        <tr>
          <th>Email</th>
          <th>Created At</th>
        </tr>
      </thead>
      <tbody>
        ${newUsers
          .map(
            (user) => `
          <tr>
            <td>${escapeHtml(user.email)}</td>
            <td>${formatDate(user.createdAt)}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
    ` : '<div class="empty-state">No new users in the past 24 hours</div>'}

    ${newSitesWithMetrics.length > 0 ? `
    <h2>🌐 New Sites</h2>
    ${newSitesWithMetrics
      .map(
        ({ site, topBotVisits, citationScores }) => `
      <div class="metric">
        <div class="metric-title">
          ${escapeHtml(site.domain)}
        </div>
        <div style="margin-top: 10px; font-size: 0.9em; color: #666;">
          <p><strong>Account:</strong> ${
            site.account.users.length
          } user(s)</p>
          <p><strong>Citation Score:</strong> Current: <span class="score-positive">${
            citationScores.current
          }</span> vs Previous: <span class="score-${
            citationScores.current >= citationScores.previous
              ? "positive"
              : "negative"
          }">${citationScores.previous}</span></p>
          <p><strong>Top Bot Visits (24h):</strong> ${
            topBotVisits.length
          } type(s)</p>
          ${topBotVisits
            .map(
              (visit) => `
            <div style="margin-left: 20px; padding: 5px 0; font-size: 0.85em;">
              • ${escapeHtml(visit.botType)}: ${visit.count} visits
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `
      )
      .join("")}
    ` : '<div class="empty-state">No new sites in the past 24 hours</div>'}

    ${botInsights.length > 0 ? `
    <h2>🤖 Updated Bot Insights</h2>
    <table>
      <thead>
        <tr>
          <th>Site</th>
          <th>Updated At</th>
        </tr>
      </thead>
      <tbody>
        ${botInsights
          .map(
            (insight) => `
          <tr>
            <td>${escapeHtml(insight.site.domain)}</td>
            <td>${formatDate(insight.updatedAt)}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
    ` : '<div class="empty-state">No bot insights updated in the past 24 hours</div>'}

    <div class="footer">
      <p>This is an automated report from CiteUp. Generated at ${formattedDate}</p>
    </div>
  </div>
</body>
</html>`;

  return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
