import { alphabetical } from "radashi";
import { ActiveLink } from "~/components/ui/ActiveLink";
import { Card, CardContent } from "~/components/ui/Card";
import Heading from "~/components/ui/Heading";
import Main from "~/components/ui/Main";
import { requireUserAccess } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/admin";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireUserAccess(request);
  if (!user.isAdmin) throw new Response("Not found", { status: 404 });
  const sites = await prisma.site.findMany({});
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
              <div key={site.id} className="pb-4">
                <ActiveLink
                  to={`/site/${site.domain}`}
                  className="font-bold text-2xl"
                >
                  {site.domain}
                </ActiveLink>
                <p className="text-foreground/60 italic">{site.summary}</p>
                <p className="text-foreground/60">
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
