import Main from "~/components/ui/Main";
import SitePageHeader from "~/components/ui/SitePageHeader";
import { requireUser } from "~/lib/auth.server";
import envVars from "~/lib/envVars";
import prisma from "~/lib/prisma.server";
import { requireSiteOwner } from "~/lib/sites.server";
import type { Route } from "./+types/route";
import ApiKeySection from "./ApiKeySection";
import MembersSection from "./MembersSection";
import SiteContent from "./SiteContent";

export const handle = { siteNav: true };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Settings — ${loaderData?.site.domain} | Cite.me.in` }];
}

function buildScript(apiKey: string, endpoint: string) {
  return `// Use this where you're handling HTTP requests:
function requestHandler(request) {
  // fire-and-forget, production only
  if (import.meta.env.PROD) trackBotVisit(request);
  …
}

function trackBotVisit(request: Request) {
  const apiKey = "${apiKey}";
  const endpoint = "${endpoint}";
  fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: \`Bearer \${apiKey}\`,
    },
    body: JSON.stringify({
      accept: request.headers.get("accept"),
      ip: request.headers.get("x-forwarded-for"),
      referer: request.headers.get("referer"),
      url: request.url.toString(),
      userAgent: request.headers.get("user-agent"),
    }),
  }).catch(() => {});
}`.trim();
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
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
  const script = buildScript(site.apiKey, envVars.BOT_TRACKER_URL);
  return { site, isOwner, script };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  const site = await requireSiteOwner(params.domain, user.id);

  const formData = await request.formData();
  const intent = formData.get("intent")?.toString();

  if (intent === "remove-member") {
    const userId = formData.get("userId")?.toString();
    if (!userId) return { ok: false as const, error: "User ID required" };
    await prisma.siteUser.deleteMany({ where: { siteId: site.id, userId } });
    return { ok: true as const };
  }

  return { ok: false as const, error: "Unknown intent" };
}

export default function SiteSettingsPage({ loaderData }: Route.ComponentProps) {
  const { site, isOwner, script } = loaderData;

  return (
    <Main variant="wide">
      <SitePageHeader site={site} title="Settings" />

      <section className="space-y-8">
        <SiteContent content={loaderData.site?.content ?? ""} />
        <ApiKeySection apiKey={site.apiKey} script={script} />
        <MembersSection site={site} isOwner={isOwner} />
      </section>
    </Main>
  );
}
