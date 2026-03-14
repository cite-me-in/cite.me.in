import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";

export default function BotKeyMetrics({
  totalVisits,
  uniqueBots,
  period,
}: {
  totalVisits: number;
  uniqueBots: number;
  period: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {[
        { label: "Total Visits", value: totalVisits.toLocaleString() },
        { label: "Unique Bots", value: uniqueBots },
        {
          label: "Avg Daily Visits",
          value: Math.round(totalVisits / period).toLocaleString(),
        },
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
