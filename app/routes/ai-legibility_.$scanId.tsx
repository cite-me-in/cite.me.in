import { data, redirect } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import Main from "~/components/ui/Main";
import { getProgress } from "~/lib/aiLegibility/progress.server";
import type { ScanResult } from "~/lib/aiLegibility/types";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/ai-legibility_.$scanId";

export async function loader({ params }: Route.LoaderArgs) {
  const { scanId } = params;

  // Try to get from Redis first (recent scans)
  const progress = await getProgress({ offset: 0, scanId });

  if (progress.done && progress.result)
    return data({ ...progress.result, source: "redis" });

  // Try to find in database (saved reports for logged-in users)
  const report = await prisma.aiLegibilityReport.findFirst({
    where: { id: scanId },
    select: {
      result: true,
      url: true,
      scannedAt: true,
    },
  });

  if (report) {
    const { summary, checks, suggestions } = report.result as ScanResult;
    return data({
      ...report,
      summary,
      checks,
      suggestions,
      source: "database",
    });
  }

  // If scan is still running, redirect to main page with scanId
  if (!progress.done) throw redirect(`/ai-legibility?scanId=${scanId}`);

  throw new Response("Report not found", { status: 404 });
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData.url) return [{ title: "Report Not Found | Cite.me.in" }];

  return [
    { title: `AI Legibility Report: ${loaderData.url} | Cite.me.in` },
    {
      name: "description",
      content: `AI legibility report for ${loaderData.url} - see how readable your website is for AI agents.`,
    },
  ];
}

export default function AiLegibilityReport({
  loaderData,
}: Route.ComponentProps) {
  const { summary, url, scannedAt, checks, suggestions } = loaderData;

  return (
    <Main variant="wide">
      <div className="mx-auto max-w-4xl py-12">
        <div className="mb-8 text-center">
          <h1 className="mb-4 font-bold text-4xl text-black md:text-5xl">
            AI Legibility Report
          </h1>
          <p className="text-black/60 text-lg">{url}</p>
          <p className="mt-2 text-black/40 text-sm">
            Scanned {new Date(scannedAt).toLocaleString()}
          </p>
        </div>

        {summary && (
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            <SummaryCard
              category="Critical"
              passed={summary.critical.passed}
              total={summary.critical.total}
            />
            <SummaryCard
              category="Important"
              passed={summary.important.passed}
              total={summary.important.total}
            />
            <SummaryCard
              category="Optimization"
              passed={summary.optimization.passed}
              total={summary.optimization.total}
            />
          </div>
        )}

        {checks && checks.length > 0 && (
          <div className="mb-8 space-y-6">
            <CheckResults
              checks={checks.filter((c) => c.category === "critical")}
              title="Critical"
            />
            <CheckResults
              checks={checks.filter((c) => c.category === "important")}
              title="Important"
            />
            <CheckResults
              checks={checks.filter((c) => c.category === "optimization")}
              title="Optimization"
            />
          </div>
        )}

        {suggestions && suggestions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Suggestions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {suggestions.map((suggestion, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: suggestions are static for a report, index is stable
                  <SuggestionCard key={i} suggestion={suggestion} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Main>
  );
}

function SummaryCard({
  category,
  passed,
  total,
}: {
  category: string;
  passed: number;
  total: number;
}) {
  const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;
  const isGood = percentage === 100;
  const isWarning = percentage >= 50 && percentage < 100;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-center">
          <div
            className={`mb-2 font-bold text-3xl ${
              isGood
                ? "text-green-600"
                : isWarning
                  ? "text-yellow-600"
                  : "text-red-600"
            }`}
          >
            {passed}/{total}
          </div>
          <div className="font-medium text-foreground/60">{category}</div>
          <div className="mt-2 h-2 w-full rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${
                isGood
                  ? "bg-green-500"
                  : isWarning
                    ? "bg-yellow-500"
                    : "bg-red-500"
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CheckResults({
  checks,
  title,
}: {
  checks: ScanResult["checks"];
  title: string;
}) {
  if (checks.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {checks.map((check, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: checks are static for a report, index is stable
              key={i}
              className="flex items-start gap-3 rounded border p-3"
            >
              <span
                className={`shrink-0 font-bold ${
                  check.passed ? "text-green-600" : "text-red-600"
                }`}
              >
                {check.passed ? "✓" : "✗"}
              </span>
              <div>
                <div className="font-medium">{check.name}</div>
                <div className="text-foreground/60 text-sm">
                  {check.message}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SuggestionCard({
  suggestion,
}: {
  suggestion: ScanResult["suggestions"][0];
}) {
  const categoryColors = {
    critical: "border-red-200 bg-red-50",
    important: "border-yellow-200 bg-yellow-50",
    optimization: "border-blue-200 bg-blue-50",
  };

  const effortColors = {
    "2 min": "text-green-600",
    "5 min": "text-green-600",
    "15 min": "text-yellow-600",
    "1 hour": "text-red-600",
  };

  return (
    <div
      className={`rounded border p-4 ${categoryColors[suggestion.category]}`}
    >
      <div className="mb-2 flex items-start justify-between gap-4">
        <h4 className="font-bold">{suggestion.title}</h4>
        <span
          className={`shrink-0 font-medium text-sm ${effortColors[suggestion.effort]}`}
        >
          {suggestion.effort}
        </span>
      </div>
      <p className="text-foreground/80 text-sm leading-relaxed">
        {suggestion.description}
      </p>
      {suggestion.fixExample && (
        <pre className="mt-3 overflow-x-auto rounded bg-black/5 p-2 font-mono text-xs">
          {suggestion.fixExample}
        </pre>
      )}
    </div>
  );
}
