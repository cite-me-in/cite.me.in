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
  platformLabel,
  sentiment,
}: {
  platformLabel: string;
  sentiment?: {
    sentimentLabel: SentimentLabel | null;
    sentimentSummary: string | null;
  };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Brand Sentiment</CardTitle>
        <CardDescription className="text-foreground/60">
          How {platformLabel} talks about your brand
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sentiment?.sentimentLabel ? (
          <div className="flex flex-col gap-3">
            <SentimentBadge label={sentiment.sentimentLabel} />
            {sentiment.sentimentSummary && <p>{sentiment.sentimentSummary}</p>}
          </div>
        ) : (
          <p className="text-foreground/60">
            No sentiment analysis available for {platformLabel}.
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
