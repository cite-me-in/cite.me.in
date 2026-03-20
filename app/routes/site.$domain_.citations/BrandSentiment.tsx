import { Badge } from "~/components/ui/Badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
import type { SentimentLabel } from "~/prisma";

function SentimentBadge({ label }: { label: SentimentLabel }) {
  if (label === "positive")
    return (
      <Badge className="bg-green-500 text-white border-green-600">
        Positive
      </Badge>
    );
  if (label === "negative")
    return (
      <Badge className="bg-red-500 text-white border-red-600">Negative</Badge>
    );
  if (label === "mixed") return <Badge variant="yellow">Mixed</Badge>;
  return <Badge variant="neutral">Neutral</Badge>;
}

export default function BrandSentiment({
  run,
}: {
  run: { sentimentLabel: SentimentLabel | null; sentimentSummary: string | null };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Brand Sentiment</CardTitle>
        <CardDescription>
          How this platform talks about your brand
        </CardDescription>
      </CardHeader>
      <CardContent>
        {run.sentimentLabel ? (
          <div className="flex flex-col gap-3">
            <SentimentBadge label={run.sentimentLabel} />
            {run.sentimentSummary && (
              <p className="text-sm">{run.sentimentSummary}</p>
            )}
          </div>
        ) : (
          <p className="text-foreground/60 text-sm">
            No analysis available for this run.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
