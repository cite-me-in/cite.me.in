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
import { normalizeURL } from "~/lib/isSameDomain";

export default function LatestResults({
  queries,
  meta,
  site,
  classifications,
}: {
  queries: {
    id: string;
    group: string;
    query: string;
    citations: { url: string; relationship: string | null }[];
    onDate: string;
  }[];
  meta: { model: string } | undefined;
  site: { id: string; domain: string };
  classifications: {
    exact: string[];
    direct: { url: string; reason: string | null }[];
    indirect: { url: string; reason: string | null }[];
  };
}) {
  const directUrls = new Set([
    ...classifications.exact,
    ...classifications.direct.map((c) => normalizeURL(c.url)),
  ]);
  const indirectUrls = new Set(
    classifications.indirect.map((c) => normalizeURL(c.url)),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest Results</CardTitle>
        <CardDescription className="text-foreground/60">
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
                Citations
              </TableHead>
              <TableHead className="text-right font-bold text-foreground">
                Date
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {queries.map((query) => {
              const hasDirect = query.citations.some((c) =>
                directUrls.has(normalizeURL(c.url)),
              );
              const hasIndirect = query.citations.some((c) =>
                indirectUrls.has(normalizeURL(c.url)),
              );

              return (
                <TableRow
                  key={query.id}
                  className={twMerge(
                    hasDirect && "bg-green-100 hover:bg-green-100/80",
                    !hasDirect &&
                      hasIndirect &&
                      "bg-blue-50 hover:bg-blue-50/80",
                  )}
                >
                  <TableCell className="text-foreground/60 text-xs">
                    {query.group}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {query.query}
                  </TableCell>
                  <TableCell className="text-right">
                    {citationCounts(
                      query.citations.map((c) => c.url),
                      directUrls,
                      indirectUrls,
                    )}
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
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function citationCounts(
  citations: string[],
  directUrls: Set<string>,
  indirectUrls: Set<string>,
) {
  let direct = 0;
  let indirect = 0;

  for (const citation of citations) {
    const normalized = normalizeURL(citation);
    if (directUrls.has(normalized)) {
      direct++;
    } else if (indirectUrls.has(normalized)) {
      indirect++;
    }
  }

  if (direct === 0 && indirect === 0) return null;

  const parts = [];
  if (direct > 0) parts.push(`${direct} direct`);
  if (indirect > 0) parts.push(`${indirect} indirect`);
  return parts.join(", ");
}
