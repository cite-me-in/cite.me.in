import { ArrowBigUpDashIcon } from "lucide-react";
import { useMemo } from "react";
import { Section, Text } from "react-email";
import { BrandReminderCard } from "~/components/email/BrandReminder";
import Button from "~/components/email/Button";
import Card from "~/components/email/Card";
import CATEGORIES from "~/lib/aiLegibility/checkDetails";
import type { CheckResult, ScanResult } from "~/lib/aiLegibility/types";
import envVars from "~/lib/envVars.server";
import prisma from "~/lib/prisma.server";
import scoreColor from "~/lib/scoreColor";
import type { Prisma } from "~/prisma";
import { sendEmail } from "./sendEmails";

export default async function sendAiLegibilityReport({
  site,
  result,
  sendTo,
}: {
  site: Prisma.SiteGetPayload<{
    select: {
      domain: true;
      citations: true;
    };
  }>;
  result: ScanResult;
  sendTo: { id: string; email: string; unsubscribed: boolean };
}) {
  const reportURL = new URL(
    `/site/${site.domain}/ai-legibility`,
    envVars.VITE_APP_URL,
  ).toString();

  await sendEmail({
    domain: site.domain,
    email: (
      <AiLegibilityReportEmail
        site={site}
        result={result}
        reportUrl={reportURL}
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

export function AiLegibilityReportEmail({
  site,
  result,
  reportUrl,
}: {
  site: Prisma.SiteGetPayload<{
    select: {
      domain: true;
      citations: true;
    };
  }>;
  result: ScanResult | string;
  reportUrl: string;
}) {
  const { checks, summary } =
    typeof result === "string" ? (JSON.parse(result) as ScanResult) : result;
  const totalPassed = useMemo(
    () =>
      summary.discovered.passed +
      summary.trusted.passed +
      summary.welcomed.passed,
    [summary],
  );
  const totalChecks = useMemo(
    () =>
      summary.discovered.total + summary.trusted.total + summary.welcomed.total,
    [summary],
  );
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
            {category.title} — {summary[category.key].passed}/
            {summary[category.key].total}
          </Text>

          {checks
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

      <BrandReminderCard site={site} />

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
