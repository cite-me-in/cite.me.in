import { sum } from "radashi";
import type { SentimentLabel } from "~/prisma";
import Card from "./Card";
import KeyMetrics from "./KeyMetric";

export default function PlatformBreakdown({
  byPlatform,
}: {
  byPlatform: {
    [k: string]: {
      count: number;
      sentimentLabel: SentimentLabel;
      sentimentSummary: string;
    };
  };
}) {
  const first4 = Object.entries(byPlatform).slice(0, 4);
  const total = sum(first4, ([, { count }]) => count);
  if (total === 0) return null;

  return (
    <Card title="Citations by platform" className="pb-8">
      <KeyMetrics
        metrics={first4.map(([platform, { count }]) => ({
          label: platform,
          current: `${((count / total) * 100).toFixed(1)}%`,
          count,
        }))}
      />
    </Card>
  );
}
