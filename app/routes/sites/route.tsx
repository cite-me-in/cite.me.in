import { useState } from "react";
import { redirect, useFetcher } from "react-router";
import { Button } from "~/components/ui/Button";
import { Card, CardContent } from "~/components/ui/Card";
import Heading from "~/components/ui/Heading";
import Main from "~/components/ui/Main";
import { requireUserAccess } from "~/lib/auth.server";
import getSiteMetrics from "~/lib/getSiteMetrics.server";
import prisma from "~/lib/prisma.server";
import { createSite, extractDomain } from "~/lib/sites.server";
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
  const canAddSite = user.isAdmin || ownedSiteCount < (isPro ? 5 : 1);

  // trialExpired is true if the user's trial has ended (isPro is false)
  const trialEnd = new Date(user.createdAt);
  trialEnd.setDate(trialEnd.getDate() + 25);
  const trialExpired = !account && new Date() > trialEnd;

  return { sites, trialExpired, canAddSite, isPro };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireUserAccess(request);
  const formData = await request.formData();
  if (request.method !== "POST")
    throw new Response("Method not allowed", { status: 405 });

  // Add a new site to the account
  const url = formData.get("url")?.toString() ?? "";
  try {
    const domain = extractDomain(url);
    if (!domain) throw new Error("Enter a valid website URL or domain name");

    const existing = await prisma.site.findFirst({
      where: {
        domain,
        OR: [
          { ownerId: user.id },
          { siteUsers: { some: { userId: user.id } } },
        ],
      },
    });
    if (existing) return redirect(`/site/${domain}/citations`);

    const site = await createSite({ user, domain });
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
      <Heading title="Your Sites">
        {canAddSite && !isAddSiteFormOpen && (
          <Button onClick={() => setIsAddSiteFormOpen(true)}>Add Site</Button>
        )}
      </Heading>

      {canAddSite
        ? isAddSiteFormOpen && (
            <AddSiteForm actionData={actionData} fetcher={fetcher} />
          )
        : trialExpired && <TrialExpired />}

      {sites.length > 0 && (
        <Card>
          <CardContent className="space-y-4 divide-y-2 divide-black/10">
            {sites.map((item) => (
              <SiteEntry
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
