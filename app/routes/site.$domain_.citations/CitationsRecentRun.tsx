import { sortBy } from "es-toolkit";
import { ArrowRightIcon } from "lucide-react";
import { Link } from "react-router";
import { twMerge } from "tailwind-merge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/Table";
import type { Prisma } from "~/prisma";

export default function RecentVisibility({
  lastRun,
  site,
}: {
  lastRun: Prisma.CitationQueryRunGetPayload<{ include: { queries: true } }>;
  site: { id: string; domain: string };
}) {
  const queries = sortBy(lastRun.queries, ["group", "query"]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Most Recent Run</CardTitle>
        <CardDescription>
          {lastRun.model} · {queries.length} checks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-bold text-foreground">Group</TableHead>
              <TableHead className="font-bold text-foreground">Query</TableHead>
              <TableHead className="text-right font-bold text-foreground">
                Positions
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {queries.map((query) => (
              <TableRow
                key={query.id}
                className={twMerge(
                  query.citations.some(
                    (c) => new URL(c).hostname === site.domain,
                  ) && "bg-green-100 hover:bg-green-100/80",
                )}
              >
                <TableCell className="text-foreground/60 text-xs">
                  {query.group}
                </TableCell>
                <TableCell className="max-w-xs truncate">
                  {query.query}
                </TableCell>
                <TableCell className="text-right">
                  {positions(query.citations, site.domain)}
                </TableCell>
                <TableCell className="text-right">
                  <Link to={`/site/${site.id}/citation/${query.id}`}>
                    <ArrowRightIcon className="size-4" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function positions(citations: string[], domain: string) {
  const all = citations
    .map((citation, index) =>
      new URL(citation).hostname === domain ? index + 1 : null,
    )
    .filter((position) => position !== null);
  return all.length === 0
    ? null
    : all.length > 5
      ? `${all.slice(0, 5).join(", ")}, …`
      : all.join(", ");
}
