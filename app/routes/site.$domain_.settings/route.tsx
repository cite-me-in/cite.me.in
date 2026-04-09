import { redirect } from "react-router";
import Main from "~/components/ui/Main";
import SitePageHeader from "~/components/ui/SiteHeading";
import { requireSiteOwner, requireUserAccess } from "~/lib/auth.server";
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
  const { user } = await requireUserAccess(request);
  const site = await prisma.site.findFirst({
    where: {
      domain: params.domain,
      OR: [{ ownerId: user.id }, { siteUsers: { some: { userId: user.id } } }],
    },
    include: {
      owner: { select: { id: true, email: true } },
      siteUsers: { include: { user: { select: { id: true, email: true } } } },
      siteInvitations: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!site) throw new Response("Not found", { status: 404 });

  const isOwner = site.ownerId === user.id;
  return { site, isOwner };
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
  const { site, isOwner } = loaderData;

  return (
    <Main variant="wide">
      <SitePageHeader site={site} title="Settings" />

      <section className="space-y-8">
        <SiteContentButton
          content={loaderData.site?.content ?? ""}
          isOwner={isOwner}
          domain={site.domain}
        />
        <TrackingScript
          script={`<script async src="${import.meta.env.VITE_APP_URL}/pixel.js" crossorigin="anonymous" />`}
        />
        <MembersSection site={site} isOwner={isOwner} />
      </section>
    </Main>
  );
}
