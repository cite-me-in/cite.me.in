import { invariant } from "node_modules/es-toolkit/dist/util/invariant.mjs";
import { useState } from "react";
import { redirect, useFetcher } from "react-router";
import { Button } from "~/components/ui/Button";
import { Card, CardContent } from "~/components/ui/Card";
import Main from "~/components/ui/Main";
import { requireUser } from "~/lib/auth.server";
import captureException from "~/lib/captureException.server";
import generateSiteQueries from "~/lib/llm-visibility/generateSiteQueries";
import {
  addSiteToAccount,
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
  const sites = await loadSitesWithMetrics(user.accountId);
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
        const { site, existing } = await addSiteToAccount(user.account, url);
        if (existing) {
          return redirect(`/site/${site.id}/citations`);
        } else {
          await generateSiteQueries(site);
          return redirect(`/site/${site.id}/suggestions`);
        }
      } catch (error) {
        captureException(error, { extra: { url } });
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
      await deleteSite({ accountId: user.accountId, siteId });
      return { ok: true };
    }
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
                key={item.site.id}
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
