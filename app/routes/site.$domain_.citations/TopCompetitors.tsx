import { Link } from "react-router";
import { Badge } from "~/components/ui/Badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
import externalLink from "~/lib/externalLink";

export default function TopCompetitors({
  queries,
  ownDomain,
}: {
  queries: { citations: string[] }[];
  ownDomain: string;
}) {
  const { competitors } = topCompetitors(queries, ownDomain);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Competitors</CardTitle>
        <CardDescription>
          Domains most cited alongside your queries
        </CardDescription>
      </CardHeader>
      <CardContent>
        {competitors.length === 0 ? (
          <p className="text-foreground/60 text-sm">
            No other domains found in this run.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {competitors.map(({ domain, count, pct }) => (
              <div
                key={domain}
                className="flex items-center justify-between gap-4"
              >
                <Link
                  className="truncate font-medium"
                  to={externalLink(`https://${domain}`)}
                  target="_blank"
                >
                  {domain}
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-foreground/60">
                    {count.toLocaleString()}{" "}
                    {count === 1 ? "citation" : "citations"}
                  </span>
                  <Badge variant="neutral">{pct}%</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function topCompetitors(
  queries: { citations: string[] }[],
  ownDomain: string,
): {
  total: number;
  competitors: { domain: string; count: number; pct: number }[];
} {
  const counts = new Map<string, number>();
  let total = 0;
  for (const query of queries) {
    for (const url of query.citations) {
      try {
        const hostname = new URL(url).hostname.replace(/^www\./, "");
        total++;
        if (hostname !== ownDomain)
          counts.set(hostname, (counts.get(hostname) ?? 0) + 1);
      } catch {
        /* skip invalid URLs */
      }
    }
  }
  return {
    total,
    competitors: [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([domain, count]) => ({
        domain,
        count,
        pct: Math.round((count / total) * 100),
      })),
  };
}
