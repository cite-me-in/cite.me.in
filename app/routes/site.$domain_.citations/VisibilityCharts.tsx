import { Link } from "react-router";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "~/components/ui/Chart";
import { formatDateMed } from "~/lib/formatDate";
import calculateVisibilityScore from "~/lib/llm-visibility/calculateVisibilityScore";
import type { Citation } from "~/prisma";

const charts: {
  config: Record<string, { label: string; color: string }>;
  dataKey: string;
  name: string;
  color: string;
  explainer: string;
  explainerLink?: string;
}[] = [
  {
    config: {
      citations: { label: "Citations", color: "var(--chart-3)" },
    },
    dataKey: "citations",
    name: "Citations",
    color: "var(--chart-3)",
    explainer: "Count of citations that reference this site.",
  },
  {
    config: {
      score: { label: "Visibility Score", color: "var(--chart-4)" },
    },
    dataKey: "score",
    name: "Visibility Score",
    color: "var(--chart-4)",
    explainer: "Visibility score (0-100). See how it's calculated.",
    explainerLink: "/visibility-score",
  },
] as const;

export default function VisibilityCharts({
  recentRuns: runs,
  site,
  classifications,
}: {
  recentRuns: {
    id: string;
    onDate: string;
    queries: { citations: { url: string }[]; text: string }[];
  }[];
  site: { id: string; domain: string };
  classifications: Pick<Citation, "url" | "relationship" | "runId">[];
}) {
  const data = runs
    .map((run) => runToPoint(run, site, classifications))
    .reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Citation / Score Trend</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {charts.map((chart) => (
          <div key={chart.dataKey}>
            <ChartContainer config={chart.config} className="h-36 w-full">
              <AreaChart data={data}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => formatDateMed(new Date(value))}
                />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey={chart.dataKey}
                  name={chart.name}
                  fill={chart.color}
                  stroke={chart.color}
                  strokeWidth={2}
                  type="monotone"
                />
              </AreaChart>
            </ChartContainer>
            <p className="text-center text-foreground/60 text-sm">
              {chart.explainer}
              {chart.explainerLink && (
                <>
                  {" "}
                  <Link to={chart.explainerLink} className="underline">
                    Learn more
                  </Link>
                  .
                </>
              )}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function runToPoint(
  run: {
    id: string;
    onDate: string;
    queries: { citations: { url: string }[]; text: string }[];
  },
  site: { id: string; domain: string },
  classifications: Pick<Citation, "url" | "relationship" | "runId">[],
): {
  date: string;
  citations: number;
  score: number;
  coverage: number;
} {
  const runClassifications = classifications
    .filter((c) => c.runId === run.id && c.relationship !== null)
    .map((c) => ({ url: c.url, relationship: c.relationship as string }));
  const { visibilityScore, domainCitations, queryCoverageRate } =
    calculateVisibilityScore({
      domain: site.domain,
      queries: run.queries.map((q) => ({
        citations: q.citations.map((c) => c.url),
        text: q.text,
      })),
      classifications: runClassifications,
    });

  return {
    date: run.onDate,
    citations: domainCitations,
    score: visibilityScore,
    coverage: queryCoverageRate,
  };
}
