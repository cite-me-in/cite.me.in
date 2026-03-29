import invariant from "tiny-invariant";
import { useState } from "react";
import { redirect, useFetcher } from "react-router";
import { Button } from "~/components/ui/Button";
import { Card, CardContent } from "~/components/ui/Card";
import Main from "~/components/ui/Main";
import { requireUserAccess } from "~/lib/auth.server";
import getSiteMetrics from "~/lib/getSiteMetrics.server";
import prisma from "~/lib/prisma.server";
import { createSite, deleteSite } from "~/lib/sites.server";
import type { Route } from "./+types/route";
import AddSiteForm from "./AddSiteForm";
import OfferSubscription from "./OfferSubscription";
import SiteEntry from "./SiteEntry";
import TrialExpired from "./TrialExpired";

export function meta(): Route.MetaDescriptors {
  return [{ title: "Your Sites | Cite.me.in" }];
}

export const handle = { siteNav: true };

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireUserAccess(request);
  const [sites, account] = await Promise.all([
    getSiteMetrics({ userId: user.id }),
    prisma.account.findUnique({
      where: { userId: user.id },
      select: { status: true },
    }),
  ]);

  // isPro is true if the user has an active account
  // ownedSiteCount is the number of sites the user owns
  // canAddSite is true if the user can add a site (5 if pro, 1 if not)
  const isPro = account?.status === "active";
  const ownedSiteCount = sites.filter((s) => s.site.ownerId === user.id).length;
  const canAddSite = user.isAdmin || (ownedSiteCount < (isPro ? 5 : 1));

  // trialExpired is true if the user's trial has ended (isPro is false)
  const trialEnd = new Date(user.createdAt);
  trialEnd.setDate(trialEnd.getDate() + 25);
  const trialExpired = !account && new Date() > trialEnd;

  return { sites, trialExpired, canAddSite, isPro };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireUserAccess(request);
  const formData = await request.formData();

  switch (request.method) {
    case "POST": {
      // Add a new site to the account
      const url = formData.get("url")?.toString() ?? "";
      try {
        const { site, existing } = await createSite(user, url);
        if (existing) return redirect(`/site/${site.domain}/citations`);
        return redirect(`/site/${site.domain}/setup`);
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
  const { sites, trialExpired, canAddSite, isPro } = loaderData;
  const [isAddSiteFormOpen, setIsAddSiteFormOpen] = useState(
    sites.length === 0 && canAddSite,
  );
  const fetcher = useFetcher<typeof action>();

  return (
    <Main variant="wide">
      <div className="flex flex-row items-center justify-between gap-4">
        <h1 className="font-heading text-3xl">Your Sites</h1>
        {canAddSite && !isAddSiteFormOpen && (
          <Button onClick={() => setIsAddSiteFormOpen(true)}>Add Site</Button>
        )}
      </div>

      {trialExpired ? (
        <TrialExpired />
      ) : (
        isAddSiteFormOpen && (
          <AddSiteForm actionData={actionData} fetcher={fetcher} />
        )
      )}

      {sites.length > 0 && (
        <Card>
          <CardContent className="space-y-4 divide-y-2 divide-black/10">
            {sites.map((item) => (
              <SiteEntry
                fetcher={fetcher}
                key={item.site.id}
                visibilityScore={item.visbilityScore}
                site={item.site}
                botVisits={item.botVisits}
                allCitations={item.allCitations}
                yourCitations={item.yourCitations}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {!isPro && <OfferSubscription />}
    </Main>
  );
}
