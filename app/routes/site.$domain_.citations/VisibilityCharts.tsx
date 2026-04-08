import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "~/components/ui/Chart";
import { formatDateMed } from "~/lib/formatDate";
import calculateVisibilityScore from "~/lib/llm-visibility/calculateVisibilityScore";
import type { Prisma } from "~/prisma";

const charts = [
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
    explainer:
      "Composite visibility score (0-100) weighting query coverage (35%), position-decayed citation rank (30%), share of voice (20%), and soft text mentions (15%).",
  },
  {
    config: {
      coverage: { label: "Query Coverage", color: "var(--chart-2)" },
    },
    dataKey: "coverage",
    name: "Query Coverage",
    color: "var(--chart-2)",
    explainer:
      "Percentage of queries (0-100) where this site appears in citations.",
  },
] as const;

export default function VisibilityCharts({
  recentRuns: runs,
  site,
}: {
  recentRuns: Prisma.CitationQueryRunGetPayload<{
    include: { queries: true };
  }>[];
  site: { id: string; domain: string };
}) {
  const data = runs.map((run) => runToPoint(run, site));

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
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function runToPoint(
  run: Prisma.CitationQueryRunGetPayload<{
    include: { queries: true };
  }>,
  site: { id: string; domain: string },
): {
  date: string;
  citations: number;
  score: number;
  coverage: number;
} {
  const { visibilityScore, domainCitations, queryCoverageRate } =
    calculateVisibilityScore({
      domain: site.domain,
      queries: run.queries,
    });

  return {
    date: run.onDate,
    citations: domainCitations,
    score: visibilityScore,
    coverage: queryCoverageRate,
  };
}
