import { BrainIcon } from "lucide-react";
import { Streamdown } from "streamdown";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/Card";
import { formatDateShort } from "~/lib/formatDate";

export default function BotInsights({
  insight,
}: {
  insight: {
    content: string;
    generatedAt: Date;
  };
}) {
  return (
    <Card variant="yellow">
      <CardHeader>
        <CardTitle>
          <BrainIcon className="size-6" />
          Bot Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Streamdown
          mode="static"
          className="prose prose-sm text-foreground/60 mt-4 mb-4 line-clamp-2 max-w-none italic"
        >
          {insight.content}
        </Streamdown>
      </CardContent>
      <CardFooter className="text-foreground/50 text-xs">
        Updated {formatDateShort(insight.generatedAt)}
      </CardFooter>
    </Card>
  );
}
