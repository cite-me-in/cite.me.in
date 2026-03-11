import { Streamdown } from "streamdown";
import { twMerge } from "tailwind-merge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
import Main from "~/components/ui/Main";
import SitePageHeader from "~/components/ui/SitePageHeader";
import { requireUser } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/route";

export const handle = { siteNav: true };

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: `Citations — ${loaderData?.citation.run.site.domain} | Cite.me.in`,
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request);
  const citation = await prisma.citationQuery.findFirst({
    where: { id: params.citeId, run: { siteId: params.id } },
    include: { run: { include: { site: true } } },
  });
  if (!citation) throw new Response("Not found", { status: 404 });
  return { citation };
}

export default function SiteCitationsPage({
  loaderData,
}: Route.ComponentProps) {
  const { citation } = loaderData;
  const { site, platform, model } = citation.run;

  return (
    <Main variant="wide">
      <SitePageHeader
        site={site}
        title="Citations"
        backTo={{ label: "All citations", path: `/site/${site.id}/citations` }}
      />

      <Card>
        <CardHeader>
          <CardDescription className="text-foreground/60 text-sm">
            {platform} · {model} · {citation.group}
          </CardDescription>
          <CardTitle>Q: {citation.query}</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="block overflow-hidden text-base text-foreground/60">
            <tbody>
              {citation.citations.map((citation, index) => (
                <tr
                  key={index.toString()}
                  className={twMerge(
                    new URL(citation).hostname === site.domain &&
                      "bg-green-100 hover:bg-green-100/80",
                  )}
                >
                  <td className="pr-2 text-right">{index + 1}.</td>
                  <td className="inline-block w-7/10 truncate font-mono">
                    {citation}
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
          <Streamdown mode="static">{citation.text}</Streamdown>
        </CardContent>
      </Card>
    </Main>
  );
}
