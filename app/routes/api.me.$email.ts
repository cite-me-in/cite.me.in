import { sortBy } from "es-toolkit";
import { data } from "react-router";
import { verifyUserAccess } from "~/lib/api/apiAuth.server";
import { UserSchema } from "~/lib/api/schemas";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/api.me.$email";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { id } = await verifyUserAccess({ email: params.email, request });
  const user = await prisma.user.findUniqueOrThrow({
    where: { id },
    select: {
      email: true,
      ownedSites: { select: { domain: true, createdAt: true } },
      siteUsers: {
        select: { site: { select: { domain: true, createdAt: true } } },
      },
    },
  });
  const sites = sortBy(
    [
      ...user.ownedSites.map(({ domain, createdAt }) => ({
        domain,
        createdAt: createdAt.toISOString().split("T")[0],
      })),
      ...user.siteUsers.map(({ site }) => ({
        domain: site.domain,
        createdAt: site.createdAt.toISOString().split("T")[0],
      })),
    ],
    ["domain"],
  );

  return data(UserSchema.parse({ email: params.email, sites }));
}
