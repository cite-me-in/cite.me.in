import { sortBy } from "es-toolkit";
import { data } from "react-router";
import { verifyUserAccess } from "~/lib/api/apiAuth.server";
import { UserSchema } from "~/lib/api/openapi";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/api.me";

export async function loader({ request }: Route.LoaderArgs) {
  const { id, email } = await verifyUserAccess(request);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id },
    select: {
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

  return data(UserSchema.parse({ email, sites }));
}
