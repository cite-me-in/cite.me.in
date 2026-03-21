import { Badge } from "~/components/ui/Badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
import type { SentimentLabel } from "~/prisma";

export default function BrandSentiment({
  run,
}: {
  run: {
    sentimentLabel: SentimentLabel | null;
    sentimentSummary: string | null;
  };
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
            {run.sentimentSummary && <p>{run.sentimentSummary}</p>}
          </div>
        ) : (
          <p className="text-foreground/60">
            No analysis available for this run.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SentimentBadge({ label }: { label: SentimentLabel }) {
  switch (label) {
    case "positive":
      return <Badge variant="green">Positive</Badge>;
    case "negative":
      return <Badge variant="red">Negative</Badge>;
    case "mixed":
      return <Badge variant="yellow">Mixed</Badge>;
    default:
      return <Badge variant="neutral">Neutral</Badge>;
  }
}
