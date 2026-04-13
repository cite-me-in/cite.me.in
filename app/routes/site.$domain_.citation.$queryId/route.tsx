import { Streamdown } from "streamdown";
import { twMerge } from "tailwind-merge";
import { ActiveLink } from "~/components/ui/ActiveLink";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
import Main from "~/components/ui/Main";
import SitePageHeader from "~/components/ui/SiteHeading";
import { requireSiteAccess } from "~/lib/auth.server";
import externalLink from "~/lib/externalLink";
import { isSameDomain } from "~/lib/isSameDomain";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/route";

export const handle = { siteNav: true };

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: `Citations — ${loaderData?.site.domain} | Cite.me.in`,
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { site } = await requireSiteAccess({ domain: params.domain, request });

  const citation = await prisma.citationQuery.findFirst({
    where: {
      id: params.queryId,
      run: { siteId: site.id },
    },
    select: {
      citations: true,
      group: true,
      id: true,
      query: true,
      text: true,
      run: {
        select: {
          model: true,
          platform: true,
        },
      },
    },
  });

  if (!citation) throw new Response("Not found", { status: 404 });
  return { citation, site };
}

export default function SiteCitationsPage({
  loaderData,
}: Route.ComponentProps) {
  const { citation, site } = loaderData;
  const { platform, model } = citation.run;

  return (
    <Main variant="wide">
      <SitePageHeader
        site={site}
        title="Citations"
        backTo={{
          label: "All citations",
          path: `/site/${site.domain}/citations`,
        }}
      />

      <Card>
        <CardHeader>
          <CardDescription className="text-foreground/60 text-sm">
            {platform} · {model} · {citation.group}
          </CardDescription>
          <CardTitle className="block">Q: {citation.query}</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="block overflow-hidden text-base text-foreground/60">
            <tbody>
              {citation.citations.map((citation, index) => (
                <tr
                  key={index.toString()}
                  className={twMerge(
                    isSameDomain({ domain: site.domain, url: citation }) &&
                      "bg-green-100 hover:bg-green-100/80",
                  )}
                >
                  <td className="pr-2 text-right">{index + 1}.</td>
                  <td className="inline-block w-7/10 truncate font-mono">
                    <ActiveLink to={externalLink(citation)} target="_blank">
                      {citation}
                    </ActiveLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Response from {citation.run.model}</CardTitle>{" "}
        </CardHeader>
        <CardContent>
          <Streamdown
            mode="static"
            components={{
              a: ({ children, href }) => (
                <ActiveLink to={externalLink(href ?? "")} target="_blank">
                  {children}
                </ActiveLink>
              ),
            }}
          >
            {citation.text}
          </Streamdown>
        </CardContent>
      </Card>
    </Main>
  );
}
