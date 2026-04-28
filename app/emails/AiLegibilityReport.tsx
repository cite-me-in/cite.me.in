import { Section, Text } from "react-email";
import { BrandReminderCard } from "~/components/email/BrandReminder";
import Button from "~/components/email/Button";
import Card from "~/components/email/Card";
import CATEGORIES from "~/lib/aiLegibility/criteria";
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
    result.summary.discovered.passed +
    result.summary.trusted.passed +
    result.summary.welcomed.passed;
  const totalChecks =
    result.summary.discovered.total +
    result.summary.trusted.total +
    result.summary.welcomed.total;

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
        {CATEGORIES.map((category) => (
          <SummaryRow
            key={category.key}
            category={category.title}
            passed={result.summary[category.key].passed}
            total={result.summary[category.key].total}
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

function Explainer() {
  return (
    <Card
      withBorder
      title="About the categories"
      subtitle="Checks are grouped by type"
    >
      <div className="mb-6">
        {CATEGORIES.map((category) => (
          <Text className="text-text text-base leading-relaxed">
            <strong style={{ color: category.emailColor }}>
              {category.title}
            </strong>{" "}
            — {category.description}
          </Text>
        ))}
      </div>
    </Card>
  );
}
