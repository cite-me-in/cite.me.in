import type { Route } from "./+types/api.me";
import { verifyUserAccess } from "~/lib/api/apiAuth.server";
import { alphabetical } from "radashi";
import { UserSchema } from "~/lib/api/openapi";
import { data } from "react-router";
import prisma from "~/lib/prisma.server";

export async function loader({ request }: Route.LoaderArgs) {
  const { id, email } = await verifyUserAccess(request);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      email: true,
      ownedSites: { select: { domain: true, createdAt: true } },
      siteUsers: {
        select: { site: { select: { domain: true, createdAt: true } } },
      },
    },
  });
  const sites = alphabetical(
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
    ({ domain }) => domain,
  );

  return data(UserSchema.parse({ id, email, sites }));
}
