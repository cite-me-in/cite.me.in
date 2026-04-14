import { requireSiteAccess } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import Main from "~/components/ui/Main";
import SiteHeading from "~/components/ui/SiteHeading";
import { Badge } from "~/components/ui/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/Table";
import type { Route } from "./+types/route";

export const handle = { siteNav: true };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Cited Pages — ${loaderData?.site.domain} | Cite.me.in` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { site } = await requireSiteAccess({ domain: params.domain, request });

  const pages = await prisma.citedPage.findMany({
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
      <SiteHeading site={site} title="Cited Pages" />

      {pages.length > 0 && (
        <div className="flex gap-3">
          <Badge variant="green">{healthyCount} healthy</Badge>
          {brokenCount > 0 && (
            <Badge variant="red">{brokenCount} broken</Badge>
          )}
        </div>
      )}

      {pages.length === 0 ? (
        <p className="flex items-center justify-center py-8 text-center text-foreground/60 text-lg">
          No cited pages yet — run a citation check to populate this list.
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
              <TableRow key={page.id}>
                <TableCell>
                  <PageUrl url={page.url} />
                </TableCell>
                <TableCell>{page.citationCount}</TableCell>
                <TableCell>
                  <StatusBadge page={page} />
                </TableCell>
                <TableCell>
                  {page.lastCheckedAt
                    ? new Date(page.lastCheckedAt).toLocaleDateString()
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Main>
  );
}

function PageUrl({ url }: { url: string }) {
  try {
    const parsed = new URL(url);
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline"
        title={url}
      >
        <span className="font-mono text-foreground/60 text-sm">
          {parsed.hostname}
        </span>
        <span className="ml-1 font-mono text-sm">
          {parsed.pathname === "/" ? "" : parsed.pathname}
        </span>
      </a>
    );
  } catch {
    return <span className="font-mono text-sm">{url}</span>;
  }
}

function StatusBadge({
  page,
}: {
  page: { isHealthy: boolean; statusCode: number | null; lastCheckedAt: Date | null };
}) {
  if (!page.lastCheckedAt) return <Badge variant="neutral">pending</Badge>;
  if (page.isHealthy) return <Badge variant="green">healthy</Badge>;
  return (
    <Badge variant="red">
      {page.statusCode ? `broken (${page.statusCode})` : "broken"}
    </Badge>
  );
}
