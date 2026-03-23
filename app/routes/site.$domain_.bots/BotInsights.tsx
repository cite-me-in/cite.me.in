import { BrainIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
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
      <CardContent>{insight.content}</CardContent>
      <CardFooter className="text-foreground/50 text-xs">
        Updated {formatDateShort(insight.generatedAt)}
      </CardFooter>
    </Card>
  );
}
