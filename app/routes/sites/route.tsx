import { ExternalLinkIcon } from "lucide-react";
import { Link } from "react-router";
import { ActiveLink } from "~/components/ui/ActiveLink";
import { Button } from "~/components/ui/Button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
import { requireUser } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import { timeago } from "~/lib/relativeTime";
import type { Route } from "./+types/route";

export function meta(): Route.MetaDescriptors {
  return [{ title: "Your Sites | CiteUp" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const sites = await prisma.site.findMany({
    where: { accountId: user.accountId },
    orderBy: { createdAt: "desc" },
  });
  return { sites };
}

export default function SitesPage({ loaderData }: Route.ComponentProps) {
  const { sites } = loaderData;

  if (sites.length === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl space-y-6 px-6 py-12">
        <h1 className="font-heading text-3xl">Your Sites</h1>
        <div className="rounded-base border-2 border-black bg-secondary-background p-8 text-center shadow-shadow">
          <p className="mb-2 font-bold text-xl">No sites yet</p>
          <p className="mb-6 text-base text-foreground/60">
            Add your first site to start tracking when AI platforms cite you.
          </p>
          <ActiveLink variant="button" to="/sites/new" bg="yellow">
            Add your first site
          </ActiveLink>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-6 py-12">
      <div className="flex flex-row items-center justify-between gap-4">
        <h1 className="font-heading text-3xl">Your Sites</h1>
        <Button render={<Link to="/sites/new" />}>Add Site</Button>
      </div>
      <ul className="space-y-4">
        {sites.map((site) => (
          <li key={site.id}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between font-heading text-xl">
                  <span>{site.domain}</span>
                  <Link target="_blank" to={`https://${site.domain}`}>
                    <ExternalLinkIcon className="size-4" />
                  </Link>
                </CardTitle>
              </CardHeader>

              <CardContent>
                <ActiveLink
                  className="w-full max-w-xs"
                  size="lg"
                  to={`/site/${site.id}/citations`}
                  variant="button"
                >
                  View Site
                </ActiveLink>
              </CardContent>

              <CardFooter>Added {timeago(site.createdAt)}</CardFooter>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}
