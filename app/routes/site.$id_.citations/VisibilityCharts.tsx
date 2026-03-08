import { captureException as sentryCaptureException } from "@sentry/react-router";
import { mean } from "es-toolkit";
import { Component } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "~/components/ui/Chart";
import type { Run } from "./RecentVisibility";

class ChartErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    sentryCaptureException(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-foreground/60 text-sm">Chart unavailable</div>
      );
    }
    return this.props.children;
  }
}

const chartConfig = {
  visibilityPct: { label: "Visibility %", color: "var(--chart-1)" },
  citationRatio: { label: "Citation Ratio %", color: "var(--chart-3)" },
  score: { label: "Score", color: "var(--chart-4)" },
} satisfies ChartConfig;

const CHART_KEYS = ["visibilityPct", "citationRatio", "score"] as const;
type ChartKey = (typeof CHART_KEYS)[number];

type RunPoint = { date: string } & Record<ChartKey, number>;

function runToPoint(run: Run): RunPoint {
  const { queries } = run;
  if (queries.length === 0) {
    return {
      date: run.createdAt.toISOString().slice(0, 10),
      visibilityPct: 0,
      citationRatio: 0,
      score: 0,
    };
  }

  const visibilityPct = mean(
    queries.map((q) => (q.position !== null ? 100 : 0)),
  );
  const citationRatio =
    mean(
      queries.map((q) =>
        q.position !== null && q.citations.length > 0
          ? (1 / q.citations.length) * 100
          : 0,
      ),
    ) || 0;
  const score =
    mean(
      queries.map((q) => {
        if (q.position === null) return 0;
        if (q.position === 0) return 50;
        return Math.max(0, 10 * (q.citations.length - q.position));
      }),
    ) || 0;

  return {
    date: run.createdAt.toISOString().slice(0, 10),
    visibilityPct: +visibilityPct.toFixed(1),
    citationRatio: +citationRatio.toFixed(1),
    score: +score.toFixed(1),
  };
}

export default function VisibilityCharts({ runs }: { runs: Run[] }) {
  const data = runs.map(runToPoint);

  return (
    <ChartErrorBoundary>
      <div className="grid gap-4 md:grid-cols-3">
        {CHART_KEYS.map((key) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle>{chartConfig[key].label}</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-36 w-full">
                <AreaChart data={data}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={false}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey={key}
                    stroke={`var(--color-${key})`}
                    fill={`var(--color-${key})`}
                    fillOpacity={0.2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        ))}
      </div>
    </ChartErrorBoundary>
  );
}
