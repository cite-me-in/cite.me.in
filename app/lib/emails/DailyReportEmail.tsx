import { Hr, Row, Section, Text } from "@react-email/components";
import debug from "debug";
import captureException from "~/lib/captureException.server";
import type { Account, BotInsight, BotVisit, Site, User } from "~/prisma";
import {
  queryBotInsightsUpdated,
  queryCitationScores,
  queryNewSites,
  queryNewUsers,
  queryTopBotVisits,
} from "./dailyReports.server";
import EmailLayout from "./EmailLayout";
import { sendEmail } from "./sendEmails.server";

const logger = debug("email");

export default async function sendDailyReportEmail(): Promise<string> {
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
      }),
    );

    logger("[reports:generate] Report data collected successfully");

    return await sendEmail({
      render: () => (
        <DailyReportEmail
          newUsers={newUsers}
          newSitesWithMetrics={newSitesWithMetrics}
          botInsights={botInsights}
        />
      ),
      subject: "Cite.me.in Daily Report",
      to: "assaf@labnotes.org",
    });
  } catch (error) {
    captureException(error);
    throw error;
  }
}

function DailyReportEmail({
  newUsers,
  newSitesWithMetrics,
  botInsights,
}: {
  newUsers: User[];
  newSitesWithMetrics: Array<{
    site: Site & { account: Account & { users: User[] } };
    topBotVisits: BotVisit[];
    citationScores: { current: number; previous: number };
  }>;
  botInsights: (BotInsight & { site: Site })[];
}) {
  const botInsightMap = new Map(
    botInsights.map((insight) => [insight.siteId, insight]),
  );

  return (
    <EmailLayout subject="Cite.me.in Daily Report">
      {/* New Users Section */}
      {newUsers.length > 0 ? (
        <Section className="mb-8 pb-5">
          <Text className="m-0 mb-[15px] font-semibold text-[#333] text-[20px]">
            New Users (Past 24h)
          </Text>
          <table className="my-[15px] w-full border-collapse">
            <thead>
              <tr>
                <th className="border-[#ddd] border-b bg-[#f5f5f5] p-[10px] text-left font-semibold text-[14px]">
                  Email
                </th>
                <th className="border-[#ddd] border-b bg-[#f5f5f5] p-[10px] text-left font-semibold text-[14px]">
                  Account ID
                </th>
                <th className="border-[#ddd] border-b bg-[#f5f5f5] p-[10px] text-left font-semibold text-[14px]">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {newUsers.map((user) => (
                <tr key={user.id}>
                  <td className="border-[#ddd] border-b p-[10px] text-[14px]">
                    {user.email}
                  </td>
                  <td className="border-[#ddd] border-b p-[10px] text-[14px]">
                    {user.accountId}
                  </td>
                  <td className="border-[#ddd] border-b p-[10px] text-[14px]">
                    {user.createdAt.toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : (
        <Section className="mb-8 pb-5">
          <Text className="m-0 mb-[15px] font-semibold text-[#333] text-[20px]">
            New Users (Past 24h)
          </Text>
          <Text className="text-[#999] text-[14px] italic">
            None in the past 24 hours.
          </Text>
        </Section>
      )}

      {/* New Sites Section */}
      {newSitesWithMetrics.length > 0 ? (
        <Section className="mb-8 pb-5">
          <Text className="m-0 mb-[15px] font-semibold text-[#333] text-[20px]">
            New Sites (Past 24h)
          </Text>
          {newSitesWithMetrics.map(({ site, topBotVisits }) => {
            const insight = botInsightMap.get(site.id);

            return (
              <Section
                key={site.id}
                className="mb-[15px] rounded bg-[#f9f9f9] p-[15px]"
              >
                <Text className="m-0 mb-2 font-semibold text-[16px]">
                  {site.domain}
                </Text>
                <Text className="m-0 mb-3 text-[#666] text-[12px]">
                  Account: {site.account.id} | Users:{" "}
                  {site.account.users.map((u: User) => u.email).join(", ")}
                </Text>

                {topBotVisits.length > 0 && (
                  <>
                    <Text className="mt-3 mb-2 font-semibold text-[#333] text-[14px]">
                      Top Bot Visits
                    </Text>
                    <ul className="my-2 pl-5">
                      {topBotVisits.map((visit) => (
                        <li
                          key={visit.id}
                          className="my-1 text-[#555] text-[13px]"
                        >
                          {visit.botType}: {visit.count} visits
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {insight && (
                  <>
                    <Text className="mt-3 mb-2 font-semibold text-[#333] text-[14px]">
                      Bot Insight (Updated today)
                    </Text>
                    <Text className="my-2 text-[#555] text-[13px] leading-normal">
                      {insight.content.split("\n").slice(0, 2).join(" ")}
                    </Text>
                  </>
                )}

                <Hr className="my-[15px] border-[#eee] border-t" />
              </Section>
            );
          })}
        </Section>
      ) : (
        <Section className="mb-8 pb-5">
          <Text className="m-0 mb-[15px] font-semibold text-[#333] text-[20px]">
            New Sites (Past 24h)
          </Text>
          <Text className="text-[#999] text-[14px] italic">
            None in the past 24 hours.
          </Text>
        </Section>
      )}

      {/* Account Metrics Section */}
      <Section className="mb-8 pb-5">
        <Text className="m-0 mb-[15px] font-semibold text-[#333] text-[20px]">
          Account Metrics (Citation Query Score)
        </Text>
        {newSitesWithMetrics.map(({ site, citationScores }) => {
          const change = citationScores.current - citationScores.previous;
          const changePercent =
            citationScores.previous === 0
              ? citationScores.current > 0
                ? 100
                : 0
              : (change / citationScores.previous) * 100;
          const changeColor =
            change > 0 ? "#28a745" : change < 0 ? "#dc3545" : "#6c757d";

          return (
            <Section
              key={site.id}
              className="mb-[15px] rounded bg-[#f9f9f9] p-[15px]"
            >
              <Row>
                <Text className="m-0 font-semibold text-[#1a1a1a] text-[15px]">
                  {site.account.hostname || site.account.id}
                </Text>
              </Row>
              <Row>
                <Text className="my-1 text-[#555] text-[13px]">
                  Current: <strong>{citationScores.current}</strong> | Previous
                  24h: {citationScores.previous}
                </Text>
              </Row>
              <Row>
                <Text
                  className="my-1 text-[13px]"
                  style={{ color: changeColor }}
                >
                  Change: {change > 0 ? "+" : ""}
                  {change} ({changePercent > 0 ? "+" : ""}
                  {changePercent.toFixed(2)}%)
                </Text>
              </Row>
            </Section>
          );
        })}
      </Section>
    </EmailLayout>
  );
}
