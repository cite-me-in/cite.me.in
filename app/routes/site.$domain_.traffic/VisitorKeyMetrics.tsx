import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";

export default function VisitorKeyMetrics({
  totalVisitors,
  totalPageViews,
  aiReferredVisitors,
  aiPct,
}: {
  totalVisitors: number;
  totalPageViews: number;
  aiReferredVisitors: number;
  aiPct: number;
}) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {[
        { label: "Unique Visitors", value: totalVisitors.toLocaleString() },
        { label: "Page Views", value: totalPageViews.toLocaleString() },
        {
          label: "AI-Referred Visitors",
          value: aiReferredVisitors.toLocaleString(),
        },
        { label: "% from AI", value: `${aiPct.toFixed(2)}%` },
      ].map(({ label, value }) => (
        <Card key={label}>
          <CardHeader className="text-center">
            <CardDescription className="text-foreground/60">
              {label}
            </CardDescription>
            <CardTitle>{value}</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
