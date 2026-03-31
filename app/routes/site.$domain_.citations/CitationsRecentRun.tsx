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
import { formatDateShort } from "~/lib/formatDate";
import { isSameDomain } from "~/lib/isSameDomain";

export default function RecentVisibility({
  queries,
  meta,
  site,
}: {
  queries: {
    id: string;
    group: string;
    query: string;
    citations: string[];
    onDate: string;
  }[];
  meta: { model: string } | undefined;
  site: { id: string; domain: string };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest Results</CardTitle>
        <CardDescription>
          {meta?.model} · {queries.length} queries
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
              <TableHead className="text-right font-bold text-foreground">
                Date
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {queries.map((query) => (
              <TableRow
                key={query.id}
                className={twMerge(
                  query.citations.some((c) =>
                    isSameDomain({ domain: site.domain, url: c }),
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
                <TableCell className="text-right text-foreground/60 text-xs">
                  {formatDateShort(new Date(query.onDate))}
                </TableCell>
                <TableCell className="text-right">
                  <Link to={`/site/${site.domain}/citation/${query.id}`}>
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
      isSameDomain({ domain, url: citation }) ? index + 1 : null,
    )
    .filter((position) => position !== null);
  return all.length === 0
    ? null
    : all.length > 5
      ? `${all.slice(0, 5).join(", ")}, …`
      : all.join(", ");
}
