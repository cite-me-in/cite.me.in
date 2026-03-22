import { ArrowRightIcon } from "lucide-react";
import { Link, type useFetcher } from "react-router";
import { Streamdown } from "streamdown";
import { ActiveLink } from "~/components/ui/ActiveLink";
import type { Site } from "~/prisma";
import DeleteSiteDialog from "./DeleteSiteDialog";
import type { action } from "./route";

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
      className={`font-medium text-sm ${positive ? "text-green-700" : "text-red-600"}`}
    >
      {positive ? "+" : ""}
      {pct}%
    </span>
  );
}

export default function SiteEntry({
  citationsToDmain,
  fetcher,
  isOwner,
  previousCitationsToDomain,
  previousScore,
  score,
  site,
  totalBotVisits,
  uniqueBots,
}: {
  citationsToDmain: number;
  fetcher: ReturnType<typeof useFetcher<typeof action>>;
  isOwner: boolean;
  previousCitationsToDomain: number | null;
  previousScore: number | null;
  score: number;
  site: Site;
  totalBotVisits: number;
  uniqueBots: number;
}) {
  const isSubmitting = fetcher.state === "submitting";

  return (
    <div
      className={
        "block py-4 first:pt-0 last:pb-0" // preserve space-y-4 effect; optional
      }
      key={site.id}
    >
      <p className="flex flex-row items-center justify-between">
        <span className="flex flex-row items-center gap-2">
          <Link
            to={`/site/${site.domain}/citations`}
            className="font-bold font-mono text-lg"
          >
            {site.domain}
          </Link>
          <span className="text-muted-foreground text-xs">
            {isOwner ? "Owner" : "Member"}
          </span>
        </span>
        <ActiveLink
          variant="button"
          to={`/site/${site.domain}/citations`}
          aria-label="View site"
        >
          View Site <ArrowRightIcon className="size-4" />
        </ActiveLink>
      </p>
      <Link
        to={`/site/${site.domain}/citations`}
        className="mt-4 grid grid-cols-4 gap-4 text-center"
      >
        <div>
          <p className="font-light">Citations</p>
          <p className="font-bold text-3xl">
            {citationsToDmain.toLocaleString()}
          </p>
          <div className="flex items-center justify-center gap-1 text-muted-foreground text-sm">
            <Delta
              current={citationsToDmain}
              previous={previousCitationsToDomain}
            />
            {previousCitationsToDomain !== null &&
              previousCitationsToDomain !== 0 && (
                <span>{previousCitationsToDomain.toLocaleString()}</span>
              )}
          </div>
        </div>
        <div>
          <p className="font-light">Score</p>
          <p className="font-bold text-3xl">{score.toFixed(1)}</p>
          <div className="flex items-center justify-center gap-1 text-muted-foreground text-sm">
            <Delta current={score} previous={previousScore} />
            {previousScore !== null && previousScore !== 0 && (
              <span>{previousScore.toFixed(1)}</span>
            )}
          </div>
        </div>
        <div>
          <p className="font-light">Bot Visits</p>
          <p className="font-bold text-3xl">
            {totalBotVisits.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="font-light">Unique Bots</p>
          <p className="font-bold text-3xl">{uniqueBots.toLocaleString()}</p>
        </div>
      </Link>
      <Streamdown
        mode="static"
        className="prose prose-sm mt-4 line-clamp-2 max-w-none text-foreground/60"
      >
        {site.summary}
      </Streamdown>
      <div>
        <DeleteSiteDialog
          domain={site.domain}
          onConfirm={() => {
            fetcher.submit({ siteId: site.id }, { method: "DELETE" });
          }}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}
