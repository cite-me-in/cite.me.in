import { ArrowRightIcon } from "lucide-react";
import { Link } from "react-router";
import { Streamdown } from "streamdown";
import { twMerge } from "tailwind-merge";
import { ActiveLink } from "~/components/ui/ActiveLink";
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
        <Link
          to={`/site/${site.domain}/citations`}
          className="font-bold font-mono text-lg"
        >
          {site.domain}
        </Link>

        <ActiveLink
          variant="button"
          to={`/site/${site.domain}/citations`}
          aria-label="View site"
        >
          View Site <ArrowRightIcon className="size-4" />
        </ActiveLink>
      </div>

      <Link
        to={`/site/${site.domain}/citations`}
        className="grid grid-cols-4 gap-4 text-center"
      >
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
        className="prose prose-sm mt-4 mb-4 line-clamp-2 max-w-none text-foreground/60 italic"
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
  const scoreColor = highlightScore ? getScoreColor(value) : null;
  return (
    <div className={`metric-${label.toLowerCase().replace(" ", "-")}`}>
      <div className="whitespace-nowrap font-light">{label}</div>
      <div
        className={twMerge(
          "font-bold text-3xl tabular-nums",
          scoreColor === "green" && "text-green-600",
          scoreColor === "red" && "text-red-600",
        )}
      >
        {value.toLocaleString()}
        {suffix}
      </div>
      <div className="flex items-center justify-center gap-1 text-muted-foreground text-sm">
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

function getScoreColor(score: number): "green" | "gray" | "red" {
  if (score >= 70) return "green";
  if (score >= 30) return "gray";
  return "red";
}

function Delta({
  current,
  previous,
}: {
  current: number;
  previous: number | null;
}) {
  if (previous === null) return null;
  if (previous === 0 && current === 0) return null;
  if (previous === 0)
    return <span className="font-medium text-green-700 text-sm">new</span>;

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
