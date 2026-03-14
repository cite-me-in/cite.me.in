import { BrainIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";

export default function BotInsights({
  insight,
}: {
  insight: {
    content: string;
    generatedAt: Date;
  };
}) {
  const format = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <Card variant="yellow">
      <CardHeader>
        <CardTitle>
          <BrainIcon className="size-6" />
          Bot Insights
        </CardTitle>
      </CardHeader>
      <CardContent>{insight.content}</CardContent>
      <CardFooter className="text-foreground/50 text-xs">
        Updated {format.format(new Date(insight.generatedAt))}
      </CardFooter>
    </Card>
  );
}
