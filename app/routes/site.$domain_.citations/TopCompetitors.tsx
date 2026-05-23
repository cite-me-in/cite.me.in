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
import nonCompetitors from "./nonCompetitors";

export default function TopCompetitors({
  competitors,
  shareOfVoice,
}: {
  competitors: {
    domain: string;
    brandName: string;
    url: string;
    count: number;
    pct: number;
  }[];
  shareOfVoice: {
    count: number;
    pct: number;
    breakdown?: { direct: number; indirect: number };
  };
}) {
  const { breakdown } = shareOfVoice;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Competitors</CardTitle>
        <CardDescription className="text-foreground/60">
          Domains most cited alongside yours
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="border-border/20 mb-4 border-t-2 border-b-2 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="font-medium">Your share of voice</span>
              {breakdown && (
                <span className="text-foreground/50 text-xs">
                  {breakdown.direct} direct + {breakdown.indirect} indirect
                  (×0.5)
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-foreground/60">
                {shareOfVoice.count.toLocaleString()}{" "}
                {shareOfVoice.count === 1 ? "citation" : "citations"}
              </span>
              <Badge variant="green">{shareOfVoice.pct}%</Badge>
            </div>
          </div>
        </div>

        {competitors.length === 0 ? (
          <p className="text-foreground/60 text-sm">
            No other domains found in this run.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {competitors.map(({ domain, brandName, url, count, pct }) => (
              <div
                key={domain}
                className="flex items-center justify-between gap-4"
              >
                <Link
                  className="flex items-center gap-2 truncate font-medium"
                  to={externalLink(url)}
                  target="_blank"
                >
                  <span>{brandName}</span>
                  <code className="text-foreground/60 text-xs">
                    {new URL(url).hostname}
                  </code>
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
  citations: { url: string; domain: string }[],
  ownDomain: string,
  classifiedUrls?: Set<string>,
): {
  total: number;
  ownCitations: number;
  competitors: { domain: string; count: number; pct: number }[];
} {
  const counts = new Map<string, number>();
  let total = 0;
  let ownCitations = 0;
  for (const { url, domain } of citations) {
    if (!domain) continue;
    total++;
    if (domain === ownDomain) {
      ownCitations++;
    } else if (
      !nonCompetitors.has(domain) &&
      !nonCompetitors.has(domain.split(".").slice(1).join("."))
    ) {
      const isClassified = classifiedUrls?.has(url) ?? false;
      if (!isClassified) {
        counts.set(domain, (counts.get(domain) ?? 0) + 1);
      }
    }
  }
  return {
    total,
    ownCitations,
    competitors: [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([domain, count]) => ({
        domain,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
      })),
  };
}
