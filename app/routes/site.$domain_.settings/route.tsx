import { ClipboardCopyIcon, TrashIcon } from "lucide-react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/Button";
import Main from "~/components/ui/Main";
import SitePageHeader from "~/components/ui/SitePageHeader";
import { requireUser } from "~/lib/auth.server";
import envVars from "~/lib/envVars";
import prisma from "~/lib/prisma.server";
import { requireSiteOwner } from "~/lib/sites.server";
import type { Route } from "./+types/route";

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
        <ApiKeySection apiKey={site.apiKey} script={script} />
        <MembersSection site={site} isOwner={isOwner} />
        {isOwner && <InviteSection site={site} invitations={site.siteInvitations} />}
      </section>
    </Main>
  );
}

function ApiKeySection({ apiKey, script }: { apiKey: string; script: string }) {
  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="space-y-4 rounded-base border-2 border-black bg-white p-6 shadow-[4px_4px_0px_0px_black]">
      <h2 className="font-heading text-xl">API Key</h2>
      <p className="text-foreground/70 text-sm">
        Use this API key to authenticate bot visit tracking requests from your server.
      </p>

      <div className="flex items-center gap-3">
        <code className="flex-1 rounded-base border-2 border-black bg-[hsl(60,100%,99%)] px-4 py-2 font-mono text-sm">
          {apiKey}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => copyToClipboard(apiKey)}
          className="gap-2"
        >
          <ClipboardCopyIcon className="size-4" />
          Copy
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm">Tracking Script</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(script)}
            className="gap-2"
          >
            <ClipboardCopyIcon className="size-4" />
            Copy script
          </Button>
        </div>
        <pre className="overflow-x-auto rounded-base border-2 border-black bg-[hsl(60,100%,99%)] p-4 font-mono text-xs leading-relaxed">
          {script}
        </pre>
      </div>
    </div>
  );
}

function MembersSection({
  site,
  isOwner,
}: {
  site: {
    owner: { id: string; email: string };
    siteUsers: { user: { id: string; email: string } }[];
  };
  isOwner: boolean;
}) {
  const fetcher = useFetcher<typeof action>();

  return (
    <div className="space-y-4 rounded-base border-2 border-black bg-white p-6 shadow-[4px_4px_0px_0px_black]">
      <h2 className="font-heading text-xl">Members</h2>

      <ul className="divide-y-2 divide-black border-2 border-black">
        <li className="flex items-center justify-between px-4 py-3">
          <span className="font-mono text-sm">{site.owner.email}</span>
          <span className="rounded-base border-2 border-black bg-[#F59E0B] px-2 py-0.5 font-bold text-xs">
            Owner
          </span>
        </li>
        {site.siteUsers.map(({ user }) => (
          <li key={user.id} className="flex items-center justify-between px-4 py-3">
            <span className="font-mono text-sm">{user.email}</span>
            {isOwner && (
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="remove-member" />
                <input type="hidden" name="userId" value={user.id} />
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                >
                  <TrashIcon className="size-4" />
                  Remove
                </Button>
              </fetcher.Form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InviteSection({
  site,
  invitations,
}: {
  site: { domain: string };
  invitations: { id: string; email: string; createdAt: Date }[];
}) {
  const fetcher = useFetcher();

  return (
    <div className="space-y-4 rounded-base border-2 border-black bg-white p-6 shadow-[4px_4px_0px_0px_black]">
      <h2 className="font-heading text-xl">Invite Member</h2>

      <fetcher.Form method="post" action={`/site/${site.domain}/invite`} className="flex gap-3">
        <input
          type="email"
          name="email"
          placeholder="colleague@example.com"
          required
          className="flex-1 rounded-base border-2 border-black bg-white px-4 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
        />
        <Button type="submit" disabled={fetcher.state !== "idle"}>
          Send Invite
        </Button>
      </fetcher.Form>

      {invitations.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-bold text-sm">Pending Invitations</h3>
          <ul className="divide-y-2 divide-black border-2 border-black">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="flex items-center justify-between px-4 py-3">
                <span className="font-mono text-sm">{invitation.email}</span>
                <span className="text-foreground/60 text-xs">
                  {new Date(invitation.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
