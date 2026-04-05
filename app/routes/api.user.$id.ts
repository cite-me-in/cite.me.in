import type { Route } from "./+types/api.user.$id";
import { verifyUserAccess } from "~/lib/api/apiAuth.server";
import { UserSchema } from "~/lib/api/openapi";
import { data } from "react-router";
import prisma from "~/lib/prisma.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { id, isAdmin } = await verifyUserAccess(request);
  if (!isAdmin && id !== params.id)
    throw new Response("Forbidden", { status: 403 });

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: params.id },
    select: {
      id: true,
      email: true,
      ownedSites: {
        select: {
          summary: true,
          domain: true,
          createdAt: true,
        },
      },
      siteUsers: {
        select: {
          site: {
            select: {
              summary: true,
              domain: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });
  const sites = [...user.ownedSites, ...user.siteUsers.map(({ site }) => site)];

  return data(
    UserSchema.parse({
      id: user.id,
      email: user.email,
      sites: sites.map(({ summary, domain, createdAt }) => ({
        createdAt: createdAt.toISOString().split("T")[0],
        domain,
        summary,
      })),
    }),
  );
}
