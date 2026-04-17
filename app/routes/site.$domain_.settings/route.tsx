import { redirect } from "react-router";
import Main from "~/components/ui/Main";
import SitePageHeader from "~/components/ui/SiteHeading";
import { requireSiteAccess, requireSiteOwner } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import { deleteSite } from "~/lib/sites.server";
import type { Route } from "./+types/route";
import MembersSection from "./MembersSection";
import SiteContentButton from "./SiteContentButton";
import TrackingScript from "./TrackingScript";

export const handle = { siteNav: true };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Settings — ${loaderData?.site.domain} | Cite.me.in` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, site } = await requireSiteAccess({
    domain: params.domain,
    request,
  });
  const { content, apiKey } = await prisma.site.findUniqueOrThrow({
    where: { id: site.id },
    select: { content: true, apiKey: true },
  });
  const fullyLoaded = await prisma.site.findUniqueOrThrow({
    where: { id: site.id },
    select: {
      domain: true,
      owner: { select: { id: true, email: true } },
      siteUsers: { select: { user: { select: { id: true, email: true } } } },
      siteInvitations: { select: { id: true, email: true, createdAt: true } },
    },
  });
  const isOwner = fullyLoaded.owner.id === user.id;
  return { apiKey, content, isOwner, site: fullyLoaded };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { site, user } = await requireSiteOwner({
    domain: params.domain,
    request,
  });

  const formData = await request.formData();
  const intent = formData.get("intent")?.toString();

  if (intent === "remove-member") {
    const userId = formData.get("userId")?.toString();
    if (!userId) return { ok: false as const, error: "User ID required" };
    await prisma.siteUser.deleteMany({ where: { siteId: site.id, userId } });
    return { ok: true as const };
  }

  if (intent === "delete-site") {
    await deleteSite({ userId: user.id, siteId: site.id });
    throw redirect("/sites");
  }

  return { ok: false as const, error: "Unknown intent" };
}

export default function SiteSettingsPage({ loaderData }: Route.ComponentProps) {
  const { apiKey, content, site, isOwner } = loaderData;
  const trackingScript = `
<script defer crossorigin="anonymous"
        src="${import.meta.env.VITE_APP_URL}/pixel.js?key=${apiKey}" />`.trim();

  return (
    <Main variant="wide">
      <SitePageHeader site={site} title="Settings" />

      <section className="space-y-8">
        <SiteContentButton
          content={content}
          isOwner={isOwner}
          domain={site.domain}
        />
        <TrackingScript script={trackingScript} />
        <MembersSection site={site} isOwner={isOwner} />
      </section>
    </Main>
  );
}
