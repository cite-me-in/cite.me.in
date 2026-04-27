import { Section, Text } from "react-email";
import { BrandReminderCard } from "~/components/email/BrandReminder";
import Button from "~/components/email/Button";
import Card from "~/components/email/Card";
import Link from "~/components/email/Link";
import TIERS from "~/lib/aiLegibility/criteria";
import type { ScanResult } from "~/lib/aiLegibility/types";
import envVars from "~/lib/envVars.server";
import prisma from "~/lib/prisma.server";
import { sendEmail } from "./sendEmails";

export default async function sendAiLegibilityReport({
  site,
  result,
  sendTo,
}: {
  site: { id: string; domain: string };
  result: ScanResult;
  sendTo: { id: string; email: string; unsubscribed: boolean };
}) {
  const reportURL = new URL(
    `/site/${site.domain}/ai-legibility`,
    envVars.VITE_APP_URL,
  ).toString();

  const totalPassed =
    result.summary.critical.passed +
    result.summary.important.passed +
    result.summary.optimization.passed;
  const totalChecks =
    result.summary.critical.total +
    result.summary.important.total +
    result.summary.optimization.total;

  await sendEmail({
    domain: site.domain,
    email: (
      <AiLegibilityReport
        site={site}
        result={result}
        reportUrl={reportURL}
        totalPassed={totalPassed}
        totalChecks={totalChecks}
      />
    ),
    isTransactional: true,
    sendTo,
    subject: `AI Legibility Report for ${site.domain}`,
  });
  await prisma.sentEmail.create({
    data: { user: { connect: { id: sendTo.id } }, type: "AiLegibilityReport" },
  });
}

function AiLegibilityReport({
  site,
  result,
  reportUrl,
  totalPassed,
  totalChecks,
}: {
  site: { id: string; domain: string };
  result: ScanResult;
  reportUrl: string;
  totalPassed: number;
  totalChecks: number;
}) {
  const score = Math.round((totalPassed / totalChecks) * 100);
  const visibleSuggestions = result.suggestions.slice(0, 3);
  const hasMoreSuggestions = result.suggestions.length > 3;

  return (
    <Section>
      <Text className="text-text my-4 text-base leading-relaxed">
        Your AI Legibility Report for <strong>{site.domain}</strong> is ready.
      </Text>

      <Card
        title={`AI Legibility Score: ${score}%`}
        subtitle={`${totalPassed}/${totalChecks} checks passed`}
        withBorder
      >
        <SummaryTable result={result} />
      </Card>

      <Section className="my-8 text-center">
        <Button href={reportUrl}>View Full Report</Button>
      </Section>

      {visibleSuggestions.length > 0 && (
        <Card title="Top Suggestions" withBorder>
          {visibleSuggestions.map((suggestion, i) => (
            <SuggestionItem key={i} suggestion={suggestion} />
          ))}
          {hasMoreSuggestions && (
            <div className="border-border border-t p-4 text-center">
              <Link
                href={`${reportUrl}#suggestions`}
                style={{ color: "#6366f1", textDecoration: "underline" }}
              >
                View all {result.suggestions.length} suggestions →
              </Link>
            </div>
          )}
        </Card>
      )}

      <BrandReminderCard domain={site.domain} citations={totalPassed} />

      <Explainer />

      <Text className="text-text my-4 text-base leading-relaxed">
        Best regards,
        <br />
        The Cite.me.in Team
      </Text>
    </Section>
  );
}

function SummaryTable({ result }: { result: ScanResult }) {
  return (
    <table>
      <thead>
        <tr className="text-light text-center text-xs tracking-wide uppercase">
          <th className="p-4 text-left">Category</th>
          <th className="p-4">Passed</th>
          <th className="p-4">Status</th>
        </tr>
      </thead>
      <tbody>
        {TIERS.map((tier) => (
          <SummaryRow
            key={tier.key}
            category={tier.title.split(" — ")[0]}
            passed={result.summary[tier.key].passed}
            total={result.summary[tier.key].total}
          />
        ))}
      </tbody>
    </table>
  );
}

function SummaryRow({
  category,
  passed,
  total,
}: {
  category: string;
  passed: number;
  total: number;
}) {
  const status = passed === total ? "✓" : `${passed}/${total}`;
  const statusColor = passed === total ? "text-green-600" : "text-red-600";

  return (
    <tr className="border-border border-t">
      <td className="p-4 text-left font-medium">{category}</td>
      <td className="p-4 text-center">
        {passed}/{total}
      </td>
      <td className={`p-4 text-center font-bold ${statusColor}`}>{status}</td>
    </tr>
  );
}

function SuggestionItem({
  suggestion,
}: {
  suggestion: ScanResult["suggestions"][0];
}) {
  return (
    <div className="border-border border-t p-4">
      <div className="mb-1 text-sm font-bold">{suggestion.title}</div>
      <div className="text-light text-xs">{suggestion.effort}</div>
      <div className="mt-2 text-sm">{suggestion.description}</div>
      {suggestion.fixExample && (
        <pre
          className="mt-2 overflow-x-auto rounded text-sm"
          style={{
            backgroundColor: "#f5f5f5",
            border: "1px solid #e5e5e5",
            fontFamily: "monospace",
            lineHeight: "1.5",
            margin: 0,
            padding: "12px 16px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {suggestion.fixExample}
        </pre>
      )}
    </div>
  );
}

function Explainer() {
  return (
    <Card
      withBorder
      title="About the tier system"
      subtitle="Checks are grouped by impact"
    >
      {TIERS.map((tier) => (
        <Text
          key={tier.key}
          className="text-text my-2 text-base leading-relaxed"
          style={{ margin: 0 }}
        >
          <strong style={{ color: tier.emailColor }}>
            {tier.title.split(" — ")[0]}
          </strong>{" "}
          — {tier.description}
        </Text>
      ))}
    </Card>
  );
}
