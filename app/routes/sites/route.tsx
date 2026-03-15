import { invariant } from "es-toolkit";
import { useState } from "react";
import { redirect, useFetcher } from "react-router";
import { Button } from "~/components/ui/Button";
import { Card, CardContent } from "~/components/ui/Card";
import Main from "~/components/ui/Main";
import { requireUser } from "~/lib/auth.server";
import generateSiteQueries from "~/lib/llm-visibility/generateSiteQueries";
import logError from "~/lib/logError.server";
import {
  addSiteToUser,
  deleteSite,
  loadSitesWithMetrics,
} from "~/lib/sites.server";
import type { Route } from "./+types/route";
import AddSiteForm from "./AddSiteForm";
import SiteEntry from "./SiteEntry";

export function meta(): Route.MetaDescriptors {
  return [{ title: "Your Sites | Cite.me.in" }];
}

export const handle = { siteNav: true };

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const sites = await loadSitesWithMetrics(user.id);
  return { sites };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();

  switch (request.method) {
    case "POST": {
      // Add a new site to the account
      const url = formData.get("url")?.toString() ?? "";
      try {
        const { site, existing } = await addSiteToUser(user, url);
        if (existing) {
          return redirect(`/site/${site.domain}/citations`);
        } else {
          await generateSiteQueries(site);
          return redirect(`/site/${site.domain}/suggestions`);
        }
      } catch (error) {
        logError(error, { extra: { url } });
        return {
          error:
            error instanceof Error
              ? error.message
              : "An unknown error occurred while adding the site",
        };
      }
    }

    case "DELETE": {
      // Delete the site
      const siteId = formData.get("siteId")?.toString();
      invariant(siteId, "Site ID is required");
      await deleteSite({ userId: user.id, siteId });
      return { ok: true };
    }

    default:
      throw new Response("Method not allowed", { status: 405 });
  }
}

export default function SitesPage({ loaderData }: Route.ComponentProps) {
  const { sites } = loaderData;
  const [isAddSiteFormOpen, setIsAddSiteFormOpen] = useState(
    sites.length === 0,
  );
  const fetcher = useFetcher<typeof action>();

  return (
    <Main variant="wide">
      <div className="flex flex-row items-center justify-between gap-4">
        <h1 className="font-heading text-3xl">Your Sites</h1>
        {!isAddSiteFormOpen && (
          <Button onClick={() => setIsAddSiteFormOpen(true)}>Add Site</Button>
        )}
      </div>

      {isAddSiteFormOpen && <AddSiteForm fetcher={fetcher} />}

      {sites.length > 0 && (
        <Card>
          <CardContent className="space-y-4 divide-y-2 divide-black/10">
            {sites.map((item) => (
              <SiteEntry
                citationsToDmain={item.citationsToDomain}
                fetcher={fetcher}
                isOwner={item.isOwner}
                key={item.site.id}
                previousCitationsToDomain={item.previousCitationsToDomain}
                previousScore={item.previousScore}
                score={item.score}
                site={item.site}
                totalBotVisits={item.totalBotVisits}
                uniqueBots={item.uniqueBots}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </Main>
  );
}
