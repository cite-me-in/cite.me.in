import { ArrowRightIcon } from "lucide-react";
import { Link, type useFetcher } from "react-router";
import { Streamdown } from "streamdown";
import { twMerge } from "tailwind-merge";
import { ActiveLink } from "~/components/ui/ActiveLink";
import type { Site } from "~/prisma";
import DeleteSiteDialog from "./DeleteSiteDialog";
import type { action } from "./route";

export default function SiteEntry({
  citationsToDmain,
  fetcher,
  previousCitationsToDomain,
  previousScore,
  score,
  site,
  totalBotVisits,
  uniqueBots,
}: {
  citationsToDmain: number;
  fetcher: ReturnType<typeof useFetcher<typeof action>>;
  previousCitationsToDomain: number | null;
  previousScore: number | null;
  score: number;
  site: Site;
  totalBotVisits: number;
  uniqueBots: number;
}) {
  const isSubmitting = fetcher.state === "submitting";

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
          label="Citations"
          value={citationsToDmain}
          previous={previousCitationsToDomain}
        />
        <Metric label="Score" value={score} previous={previousScore} />
        <Metric label="Bot Visits" value={totalBotVisits} previous={null} />
        <Metric label="Unique Bots" value={uniqueBots} previous={null} />
      </Link>

      <Streamdown
        mode="static"
        className="prose prose-sm mt-4 line-clamp-2 max-w-none text-foreground/60"
      >
        {site.summary}
      </Streamdown>

      <div className="flex justify-between">
        <DeleteSiteDialog
          domain={site.domain}
          onConfirm={() => {
            fetcher.submit({ siteId: site.id }, { method: "DELETE" });
          }}
          isSubmitting={isSubmitting}
        />
      </div>

      <div className="mt-4" />
    </div>
  );
}

function Metric({
  label,
  value,
  previous,
}: {
  label: string;
  value: number;
  previous: number | null;
}) {
  return (
    <div className={`metric-${label.toLowerCase().replace(" ", "-")}`}>
      <div className="font-light">{label}</div>
      <div className="font-bold text-3xl tabular-nums">
        {value.toLocaleString()}
      </div>
      <div className="flex items-center justify-center gap-1 text-muted-foreground text-sm">
        <Delta current={value} previous={previous} />
        {previous !== null && previous !== 0 && (
          <span className="tabular-nums">{previous.toLocaleString()}</span>
        )}
      </div>
    </div>
  );
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
