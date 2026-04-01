import { Temporal } from "@js-temporal/polyfill";
import { alphabetical } from "radashi";
import { ActiveLink } from "~/components/ui/ActiveLink";
import { Card, CardContent } from "~/components/ui/Card";
import Heading from "~/components/ui/Heading";
import Main from "~/components/ui/Main";
import { requireUserAccess } from "~/lib/auth.server";
import calculateVisibilityScore from "~/lib/llm-visibility/calculateVisibilityScore";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/admin";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireUserAccess(request);
  if (!user.isAdmin) throw new Response("Not found", { status: 404 });
  const sites = await prisma.site.findMany({
    select: {
      id: true,
      domain: true,
      summary: true,
      createdAt: true,
      owner: { select: { email: true } },
      citationRuns: {
        select: {
          platform: true,
          onDate: true,
          queries: {
            select: {
              query: true,
              citations: true,
              text: true,
            },
            orderBy: { query: "asc" },
          },
        },
        orderBy: { onDate: "desc" },
        where: {
          onDate: {
            gte: Temporal.Now.plainDateISO("UTC")
              .subtract({ days: 14 })
              .toJSON(),
          },
        },
        distinct: ["platform"],
      },
    },
  });
  return { user, sites };
}

export default function Admin({ loaderData }: Route.ComponentProps) {
  return (
    <Main variant="wide">
      <Heading title="Admin" />

      <Card>
        <CardContent className="space-y-4 divide-y-2 divide-black/10">
          {alphabetical(loaderData.sites, ({ domain }) => domain).map(
            (site) => (
              <div key={site.id} className="space-y-2 pb-4">
                <div className="flex items-center justify-between">
                  <ActiveLink
                    to={`/site/${site.domain}`}
                    className="font-bold text-2xl"
                  >
                    {site.domain}
                  </ActiveLink>
                  <span className="text-foreground/40">{site.owner.email}</span>
                </div>
                <p className="text-foreground/60 italic">{site.summary}</p>
                <div className="flex flex-row justify-between gap-2">
                  {alphabetical(
                    site.citationRuns,
                    ({ platform }) => platform,
                  ).map((run) => (
                    <div key={run.platform}>
                      <div className="text-center font-bold text-2xl">
                        {calculateVisibilityScore({
                          domain: site.domain,
                          queries: run.queries,
                        }).visibilityScore.toLocaleString()}
                      </div>
                      <div className="text-center text-foreground/40">
                        {run.platform}
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-right text-foreground/40">
                  Created: {site.createdAt.toLocaleDateString()}
                </p>
              </div>
            ),
          )}
        </CardContent>
      </Card>
    </Main>
  );
}
