import { data } from "react-router";
import { verifySiteAccess } from "~/lib/api/apiAuth.server";
import { SiteSchema } from "~/lib/api/schemas";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/api.sites.$domain";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { id } = await verifySiteAccess({ domain: params.domain, request });
  const site = await prisma.site.findUniqueOrThrow({
    where: { id },
    select: {
      domain: true,
      summary: true,
      content: true,
      createdAt: true,
      owner: { select: { id: true, email: true } },
      siteUsers: { select: { user: { select: { id: true, email: true } } } },
    },
  });

  return data(
    SiteSchema.parse({
      domain: site.domain,
      summary: site.summary,
      content: site.content,
      createdAt: site.createdAt.toISOString().split("T")[0],
      users: [
        {
          id: site.owner.id,
          email: site.owner.email,
          role: "owner" as const,
        },
        ...site.siteUsers.map(({ user }) => ({
          id: user.id,
          email: user.email,
          role: "member" as const,
        })),
      ],
    }),
  );
}
