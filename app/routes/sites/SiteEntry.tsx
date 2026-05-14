import { ArrowRightIcon } from "lucide-react";
import { Link } from "react-router";
import { Streamdown } from "streamdown";
import { twMerge } from "tailwind-merge";
import { ActiveLink } from "~/components/ui/ActiveLink";
import scoreColor from "~/lib/scoreColor";
import type { Site } from "~/prisma";

export default function SiteEntry({
  site,
  queryCoverageRate,
  allCitations,
  yourCitations,
  visibilityScore,
}: {
  site: Pick<Site, "id" | "domain" | "ownerId" | "summary">;
  queryCoverageRate: { current: number; previous: number };
  allCitations: { current: number; previous: number };
  yourCitations: { current: number; previous: number };
  visibilityScore: { current: number; previous: number };
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-row items-center justify-between">
        <Link to={`/site/${site.domain}/citations`} className="font-mono text-lg font-bold">
          {site.domain}
        </Link>

        <ActiveLink variant="button" to={`/site/${site.domain}/citations`} aria-label="View site">
          View Site <ArrowRightIcon className="size-4" />
        </ActiveLink>
      </div>

      <Link to={`/site/${site.domain}/citations`} className="grid grid-cols-4 gap-4 text-center">
        <Metric
          label="Your citations"
          current={yourCitations.current}
          previous={yourCitations.previous}
        />
        <Metric
          label="All citations"
          current={allCitations.current}
          previous={allCitations.previous}
        />
        <Metric
          label="Query Coverage"
          current={queryCoverageRate.current}
          previous={queryCoverageRate.previous}
          suffix="%"
        />
        <Metric
          label="Visibility Score"
          current={visibilityScore.current}
          previous={visibilityScore.previous}
          suffix="%"
          highlightScore
        />
      </Link>

      <Streamdown
        mode="static"
        className="prose prose-sm text-foreground/60 mt-4 mb-4 line-clamp-2 max-w-none italic"
      >
        {site.summary}
      </Streamdown>
    </div>
  );
}

function Metric({
  label,
  current: value,
  previous,
  suffix,
  highlightScore,
}: {
  label: string;
  current: number;
  previous: number | null;
  suffix?: string;
  highlightScore?: boolean;
}) {
  const scoreColorValue = highlightScore ? scoreColor(value) : null;
  return (
    <div className={`metric-${label.toLowerCase().replace(" ", "-")}`}>
      <div className="font-light whitespace-nowrap">{label}</div>
      <div
        className="text-3xl font-bold tabular-nums"
        style={scoreColorValue ? { color: scoreColorValue } : undefined}
      >
        {value.toLocaleString()}
        {suffix}
      </div>
      <div className="text-muted-foreground flex items-center justify-center gap-1 text-sm">
        <Delta current={value} previous={previous} />
        {previous !== null && previous !== 0 && (
          <span className="tabular-nums">
            {previous.toLocaleString()}
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function Delta({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null) return null;
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return <span className="text-sm font-medium text-green-700">new</span>;

  const pct = Math.round(((current - previous) / previous) * 100);
  const positive = pct >= 0;
  return (
    <span
      className={twMerge(
        "font-medium text-sm tabular-nums",
        positive ? "text-green-700" : "text-red-600",
      )}
    >
      {positive ? "+" : ""}
      {pct}%
    </span>
  );
}
