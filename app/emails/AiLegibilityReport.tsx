import { ArrowBigUpDashIcon } from "lucide-react";
import { Section, Text } from "react-email";
import { BrandReminderCard } from "~/components/email/BrandReminder";
import Button from "~/components/email/Button";
import Card from "~/components/email/Card";
import CATEGORIES from "~/lib/aiLegibility/criteria";
import type { CheckResult, ScanResult } from "~/lib/aiLegibility/types";
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

const SCORE_COLORS = [
  { max: 35, color: "#dc2626" },
  { max: 65, color: "#eab308" },
  { max: 100, color: "#16a34a" },
];

function scoreColor(score: number) {
  for (const { max, color } of SCORE_COLORS) if (score <= max) return color;
  return "#16a34a";
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

      <Card withBorder>
        <Text className="text-light text-lg">Site AI legibility score</Text>
        <Text
          className="text-4xl font-bold"
          style={{ color: scoreColor(score) }}
        >
          {score}
        </Text>
        <Text className="text-light text-sm">
          {totalPassed} of {totalChecks} checks passed
        </Text>
      </Card>

      <Section className="my-8 text-center">
        <Button href={reportUrl} className="whitespace-nowrap">
          <ArrowBigUpDashIcon className="mr-2 -mb-0.5 size-4" />
          Improve your score
        </Button>
      </Section>

      {CATEGORIES.map((category) => (
        <Section key={category.key} className="mb-6">
          <Text
            className="text-base font-bold tracking-wide uppercase"
            style={{ color: category.emailColor }}
          >
            {category.title} — {result.summary[category.key].passed}/
            {result.summary[category.key].total}
          </Text>

          {result.checks
            .filter((c) => c.category === category.key)
            .map((check) =>
              check.passed ? (
                <CheckPassed key={check.name} check={check} />
              ) : (
                <CheckFailed key={check.name} check={check} />
              ),
            )}
        </Section>
      ))}

      <Section className="my-8 text-center">
        <Button href={reportUrl} className="whitespace-nowrap">
          <ArrowBigUpDashIcon className="mr-2 -mb-0.5 size-4" />
          View Full Report
        </Button>
      </Section>

      <BrandReminderCard domain={site.domain} citations={totalPassed} />

      <Text className="text-text my-4 text-base leading-relaxed">
        Best regards,
        <br />
        The Cite.me.in Team
      </Text>
    </Section>
  );
}

function CheckPassed({ check }: { check: CheckResult }) {
  return (
    <Card withBorder className="pb-1">
      <Text className="mt-1 mb-3 text-base text-green-600">✓ {check.name}</Text>
    </Card>
  );
}

function CheckFailed({ check }: { check: CheckResult }) {
  return (
    <Card withBorder className="pb-1">
      <Text className="my-1 text-base font-bold text-red-600">
        ✗ {check.name}
      </Text>

      <div
        style={{
          height: "1px",
          backgroundColor: "#e5e7eb",
          margin: "8px 0",
        }}
      />

      {check.detail && (
        <>
          <DetailBlock label="Goal">{check.detail.goal}</DetailBlock>
          <DetailBlock label="Issue">{check.detail.issue}</DetailBlock>
          <DetailBlock label="How to implement">
            {check.detail.howToImplement}
          </DetailBlock>
          {check.detail.fixExample && (
            <DetailBlock label="Example">
              <pre
                style={{
                  background: "#1e293b",
                  color: "#e2e8f0",
                  padding: "12px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  lineHeight: "1.5",
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {check.detail.fixExample}
              </pre>
            </DetailBlock>
          )}
        </>
      )}
    </Card>
  );
}

function DetailBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-text my-2 text-base leading-relaxed">
      <strong>{label}:</strong>
      <br />
      {children}
    </div>
  );
}
