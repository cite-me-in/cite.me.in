import { Link, type useFetcher } from "react-router";
import type { Site } from "~/prisma";
import DeleteSiteDialog from "./DeleteSiteDialog";
import type { action } from "./route";

export default function SiteEntry({
  fetcher,
  site,
  totalCitations,
  avgScore,
  totalBotVisits,
  uniqueBots,
}: {
  fetcher: ReturnType<typeof useFetcher<typeof action>>;
  site: Site;
  totalCitations: number;
  avgScore: number;
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
        <Link
          to={`/site/${site.id}/citations`}
          className="w-full font-bold font-mono text-lg"
        >
          {site.domain}
        </Link>
        <DeleteSiteDialog
          domain={site.domain}
          onConfirm={() => {
            fetcher.submit({ siteId: site.id }, { method: "DELETE" });
          }}
          isSubmitting={isSubmitting}
        />
      </p>
      <Link
        to={`/site/${site.id}/citations`}
        className="mt-4 grid grid-cols-4 gap-4 text-center"
      >
        <div>
          <p className="font-light">Citations</p>
          <p className="font-bold text-3xl">
            {totalCitations.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="font-light">Avg Score</p>
          <p className="font-bold text-3xl">
            {avgScore.toFixed(1).toLocaleString()}
          </p>
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
    </div>
  );
}
