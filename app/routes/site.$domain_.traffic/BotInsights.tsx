import { BrainIcon } from "lucide-react";
import { Streamdown } from "streamdown";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";

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
          className="prose prose-sm max-w-none text-foreground/60 italic"
        >
          {insight.content}
        </Streamdown>
      </CardContent>
    </Card>
  );
}
