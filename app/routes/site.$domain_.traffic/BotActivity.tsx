import { Fragment } from "react";
import { Badge } from "~/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/Table";

const CLASS_LABELS: Record<string, { label: string; description: string }> = {
  retrieval: {
    description: "AI answering a user question about your site right now",
    label: "Retrieval",
  },
  search_indexing: {
    description: "AI building an index for future answers",
    label: "Search Indexing",
  },
  training: {
    description: "AI training on your content",
    label: "Training",
  },
  other: {
    description: "Monitoring, testing, or other bots",
    label: "Other",
  },
};

export default function BotActivity({
  botActivity,
}: {
  botActivity: {
    botClass: string;
    botType: string;
    total: number;
    uniquePaths: number;
    accepts: string[];
  }[];
}) {
  const grouped = botActivity.reduce(
    (acc, bot) => {
      const cls = bot.botClass ?? "other";
      if (!acc[cls]) acc[cls] = [];
      acc[cls].push(bot);
      return acc;
    },
    {} as Record<string, typeof botActivity>,
  );

  const classOrder = ["retrieval", "search_indexing", "training", "other"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bot Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-2/3 font-bold">Bot</TableHead>
              <TableHead className="text-right font-bold">Visits</TableHead>
              <TableHead className="text-right font-bold">Paths</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classOrder.map((cls) => {
              const bots = grouped[cls];
              if (!bots || bots.length === 0) return null;
              const info = CLASS_LABELS[cls] ?? CLASS_LABELS.other;
              return (
                <Fragment key={cls}>
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={3} className="py-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={cls === "retrieval" ? "default" : "neutral"}
                        >
                          {info.label}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {info.description}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                  {bots.map((row) => (
                    <TableRow key={row.botType}>
                      <TableCell className="pl-6 font-medium">
                        {row.botType}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.total.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.uniquePaths}
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
