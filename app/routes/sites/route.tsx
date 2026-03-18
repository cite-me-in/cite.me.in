import { invariant } from "es-toolkit";
import { useState } from "react";
import { Link, redirect, useFetcher } from "react-router";
import { Button } from "~/components/ui/Button";
import { Card, CardContent } from "~/components/ui/Card";
import Main from "~/components/ui/Main";
import { requireUser } from "~/lib/auth.server";
import generateSiteQueries from "~/lib/llm-visibility/generateSiteQueries";
import prisma from "~/lib/prisma.server";
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
  const [sites, account] = await Promise.all([
    loadSitesWithMetrics(user.id),
    prisma.account.findUnique({ where: { userId: user.id }, select: { status: true } }),
  ]);

  const trialEnd = new Date(user.createdAt);
  trialEnd.setDate(trialEnd.getDate() + 25);
  const trialExpired = !account && new Date() > trialEnd;

  return { sites, trialExpired };
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

export default function SitesPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { sites, trialExpired } = loaderData;
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

      {isAddSiteFormOpen && (
        <AddSiteForm actionData={actionData} fetcher={fetcher} />
      )}

      {trialExpired && (
        <div className="mb-6 rounded-base border-2 border-black bg-amber-100 p-4 shadow-[4px_4px_0px_0px_black]">
          <p className="font-bold mb-1">Your free trial has ended.</p>
          <p className="text-sm text-foreground/70 mb-3">
            Your daily runs have paused. Upgrade to keep your citation history
            and resume monitoring.
          </p>
          <Link
            to="/upgrade"
            className="inline-block rounded-base border-2 border-black bg-amber-400 px-4 py-2 font-bold text-sm shadow-[2px_2px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all"
          >
            Upgrade to Pro — $29/mo
          </Link>
        </div>
      )}

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
