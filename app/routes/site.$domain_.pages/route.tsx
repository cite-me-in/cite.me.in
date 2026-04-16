import { twMerge } from "tailwind-merge";
import { ActiveLink } from "~/components/ui/ActiveLink";
import { Badge } from "~/components/ui/Badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
import Main from "~/components/ui/Main";
import SiteHeading from "~/components/ui/SiteHeading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/Table";
import { requireSiteAccess } from "~/lib/auth.server";
import { isSameDomain } from "~/lib/isSameDomain";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/route";

export const handle = { siteNav: true };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Citing Pages — ${loaderData?.site.domain} | Cite.me.in` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { site } = await requireSiteAccess({ domain: params.domain, request });

  const pages = await prisma.citingPage.findMany({
    where: { siteId: site.id },
    orderBy: { citationCount: "desc" },
  });

  return { site, pages };
}

export default function SitePagesPage({ loaderData }: Route.ComponentProps) {
  const { site, pages } = loaderData;

  const healthyCount = pages.filter((p) => p.isHealthy).length;
  const brokenCount = pages.filter((p) => !p.isHealthy).length;

  return (
    <Main variant="wide">
      <SiteHeading site={site} title="Citing Pages" />

      <div className="flex items-start gap-2" />

      <Card>
        <CardHeader>
          <CardTitle>
            {pages.length > 0 && (
              <div className="flex gap-3">
                <Badge variant="green">{healthyCount} healthy</Badge>
                {brokenCount > 0 && (
                  <Badge variant="red">{brokenCount} broken</Badge>
                )}
              </div>
            )}
          </CardTitle>

          <CardDescription className="text-base text-foreground/60">
            <p>
              Citing pages are pages that cite your content according to LLMs.
              This list helps you understand what parts of your content is being
              surfaced by LLMs and presented to users. To reach a wider
              audience, these pages should be a priority for your SEO strategy.
            </p>
          </CardDescription>
        </CardHeader>

        <CardContent>
          {pages.length === 0 ? (
            <p className="flex items-center justify-center py-8 text-center text-foreground/60 text-lg">
              No citing pages yet — run a citation check to populate this list.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead>Citations</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last checked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((page) => (
                  <TableRow
                    key={page.id}
                    className={twMerge(
                      isSameDomain({ domain: site.domain, url: page.url }) &&
                        "bg-green-100 hover:bg-green-100/80",
                    )}
                  >
                    <TableCell
                      className="max-w-xs truncate font-mono"
                      title={page.url}
                    >
                      <PageUrl
                        direct={isSameDomain({
                          domain: site.domain,
                          url: page.url,
                        })}
                        url={page.url}
                      />
                    </TableCell>
                    <TableCell className="w-10 text-center">
                      {page.citationCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="w-10 text-center">
                      <StatusBadge page={page} />
                    </TableCell>
                    <TableCell className="w-10 text-center">
                      {page.lastCheckedAt
                        ? new Date(page.lastCheckedAt).toLocaleDateString()
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Main>
  );
}

function PageUrl({ url, direct }: { url: string; direct: boolean }) {
  try {
    const parsed = new URL(url);
    return (
      <ActiveLink
        to={url}
        target="_blank"
        rel="noopener noreferrer"
        className={twMerge(
          "hover:underline",
          direct && "font-semibold text-emerald-700 dark:text-emerald-400",
        )}
        title={url}
      >
        <span className="font-mono text-foreground/60 text-sm">
          {parsed.hostname}
        </span>
        <span className="font-mono text-sm">
          {parsed.pathname === "/" ? "" : parsed.pathname}
        </span>
      </ActiveLink>
    );
  } catch {
    return <span className="font-mono text-sm">{url}</span>;
  }
}

function StatusBadge({
  page,
}: {
  page: {
    isHealthy: boolean;
    statusCode: number | null;
    lastCheckedAt: Date | null;
  };
}) {
  if (!page.lastCheckedAt) return <Badge variant="neutral">pending</Badge>;
  if (page.isHealthy) return <Badge variant="green">healthy</Badge>;
  return (
    <Badge variant="red">
      {page.statusCode ? `broken (${page.statusCode})` : "broken"}
    </Badge>
  );
}
