import { Section, Text } from "react-email";
import { BrandReminderCard } from "~/components/email/BrandReminder";
import Button from "~/components/email/Button";
import Card from "~/components/email/Card";
import Link from "~/components/email/Link";
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
      <Text className="my-4 text-base text-text leading-relaxed">
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
            // biome-ignore lint/suspicious/noArrayIndexKey: suggestions are static for a report, index is stable
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

      <Text className="my-4 text-base text-text leading-relaxed">
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
        <tr className="text-center text-light text-xs uppercase tracking-wide">
          <th className="p-4 text-left">Category</th>
          <th className="p-4">Passed</th>
          <th className="p-4">Status</th>
        </tr>
      </thead>
      <tbody>
        <SummaryRow
          category="Critical"
          passed={result.summary.critical.passed}
          total={result.summary.critical.total}
        />
        <SummaryRow
          category="Important"
          passed={result.summary.important.passed}
          total={result.summary.important.total}
        />
        <SummaryRow
          category="Optimization"
          passed={result.summary.optimization.passed}
          total={result.summary.optimization.total}
        />
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
      <div className="mb-1 font-bold text-sm">{suggestion.title}</div>
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
